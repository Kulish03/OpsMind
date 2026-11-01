from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import os

from src.core.config import settings
from src.schemas.health import HealthCheckResponse
from src.api.v1.ml.router import router as ml_router
from src.api.v1.copilot.router import router as copilot_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="OpsMind Machine Learning & Natural Language AI Copilot Service",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to CLIENT_URL/BACKEND_URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Domain Routers
app.include_router(ml_router, prefix=settings.API_V1_STR)
app.include_router(copilot_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Root"])
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/health", response_model=HealthCheckResponse, tags=["Health"])
@app.get(f"{settings.API_V1_STR}/health", response_model=HealthCheckResponse, tags=["Health"])
async def health_check():
    return HealthCheckResponse(
        service="opsmind-ml-service",
        status="healthy",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc).isoformat(),
        models_loaded={
            "demand_forecast": False,
            "anomaly_detector": False,
            "churn_predictor": False,
            "stockout_evaluator": False
        },
        details={
            "backend_url": settings.BACKEND_URL,
            "port": settings.PORT
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host=settings.HOST, port=settings.PORT, reload=True)
