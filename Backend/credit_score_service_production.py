"""
Production Credit Score Service
Uses Celery, Redis, Database, and Monitoring with FICO-based Credit Score Engine
"""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging
from credit_score_models import (
    CreditScoreRequest,
    CreditScoreResponse,
    ScoreStatus,
    ScoreRefreshRequest
)
from redis_cache import redis_cache
from rate_limiter import rate_limiter
from monitoring import monitor, monitor_performance
from database import SessionLocal
from db_models import CreditScore, TaskLog
import json

logger = logging.getLogger(__name__)


class ProductionCreditScoreService:
    """
    Production-grade credit scoring service
    Uses FICO-based credit score engine for accurate scoring
    """
    
    def __init__(self):
        # No custom scoring logic - we use credit_score_engine
        pass
    
    def _get_score_band(self, score: int) -> str:
        """
        Get score band classification
        
        Args:
            score: Credit score (0-900)
            
        Returns:
            Score band string
        """
        if score >= 800:
            return "excellent"
        elif score >= 740:
            return "very_good"
        elif score >= 670:
            return "good"
        elif score >= 580:
            return "fair"
        elif score >= 500:
            return "poor"
        else:
            return "very_poor"
    
    @monitor_performance('get_credit_score')
    async def get_credit_score(
        self,
        request: CreditScoreRequest,
        authenticated_wallet: str
    ) -> CreditScoreResponse:
        """
        Get credit score with production features
        Uses Celery background task with FICO-based engine
        """
        # SECURITY CHECK
        if request.wallet_address.lower() != authenticated_wallet.lower():
            monitor.create_alert(
                alert_type='security',
                alert_level='high',
                message=f'Unauthorized score access attempt',
                details={'requester': authenticated_wallet, 'target': request.wallet_address}
            )
            return CreditScoreResponse(
                wallet_address=request.wallet_address,
                status=ScoreStatus.FAILED,
                message="Unauthorized: You can only request your own credit score"
            )
        
        wallet_address = request.wallet_address.lower()
        
        # RATE LIMITING
        allowed, retry_after = rate_limiter.check_rate_limit(wallet_address, 'score_calculation')
        if not allowed:
            monitor.record_metric('rate_limit', 'score_calculation_blocked', 1, {'wallet': wallet_address})
            return CreditScoreResponse(
                wallet_address=wallet_address,
                status=ScoreStatus.FAILED,
                message=f"Rate limit exceeded. Try again in {retry_after} seconds."
            )
        
        # Check Redis cache first
        if not request.force_refresh:
            cached = redis_cache.get_score(wallet_address)
            if cached:
                age_hours = redis_cache.get_age_hours(wallet_address)
                is_stale = redis_cache.is_stale(wallet_address)
                
                monitor.record_metric('cache', 'score_hit', 1, {'wallet': wallet_address})
                
                return CreditScoreResponse(
                    wallet_address=wallet_address,
                    status=ScoreStatus.STALE if is_stale else ScoreStatus.COMPLETED,
                    score=cached['score'],
                    score_breakdown=cached['score_breakdown'],
                    last_updated=datetime.fromisoformat(cached['calculated_at']),
                    message=f"Cached score (updated {age_hours:.1f} hours ago)" + 
                            (" - Consider refreshing" if is_stale else "")
                )
            
            monitor.record_metric('cache', 'score_miss', 1, {'wallet': wallet_address})
        
        # Check database for existing score
        db = SessionLocal()
        try:
            db_score = db.query(CreditScore).filter(
                CreditScore.wallet_address == wallet_address
            ).order_by(CreditScore.calculated_at.desc()).first()
            
            if db_score and not request.force_refresh:
                # Return from database
                return CreditScoreResponse(
                    wallet_address=wallet_address,
                    status=ScoreStatus.COMPLETED,
                    score=db_score.score,
                    score_breakdown=json.loads(db_score.score_breakdown),
                    last_updated=db_score.calculated_at,
                    message="Score retrieved from database"
                )
        finally:
            db.close()
        
        # Check for running task
        db = SessionLocal()
        try:
            running_task = db.query(TaskLog).filter(
                TaskLog.wallet_address == wallet_address,
                TaskLog.status.in_(['PENDING', 'STARTED'])
            ).first()
            
            if running_task:
                return CreditScoreResponse(
                    wallet_address=wallet_address,
                    status=ScoreStatus.PROCESSING,
                    job_id=running_task.task_id,
                    message=f"Score calculation in progress ({running_task.progress}% complete)"
                )
        finally:
            db.close()
        
        # Start new Celery task (uses FICO-based engine)
        from celery_tasks import calculate_credit_score_task
        
        task = calculate_credit_score_task.delay(wallet_address, request.networks)
        
        # Log task
        db = SessionLocal()
        try:
            task_log = TaskLog(
                task_id=task.id,
                task_name='calculate_credit_score',
                wallet_address=wallet_address,
                status='PENDING',
                progress=0
            )
            db.add(task_log)
            db.commit()
        finally:
            db.close()
        
        monitor.record_metric('tasks', 'score_calculation_started', 1, {'wallet': wallet_address})
        
        return CreditScoreResponse(
            wallet_address=wallet_address,
            status=ScoreStatus.PROCESSING,
            job_id=task.id,
            message="Score calculation started. You can close this page and check back later."
        )
    
    async def refresh_score(
        self,
        request: ScoreRefreshRequest,
        authenticated_wallet: str
    ) -> CreditScoreResponse:
        """Refresh score with rate limiting"""
        # SECURITY CHECK
        if request.wallet_address.lower() != authenticated_wallet.lower():
            return CreditScoreResponse(
                wallet_address=request.wallet_address,
                status=ScoreStatus.FAILED,
                message="Unauthorized"
            )
        
        # RATE LIMITING
        allowed, retry_after = rate_limiter.check_rate_limit(
            request.wallet_address,
            'score_refresh'
        )
        if not allowed:
            return CreditScoreResponse(
                wallet_address=request.wallet_address,
                status=ScoreStatus.FAILED,
                message=f"Rate limit exceeded. Try again in {retry_after} seconds."
            )
        
        # Invalidate cache
        redis_cache.delete_score(request.wallet_address)
        
        # Trigger new calculation
        return await self.get_credit_score(
            CreditScoreRequest(
                wallet_address=request.wallet_address,
                force_refresh=True
            ),
            authenticated_wallet
        )
    
    async def get_job_status(
        self,
        job_id: str,
        authenticated_wallet: str
    ) -> Optional[Dict[str, Any]]:
        """Get Celery task status"""
        from celery_app import celery_app
        
        db = SessionLocal()
        try:
            task_log = db.query(TaskLog).filter(TaskLog.task_id == job_id).first()
            
            if not task_log:
                return None
            
            # SECURITY CHECK
            if task_log.wallet_address != authenticated_wallet.lower():
                return None
            
            # Get Celery task result
            task = celery_app.AsyncResult(job_id)
            
            response = {
                'job_id': job_id,
                'wallet_address': task_log.wallet_address,
                'status': task.state,
                'progress': task_log.progress,
                'created_at': task_log.created_at.isoformat()
            }
            
            if task.state == 'PROGRESS':
                response['info'] = task.info
            elif task.state == 'SUCCESS':
                response['result'] = task.result
            elif task.state == 'FAILURE':
                response['error'] = str(task.info)
            
            return response
            
        finally:
            db.close()


# Global service instance
production_credit_score_service = ProductionCreditScoreService()
