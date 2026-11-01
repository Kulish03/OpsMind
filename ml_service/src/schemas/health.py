from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class HealthCheckResponse(BaseModel):
    service: str
    status: str
    version: str
    environment: str
    timestamp: str
    models_loaded: Dict[str, bool]
    details: Optional[Dict[str, Any]] = None
