"""
Rate Limiter
Per-wallet rate limiting for API endpoints
"""
import redis
from typing import Optional
from datetime import datetime, timedelta, timezone
from config import settings
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Redis-based rate limiter with per-wallet limits
    """
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=3,  # Separate DB for rate limiting
            decode_responses=True
        )
        
        # Rate limit configurations
        self.limits = {
            'score_calculation': {'requests': 5, 'window': 3600},  # 5 per hour
            'score_refresh': {'requests': 10, 'window': 3600},  # 10 per hour
            'score_lookup': {'requests': 100, 'window': 3600},  # 100 per hour
            'webhook_register': {'requests': 5, 'window': 86400},  # 5 per day
            'borrow_request_create': {'requests': 10, 'window': 3600},  # 10 per hour
        }
    
    def _get_key(self, wallet_address: str, endpoint: str) -> str:
        """Generate Redis key for rate limit"""
        return f"ratelimit:{wallet_address.lower()}:{endpoint}"
    
    def check_rate_limit(
        self,
        wallet_address: str,
        endpoint: str
    ) -> tuple[bool, Optional[int]]:
        """
        Check if request is within rate limit
        
        Args:
            wallet_address: Wallet address
            endpoint: API endpoint identifier
            
        Returns:
            (allowed: bool, retry_after: Optional[int])
        """
        try:
            limit_config = self.limits.get(endpoint)
            if not limit_config:
                # No limit configured, allow
                return True, None
            
            key = self._get_key(wallet_address, endpoint)
            max_requests = limit_config['requests']
            window_seconds = limit_config['window']
            
            # Get current count
            current = self.redis_client.get(key)
            
            if current is None:
                # First request in window
                self.redis_client.setex(key, window_seconds, 1)
                logger.info(f"Rate limit: {wallet_address} - {endpoint}: 1/{max_requests}")
                return True, None
            
            current_count = int(current)
            
            if current_count >= max_requests:
                # Rate limit exceeded
                ttl = self.redis_client.ttl(key)
                logger.warning(f"Rate limit exceeded: {wallet_address} - {endpoint}: {current_count}/{max_requests}")
                return False, ttl
            
            # Increment counter
            self.redis_client.incr(key)
            logger.info(f"Rate limit: {wallet_address} - {endpoint}: {current_count + 1}/{max_requests}")
            return True, None
            
        except redis.RedisError as e:
            logger.critical(f"Redis error in rate limiter: {e} - DENYING REQUEST for security")
            # Fail closed - deny request if Redis is down (security best practice)
            return False, 60  # Retry after 60 seconds
    
    def reset_limit(self, wallet_address: str, endpoint: str):
        """Reset rate limit for wallet/endpoint"""
        try:
            key = self._get_key(wallet_address, endpoint)
            self.redis_client.delete(key)
            logger.info(f"Reset rate limit for {wallet_address} - {endpoint}")
        except redis.RedisError as e:
            logger.error(f"Redis error resetting limit: {e}")
    
    def get_remaining(
        self,
        wallet_address: str,
        endpoint: str
    ) -> Optional[int]:
        """Get remaining requests in current window"""
        try:
            limit_config = self.limits.get(endpoint)
            if not limit_config:
                return None
            
            key = self._get_key(wallet_address, endpoint)
            current = self.redis_client.get(key)
            
            if current is None:
                return limit_config['requests']
            
            return max(0, limit_config['requests'] - int(current))
            
        except redis.RedisError as e:
            logger.error(f"Redis error getting remaining: {e}")
            return None


# Global rate limiter instance
rate_limiter = RateLimiter()
