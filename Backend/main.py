from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from routes import router as auth_router
from data_ingestion_routes import router as ingestion_router
from feature_extraction_routes import router as feature_router
from credit_score_routes import router as credit_score_router
from feature_routes import router as feature_data_router
from webhook_routes import router as webhook_router
from monitoring_routes import router as monitoring_router
from zk_witness_routes import router as zk_witness_router
from zk_monitoring_routes import router as zk_monitoring_router
from market_routes import router as market_router
from analytics_routes import router as analytics_router
from user_dashboard_routes import router as user_dashboard_router
from borrow_request_routes import router as borrow_request_router
from supply_marketplace_routes import router as supply_marketplace_router
from blockchain_lending_routes import router as blockchain_lending_router
from config import settings
from middleware import SecurityHeadersMiddleware, RequestLoggingMiddleware, RateLimitMiddleware
from exceptions import validation_exception_handler, http_exception_handler, general_exception_handler
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(
    title="DeFiScore Credit Scoring API",
    description="Production-grade trustless credit scoring platform with multi-chain support, ZK proofs, background processing, caching, webhooks, and monitoring",
    version="3.2.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None
)

# CORS configuration
allowed_origins = ["*"] if settings.ENVIRONMENT == "development" else [
    "https://yourdomain.com",  # Configure for production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security and logging middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

# Exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include routers
app.include_router(auth_router)
app.include_router(ingestion_router)
app.include_router(feature_router)
app.include_router(credit_score_router)
app.include_router(feature_data_router)
app.include_router(webhook_router)
app.include_router(monitoring_router)
app.include_router(zk_witness_router)
app.include_router(zk_monitoring_router)
app.include_router(market_router)
app.include_router(analytics_router)
app.include_router(user_dashboard_router)
app.include_router(borrow_request_router)
app.include_router(supply_marketplace_router)
app.include_router(blockchain_lending_router)


@app.get("/")
async def root():
    return {
        "service": "DeFiScore Credit Scoring Platform",
        "version": "3.2.0",
        "status": "operational",
        "modules": {
            "authentication": "active",
            "data_ingestion": "active",
            "feature_extraction": "active",
            "credit_scoring": "active",
            "zk_proofs": "active",
            "webhooks": "active",
            "monitoring": "active"
        },
        "features": {
            "background_processing": "celery",
            "score_caching": "redis",
            "database_persistence": "postgresql",
            "rate_limiting": "per_wallet",
            "webhooks": "enabled",
            "monitoring": "enabled",
            "multi_chain_support": "74 networks",
            "zk_proofs": "circom + groth16"
        },
        "infrastructure": {
            "task_queue": "Celery + Redis",
            "cache": "Redis",
            "database": "PostgreSQL",
            "monitoring": "Built-in metrics & alerts",
            "zk_circuit": "DeFiCreditScore v1.0.0"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development"
    )
