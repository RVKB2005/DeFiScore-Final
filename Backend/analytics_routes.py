"""
Analytics Routes - User and Platform Statistics
Provides real analytics data for the dashboard
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from database import get_db
from db_models import CreditScore, RateLimitRecord
from datetime import datetime, timedelta
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/active-users")
async def get_active_users(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Get count of active users (unique wallet addresses that have interacted with the platform)
    """
    try:
        # Count unique wallets from CreditScore table (users who calculated scores)
        unique_credit_users = db.query(func.count(distinct(CreditScore.wallet_address))).scalar() or 0
        
        # Count unique wallets from RateLimitRecord (all API interactions)
        unique_api_users = db.query(func.count(distinct(RateLimitRecord.wallet_address))).scalar() or 0
        
        # Use the higher count (some users may only use API without calculating score)
        total_users = max(unique_credit_users, unique_api_users)
        
        # Get users active in last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        active_24h = db.query(func.count(distinct(RateLimitRecord.wallet_address)))\
            .filter(RateLimitRecord.window_end >= yesterday)\
            .scalar() or 0
        
        # Get users active in last 7 days
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_7d = db.query(func.count(distinct(RateLimitRecord.wallet_address)))\
            .filter(RateLimitRecord.window_end >= week_ago)\
            .scalar() or 0
        
        # Calculate growth (compare last 7 days to previous 7 days)
        two_weeks_ago = datetime.utcnow() - timedelta(days=14)
        previous_7d = db.query(func.count(distinct(RateLimitRecord.wallet_address)))\
            .filter(RateLimitRecord.window_end >= two_weeks_ago)\
            .filter(RateLimitRecord.window_end < week_ago)\
            .scalar() or 0
        
        growth_percentage = 0
        if previous_7d > 0:
            growth_percentage = ((active_7d - previous_7d) / previous_7d) * 100
        elif active_7d > 0:
            growth_percentage = 100  # First week, 100% growth
        
        return {
            "total_users": total_users,
            "active_24h": active_24h,
            "active_7d": active_7d,
            "growth_percentage": round(growth_percentage, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error fetching active users: {e}")
        # Return fallback data
        return {
            "total_users": 0,
            "active_24h": 0,
            "active_7d": 0,
            "growth_percentage": 0,
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/platform-stats")
async def get_platform_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Get overall platform statistics
    """
    try:
        # Total credit scores calculated
        total_scores = db.query(func.count(CreditScore.id)).scalar() or 0
        
        # Average credit score
        avg_score = db.query(func.avg(CreditScore.score)).scalar() or 0
        
        # Scores calculated in last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        scores_24h = db.query(func.count(CreditScore.id))\
            .filter(CreditScore.calculated_at >= yesterday)\
            .scalar() or 0
        
        return {
            "total_scores_calculated": total_scores,
            "average_credit_score": round(avg_score, 2) if avg_score else 0,
            "scores_calculated_24h": scores_24h,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error fetching platform stats: {e}")
        return {
            "total_scores_calculated": 0,
            "average_credit_score": 0,
            "scores_calculated_24h": 0,
            "timestamp": datetime.utcnow().isoformat()
        }
