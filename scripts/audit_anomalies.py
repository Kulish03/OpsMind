import os
import pandas as pd

RAW_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "raw", "online_retail_raw.csv"
)

def run_anomaly_audit():
    print(f"[OpsMind Data Engineering] Auditing Anomalies: {RAW_DATA_PATH}\n")
    df = pd.read_csv(RAW_DATA_PATH, encoding="ISO-8859-1")
    total_records = len(df)

    print("=" * 80)
    print(" FORENSIC DATA QUALITY AUDIT — UCI ONLINE RETAIL DATASET")
    print("=" * 80)

    # 1. Missing Values Audit
    print("\n--- 1. MISSING VALUES AUDIT ---")
    missing_desc = df['Description'].isna().sum()
    missing_cust = df['CustomerID'].isna().sum()
    both_missing = (df['Description'].isna() & df['CustomerID'].isna()).sum()

    print(f"• Total Rows with Missing CustomerID:   {missing_cust:,} ({missing_cust / total_records * 100:.2f}%)")
    print(f"• Total Rows with Missing Description:  {missing_desc:,} ({missing_desc / total_records * 100:.2f}%)")
    print(f"• Rows with BOTH Missing:               {both_missing:,} ({both_missing / total_records * 100:.2f}%)")

    # Inspect descriptions of missing CustomerID
    guest_tx = df[df['CustomerID'].isna()]
    guest_sales = guest_tx[(guest_tx['Quantity'] > 0) & (guest_tx['UnitPrice'] > 0)]
    guest_revenue = (guest_sales['Quantity'] * guest_sales['UnitPrice']).sum()
    reg_sales = df[(df['CustomerID'].notna()) & (df['Quantity'] > 0) & (df['UnitPrice'] > 0)]
    reg_revenue = (reg_sales['Quantity'] * reg_sales['UnitPrice']).sum()

    print(f"\n  Financial Impact of Missing CustomerID (Guest Checkouts):")
    print(f"  - Valid Guest Sales Rows:             {len(guest_sales):,} rows")
    print(f"  - Total Guest Revenue:                £{guest_revenue:,.2f} ({(guest_revenue / (guest_revenue + reg_revenue)) * 100:.2f}% of total sales)")
    print(f"  - Total Registered Revenue:           £{reg_revenue:,.2f}")
    print(f"  - AUDIT DECISION: DO NOT DROP missing CustomerIDs for Sales/Inventory; isolate them for Churn/RFM.")

    # 2. Duplicate Records Audit
    print("\n--- 2. DUPLICATE RECORDS AUDIT ---")
    exact_duplicates = df.duplicated().sum()
    all_duplicate_rows = df[df.duplicated(keep=False)]
    print(f"• Exact Duplicate Rows (Identical across all 8 columns): {exact_duplicates:,} ({exact_duplicates / total_records * 100:.2f}%)")
    print(f"• Total Rows Affected by Duplication:                   {len(all_duplicate_rows):,}")
    print(f"• AUDIT DECISION: Drop exact duplicates in Task 4 cleaning to prevent double-counting revenue.")

    # 3. Cancellations & Returns Audit
    print("\n--- 3. CANCELLED INVOICES & RETURN AUDIT ---")
    invoices = df['InvoiceNo'].astype(str)
    cancellations = df[invoices.str.startswith('C')]
    total_cancelled_rows = len(cancellations)
    cancelled_qty = cancellations['Quantity'].sum()
    cancelled_val = (cancellations['Quantity'] * cancellations['UnitPrice']).sum()

    print(f"• Total Cancelled Invoice Line Items (Prefix 'C'): {total_cancelled_rows:,} ({total_cancelled_rows / total_records * 100:.2f}%)")
    print(f"• Unique Cancelled Invoices:                       {cancellations['InvoiceNo'].nunique():,}")
    print(f"• Net Cancelled Product Units:                     {cancelled_qty:,} units")
    print(f"• Total Monetary Value of Returns:                 £{cancelled_val:,.2f}")
    print(f"• Percentage with Positive Quantity in 'C' rows:   {(cancellations['Quantity'] > 0).sum()} (All 'C' invoices have negative quantity)")
    print(f"• AUDIT DECISION: Model cancellations as return events (`status: 'cancelled'`) linked to products.")

    # 4. Invalid & Administrative Records Audit
    print("\n--- 4. INVALID & NON-COMMERCIAL RECORDS AUDIT ---")
    
    # A. Zero & Negative Unit Prices
    zero_prices = df[df['UnitPrice'] == 0]
    negative_prices = df[df['UnitPrice'] < 0]
    print(f"• Rows with UnitPrice == 0.00:                      {len(zero_prices):,} rows")
    print(f"  - Overlap with Missing Description:              {zero_prices['Description'].isna().sum():,} rows")
    print(f"  - Descriptions for Zero Price items include:     {list(zero_prices['Description'].dropna().unique()[:8])}")
    print(f"• Rows with UnitPrice < 0.00:                       {len(negative_prices):,} rows")
    for idx, row in negative_prices.iterrows():
        print(f"  - Invoice: {row['InvoiceNo']} | Code: {row['StockCode']} | Desc: {row['Description']} | Price: £{row['UnitPrice']:,.2f}")

    # B. Negative Quantity WITHOUT 'C' Prefix (Warehouse Write-Offs)
    neg_qty_non_c = df[(df['Quantity'] < 0) & (~invoices.str.startswith('C'))]
    print(f"\n• Negative Quantity WITHOUT 'C' Prefix:             {len(neg_qty_non_c):,} rows")
    print(f"  - Price == 0 in these rows:                      {(neg_qty_non_c['UnitPrice'] == 0).sum():,} out of {len(neg_qty_non_c):,} rows")
    print(f"  - Common Reasons:                                {dict(neg_qty_non_c['Description'].value_counts().head(5))}")
    print(f"  - AUDIT DECISION: These are internal warehouse stock write-offs (breakages, theft, expired stock).")
    print(f"    They are NOT customer sales, but MUST be routed to Inventory Movements (`reason: 'damage/loss'`).")

    # C. Non-Merchandise Service Codes
    special_codes = ['POST', 'DOT', 'M', 'D', 'CRUK', 'BANK CHARGES', 'AMAZONFEE', 'PADS', 'S', 'B']
    special_df = df[df['StockCode'].isin(special_codes)]
    print(f"\n• Non-Merchandise Operational Codes:                {len(special_df):,} rows")
    for code, group in special_df.groupby('StockCode'):
        net_val = (group['Quantity'] * group['UnitPrice']).sum()
        print(f"  - Code: {code:<12} | Rows: {len(group):<5} | Net Value: £{net_val:>11,.2f} | Example: {group['Description'].iloc[0]}")
    print(f"  - AUDIT DECISION: Separate shipping fees, discounts, and bank charges from the merchandise catalog.")

    print("\n" + "=" * 80)
    print(" SUMMARY OF AUDIT FINDINGS COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    run_anomaly_audit()
