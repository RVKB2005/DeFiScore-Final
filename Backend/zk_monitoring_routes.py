"""
ZK Proof Monitoring Routes
API endpoints for monitoring ZK proof system
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from monitoring_service import monitoring_service
from dependencies import get_optional_wallet, get_current_wallet

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zk/monitoring", tags=["zk-monitoring"])


@router.get("/metrics")
async def get_system_metrics(
    hours: int = Query(default=24, ge=1, le=168),
    authenticated_wallet: Optional[str] = Depends(get_optional_wallet)
):
    """
    Get system-wide ZK proof metrics
    
    Args:
        hours: Time range in hours (1-168)
        current_user: Authenticated user (optional for public metrics)
        
    Returns:
        System metrics including success rates, performance, and user activity
    """
    try:
        metrics = monitoring_service.get_system_metrics(hours=hours)
        
        return {
            "time_range_hours": hours,
            "metrics": {
                "total_proofs": metrics.total_proofs_generated,
                "successful": metrics.successful_proofs,
                "failed": metrics.failed_proofs,
                "success_rate": (
                    metrics.successful_proofs / metrics.total_proofs_generated
                    if metrics.total_proofs_generated > 0 else 0.0
                ),
                "average_duration_ms": metrics.average_duration_ms,
                "average_duration_seconds": metrics.average_duration_ms / 1000,
                "average_gas_used": metrics.average_gas_used,
                "unique_users": metrics.unique_users,
                "proofs_last_24h": metrics.proofs_last_24h,
                "errors_last_24h": metrics.errors_last_24h
            }
        }
    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors")
async def get_error_summary(
    hours: int = Query(default=24, ge=1, le=168),
    authenticated_wallet: Optional[str] = Depends(get_optional_wallet)
):
    """
    Get error summary for ZK proof generation
    
    Args:
        hours: Time range in hours
        current_user: Authenticated user
        
    Returns:
        Error counts by type
    """
    try:
        errors = monitoring_service.get_error_summary(hours=hours)
        
        return {
            "time_range_hours": hours,
            "total_errors": sum(errors.values()),
            "errors_by_type": errors
        }
    except Exception as e:
        logger.error(f"Failed to get error summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/performance")
async def get_performance_metrics(
    authenticated_wallet: Optional[str] = Depends(get_optional_wallet)
):
    """
    Get performance percentiles for proof generation
    
    Returns:
        Performance percentiles (p50, p90, p95, p99)
    """
    try:
        percentiles = monitoring_service.get_performance_percentiles()
        
        return {
            "duration_percentiles_ms": percentiles,
            "duration_percentiles_seconds": {
                k: v / 1000 for k, v in percentiles.items()
            }
        }
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_alerts(
    authenticated_wallet: str = Depends(get_current_wallet)
):
    """
    Get active alerts for ZK proof system
    
    Requires authentication
    
    Returns:
        List of active alerts
    """
    try:
        alerts = monitoring_service.check_alerts()
        
        return {
            "alert_count": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{wallet_address}")
async def get_user_metrics(
    wallet_address: str,
    authenticated_wallet: str = Depends(get_current_wallet)
):
    """
    Get metrics for specific user
    
    User can only access their own metrics
    
    Args:
        wallet_address: User's wallet address
        current_user: Authenticated user
        
    Returns:
        User-specific metrics
    """
    # Authorization: user can only access their own metrics
    if current_user.lower() != wallet_address.lower():
        raise HTTPException(
            status_code=403,
            detail="Can only access your own metrics"
        )
    
    try:
        metrics = monitoring_service.get_user_metrics(wallet_address)
        
        return metrics
    except Exception as e:
        logger.error(f"Failed to get user metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
async def export_metrics(
    hours: int = Query(default=24, ge=1, le=168),
    authenticated_wallet: str = Depends(get_current_wallet)
):
    """
    Export metrics as JSON
    
    Requires authentication
    
    Args:
        hours: Time range in hours
        current_user: Authenticated user
        
    Returns:
        Complete metrics export
    """
    try:
        export_data = monitoring_service.export_metrics(hours=hours)
        
        return {
            "export": export_data
        }
    except Exception as e:
        logger.error(f"Failed to export metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/record")
async def record_proof_attempt(
    wallet_address: str,
    threshold: int,
    success: bool,
    duration_ms: Optional[int] = None,
    stage: str = "generation",
    error: Optional[str] = None,
    gas_used: Optional[int] = None,
    tx_hash: Optional[str] = None,
    authenticated_wallet: str = Depends(get_current_wallet)
):
    """
    Record a proof generation attempt
    
    Called by frontend after proof generation
    
    Args:
        wallet_address: User's wallet
        threshold: Score threshold
        success: Whether proof generation succeeded
        duration_ms: Duration in milliseconds
        stage: Stage where error occurred
        error: Error message if failed
        gas_used: Gas used for transaction
        tx_hash: Transaction hash
        current_user: Authenticated user
        
    Returns:
        Success confirmation
    """
    # Authorization
    if current_user.lower() != wallet_address.lower():
        raise HTTPException(
            status_code=403,
            detail="Can only record your own proof attempts"
        )
    
    try:
        monitoring_service.record_proof_attempt(
            wallet_address=wallet_address,
            threshold=threshold,
            success=success,
            duration_ms=duration_ms,
            stage=stage,
            error=error,
            gas_used=gas_used,
            tx_hash=tx_hash
        )
        
        return {
            "success": True,
            "message": "Proof attempt recorded"
        }
    except Exception as e:
        logger.error(f"Failed to record proof attempt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """
    Health check for monitoring service
    
    Returns:
        Service health status
    """
    try:
        metrics = monitoring_service.get_system_metrics(hours=1)
        alerts = monitoring_service.check_alerts()
        
        # Determine health status
        critical_alerts = [a for a in alerts if a["severity"] == "high"]
        
        if critical_alerts:
            status = "degraded"
        elif alerts:
            status = "warning"
        else:
            status = "healthy"
        
        return {
            "status": status,
            "proofs_last_hour": metrics.total_proofs_generated,
            "success_rate": (
                metrics.successful_proofs / metrics.total_proofs_generated
                if metrics.total_proofs_generated > 0 else 1.0
            ),
            "alert_count": len(alerts),
            "critical_alerts": len(critical_alerts)
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
