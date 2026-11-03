import os
import pandas as pd

RAW_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw", "online_retail_raw.csv")

def inspect_dataset():
    print(f"[OpsMind Data Engineering] Inspecting: {RAW_DATA_PATH}")
    if not os.path.exists(RAW_DATA_PATH):
        print(f"Error: Raw dataset not found at {RAW_DATA_PATH}")
        return

    # Load CSV
    df = pd.read_csv(RAW_DATA_PATH, encoding="ISO-8859-1")

    print("\n" + "="*70)
    print(" 1. DATASET DIMENSIONS & MEMORY")
    print("="*70)
    print(f"Total Transactions (Rows): {df.shape[0]:,}")
    print(f"Total Attributes (Cols):   {df.shape[1]}")
    print(f"Memory Usage in RAM:       {df.memory_usage(deep=True).sum() / (1024*1024):.2f} MB")

    print("\n" + "="*70)
    print(" 2. COLUMNS, DATA TYPES & MISSING VALUES")
    print("="*70)
    summary_data = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        null_count = df[col].isna().sum()
        null_pct = (null_count / len(df)) * 100
        unique_count = df[col].nunique(dropna=True)
        summary_data.append({
            "Column": col,
            "Type": dtype,
            "Non-Null Count": f"{df[col].count():,}",
            "Missing Count": f"{null_count:,}",
            "Missing %": f"{null_pct:.2f}%",
            "Unique Values": f"{unique_count:,}"
        })
    summary_df = pd.DataFrame(summary_data)
    print(summary_df.to_string(index=False))

    print("\n" + "="*70)
    print(" 3. SAMPLE RECORDS (HEAD & TAIL)")
    print("="*70)
    print("\nFirst 3 rows:")
    print(df.head(3).to_string())
    print("\nLast 3 rows:")
    print(df.tail(3).to_string())

    print("\n" + "="*70)
    print(" 4. NUMERICAL METRIC DISTRIBUTION (SUMMARY STATS)")
    print("="*70)
    print(df[['Quantity', 'UnitPrice']].describe().to_string())

    print("\n" + "="*70)
    print(" 5. INITIAL OPERATIONAL OBSERVATIONS")
    print("="*70)
    
    # Check InvoiceNo patterns
    invoices = df['InvoiceNo'].astype(str)
    cancellations = invoices[invoices.str.startswith('C', na=False)]
    print(f"• Total Unique Invoices:           {invoices.nunique():,}")
    print(f"• Cancelled Invoices (Prefix 'C'): {len(cancellations):,} occurrences ({invoices[invoices.str.startswith('C', na=False)].nunique():,} unique)")

    # Negative quantities
    negative_qty = df[df['Quantity'] < 0]
    print(f"• Negative Quantity Rows:         {len(negative_qty):,} ({len(negative_qty)/len(df)*100:.2f}%)")

    # Zero or negative UnitPrice
    non_positive_price = df[df['UnitPrice'] <= 0]
    print(f"• Free or Negative Price Rows:     {len(non_positive_price):,} ({len(non_positive_price)/len(df)*100:.2f}%)")

    # Customer ID missing
    missing_customers = df['CustomerID'].isna().sum()
    print(f"• Missing CustomerID Rows:         {missing_customers:,} ({missing_customers/len(df)*100:.2f}%)")

    # Duplicate rows
    duplicates = df.duplicated().sum()
    print(f"• Exact Duplicate Rows:            {duplicates:,} ({duplicates/len(df)*100:.2f}%)")

    # Date range
    try:
        dates = pd.to_datetime(df['InvoiceDate'], errors='coerce')
        print(f"• Earliest Invoice Date:           {dates.min()}")
        print(f"• Latest Invoice Date:             {dates.max()}")
    except Exception as e:
        print(f"• Date parsing note: {e}")

    print("="*70)

if __name__ == "__main__":
    inspect_dataset()
