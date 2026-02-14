import redis
from typing import Optional
from datetime import datetime, timedelta
from config import settings
import json


class NonceStore:
    """Redis-based nonce storage with expiration"""
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    
    def _get_key(self, address: str) -> str:
        """Generate Redis key for address"""
        return f"nonce:{address.lower()}"
    
    def store_nonce(self, address: str, nonce: str, expires_in: int = None) -> datetime:
        """
        Store nonce for address with expiration
        
        Args:
            address: Wallet address
            nonce: Generated nonce
            expires_in: Expiration time in seconds (default from settings)
        
        Returns:
            Expiration datetime
        """
        if expires_in is None:
            expires_in = settings.NONCE_EXPIRE_SECONDS
        
        key = self._get_key(address)
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        data = {
            'nonce': nonce,
            'created_at': datetime.utcnow().isoformat(),
            'expires_at': expires_at.isoformat()
        }
        
        self.redis_client.setex(
            key,
            expires_in,
            json.dumps(data)
        )
        
        return expires_at
    
    def get_nonce(self, address: str) -> Optional[str]:
        """
        Retrieve nonce for address
        
        Args:
            address: Wallet address
        
        Returns:
            Nonce string or None if not found/expired
        """
        key = self._get_key(address)
        data = self.redis_client.get(key)
        
        if data is None:
            return None
        
        try:
            parsed = json.loads(data)
            return parsed.get('nonce')
        except Exception:
            return None
    
    def verify_and_consume_nonce(self, address: str, nonce: str) -> bool:
        """
        Verify nonce exists and matches, then delete it (single-use)
        
        Args:
            address: Wallet address
            nonce: Nonce to verify
        
        Returns:
            True if nonce is valid and consumed
        """
        stored_nonce = self.get_nonce(address)
        
        if stored_nonce is None:
            return False
        
        if stored_nonce != nonce:
            return False
        
        # Delete nonce immediately (single-use)
        key = self._get_key(address)
        self.redis_client.delete(key)
        
        return True
    
    def delete_nonce(self, address: str) -> bool:
        """
        Delete nonce for address
        
        Args:
            address: Wallet address
        
        Returns:
            True if deleted
        """
        key = self._get_key(address)
        return self.redis_client.delete(key) > 0


class InMemoryNonceStore:
    """In-memory fallback nonce store (for development without Redis)"""
    
    def __init__(self):
        self.store = {}
    
    def store_nonce(self, address: str, nonce: str, expires_in: int = None) -> datetime:
        if expires_in is None:
            expires_in = settings.NONCE_EXPIRE_SECONDS
        
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        self.store[address.lower()] = {
            'nonce': nonce,
            'expires_at': expires_at
        }
        
        return expires_at
    
    def get_nonce(self, address: str) -> Optional[str]:
        data = self.store.get(address.lower())
        
        if data is None:
            return None
        
        if datetime.utcnow() > data['expires_at']:
            del self.store[address.lower()]
            return None
        
        return data['nonce']
    
    def verify_and_consume_nonce(self, address: str, nonce: str) -> bool:
        stored_nonce = self.get_nonce(address)
        
        if stored_nonce is None:
            return False
        
        if stored_nonce != nonce:
            return False
        
        del self.store[address.lower()]
        return True
    
    def delete_nonce(self, address: str) -> bool:
        if address.lower() in self.store:
            del self.store[address.lower()]
            return True
        return False


def get_nonce_store():
    """Factory function to get appropriate nonce store"""
    # Check if Redis is explicitly enabled in configuration
    if not settings.REDIS_ENABLED:
        return InMemoryNonceStore()
    
    try:
        store = NonceStore()
        # Test the connection
        store.redis_client.ping()
        return store
    except (redis.ConnectionError, redis.exceptions.ConnectionError, Exception):
        # Silently fall back to in-memory store
        return InMemoryNonceStore()
