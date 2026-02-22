"""
Score Cache Manager
Handles caching of credit scores with security and expiration
"""
import hashlib
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from credit_score_models import CachedScore
import logging

logger = logging.getLogger(__name__)


class ScoreCache:
    """
    Secure cache for credit scores
    In production, use Redis or similar
    """
    
    def __init__(self, default_ttl_hours: int = 24):
        self.cache: Dict[str, CachedScore] = {}
        self.default_ttl_hours = default_ttl_hours
    
    def _generate_data_hash(self, data: Dict[str, Any]) -> str:
        """Generate hash of input data for verification"""
        # Sort keys for consistent hashing
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def _is_expired(self, cached_score: CachedScore) -> bool:
        """Check if cached score is expired"""
        now = datetime.now(timezone.utc)
        return now >= cached_score.expires_at
    
    def get(self, wallet_address: str) -> Optional[CachedScore]:
        """
        Get cached score for wallet
        Returns None if not found or expired
        """
        wallet_lower = wallet_address.lower()
        cached = self.cache.get(wallet_lower)
        
        if not cached:
            return None
        
        if self._is_expired(cached):
            logger.info(f"Cached score for {wallet_address} expired")
            del self.cache[wallet_lower]
            return None
        
        logger.info(f"Cache hit for {wallet_address}")
        return cached
    
    def set(
        self,
        wallet_address: str,
        score: int,
        score_breakdown: Dict[str, Any],
        classification: Dict[str, str],
        networks_analyzed: list[str],
        total_networks: int,
        input_data: Dict[str, Any],
        ttl_hours: Optional[int] = None
    ) -> CachedScore:
        """Cache a credit score"""
        wallet_lower = wallet_address.lower()
        ttl = ttl_hours or self.default_ttl_hours
        
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=ttl)
        
        data_hash = self._generate_data_hash(input_data)
        
        cached_score = CachedScore(
            wallet_address=wallet_lower,
            score=score,
            score_breakdown=score_breakdown,
            classification=classification,
            networks_analyzed=networks_analyzed,
            total_networks=total_networks,
            calculated_at=now,
            expires_at=expires_at,
            data_hash=data_hash
        )
        
        self.cache[wallet_lower] = cached_score
        logger.info(f"Cached score for {wallet_address} (expires in {ttl}h)")
        
        return cached_score
    
    def invalidate(self, wallet_address: str):
        """Invalidate cached score for wallet"""
        wallet_lower = wallet_address.lower()
        if wallet_lower in self.cache:
            del self.cache[wallet_lower]
            logger.info(f"Invalidated cache for {wallet_address}")
    
    def get_age_hours(self, wallet_address: str) -> Optional[float]:
        """Get age of cached score in hours"""
        cached = self.get(wallet_address)
        if not cached:
            return None
        
        now = datetime.now(timezone.utc)
        age = (now - cached.calculated_at).total_seconds() / 3600
        return age
    
    def is_stale(self, wallet_address: str, stale_threshold_hours: int = 12) -> bool:
        """Check if cached score is stale (old but not expired)"""
        age = self.get_age_hours(wallet_address)
        if age is None:
            return True
        return age >= stale_threshold_hours
    
    def cleanup_expired(self):
        """Remove all expired entries"""
        now = datetime.now(timezone.utc)
        to_remove = []
        
        for wallet, cached in self.cache.items():
            if now >= cached.expires_at:
                to_remove.append(wallet)
        
        for wallet in to_remove:
            del self.cache[wallet]
        
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} expired cache entries")


# Global cache instance
score_cache = ScoreCache(default_ttl_hours=24)
