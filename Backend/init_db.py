"""
Database initialization script
Run this to create all required tables
"""
from database import DatabaseManager
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database():
    """Initialize database tables"""
    try:
        logger.info("Initializing database...")
        logger.info(f"Database URL: {settings.DATABASE_URL}")
        
        db_manager = DatabaseManager()
        db_manager.create_tables()
        
        logger.info("Database initialized successfully!")
        logger.info("Tables created:")
        logger.info("  - wallet_metadata")
        logger.info("  - transactions")
        logger.info("  - protocol_events")
        logger.info("  - balance_snapshots")
        logger.info("  - ingestion_logs")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


if __name__ == "__main__":
    init_database()
