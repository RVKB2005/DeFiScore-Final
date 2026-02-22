"""
Initialize Production Database
Creates all tables for production features
"""
from database import DatabaseManager, Base
from db_models import (
    CreditScore,
    WebhookSubscription,
    RateLimitRecord,
    TaskLog,
    MetricsLog,
    AlertLog
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_production_db():
    """Create all production tables"""
    try:
        logger.info("Creating production database tables...")
        
        # Create database manager
        db_manager = DatabaseManager()
        
        # Create all tables
        Base.metadata.create_all(bind=db_manager.engine)
        
        logger.info("✓ Production database tables created successfully!")
        logger.info("Tables created:")
        logger.info("  - credit_scores: Store calculated scores")
        logger.info("  - webhook_subscriptions: Webhook registrations")
        logger.info("  - rate_limit_records: Rate limiting data")
        logger.info("  - task_logs: Celery task tracking")
        logger.info("  - metrics_logs: System metrics")
        logger.info("  - alert_logs: System alerts")
        
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
        raise


if __name__ == "__main__":
    init_production_db()
