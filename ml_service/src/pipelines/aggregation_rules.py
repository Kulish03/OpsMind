"""
OpsMind Business Analytics & Aggregation Rules Engine
Standardized formulations for KPIs, time-series demand resampling, and customer RFM analytics.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, Optional

def compute_revenue_kpis(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Standard Revenue KPI Formulation:
    - Gross Revenue: Sum of all positive sales (Quantity > 0 and UnitPrice > 0)
    - Refund Amount: Sum of all negative returns (Quantity < 0 or IsCancellation == True)
    - Net Revenue: Gross Revenue - |Refund Amount| (Sum of all signed LineTotals)
    - Total Orders: Distinct InvoiceNo count of non-cancelled orders
    - Average Order Value (AOV): Net Revenue / Total Completed Orders
    """
    sales_only = df[~df['IsCancellation']]
    returns_only = df[df['IsCancellation']]

    gross_revenue = float(sales_only['LineTotal'].sum())
    refund_amount = float(returns_only['LineTotal'].abs().sum())
    net_revenue = gross_revenue - refund_amount

    # Invoices that represent positive purchases
    unique_orders = sales_only['InvoiceNo'].nunique()
    aov = (net_revenue / unique_orders) if unique_orders > 0 else 0.0

    return {
        "gross_revenue": round(gross_revenue, 2),
        "refund_amount": round(refund_amount, 2),
        "net_revenue": round(net_revenue, 2),
        "total_completed_orders": unique_orders,
        "average_order_value": round(aov, 2),
        "total_units_sold": int(sales_only['Quantity'].sum()),
        "total_units_returned": int(returns_only['Quantity'].abs().sum())
    }

def aggregate_daily_demand(
    df: pd.DataFrame, 
    sku: Optional[str] = None, 
    fill_missing_days: bool = True
) -> pd.DataFrame:
    """
    Time-Series Resampling Rule for Machine Learning:
    - Restricts to positive commercial demand (Quantity > 0).
    - Groups transactions by calendar date (UTC).
    - If fill_missing_days is True, reindexes across full min_date to max_date 
      range filling missing days with 0 quantity (prevents irregular time-step bias in ML).
    """
    subset = df[~df['IsCancellation']].copy()
    if sku:
        subset = subset[subset['StockCode'] == sku]

    if subset.empty:
        return pd.DataFrame(columns=['date', 'units_sold', 'revenue', 'order_count'])

    subset['date'] = pd.to_datetime(subset['InvoiceDate']).dt.date
    daily = subset.groupby('date').agg(
        units_sold=('Quantity', 'sum'),
        revenue=('LineTotal', 'sum'),
        order_count=('InvoiceNo', 'nunique')
    ).reset_index()

    if fill_missing_days:
        daily['date'] = pd.to_datetime(daily['date'])
        full_idx = pd.date_range(start=daily['date'].min(), end=daily['date'].max(), freq='D')
        daily = daily.set_index('date').reindex(full_idx).fillna({
            'units_sold': 0,
            'revenue': 0.0,
            'order_count': 0
        }).reset_index()
        daily.rename(columns={'index': 'date'}, inplace=True)
        daily['units_sold'] = daily['units_sold'].astype(int)
        daily['order_count'] = daily['order_count'].astype(int)

    return daily

def compute_customer_rfm(
    df: pd.DataFrame, 
    reference_date: Optional[pd.Timestamp] = None
) -> pd.DataFrame:
    """
    Customer Retention & Inactivity (RFM) Formulation:
    - Filters out 'GUEST' transactions (anonymous walk-ins have no persistent identity).
    - Reference Date (T_ref): Defaults to max(InvoiceDate) + 1 day.
    - Recency (R): Days elapsed between customer's latest purchase and T_ref.
    - Frequency (F): Distinct completed invoice count.
    - Monetary (M): Net total spend across the entire customer history.
    """
    valid_customers = df[df['CustomerIDClean'] != "GUEST"].copy()
    valid_customers['InvoiceDate'] = pd.to_datetime(valid_customers['InvoiceDate'])

    if reference_date is None:
        reference_date = valid_customers['InvoiceDate'].max() + pd.Timedelta(days=1)

    rfm = valid_customers.groupby('CustomerIDClean').agg(
        last_purchase=('InvoiceDate', 'max'),
        frequency=('InvoiceNo', lambda invs: invs[~invs.str.startswith('C')].nunique()),
        monetary=('LineTotal', 'sum'),
        units=('Quantity', 'sum')
    ).reset_index()

    rfm['recency_days'] = (reference_date - rfm['last_purchase']).dt.days
    rfm['monetary'] = rfm['monetary'].round(2)
    rfm.rename(columns={'CustomerIDClean': 'customer_id'}, inplace=True)

    # Classify RFM Inactivity Risk Baseline:
    # If recency > 90 days: Elevated Inactivity Risk
    # If recency > 180 days: High Churn Risk
    def classify_risk(r: int) -> str:
        if r > 180:
            return "CHURNED"
        elif r > 90:
            return "AT_RISK"
        elif r > 30:
            return "DORMANT"
        return "ACTIVE"

    rfm['retention_status'] = rfm['recency_days'].apply(classify_risk)
    return rfm

def compute_product_velocity(
    df: pd.DataFrame, 
    window_days: int = 30
) -> pd.DataFrame:
    """
    Inventory Stock Velocity Formulation:
    - Computes average daily run-rate over the trailing `window_days`.
    - Stockout Risk Indicator: Current Stock / Daily Velocity = Days of Inventory Remaining.
    """
    sales = df[~df['IsCancellation']].copy()
    sales['InvoiceDate'] = pd.to_datetime(sales['InvoiceDate'])
    max_date = sales['InvoiceDate'].max()
    cutoff_date = max_date - pd.Timedelta(days=window_days)

    recent_sales = sales[sales['InvoiceDate'] >= cutoff_date]

    velocity = recent_sales.groupby('StockCode').agg(
        units_sold_window=('Quantity', 'sum'),
        revenue_window=('LineTotal', 'sum'),
        active_days=('InvoiceDate', lambda d: d.dt.date.nunique())
    ).reset_index()

    velocity['daily_velocity'] = (velocity['units_sold_window'] / window_days).round(2)
    velocity['revenue_window'] = velocity['revenue_window'].round(2)
    return velocity
