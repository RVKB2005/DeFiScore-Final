"""
Reset All Data
Clears all data from database and Redis cache
"""
import logging
from database import SessionLocal, Base, engine
from db_models import (
    CreditScore,
    AlertLog,
    MetricsLog,
    RateLimitRecord,
    TaskLog,
    WebhookSubscription
)
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def reset_database():
    """Drop and recreate all database tables"""
    logger.info("Resetting database...")
    
    try:
        # Drop all tables
        logger.info("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        logger.info("✓ All tables dropped")
        
        # Recreate all tables
        logger.info("Recreating all tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✓ All tables recreated")
        
        # Verify tables exist
        db = SessionLocal()
        try:
            result = db.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]
            
            logger.info(f"✓ Database reset complete. Tables created:")
            for table in tables:
                logger.info(f"  - {table}")
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Database reset failed: {e}")
        raise


def reset_redis_cache():
    """Clear all Redis cache data"""
    logger.info("Resetting Redis cache...")
    
    try:
        from redis_cache import redis_cache
        
        # Get Redis client
        redis_client = redis_cache.redis_client
        
        # Get all keys
        keys = redis_client.keys('*')
        
        if keys:
            logger.info(f"Found {len(keys)} keys in Redis")
            
            # Delete all keys
            deleted = redis_client.delete(*keys)
            logger.info(f"✓ Deleted {deleted} keys from Redis")
        else:
            logger.info("✓ Redis cache is already empty")
            
    except ImportError:
        logger.warning("Redis cache not available (redis_cache module not found)")
    except Exception as e:
        logger.error(f"Redis reset failed: {e}")
        # Don't raise - Redis might not be running


def main():
    """Main reset function"""
    print("\n" + "="*80)
    print("RESET ALL DATA - DATABASE & CACHE")
    print("="*80)
    print("WARNING: This will delete ALL data from:")
    print("  - PostgreSQL database (all tables)")
    print("  - Redis cache (all keys)")
    print("="*80)
    
    response = input("\nAre you sure you want to continue? (yes/no): ")
    
    if response.lower() != 'yes':
        logger.info("Reset cancelled by user")
        return
    
    print("\n" + "="*80)
    
    # Reset database
    reset_database()
    
    print("")
    
    # Reset Redis cache
    reset_redis_cache()
    
    print("\n" + "="*80)
    print("✓ RESET COMPLETE")
    print("="*80)
    print("All data has been cleared. The system is ready for fresh data.")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
