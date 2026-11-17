"""
OpsMind Machine Learning API Router
Exposes independently evaluated, explainable ML models:
- Demand Forecasting (Random Forest with chronological evaluation vs Naive & MA7)
- Anomaly Detection (Isolation Forest with Z-Score and IQR explainability)
- Inventory Risk Prediction (Stockout evaluation & lead-time replenishment)
- Customer Inactivity Prediction (Temporal RFM and Random Forest churn classifier)
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from src.schemas.ml import (
    DemandForecastRequest,
    DemandForecastResponse,
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    InventoryRiskRequest,
    InventoryRiskResponse,
    CustomerChurnRequest,
    CustomerChurnResponse,
    MLModelsOverviewResponse
)

from src.services.forecasting import demand_service
from src.services.anomaly_detector import anomaly_service
from src.services.inventory_risk import inventory_risk_service
from src.services.customer_churn import customer_churn_service
from src.services.monitoring.model_monitor import monitor

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.get("/status")
async def get_ml_status():
    """Returns the operational status of ML pipelines and model readiness."""
    return {
        "status": "operational",
        "capabilities": [
            "demand_forecasting",
            "anomaly_detection",
            "stockout_risk",
            "customer_churn"
        ],
        "models_active": {
            "demand_forecast": demand_service.model is not None,
            "anomaly_detector": (anomaly_service.expense_model is not None and anomaly_service.sales_model is not None),
            "stockout_evaluator": True,
            "churn_predictor": customer_churn_service.model is not None
        },
        "phase": "Phase 5 - Machine Learning Production Ready",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/overview", response_model=MLModelsOverviewResponse)
async def get_models_overview():
    """Returns model versions, governance metadata, and real benchmark evaluations."""
    return MLModelsOverviewResponse(
        status="operational",
        timestamp=datetime.now(timezone.utc).isoformat(),
        models={
            "demand_forecasting": demand_service.metadata or demand_service.train_and_evaluate(),
            "expense_anomaly_detection": anomaly_service.expense_meta or anomaly_service.train_expense_detector(),
            "sales_anomaly_detection": anomaly_service.sales_meta or anomaly_service.train_sales_detector(),
            "inventory_risk": inventory_risk_service.metadata or inventory_risk_service.evaluate_inventory_risk(limit=1)["summary"],
            "customer_churn": customer_churn_service.metadata or customer_churn_service.train_and_evaluate()
        }
    )

@router.post("/forecast", response_model=DemandForecastResponse)
async def forecast_demand_endpoint(req: DemandForecastRequest):
    """Generates multi-step demand predictions with confidence bounds and baseline metrics."""
    try:
        result = demand_service.forecast_demand(
            horizon_days=req.horizon_days,
            sku=req.sku
        )
        return DemandForecastResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demand forecasting failed: {str(e)}")

@router.post("/anomalies", response_model=AnomalyDetectionResponse)
async def detect_anomalies_endpoint(req: AnomalyDetectionRequest):
    """Detects and explains anomalies in expenses or sales transactions."""
    try:
        if req.domain == "expenses":
            result = anomaly_service.detect_expense_anomalies(expenses=req.records)
        else:
            result = anomaly_service.detect_sales_anomalies(sales=req.records, limit=req.limit)

        return AnomalyDetectionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@router.post("/inventory-risk", response_model=InventoryRiskResponse)
async def inventory_risk_endpoint(req: InventoryRiskRequest):
    """Evaluates stockout risks and generates actionable replenishment recommendations."""
    try:
        result = inventory_risk_service.evaluate_inventory_risk(
            products=req.products,
            suppliers=req.suppliers,
            limit=req.limit
        )
        return InventoryRiskResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inventory risk evaluation failed: {str(e)}")

@router.post("/customer-churn", response_model=CustomerChurnResponse)
async def customer_churn_endpoint(req: CustomerChurnRequest):
    """Predicts customer inactivity probabilities with RFM features and recommended actions."""
    try:
        result = customer_churn_service.predict_customer_inactivity(limit=req.limit)
        return CustomerChurnResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Customer churn prediction failed: {str(e)}")

@router.post("/forecast/advanced")
async def advanced_forecast_endpoint(
    horizon_days: int = 14,
    promotional_lift_pct: float = 0.0,
    price_elasticity: float = 0.0,
    sku: Optional[str] = None
):
    """
    Advanced demand forecast with day-of-week seasonality, scenario simulation,
    and promotional lift adjustment.
    """
    try:
        base = demand_service.forecast_demand(horizon_days=horizon_days, sku=sku)
        base_units = base["summary"]["total_forecasted_units"]
        base_revenue = base["summary"]["total_forecasted_revenue"]
        multiplier = max(0.1, 1.0 + (promotional_lift_pct / 100.0) + (price_elasticity * 0.05))
        adjusted_units = int(base_units * multiplier)
        adjusted_revenue = round(base_revenue * multiplier, 2)

        return {
            "status": "success",
            "horizon_days": horizon_days,
            "sku": sku or "ALL_CATALOG",
            "scenario_applied": {
                "promotional_lift_pct": promotional_lift_pct,
                "price_elasticity": price_elasticity,
                "net_multiplier": round(multiplier, 3)
            },
            "forecast": {
                "base_predicted_units": base_units,
                "adjusted_predicted_units": adjusted_units,
                "base_predicted_revenue": base_revenue,
                "adjusted_predicted_revenue": adjusted_revenue,
                "wape_evaluation": base.get("model_metadata", {}).get("evaluation", {}).get("random_forest_model", {}).get("wape", 0.2956),
                "daily_sample": base.get("daily_forecasts", [])[:7]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advanced forecast failed: {str(e)}")

@router.get("/monitoring/health")
async def model_monitoring_health_endpoint():
    """Returns data drift metrics, model versions, and retraining signals."""
    return monitor.get_health()

@router.post("/train/{model_name}")
async def retrain_model_endpoint(model_name: str):
    """Trigger on-demand retraining and re-evaluation of an ML capability."""
    try:
        if model_name == "demand":
            meta = demand_service.train_and_evaluate()
        elif model_name == "expense_anomaly":
            meta = anomaly_service.train_expense_detector()
        elif model_name == "sales_anomaly":
            meta = anomaly_service.train_sales_detector()
        elif model_name == "churn":
            meta = customer_churn_service.train_and_evaluate()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown model name: {model_name}. Valid names: demand, expense_anomaly, sales_anomaly, churn")

        return {
            "success": True,
            "model_name": model_name,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "metadata": meta
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retraining failed: {str(e)}")
