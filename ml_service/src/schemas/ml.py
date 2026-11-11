"""
Pydantic Schemas for OpsMind ML Service Endpoints
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# --- Demand Forecasting ---
class DemandForecastRequest(BaseModel):
    horizon_days: int = Field(default=14, ge=1, le=90, description="Forecast horizon in days")
    sku: Optional[str] = Field(default=None, description="Optional specific product SKU")

class DailyForecastItem(BaseModel):
    date: str
    day_name: str
    predicted_units: int
    lower_bound_units: int
    upper_bound_units: int
    predicted_revenue: float
    is_weekend: bool

class DemandForecastSummary(BaseModel):
    total_forecasted_units: int
    total_forecasted_revenue: float
    daily_average_units: float
    daily_average_revenue: float

class DemandForecastResponse(BaseModel):
    forecast_horizon_days: int
    sku: str
    model_metadata: Dict[str, Any]
    summary: DemandForecastSummary
    daily_forecasts: List[DailyForecastItem]


# --- Anomaly Detection ---
class AnomalyDetectionRequest(BaseModel):
    domain: str = Field(default="expenses", pattern="^(expenses|sales)$")
    limit: int = Field(default=50, ge=1, le=200)
    records: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional custom records to evaluate")

class AnomalyItem(BaseModel):
    expense_id: Optional[str] = None
    invoice_no: Optional[str] = None
    stock_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
    date: str
    day_of_week: Optional[str] = None
    severity: str
    anomaly_score: float
    z_score: Optional[float] = None
    iqr_ratio: Optional[float] = None
    explanation: List[str]
    baseline_stats: Optional[Dict[str, Any]] = None

class AnomalyDetectionResponse(BaseModel):
    domain: str
    total_evaluated: int
    total_anomalies_detected: int
    model_metadata: Dict[str, Any]
    anomalies: List[Dict[str, Any]]


# --- Inventory Risk ---
class InventoryRiskRequest(BaseModel):
    limit: int = Field(default=100, ge=1, le=500)
    products: Optional[List[Dict[str, Any]]] = None
    suppliers: Optional[List[Dict[str, Any]]] = None

class InventoryRiskResponse(BaseModel):
    summary: Dict[str, Any]
    items: List[Dict[str, Any]]


# --- Customer Inactivity / Churn ---
class CustomerChurnRequest(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)

class CustomerChurnResponse(BaseModel):
    total_customers_evaluated: int
    risk_distribution: Dict[str, int]
    model_metadata: Dict[str, Any]
    customers: List[Dict[str, Any]]


# --- Overview & Governance ---
class MLModelsOverviewResponse(BaseModel):
    status: str
    timestamp: str
    models: Dict[str, Any]
