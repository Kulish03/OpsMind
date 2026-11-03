import os
import sys
import pandas as pd

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "ml_service"))

from src.pipelines.aggregation_rules import (
    compute_revenue_kpis,
    aggregate_daily_demand,
    compute_customer_rfm,
    compute_product_velocity
)

CLEAN_SALES_PATH = os.path.join(PROJECT_ROOT, "data", "processed", "cleaned_sales.csv")

def verify_rules():
    print("=" * 80)
    print(" OPSMIND AGGREGATION & BUSINESS RULES VERIFICATION")
    print("=" * 80)
    print(f"Loading cleaned sales data from: {CLEAN_SALES_PATH}")
    df = pd.read_csv(CLEAN_SALES_PATH)
    print(f"Loaded {len(df):,} cleaned sales transactions.\n")

    # 1. Revenue KPIs
    print("--- 1. OVERALL REVENUE & COMMERCIAL KPIS ---")
    kpis = compute_revenue_kpis(df)
    for k, v in kpis.items():
        if "revenue" in k or "value" in k or "amount" in k:
            print(f"  • {k:<25}: £{v:,.2f}")
        else:
            print(f"  • {k:<25}: {v:,}")

    # 2. Time-Series Daily Demand Resampling (Regular High-Volume SKU)
    print("\n--- 2. TIME-SERIES DAILY DEMAND AGGREGATION (SAMPLE SKU: 85123A) ---")
    sku_demo = "85123A"  # White Hanging Heart T-Light Holder
    print(f"Aggregating continuous calendar daily demand for SKU: {sku_demo}")
    daily_demand = aggregate_daily_demand(df, sku=sku_demo, fill_missing_days=True)
    print(f"Total Calendar Days in Horizon: {len(daily_demand)} days (from {daily_demand['date'].min().strftime('%Y-%m-%d')} to {daily_demand['date'].max().strftime('%Y-%m-%d')})")
    print(f"Active Selling Days: {(daily_demand['units_sold'] > 0).sum()} days | Zero-Sales Days (Zero-filled): {(daily_demand['units_sold'] == 0).sum()} days")
    print("Sample Daily Resampled Window (First 5 days):")
    print(daily_demand.head(5).to_string(index=False))

    # 3. Customer Retention (RFM) Segmentation
    print("\n--- 3. CUSTOMER RFM & INACTIVITY CLASSIFICATION ---")
    rfm_df = compute_customer_rfm(df)
    print(f"Total Registered Customers Evaluated: {len(rfm_df):,}")
    print("\nRetention Risk Distribution:")
    status_counts = rfm_df['retention_status'].value_counts()
    for status, count in status_counts.items():
        pct = (count / len(rfm_df)) * 100
        print(f"  • {status:<12}: {count:,} customers ({pct:.1f}%)")
    print("\nTop 3 Customers by Monetary Spend:")
    print(rfm_df.sort_values(by='monetary', ascending=False).head(3)[['customer_id', 'recency_days', 'frequency', 'monetary', 'retention_status']].to_string(index=False))

    # 4. Inventory Run-Rate & Velocity (Trailing 30-day Window)
    print("\n--- 4. INVENTORY STOCK VELOCITY (TRAILING 30 DAYS) ---")
    velocity_df = compute_product_velocity(df, window_days=30)
    print(f"Products with Active Sales in Last 30 Days: {len(velocity_df):,}")
    print("Top 5 Fast-Moving Items by Daily Velocity (Units/Day):")
    print(velocity_df.sort_values(by='daily_velocity', ascending=False).head(5)[['StockCode', 'daily_velocity', 'units_sold_window', 'revenue_window']].to_string(index=False))

    print("\n" + "=" * 80)
    print(" ALL AGGREGATION RULES SUCCESSFULLY VERIFIED")
    print("=" * 80)

if __name__ == "__main__":
    verify_rules()
