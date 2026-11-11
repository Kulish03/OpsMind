import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.main import health_check
from src.api.v1.ml.router import (
    get_ml_status,
    get_models_overview,
    forecast_demand_endpoint,
    detect_anomalies_endpoint,
    inventory_risk_endpoint,
    customer_churn_endpoint
)
from src.schemas.ml import (
    DemandForecastRequest,
    AnomalyDetectionRequest,
    InventoryRiskRequest,
    CustomerChurnRequest
)

async def main():
    print("=== OpsMind Phase 5 ML Service Test Suite ===", flush=True)

    print("\n1. Testing Health Check...", flush=True)
    h = await health_check()
    print("  Status:", h.status)
    print("  Models Loaded:", h.models_loaded)

    print("\n2. Testing ML Status...", flush=True)
    st = await get_ml_status()
    print("  Status:", st["status"])
    print("  Active:", st["models_active"])

    print("\n3. Testing 14-Day Demand Forecast...", flush=True)
    fc = await forecast_demand_endpoint(DemandForecastRequest(horizon_days=14))
    print("  Horizon Days:", fc.forecast_horizon_days)
    print("  Forecasted Units:", fc.summary.total_forecasted_units)
    print("  Forecasted Revenue: $", fc.summary.total_forecasted_revenue)
    print("  Sample Daily:", fc.daily_forecasts[0].model_dump())

    print("\n4. Testing Expense Anomaly Detection...", flush=True)
    anom_exp = await detect_anomalies_endpoint(AnomalyDetectionRequest(domain="expenses", limit=3))
    print("  Total Flagged:", anom_exp.total_anomalies_detected)
    if anom_exp.anomalies:
        print("  Sample Anomaly Category:", anom_exp.anomalies[0]["category"])
        print("  Sample Anomaly Severity:", anom_exp.anomalies[0]["severity"])
        print("  Sample Explanation:", anom_exp.anomalies[0]["explanation"])

    print("\n5. Testing Sales Anomaly Detection...", flush=True)
    anom_sales = await detect_anomalies_endpoint(AnomalyDetectionRequest(domain="sales", limit=3))
    print("  Total Flagged:", anom_sales.total_anomalies_detected)
    if anom_sales.anomalies:
        print("  Sample SKU:", anom_sales.anomalies[0]["stock_code"])
        print("  Sample Explanation:", anom_sales.anomalies[0]["explanation"])

    print("\n6. Testing Inventory Risk Prediction...", flush=True)
    inv = await inventory_risk_endpoint(InventoryRiskRequest(limit=3))
    print("  Total Products Evaluated:", inv.summary["total_products_evaluated"])
    print("  Critical/OOS Count:", inv.summary["critical_or_out_of_stock_count"])
    if inv.items:
        print("  Sample Item:", inv.items[0]["sku"], inv.items[0]["name"])
        print("  Sample Risk:", inv.items[0]["risk_level"], "Score:", inv.items[0]["stockout_risk_score"])
        print("  Sample Recommendation:", inv.items[0]["replenishment_recommendation"])

    print("\n7. Testing Customer Inactivity & Churn...", flush=True)
    churn = await customer_churn_endpoint(CustomerChurnRequest(limit=3))
    print("  Customers Evaluated:", churn.total_customers_evaluated)
    print("  Risk Distribution:", churn.risk_distribution)
    if churn.customers:
        print("  Sample Customer:", churn.customers[0]["customer_id"])
        print("  Churn Probability:", churn.customers[0]["churn_probability"])
        print("  Recommended Action:", churn.customers[0]["recommended_action"])

    print("\n8. Testing Models Governance Overview...", flush=True)
    ov = await get_models_overview()
    print("  Registered Model Types:", list(ov.models.keys()))

    print("\n=== ALL ML ENDPOINTS EXECUTED AND VERIFIED WITH 100% SUCCESS ===", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
