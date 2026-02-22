"""
Monitoring and Health Check Routes
System health and metrics endpoints
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any
from monitoring import monitor
from dependencies import get_current_wallet
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/monitoring", tags=["Monitoring"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    System health check
    Public endpoint - no authentication required
    """
    return monitor.check_system_health()


@router.get("/metrics/{metric_type}")
async def get_metrics(
    metric_type: str,
    hours: int = 24,
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Get metrics summary
    Requires authentication
    """
    # Only allow certain metric types for users
    allowed_metrics = ['score_calculation', 'api_request', 'cache']
    
    if metric_type not in allowed_metrics:
        return {"error": "Metric type not available"}
    
    return monitor.get_metrics_summary(metric_type, hours)


@router.get("/my-activity")
async def get_my_activity(
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Get activity summary for authenticated wallet
    """
    from database import SessionLocal
    from db_models import TaskLog, CreditScore
    from datetime import datetime, timedelta, timezone
    
    db = SessionLocal()
    try:
        # Get recent tasks
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        tasks = db.query(TaskLog).filter(
            TaskLog.wallet_address == current_wallet.lower(),
            TaskLog.created_at >= cutoff
        ).order_by(TaskLog.created_at.desc()).limit(10).all()
        
        # Get score history
        scores = db.query(CreditScore).filter(
            CreditScore.wallet_address == current_wallet.lower()
        ).order_by(CreditScore.calculated_at.desc()).limit(5).all()
        
        return {
            'wallet_address': current_wallet,
            'recent_tasks': [
                {
                    'task_id': t.task_id,
                    'task_name': t.task_name,
                    'status': t.status,
                    'created_at': t.created_at.isoformat(),
                    'completed_at': t.completed_at.isoformat() if t.completed_at else None
                }
                for t in tasks
            ],
            'score_history': [
                {
                    'score': s.score,
                    'calculated_at': s.calculated_at.isoformat(),
                    'networks': s.total_networks
                }
                for s in scores
            ]
        }
        
    finally:
        db.close()
