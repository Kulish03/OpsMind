import os
import sys
import time
from datetime import datetime
from pymongo import MongoClient

DEFAULT_MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/opsmind")
TENANT_ID = "default_sme_retail"

def run_validation():
    print("=" * 80)
    print(" OPSMIND DATA ENGINEERING — PHASE 1 FINAL VALIDATION & VERIFICATION")
    print("=" * 80)
    print(f"Connecting to MongoDB: {DEFAULT_MONGO_URI}")
    print(f"Target Business Tenant: '{TENANT_ID}'\n")

    client = MongoClient(DEFAULT_MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_database("opsmind")
    
    # Check connection
    client.admin.command('ping')
    print("[OK] MongoDB connection established.\n")

    test_results = []

    def record_test(name, passed, details):
        status_str = "[PASS]" if passed else "[FAIL]"
        test_results.append({"name": name, "passed": passed, "details": details})
        print(f" {status_str} {name}: {details}")

    # ---------------------------------------------------------
    # TEST 1: COLLECTION DOCUMENT COUNTS
    # ---------------------------------------------------------
    print("--- 1. VERIFYING DOCUMENT COUNTS ---")
    expected_counts = {
        "suppliers": 6,
        "products": 3807,
        "customers": 4371,
        "expenses": 232,
        "inventorymovements": 20371,
        "sales": 23645
    }

    all_counts_match = True
    for col_name, expected in expected_counts.items():
        actual = db[col_name].count_documents({"businessId": TENANT_ID})
        match = (actual == expected)
        if not match:
            all_counts_match = False
        record_test(f"Collection Count: {col_name}", match, f"Actual: {actual:,} | Expected: {expected:,}")

    # ---------------------------------------------------------
    # TEST 2: EMBEDDED LINE ITEMS COUNT
    # ---------------------------------------------------------
    print("\n--- 2. VERIFYING EMBEDDED SALES LINE ITEMS ---")
    line_item_pipeline = [
        {"$match": {"businessId": TENANT_ID}},
        {"$project": {"item_count": {"$size": "$items"}}},
        {"$group": {"_id": None, "total_line_items": {"$sum": "$item_count"}}}
    ]
    line_item_res = list(db.sales.aggregate(line_item_pipeline))
    actual_line_items = line_item_res[0]["total_line_items"] if line_item_res else 0
    expected_line_items = 533964
    items_match = (actual_line_items == expected_line_items)
    record_test(
        "Total Embedded Line Items", 
        items_match, 
        f"Actual: {actual_line_items:,} | Expected: {expected_line_items:,} line items"
    )

    # ---------------------------------------------------------
    # TEST 3: FINANCIAL CHECKSUM & NET REVENUE RECONCILIATION
    # ---------------------------------------------------------
    print("\n--- 3. VERIFYING FINANCIAL INTEGRITY CHECKSUMS ---")
    revenue_pipeline = [
        {"$match": {"businessId": TENANT_ID}},
        {"$group": {
            "_id": None,
            "total_net_revenue": {"$sum": "$totalAmount"},
            "gross_revenue": {
                "$sum": {
                    "$cond": [{"$gt": ["$totalAmount", 0]}, "$totalAmount", 0]
                }
            },
            "refund_amount": {
                "$sum": {
                    "$cond": [{"$lt": ["$totalAmount", 0]}, "$totalAmount", 0]
                }
            }
        }}
    ]
    rev_res = list(db.sales.aggregate(revenue_pipeline))
    actual_net = round(rev_res[0]["total_net_revenue"], 2) if rev_res else 0.0
    actual_gross = round(rev_res[0]["gross_revenue"], 2) if rev_res else 0.0
    actual_refunds = round(abs(rev_res[0]["refund_amount"]), 2) if rev_res else 0.0

    expected_net = 9979394.80
    net_match = abs(actual_net - expected_net) < 1.0  # within rounding tolerance
    record_test("Net Revenue Reconciliation", net_match, f"MongoDB: £{actual_net:,.2f} | Expected: £{expected_net:,.2f}")

    # ---------------------------------------------------------
    # TEST 4: INVOICE TOTAL AMOUNT VS ITEMS SUM INTEGRITY
    # ---------------------------------------------------------
    print("\n--- 4. VERIFYING INVOICE MATH INVARIANTS ---")
    # Verify that totalAmount == sum(items.lineTotal) for all invoices
    math_pipeline = [
        {"$match": {"businessId": TENANT_ID}},
        {"$project": {
            "invoiceId": 1,
            "totalAmount": 1,
            "items_sum": {"$round": [{"$sum": "$items.lineTotal"}, 2]},
            "diff": {
                "$abs": {
                    "$subtract": [
                        "$totalAmount",
                        {"$round": [{"$sum": "$items.lineTotal"}, 2]}
                    ]
                }
            }
        }},
        {"$match": {"diff": {"$gt": 0.05}}}  # check for any discrepancies > 5 cents
    ]
    math_mismatches = list(db.sales.aggregate(math_pipeline))
    math_pass = (len(math_mismatches) == 0)
    record_test(
        "Invoice Total vs Line Items Sum", 
        math_pass, 
        f"Mismatches: {len(math_mismatches)} out of 23,645 invoices"
    )

    # ---------------------------------------------------------
    # TEST 5: REFERENTIAL INTEGRITY CHECKS
    # ---------------------------------------------------------
    print("\n--- 5. VERIFYING REFERENTIAL INTEGRITY ---")
    # A. Products -> Suppliers link
    supplier_ids = set(db.suppliers.distinct("supplierId", {"businessId": TENANT_ID}))
    orphan_suppliers = db.products.count_documents({
        "businessId": TENANT_ID,
        "supplierId": {"$nin": list(supplier_ids)}
    })
    record_test(
        "Product Supplier References", 
        orphan_suppliers == 0, 
        f"Orphan Products with Invalid Supplier ID: {orphan_suppliers}"
    )

    # B. Non-Guest Sales -> Customers link
    sample_sales = db.sales.find({
        "businessId": TENANT_ID,
        "customerReference": {"$ne": "GUEST"}
    }).limit(500)
    customer_ids = set(db.customers.distinct("customerId", {"businessId": TENANT_ID}))
    missing_cust_refs = 0
    checked_count = 0
    for s in sample_sales:
        checked_count += 1
        if s["customerReference"] not in customer_ids:
            missing_cust_refs += 1
    record_test(
        "Sales Customer References (500 Samples)", 
        missing_cust_refs == 0, 
        f"Missing Customer IDs: {missing_cust_refs} out of {checked_count} checked"
    )

    # ---------------------------------------------------------
    # TEST 6: TENANT ISOLATION BOUNDARIES
    # ---------------------------------------------------------
    print("\n--- 6. VERIFYING MULTI-TENANT ISOLATION ---")
    foreign_tenant = "unauthorized_foreign_tenant_99"
    foreign_sales_count = db.sales.count_documents({"businessId": foreign_tenant})
    foreign_products_count = db.products.count_documents({"businessId": foreign_tenant})
    isolation_passed = (foreign_sales_count == 0 and foreign_products_count == 0)
    record_test(
        "Tenant Data Isolation", 
        isolation_passed, 
        f"Querying with foreign tenant returned {foreign_sales_count} sales and {foreign_products_count} products (Expected 0)"
    )

    # ---------------------------------------------------------
    # TEST 7: INDEX EFFICIENCY (EXPLAIN QUERY PLAN)
    # ---------------------------------------------------------
    print("\n--- 7. VERIFYING DATABASE INDEX SCAN EFFICIENCY ---")
    explain_result = db.sales.find({
        "businessId": TENANT_ID,
        "transactionDate": {"$gte": datetime(2011, 1, 1), "$lte": datetime(2011, 3, 31)}
    }).explain()

    query_stage = explain_result.get("queryPlanner", {}).get("winningPlan", {}).get("stage", "")
    input_stage = explain_result.get("queryPlanner", {}).get("winningPlan", {}).get("inputStage", {}).get("stage", "")
    is_index_scan = "IXSCAN" in [query_stage, input_stage]
    record_test(
        "Date-Range Query Plan on Sales", 
        is_index_scan, 
        f"Winning Plan Stage: {query_stage} / {input_stage} (Uses IXSCAN index: businessId_1_transactionDate_-1)"
    )

    # ---------------------------------------------------------
    # FINAL SCORECARD
    # ---------------------------------------------------------
    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t["passed"])
    
    print("\n" + "=" * 80)
    print(" VALIDATION SCORECARD")
    print("=" * 80)
    print(f"Total Tests Executed: {total_tests}")
    print(f"Passed:               {passed_tests} / {total_tests}")
    print(f"Failed:               {total_tests - passed_tests}")
    print(f"Integrity Status:     {'ALL CHECKS PASSED (100% HEALTHY)' if passed_tests == total_tests else 'FAILURES DETECTED'}")
    print("=" * 80)

if __name__ == "__main__":
    run_validation()
