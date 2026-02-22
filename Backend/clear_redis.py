"""
Clear Redis Cache
Quick script to clear all Redis cache data without touching the database
"""
import logging
from redis_cache import redis_cache

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def clear_redis():
    """Clear all Redis cache data"""
    print("\n" + "="*80)
    print("CLEAR REDIS CACHE")
    print("="*80)
    
    try:
        # Get Redis client
        redis_client = redis_cache.redis_client
        
        # Check connection
        if not redis_client.ping():
            logger.error("❌ Cannot connect to Redis")
            return False
        
        logger.info("✓ Connected to Redis")
        
        # Get all keys
        keys = redis_client.keys('*')
        
        if keys:
            logger.info(f"Found {len(keys)} keys in Redis:")
            for key in keys[:10]:  # Show first 10 keys
                logger.info(f"  - {key}")
            if len(keys) > 10:
                logger.info(f"  ... and {len(keys) - 10} more")
            
            # Delete all keys
            deleted = redis_client.delete(*keys)
            logger.info(f"✓ Deleted {deleted} keys from Redis")
        else:
            logger.info("✓ Redis cache is already empty")
        
        print("="*80)
        print("✓ REDIS CACHE CLEARED")
        print("="*80 + "\n")
        return True
        
    except Exception as e:
        logger.error(f"❌ Redis clear failed: {e}")
        return False


if __name__ == "__main__":
    clear_redis()
