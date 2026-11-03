import os
import json
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
SYNTHETIC_DIR = os.path.join(BASE_DIR, "data", "synthetic")

PRODUCTS_PATH = os.path.join(PROCESSED_DIR, "unique_products.csv")
WRITEOFFS_PATH = os.path.join(PROCESSED_DIR, "inventory_writeoffs.csv")
FEES_PATH = os.path.join(PROCESSED_DIR, "operational_fees.csv")
SALES_PATH = os.path.join(PROCESSED_DIR, "cleaned_sales.csv")

# Set deterministic seed for reproducibility
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

def generate_synthetic_data():
    print("=" * 80)
    print(" OPSMIND DATA ENGINEERING — SYNTHETIC DATA GENERATION PIPELINE")
    print("=" * 80)
    os.makedirs(SYNTHETIC_DIR, exist_ok=True)

    products_df = pd.read_csv(PRODUCTS_PATH)
    print(f"Loaded {len(products_df):,} unique merchandise products.")

    # ---------------------------------------------------------
    # 1. GENERATE SUPPLIERS MASTER
    # ---------------------------------------------------------
    print("\n--- 1. Generating Wholesale Suppliers Master ---")
    suppliers = [
        {
            "supplierId": "SUP-101",
            "name": "Heritage Ceramics & Tableware Ltd",
            "category": "Ceramics & Kitchen",
            "contactPerson": "Arthur Pendelton",
            "email": "orders@heritageceramics.co.uk",
            "phone": "+44 1782 554101",
            "city": "Stoke-on-Trent",
            "country": "United Kingdom",
            "leadTimeDays": 7,
            "minimumOrderQty": 50,
            "source": "synthetic"
        },
        {
            "supplierId": "SUP-102",
            "name": "London Vintage Gifts & Novelty Co",
            "category": "Gifts & Novelties",
            "contactPerson": "Sarah Jenkins",
            "email": "b2b@londonvintage.co.uk",
            "phone": "+44 20 7946 0192",
            "city": "London",
            "country": "United Kingdom",
            "leadTimeDays": 5,
            "minimumOrderQty": 40,
            "source": "synthetic"
        },
        {
            "supplierId": "SUP-103",
            "name": "Cotswold Textile & Home Goods",
            "category": "Textiles & Cushions",
            "contactPerson": "Edward Miller",
            "email": "supply@cotswoldtextiles.co.uk",
            "phone": "+44 1285 654321",
            "city": "Cirencester",
            "country": "United Kingdom",
            "leadTimeDays": 10,
            "minimumOrderQty": 30,
            "source": "synthetic"
        },
        {
            "supplierId": "SUP-104",
            "name": "Nordic Paper Craft & Stationery",
            "category": "Papercraft & Stationery",
            "contactPerson": "Freja Lindqvist",
            "email": "export@nordicpaper.se",
            "phone": "+46 8 123 4567",
            "city": "Stockholm",
            "country": "Sweden",
            "leadTimeDays": 14,
            "minimumOrderQty": 100,
            "source": "synthetic"
        },
        {
            "supplierId": "SUP-105",
            "name": "Bavarian Clock & Metalware Imports",
            "category": "Metalware & Clocks",
            "contactPerson": "Klaus Schneider",
            "email": "vertrieb@bavarianmetal.de",
            "phone": "+49 89 9876 5432",
            "city": "Munich",
            "country": "Germany",
            "leadTimeDays": 12,
            "minimumOrderQty": 25,
            "source": "synthetic"
        },
        {
            "supplierId": "SUP-106",
            "name": "Piccadilly Seasonal & Festive Decor",
            "category": "Seasonal & Christmas",
            "contactPerson": "Claire Higgins",
            "email": "claire@piccadillyseasonal.co.uk",
            "phone": "+44 20 8123 9988",
            "city": "London",
            "country": "United Kingdom",
            "leadTimeDays": 8,
            "minimumOrderQty": 60,
            "source": "synthetic"
        }
    ]

    suppliers_df = pd.DataFrame(suppliers)
    suppliers_path = os.path.join(SYNTHETIC_DIR, "synthetic_suppliers.csv")
    suppliers_df.to_csv(suppliers_path, index=False)
    print(f"[OK] Saved {len(suppliers_df)} suppliers -> {suppliers_path}")

    # Map products to suppliers deterministically based on name keywords or SKU hash
    def assign_supplier(row):
        name = str(row['name']).upper()
        if any(w in name for w in ['CERAMIC', 'TEAPOT', 'MUG', 'CUP', 'PLATE', 'BOWL', 'BAKING']):
            return "SUP-101", "Ceramics & Kitchen"
        elif any(w in name for w in ['HEART', 'GIFT', 'BAG', 'BOX', 'SIGN', 'PHOTO', 'FRAME']):
            return "SUP-102", "Gifts & Novelties"
        elif any(w in name for w in ['CUSHION', 'APRON', 'TOWEL', 'FABRIC', 'LINEN', 'COAT HANGER']):
            return "SUP-103", "Textiles & Home"
        elif any(w in name for w in ['PAPER', 'CARD', 'PENCIL', 'NOTEBOOK', 'WRAP', 'TAPE']):
            return "SUP-104", "Papercraft & Stationery"
        elif any(w in name for w in ['CLOCK', 'LANTERN', 'METAL', 'TIN', 'ZINC', 'HOOK', 'DRAWER']):
            return "SUP-105", "Metalware & Hardware"
        elif any(w in name for w in ['CHRISTMAS', 'TREE', 'STAR', 'LIGHT', 'CANDLE', 'DECORATION', 'FAIRY']):
            return "SUP-106", "Seasonal & Lighting"
        else:
            # Deterministic hash fallback
            supplier_keys = ["SUP-101", "SUP-102", "SUP-103", "SUP-104", "SUP-105", "SUP-106"]
            assigned_id = supplier_keys[hash(row['StockCode']) % len(supplier_keys)]
            return assigned_id, "General Merchandise"

    supplier_assignments = products_df.apply(assign_supplier, axis=1)
    products_df['supplierId'] = [s[0] for s in supplier_assignments]
    products_df['category'] = [s[1] for s in supplier_assignments]

    # ---------------------------------------------------------
    # 2. ENRICH PRODUCTS: COST PRICE & REORDER PARAMETERS
    # ---------------------------------------------------------
    print("\n--- 2. Synthesizing Cost Prices (COGS) & Inventory Parameters ---")
    # Cost price benchmarked at 55% - 68% of modal selling price
    # Ensures positive gross margins between 32% and 45%
    cost_margin_factors = np.random.uniform(0.55, 0.68, size=len(products_df))
    products_df['costPrice'] = (products_df['modal_selling_price'] * cost_margin_factors).round(2)
    # Ensure cost price is at least 0.10 if selling price > 0
    products_df['costPrice'] = np.where(
        (products_df['modal_selling_price'] > 0) & (products_df['costPrice'] < 0.10),
        (products_df['modal_selling_price'] * 0.6).round(2),
        products_df['costPrice']
    )

    # Reorder parameters based on sales velocity
    daily_run_rate = (products_df['total_units_sold'] / 374).clip(lower=0.1)
    products_df['reorderThreshold'] = (daily_run_rate * 14).round().astype(int).clip(lower=10, upper=500)
    products_df['targetStock'] = (products_df['reorderThreshold'] * 3).clip(lower=30, upper=2000)
    products_df['source'] = 'uci_retail'
    products_df['costPriceSource'] = 'synthetic_ratio'

    # ---------------------------------------------------------
    # 3. GENERATE INVENTORY MOVEMENTS LEDGER & FINAL STOCK
    # ---------------------------------------------------------
    print("\n--- 3. Generating Complete Inventory Movement Ledger ---")
    sales_df = pd.read_csv(SALES_PATH)
    sales_df['InvoiceDate'] = pd.to_datetime(sales_df['InvoiceDate'])
    min_date = sales_df['InvoiceDate'].min()

    inventory_movements = []

    # A. Initial Opening Stock Movements at Start of Horizon (2010-12-01)
    opening_date = min_date - timedelta(hours=2)
    current_stock_tracker = {}

    for _, prod in products_df.iterrows():
        sku = prod['StockCode']
        # Opening stock calculated to cover initial buffer (~25-35 days of demand)
        opening_qty = int(max(prod['reorderThreshold'] * 2, 50))
        current_stock_tracker[sku] = opening_qty

        inventory_movements.append({
            "movementId": f"MOV-INIT-{sku}",
            "productSku": sku,
            "movementType": "OPENING_BALANCE",
            "quantity": opening_qty,
            "timestamp": opening_date.isoformat(),
            "source": "synthetic",
            "referenceId": "INITIAL_AUDIT_2010",
            "unitCost": prod['costPrice'],
            "reason": "Opening Inventory Balance"
        })

    # B. Inbound Replenishment Purchases (Simulated Batch Shipments)
    # Whenever total historical sales depleted inventory, add periodic supplier shipments
    print("- Simulating quarterly supplier replenishment purchase orders...")
    quarterly_dates = [
        datetime(2011, 2, 15, 10, 0, tzinfo=timezone.utc),
        datetime(2011, 5, 15, 10, 0, tzinfo=timezone.utc),
        datetime(2011, 8, 15, 10, 0, tzinfo=timezone.utc),
        datetime(2011, 10, 25, 10, 0, tzinfo=timezone.utc),
    ]

    for q_idx, q_date in enumerate(quarterly_dates, start=1):
        for _, prod in products_df.iterrows():
            sku = prod['StockCode']
            # Reorder batch based on targetStock
            batch_qty = int(prod['targetStock'] * random.uniform(0.8, 1.2))
            current_stock_tracker[sku] += batch_qty

            inventory_movements.append({
                "movementId": f"MOV-PO-Q{q_idx}-{sku}",
                "productSku": sku,
                "movementType": "INBOUND_PURCHASE",
                "quantity": batch_qty,
                "timestamp": q_date.isoformat(),
                "source": "synthetic",
                "referenceId": f"PO-2011-Q{q_idx}-{prod['supplierId']}",
                "unitCost": prod['costPrice'],
                "reason": f"Quarterly Restock Q{q_idx}"
            })

    # C. Account for Actual Commercial Sales & Returns (from cleaned_sales.csv)
    # Deduct sales and add back returns
    sales_units_by_sku = sales_df[~sales_df['IsCancellation']].groupby('StockCode')['Quantity'].sum().to_dict()
    cancelled_sales = sales_df[sales_df['IsCancellation']].copy()
    cancelled_sales['AbsQty'] = cancelled_sales['Quantity'].abs()
    returns_units_by_sku = cancelled_sales.groupby('StockCode')['AbsQty'].sum().to_dict()

    for sku in current_stock_tracker:
        sold = sales_units_by_sku.get(sku, 0)
        returned = returns_units_by_sku.get(sku, 0)
        current_stock_tracker[sku] = current_stock_tracker[sku] - sold + returned

    # D. Ingest Warehouse Damage Write-offs from inventory_writeoffs.csv
    writeoffs_df = pd.read_csv(WRITEOFFS_PATH)
    for idx, row in writeoffs_df.iterrows():
        sku = str(row['StockCode']).strip().upper()
        qty = int(row['AbsoluteQuantity'])
        if sku in current_stock_tracker:
            current_stock_tracker[sku] -= qty

        inventory_movements.append({
            "movementId": f"MOV-WRITEOFF-{idx+1:04d}",
            "productSku": sku,
            "movementType": "ADJUSTMENT",
            "quantity": -qty,
            "timestamp": str(row['InvoiceDate']),
            "source": "uci_retail",
            "referenceId": str(row['InvoiceNo']),
            "unitCost": 0.0,
            "reason": str(row['Reason'])
        })

    # Save final computed currentStock on products
    products_df['currentStock'] = products_df['StockCode'].map(current_stock_tracker).fillna(50).astype(int)

    # Save Enriched Products
    enriched_products_path = os.path.join(SYNTHETIC_DIR, "products_enriched.csv")
    products_df.to_csv(enriched_products_path, index=False)
    print(f"[OK] Saved enriched products catalog -> {enriched_products_path}")

    # Save Inventory Movements Ledger
    movements_df = pd.DataFrame(inventory_movements)
    movements_path = os.path.join(SYNTHETIC_DIR, "synthetic_inventory_movements.csv")
    movements_df.to_csv(movements_path, index=False)
    print(f"[OK] Saved {len(movements_df):,} inventory movement ledger records -> {movements_path}")

    # ---------------------------------------------------------
    # 4. GENERATE OPERATING EXPENSES (MONTHLY OVERHEAD + FEES)
    # ---------------------------------------------------------
    print("\n--- 4. Synthesizing Operating Expenses ---")
    expenses = []
    
    # Real historical fees from raw data (Amazon fees, Bank charges)
    if os.path.exists(FEES_PATH):
        fees_df = pd.read_csv(FEES_PATH)
        for idx, row in fees_df.iterrows():
            code = str(row['StockCode'])
            cat = "Platform & Marketplace Fees" if "AMAZON" in code else "Banking & Financial Charges"
            expenses.append({
                "expenseId": f"EXP-REAL-{idx+1:04d}",
                "category": cat,
                "amount": round(float(row['Amount']), 2),
                "date": str(row['InvoiceDate']),
                "description": f"{row['Description']} (Invoice {row['InvoiceNo']})",
                "paymentMethod": "Bank Transfer",
                "source": "uci_retail"
            })
        print(f"- Integrated {len(fees_df):,} real historical fee records from UCI raw data.")

    # Generate Monthly Overhead (Rent, Payroll, Utilities, Marketing, Logistics)
    # Spanning 13 months: Dec 2010 through Dec 2011
    start_dt = datetime(2010, 12, 1)
    for m in range(13):
        curr_month_dt = start_dt + timedelta(days=m * 30.5)
        m_str = curr_month_dt.strftime("%B %Y")
        m_date = curr_month_dt.replace(day=1, hour=9, minute=0).isoformat()

        # Rent & Business Rates
        expenses.append({
            "expenseId": f"EXP-RENT-{m+1:02d}",
            "category": "Rent & Facilities",
            "amount": round(random.uniform(4800, 5200), 2),
            "date": m_date,
            "description": f"Warehouse & Office Lease - {m_str}",
            "paymentMethod": "Direct Debit",
            "source": "synthetic"
        })

        # Payroll & Staff Wages
        expenses.append({
            "expenseId": f"EXP-PAYROLL-{m+1:02d}",
            "category": "Payroll & Wages",
            "amount": round(random.uniform(14000, 16500), 2),
            "date": (curr_month_dt.replace(day=28, hour=17, minute=0)).isoformat(),
            "description": f"Operations & Fulfillment Staff Wages - {m_str}",
            "paymentMethod": "Direct Deposit",
            "source": "synthetic"
        })

        # Utilities & Internet
        expenses.append({
            "expenseId": f"EXP-UTIL-{m+1:02d}",
            "category": "Utilities",
            "amount": round(random.uniform(850, 1250), 2),
            "date": (curr_month_dt.replace(day=10, hour=11, minute=0)).isoformat(),
            "description": f"Electricity, Heating & High-Speed Internet - {m_str}",
            "paymentMethod": "Direct Debit",
            "source": "synthetic"
        })

        # Digital Marketing & Ad Spend
        expenses.append({
            "expenseId": f"EXP-MKTG-{m+1:02d}",
            "category": "Marketing & Advertising",
            "amount": round(random.uniform(1800, 3200), 2),
            "date": (curr_month_dt.replace(day=15, hour=14, minute=0)).isoformat(),
            "description": f"Search & Social Ad Campaigns - {m_str}",
            "paymentMethod": "Corporate Credit Card",
            "source": "synthetic"
        })

        # Shipping & Fulfillment Supplies
        expenses.append({
            "expenseId": f"EXP-SUPPLY-{m+1:02d}",
            "category": "Packaging & Logistics",
            "amount": round(random.uniform(900, 1700), 2),
            "date": (curr_month_dt.replace(day=20, hour=10, minute=0)).isoformat(),
            "description": f"Cardboard Boxes, Bubble Wrap & Thermal Labels - {m_str}",
            "paymentMethod": "Corporate Credit Card",
            "source": "synthetic"
        })

    expenses_df = pd.DataFrame(expenses)
    expenses_path = os.path.join(SYNTHETIC_DIR, "synthetic_expenses.csv")
    expenses_df.to_csv(expenses_path, index=False)
    print(f"[OK] Saved {len(expenses_df):,} operating expense records -> {expenses_path}")

    # ---------------------------------------------------------
    # 5. METADATA SUMMARY & AUDIT RECONCILIATION
    # ---------------------------------------------------------
    total_expense_amount = expenses_df['amount'].sum()
    synthetic_summary = {
        "suppliers_count": len(suppliers_df),
        "enriched_products_count": len(products_df),
        "total_inventory_movements": len(movements_df),
        "opening_balance_movements": int((movements_df['movementType'] == "OPENING_BALANCE").sum()),
        "inbound_purchase_movements": int((movements_df['movementType'] == "INBOUND_PURCHASE").sum()),
        "adjustment_damage_movements": int((movements_df['movementType'] == "ADJUSTMENT").sum()),
        "total_operating_expenses_count": len(expenses_df),
        "total_operating_expenses_amount": round(float(total_expense_amount), 2),
        "real_expense_records_count": int((expenses_df['source'] == "uci_retail").sum()),
        "synthetic_expense_records_count": int((expenses_df['source'] == "synthetic").sum()),
        "average_product_gross_margin_pct": round(float(((products_df['modal_selling_price'] - products_df['costPrice']) / products_df['modal_selling_price']).replace([np.inf, -np.inf], np.nan).mean() * 100), 2),
        "low_stock_products_count": int((products_df['currentStock'] < products_df['reorderThreshold']).sum()),
        "healthy_stock_products_count": int((products_df['currentStock'] >= products_df['reorderThreshold']).sum())
    }

    meta_path = os.path.join(SYNTHETIC_DIR, "synthetic_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(synthetic_summary, f, indent=2)

    print("\n" + "=" * 80)
    print(" SYNTHETIC DATA GENERATION COMPLETE")
    print(f" - Suppliers Created:              {synthetic_summary['suppliers_count']}")
    print(f" - Enriched Products:             {synthetic_summary['enriched_products_count']:,}")
    print(f" - Avg Gross Margin:              {synthetic_summary['average_product_gross_margin_pct']}%")
    print(f" - Total Inventory Movements:     {synthetic_summary['total_inventory_movements']:,}")
    print(f" - Products Below Reorder Limit:  {synthetic_summary['low_stock_products_count']:,} (Ready for Stockout Alert testing)")
    print(f" - Total Operating Expenses:      GBP {synthetic_summary['total_operating_expenses_amount']:,.2f}")
    print("=" * 80)

if __name__ == "__main__":
    generate_synthetic_data()
