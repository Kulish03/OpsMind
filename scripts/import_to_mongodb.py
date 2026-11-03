import os
import sys
import time
import argparse
import pandas as pd
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING, DESCENDING

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
SYNTHETIC_DIR = os.path.join(BASE_DIR, "data", "synthetic")

DEFAULT_TENANT = "default_sme_retail"
DEFAULT_MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/opsmind")

def import_data(mongo_uri=DEFAULT_MONGO_URI, tenant_id=DEFAULT_TENANT, drop_existing=True):
    start_time = time.time()
    print("=" * 80)
    print(" OPSMIND DATA ENGINEERING — REPEATABLE MONGODB IMPORT SCRIPT")
    print("=" * 80)
    print(f"Connecting to MongoDB: {mongo_uri}")
    print(f"Target Business Tenant ID: '{tenant_id}'")

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("opsmind")

    # Verify connection
    client.admin.command('ping')
    print("[OK] MongoDB connection verified.\n")

    if drop_existing:
        print("--- 1. Resetting Collections for Tenant ---")
        for col in ["suppliers", "products", "customers", "expenses", "inventorymovements", "sales"]:
            del_result = db[col].delete_many({"businessId": tenant_id})
            print(f"  • Cleared {del_result.deleted_count:,} existing records in '{col}'")

    # ---------------------------------------------------------
    # 2. IMPORT SUPPLIERS
    # ---------------------------------------------------------
    print("\n--- 2. Importing Suppliers ---")
    sup_path = os.path.join(SYNTHETIC_DIR, "synthetic_suppliers.csv")
    sup_df = pd.read_csv(sup_path)
    sup_records = []
    for _, row in sup_df.iterrows():
        sup_records.append({
            "businessId": tenant_id,
            "supplierId": str(row['supplierId']),
            "name": str(row['name']),
            "category": str(row['category']),
            "contactPerson": str(row['contactPerson']),
            "email": str(row['email']),
            "phone": str(row['phone']),
            "city": str(row['city']),
            "country": str(row['country']),
            "leadTimeDays": int(row['leadTimeDays']),
            "minimumOrderQty": int(row['minimumOrderQty']),
            "source": str(row['source']),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    if sup_records:
        db.suppliers.insert_many(sup_records)
        db.suppliers.create_index([("businessId", ASCENDING), ("supplierId", ASCENDING)], unique=True)
    print(f"[OK] Successfully imported {len(sup_records)} suppliers.")

    # ---------------------------------------------------------
    # 3. IMPORT PRODUCTS
    # ---------------------------------------------------------
    print("\n--- 3. Importing Products Catalog ---")
    prod_path = os.path.join(SYNTHETIC_DIR, "products_enriched.csv")
    prod_df = pd.read_csv(prod_path)
    prod_records = []
    for _, row in prod_df.iterrows():
        prod_records.append({
            "businessId": tenant_id,
            "sku": str(row['StockCode']).strip().upper(),
            "name": str(row['name']),
            "category": str(row['category']),
            "sellingPrice": float(row['modal_selling_price']),
            "costPrice": float(row['costPrice']),
            "currentStock": int(row['currentStock']),
            "reorderThreshold": int(row['reorderThreshold']),
            "targetStock": int(row['targetStock']),
            "supplierId": str(row['supplierId']),
            "isActive": True,
            "source": str(row.get('source', 'uci_retail')),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    if prod_records:
        db.products.insert_many(prod_records, ordered=False)
        db.products.create_index([("businessId", ASCENDING), ("sku", ASCENDING)], unique=True)
        db.products.create_index([("businessId", ASCENDING), ("currentStock", ASCENDING)])
        db.products.create_index([("businessId", ASCENDING), ("category", ASCENDING)])
    print(f"[OK] Successfully imported {len(prod_records):,} products.")

    # ---------------------------------------------------------
    # 4. IMPORT CUSTOMERS
    # ---------------------------------------------------------
    print("\n--- 4. Importing Customer Master ---")
    cust_path = os.path.join(PROCESSED_DIR, "unique_customers.csv")
    cust_df = pd.read_csv(cust_path)
    cust_records = []
    for _, row in cust_df.iterrows():
        # Derive retention status based on recency
        last_dt = pd.to_datetime(row['last_purchase_date'], utc=True)
        recency_days = (datetime(2011, 12, 10, tzinfo=timezone.utc) - last_dt).days
        if recency_days > 180:
            status = "CHURNED"
        elif recency_days > 90:
            status = "AT_RISK"
        elif recency_days > 30:
            status = "DORMANT"
        else:
            status = "ACTIVE"

        cust_records.append({
            "businessId": tenant_id,
            "customerId": str(row['CustomerIDClean']),
            "name": f"Customer {row['CustomerIDClean']}",
            "country": str(row['country']),
            "firstPurchaseDate": pd.to_datetime(row['first_purchase_date'], utc=True).to_pydatetime(),
            "lastPurchaseDate": last_dt.to_pydatetime(),
            "totalOrders": int(row['total_transactions']),
            "totalUnitsPurchased": int(row['total_units_purchased']),
            "totalSpend": float(row['total_spend']),
            "rfm": {
                "recencyDays": int(recency_days),
                "frequency": int(row['total_transactions']),
                "monetary": float(row['total_spend']),
                "retentionStatus": status
            },
            "source": "uci_retail",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    if cust_records:
        db.customers.insert_many(cust_records, ordered=False)
        db.customers.create_index([("businessId", ASCENDING), ("customerId", ASCENDING)], unique=True)
        db.customers.create_index([("businessId", ASCENDING), ("rfm.retentionStatus", ASCENDING)])
        db.customers.create_index([("businessId", ASCENDING), ("totalSpend", DESCENDING)])
    print(f"[OK] Successfully imported {len(cust_records):,} customers.")

    # ---------------------------------------------------------
    # 5. IMPORT EXPENSES
    # ---------------------------------------------------------
    print("\n--- 5. Importing Operating Expenses ---")
    exp_path = os.path.join(SYNTHETIC_DIR, "synthetic_expenses.csv")
    exp_df = pd.read_csv(exp_path)
    exp_records = []
    for _, row in exp_df.iterrows():
        exp_records.append({
            "businessId": tenant_id,
            "expenseId": str(row['expenseId']),
            "category": str(row['category']),
            "amount": float(row['amount']),
            "date": pd.to_datetime(row['date'], utc=True).to_pydatetime(),
            "description": str(row['description']),
            "paymentMethod": str(row['paymentMethod']),
            "source": str(row['source']),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    if exp_records:
        db.expenses.insert_many(exp_records, ordered=False)
        db.expenses.create_index([("businessId", ASCENDING), ("expenseId", ASCENDING)], unique=True)
        db.expenses.create_index([("businessId", ASCENDING), ("date", DESCENDING)])
        db.expenses.create_index([("businessId", ASCENDING), ("category", ASCENDING)])
    print(f"[OK] Successfully imported {len(exp_records):,} operating expenses.")

    # ---------------------------------------------------------
    # 6. IMPORT INVENTORY MOVEMENTS LEDGER
    # ---------------------------------------------------------
    print("\n--- 6. Importing Inventory Movements Ledger ---")
    mov_path = os.path.join(SYNTHETIC_DIR, "synthetic_inventory_movements.csv")
    mov_df = pd.read_csv(mov_path)
    mov_records = []
    for _, row in mov_df.iterrows():
        mov_records.append({
            "businessId": tenant_id,
            "movementId": str(row['movementId']),
            "productSku": str(row['productSku']).strip().upper(),
            "movementType": str(row['movementType']),
            "quantity": int(row['quantity']),
            "timestamp": pd.to_datetime(row['timestamp'], utc=True).to_pydatetime(),
            "source": str(row['source']),
            "referenceId": str(row['referenceId']) if pd.notna(row['referenceId']) else None,
            "unitCost": float(row['unitCost']) if pd.notna(row['unitCost']) else 0.0,
            "reason": str(row['reason']) if pd.notna(row['reason']) else None,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    if mov_records:
        # Batch insert in chunks of 5000
        batch_size = 5000
        for i in range(0, len(mov_records), batch_size):
            db.inventorymovements.insert_many(mov_records[i:i+batch_size], ordered=False)
        db.inventorymovements.create_index([("businessId", ASCENDING), ("movementId", ASCENDING)], unique=True)
        db.inventorymovements.create_index([("businessId", ASCENDING), ("productSku", ASCENDING), ("timestamp", DESCENDING)])
        db.inventorymovements.create_index([("businessId", ASCENDING), ("movementType", ASCENDING)])
    print(f"[OK] Successfully imported {len(mov_records):,} inventory movement ledger events.")

    # ---------------------------------------------------------
    # 7. IMPORT SALES (INVOICE-CENTRIC EMBEDDED PATTERN)
    # ---------------------------------------------------------
    print("\n--- 7. Aggregating & Importing Sales Invoices ---")
    sales_path = os.path.join(PROCESSED_DIR, "cleaned_sales.csv")
    print(f"Reading {sales_path}...")
    sales_df = pd.read_csv(sales_path)
    sales_df['InvoiceDate'] = pd.to_datetime(sales_df['InvoiceDate'], utc=True)

    print(f"Grouping {len(sales_df):,} line items into complete invoice documents...")
    invoices_grouped = sales_df.groupby('InvoiceNo')

    invoice_docs = []
    batch_size = 2000
    total_invoices_saved = 0

    for invoice_id, group in invoices_grouped:
        first_row = group.iloc[0]
        is_cancellation = bool(first_row['IsCancellation'])
        customer_ref = str(first_row['CustomerIDClean'])
        billing_country = str(first_row['Country'])
        tx_date = first_row['InvoiceDate'].to_pydatetime()
        status = "cancelled" if is_cancellation else "completed"

        items = []
        for _, item_row in group.iterrows():
            items.append({
                "productSku": str(item_row['StockCode']).strip().upper(),
                "productName": str(item_row['Description']),
                "quantity": int(item_row['Quantity']),
                "unitPrice": float(item_row['UnitPrice']),
                "lineTotal": round(float(item_row['LineTotal']), 2)
            })

        total_amount = round(float(group['LineTotal'].sum()), 2)
        total_units = int(group['Quantity'].sum())

        invoice_docs.append({
            "businessId": tenant_id,
            "invoiceId": str(invoice_id),
            "transactionDate": tx_date,
            "customerReference": customer_ref,
            "billingCountry": billing_country,
            "status": status,
            "isCancellation": is_cancellation,
            "totalAmount": total_amount,
            "totalUnits": total_units,
            "items": items,
            "source": "uci_retail",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })

        if len(invoice_docs) >= batch_size:
            db.sales.insert_many(invoice_docs, ordered=False)
            total_invoices_saved += len(invoice_docs)
            print(f"  • Inserted {total_invoices_saved:,} invoice documents...")
            invoice_docs = []

    # Insert remaining
    if invoice_docs:
        db.sales.insert_many(invoice_docs, ordered=False)
        total_invoices_saved += len(invoice_docs)
        print(f"  • Inserted final batch ({total_invoices_saved:,} total invoices).")

    # Sales indexes
    print("Creating Sales indexes...")
    db.sales.create_index([("businessId", ASCENDING), ("invoiceId", ASCENDING)], unique=True)
    db.sales.create_index([("businessId", ASCENDING), ("transactionDate", DESCENDING)])
    db.sales.create_index([("businessId", ASCENDING), ("customerReference", ASCENDING)])
    db.sales.create_index([("businessId", ASCENDING), ("items.productSku", ASCENDING)])
    db.sales.create_index([("businessId", ASCENDING), ("status", ASCENDING)])
    print(f"[OK] Successfully imported {total_invoices_saved:,} sales invoices.")

    duration = time.time() - start_time
    print("\n" + "=" * 80)
    print(" MONGODB SEED IMPORT SUMMARY")
    print("=" * 80)
    print(f"Database:             opsmind")
    print(f"Tenant ID:            {tenant_id}")
    print(f"Suppliers:            {db.suppliers.count_documents({'businessId': tenant_id}):,}")
    print(f"Products:             {db.products.count_documents({'businessId': tenant_id}):,}")
    print(f"Customers:            {db.customers.count_documents({'businessId': tenant_id}):,}")
    print(f"Operating Expenses:   {db.expenses.count_documents({'businessId': tenant_id}):,}")
    print(f"Inventory Movements:  {db.inventorymovements.count_documents({'businessId': tenant_id}):,}")
    print(f"Sales Invoices:       {db.sales.count_documents({'businessId': tenant_id}):,}")
    print(f"Total Import Time:    {duration:.2f} seconds")
    print("=" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpsMind MongoDB Data Importer")
    parser.add_argument("--uri", default=DEFAULT_MONGO_URI, help="MongoDB connection URI")
    parser.add_argument("--tenant", default=DEFAULT_TENANT, help="Tenant identifier")
    parser.add_argument("--no-drop", action="store_true", help="Do not drop existing records")
    args = parser.parse_args()

    import_data(mongo_uri=args.uri, tenant_id=args.tenant, drop_existing=not args.no_drop)
