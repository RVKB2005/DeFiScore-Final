"""
Create feature_data table
Run this once to add the new table to your database
"""
from database import engine, Base
from db_models import FeatureData
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_feature_data_table():
    """Create the feature_data table"""
    try:
        logger.info("Creating feature_data table...")
        FeatureData.__table__.create(engine, checkfirst=True)
        logger.info("✓ feature_data table created successfully")
    except Exception as e:
        logger.error(f"Failed to create table: {e}")
        raise

if __name__ == "__main__":
    create_feature_data_table()
