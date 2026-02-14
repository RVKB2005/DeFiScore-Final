from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from routes import router as auth_router
from data_ingestion_routes import router as ingestion_router
from feature_extraction_routes import router as feature_router
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
    description="Trustless wallet-based authentication and credit scoring platform with multi-chain data ingestion and feature extraction",
    version="2.1.0",
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


@app.get("/")
async def root():
    return {
        "service": "DeFiScore Credit Scoring Platform",
        "version": "2.1.0",
        "status": "operational",
        "modules": {
            "authentication": "active",
            "data_ingestion": "active",
            "feature_extraction": "active"
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
