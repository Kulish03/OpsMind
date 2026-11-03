import os
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_PATH = os.path.join(BASE_DIR, "data", "raw", "online_retail_raw.csv")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")

# Special non-merchandise codes
EXPENSE_CODES = ['AMAZONFEE', 'BANK CHARGES', 'CRUK', 'B', 'D']
SHIPPING_CODES = ['POST', 'DOT']

def clean_and_transform():
    print(f"[OpsMind Data Pipeline] Starting Data Cleaning & Transformation...")
    print(f"Reading raw dataset: {RAW_DATA_PATH}")
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    
    df = pd.read_csv(RAW_DATA_PATH, encoding="ISO-8859-1")
    initial_rows = len(df)
    print(f"Initial raw rows: {initial_rows:,}")

    # 1. Deduplication
    df = df.drop_duplicates()
    dedup_rows = len(df)
    dropped_dups = initial_rows - dedup_rows
    print(f"• Dropped exact duplicates: {dropped_dups:,} (Remaining: {dedup_rows:,})")

    # 2. String Cleaning & Trimming
    df['InvoiceNo'] = df['InvoiceNo'].astype(str).str.strip()
    df['StockCode'] = df['StockCode'].astype(str).str.strip().str.upper()
    df['Country'] = df['Country'].astype(str).str.strip()
    df['Description'] = df['Description'].fillna("").astype(str).str.strip().str.upper()

    # 3. Datetime Parsing to ISO-8601 UTC
    df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'], errors='coerce', utc=True)
    invalid_dates = df['InvoiceDate'].isna().sum()
    if invalid_dates > 0:
        print(f"• Warning: Dropping {invalid_dates} rows with unparseable dates")
        df = df[df['InvoiceDate'].notna()]

    # 4. Extract Internal Warehouse Stock Write-Offs
    # Condition: Quantity < 0, UnitPrice == 0, Invoice has NO 'C' prefix
    is_writeoff = (df['Quantity'] < 0) & (df['UnitPrice'] == 0) & (~df['InvoiceNo'].str.startswith('C'))
    writeoffs_df = df[is_writeoff].copy()
    writeoffs_df['Reason'] = writeoffs_df['Description'].replace("", "UNSPECIFIED DAMAGE")
    writeoffs_df['AbsoluteQuantity'] = writeoffs_df['Quantity'].abs()
    
    writeoffs_path = os.path.join(PROCESSED_DIR, "inventory_writeoffs.csv")
    writeoffs_df[['InvoiceNo', 'StockCode', 'Reason', 'AbsoluteQuantity', 'InvoiceDate', 'Country']].to_csv(
        writeoffs_path, index=False
    )
    print(f"• Extracted warehouse stock write-offs: {len(writeoffs_df):,} rows -> {writeoffs_path}")

    # Remove writeoffs from main commercial pipeline
    df = df[~is_writeoff]

    # 5. Extract Non-Merchandise Operating Expenses
    is_expense = df['StockCode'].isin(EXPENSE_CODES) | (df['UnitPrice'] < 0)
    expenses_df = df[is_expense].copy()
    expenses_df['Amount'] = (expenses_df['Quantity'] * expenses_df['UnitPrice']).abs()
    expenses_path = os.path.join(PROCESSED_DIR, "operational_fees.csv")
    expenses_df.to_csv(expenses_path, index=False)
    print(f"• Extracted operating fees & adjustments: {len(expenses_df):,} rows -> {expenses_path}")

    # Remove expenses from merchandise sales pipeline
    df = df[~is_expense]

    # 6. Filter Out Corrupted / Administrative Test Rows (Price <= 0 with no valid commercial intent)
    is_invalid_admin = (df['UnitPrice'] <= 0)
    dropped_admin = is_invalid_admin.sum()
    df = df[~is_invalid_admin]
    print(f"• Filtered administrative / zero-price artifacts: {dropped_admin:,} rows")

    # 7. Customer ID Cleaning: Float to Clean String, NaNs as 'GUEST'
    df['CustomerIDClean'] = df['CustomerID'].apply(
        lambda x: f"{int(x)}" if pd.notna(x) and str(x).replace('.0','').isdigit() else "GUEST"
    )

    # 8. Identify Cancellations & Commercial Sales
    df['IsCancellation'] = df['InvoiceNo'].str.startswith('C')
    # For cancellations, Quantity is negative; store LineTotal as signed financial amount
    df['LineTotal'] = df['Quantity'] * df['UnitPrice']

    # 9. Export Cleaned Sales Transactions
    sales_path = os.path.join(PROCESSED_DIR, "cleaned_sales.csv")
    sales_columns = [
        'InvoiceNo', 'StockCode', 'Description', 'Quantity', 
        'InvoiceDate', 'UnitPrice', 'LineTotal', 'CustomerIDClean', 
        'Country', 'IsCancellation'
    ]
    df[sales_columns].to_csv(sales_path, index=False)
    print(f"• Exported cleaned sales transactions: {len(df):,} rows -> {sales_path}")

    # 10. Extract Unique Products Catalog (Merchandise Only)
    # Exclude shipping codes from core merchandise catalog
    merchandise_df = df[~df['StockCode'].isin(SHIPPING_CODES)]
    # Use only positive sales for calculating standard selling price
    pos_merchandise = merchandise_df[merchandise_df['Quantity'] > 0]

    product_summary = pos_merchandise.groupby('StockCode').agg(
        name=('Description', lambda s: s.mode().iloc[0] if not s.mode().empty else s.iloc[0]),
        total_units_sold=('Quantity', 'sum'),
        total_revenue=('LineTotal', 'sum'),
        avg_selling_price=('UnitPrice', 'mean'),
        modal_selling_price=('UnitPrice', lambda p: p.mode().iloc[0] if not p.mode().empty else p.median()),
        min_selling_price=('UnitPrice', 'min'),
        max_selling_price=('UnitPrice', 'max'),
        first_sale_date=('InvoiceDate', 'min'),
        last_sale_date=('InvoiceDate', 'max'),
        transactions_count=('InvoiceNo', 'count')
    ).reset_index()

    # Clean product names (fallback for empty descriptions)
    product_summary['name'] = product_summary['name'].replace("", "UNLABELED PRODUCT")
    product_summary['avg_selling_price'] = product_summary['avg_selling_price'].round(2)
    product_summary['modal_selling_price'] = product_summary['modal_selling_price'].round(2)
    product_summary['total_revenue'] = product_summary['total_revenue'].round(2)

    products_path = os.path.join(PROCESSED_DIR, "unique_products.csv")
    product_summary.to_csv(products_path, index=False)
    print(f"• Exported unique merchandise catalog: {len(product_summary):,} products -> {products_path}")

    # 11. Extract Registered Customers Master (Excluding 'GUEST')
    reg_customers_df = df[df['CustomerIDClean'] != "GUEST"]
    reg_pos_sales = reg_customers_df[reg_customers_df['Quantity'] > 0]

    customer_summary = reg_customers_df.groupby('CustomerIDClean').agg(
        country=('Country', lambda c: c.mode().iloc[0] if not c.mode().empty else c.iloc[0]),
        first_purchase_date=('InvoiceDate', 'min'),
        last_purchase_date=('InvoiceDate', 'max'),
        total_transactions=('InvoiceNo', 'nunique'),
        total_line_items=('InvoiceNo', 'count'),
        total_units_purchased=('Quantity', 'sum'),
        total_spend=('LineTotal', 'sum')
    ).reset_index()

    customer_summary['total_spend'] = customer_summary['total_spend'].round(2)
    customers_path = os.path.join(PROCESSED_DIR, "unique_customers.csv")
    customer_summary.to_csv(customers_path, index=False)
    print(f"• Exported registered customer master: {len(customer_summary):,} customers -> {customers_path}")

    # 12. Save Transformation Summary Metadata
    summary = {
        "raw_record_count": initial_rows,
        "dropped_exact_duplicates": dropped_dups,
        "extracted_inventory_writeoffs": len(writeoffs_df),
        "extracted_operational_fees": len(expenses_df),
        "dropped_corrupted_admin_rows": int(dropped_admin),
        "final_cleaned_sales_count": len(df),
        "commercial_sales_completed": int((~df['IsCancellation']).sum()),
        "commercial_returns_count": int(df['IsCancellation'].sum()),
        "guest_transactions_count": int((df['CustomerIDClean'] == "GUEST").sum()),
        "registered_transactions_count": int((df['CustomerIDClean'] != "GUEST").sum()),
        "unique_merchandise_products": len(product_summary),
        "unique_registered_customers": len(customer_summary),
        "total_gross_merchandise_revenue": float(df[df['Quantity'] > 0]['LineTotal'].sum().round(2)),
        "total_refund_amount": float(df[df['Quantity'] < 0]['LineTotal'].sum().round(2)),
        "net_revenue": float(df['LineTotal'].sum().round(2)),
        "date_range_start": df['InvoiceDate'].min().isoformat(),
        "date_range_end": df['InvoiceDate'].max().isoformat()
    }

    meta_path = os.path.join(PROCESSED_DIR, "transformation_summary.json")
    with open(meta_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"• Saved transformation metadata report -> {meta_path}")
    print("\n" + "=" * 80)
    print(" TRANSFORMATION COMPLETED SUCCESSFULLY")
    print(f" Net Commercial Revenue: £{summary['net_revenue']:,.2f}")
    print(f" Date Horizon: {summary['date_range_start'][:10]} to {summary['date_range_end'][:10]}")
    print("=" * 80)

if __name__ == "__main__":
    clean_and_transform()
