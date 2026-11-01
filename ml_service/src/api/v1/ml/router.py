from fastapi import APIRouter
from datetime import datetime, timezone

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
            "demand_forecast": False,  # Will be populated in Phase 5
            "anomaly_detector": False,
            "churn_predictor": False,
            "stockout_evaluator": False
        },
        "phase": "Phase 0 - Foundation Skeleton",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
