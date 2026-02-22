"""
Redis Cache Manager
Production-grade caching with Redis
"""
import redis
import json
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from config import settings
import logging

logger = logging.getLogger(__name__)


class RedisCache:
    """
    Redis-based cache for credit scores
    Production-ready with connection pooling
    """
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30
        )
        self.default_ttl_seconds = 86400  # 24 hours
    
    def _get_key(self, wallet_address: str) -> str:
        """Generate Redis key for wallet"""
        return f"score:{wallet_address.lower()}"
    
    def _generate_data_hash(self, data: Dict[str, Any]) -> str:
        """Generate hash of input data"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def get_score(self, wallet_address: str) -> Optional[Dict[str, Any]]:
        """
        Get cached score from Redis
        
        Returns:
            Dict with score data or None if not found/expired
        """
        try:
            key = self._get_key(wallet_address)
            data = self.redis_client.get(key)
            
            if not data:
                return None
            
            score_data = json.loads(data)
            logger.info(f"Redis cache hit for {wallet_address}")
            return score_data
            
        except redis.RedisError as e:
            logger.error(f"Redis error getting score: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting score from cache: {e}")
            return None
    
    def set_score(
        self,
        wallet_address: str,
        score: int,
        score_breakdown: Dict[str, Any],
        classification: Dict[str, str],
        networks_analyzed: list,
        total_networks: int,
        ttl_hours: Optional[int] = None
    ):
        """
        Cache score in Redis
        
        Args:
            wallet_address: Wallet address
            score: Credit score
            score_breakdown: Detailed breakdown
            classification: Behavioral classification
            networks_analyzed: List of networks
            total_networks: Total number of networks
            ttl_hours: Time to live in hours
        """
        try:
            key = self._get_key(wallet_address)
            ttl = ttl_hours or 24
            
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(hours=ttl)
            
            data = {
                'wallet_address': wallet_address.lower(),
                'score': score,
                'score_breakdown': score_breakdown,
                'classification': classification,
                'networks_analyzed': networks_analyzed,
                'total_networks': total_networks,
                'calculated_at': now.isoformat(),
                'expires_at': expires_at.isoformat()
            }
            
            self.redis_client.setex(
                key,
                ttl * 3600,
                json.dumps(data)
            )
            
            logger.info(f"Cached score for {wallet_address} in Redis (TTL: {ttl}h)")
            
        except redis.RedisError as e:
            logger.error(f"Redis error setting score: {e}")
        except Exception as e:
            logger.error(f"Error caching score: {e}")
    
    def delete_score(self, wallet_address: str):
        """Delete cached score"""
        try:
            key = self._get_key(wallet_address)
            self.redis_client.delete(key)
            logger.info(f"Deleted cached score for {wallet_address}")
        except redis.RedisError as e:
            logger.error(f"Redis error deleting score: {e}")
    
    def get_age_hours(self, wallet_address: str) -> Optional[float]:
        """Get age of cached score in hours"""
        score_data = self.get_score(wallet_address)
        if not score_data:
            return None
        
        calculated_at = datetime.fromisoformat(score_data['calculated_at'])
        now = datetime.now(timezone.utc)
        age = (now - calculated_at).total_seconds() / 3600
        return age
    
    def is_stale(self, wallet_address: str, stale_threshold_hours: int = 12) -> bool:
        """Check if cached score is stale"""
        age = self.get_age_hours(wallet_address)
        if age is None:
            return True
        return age >= stale_threshold_hours
    
    def health_check(self) -> bool:
        """Check Redis connection health"""
        try:
            return self.redis_client.ping()
        except redis.RedisError:
            return False


# Global Redis cache instance
redis_cache = RedisCache()
