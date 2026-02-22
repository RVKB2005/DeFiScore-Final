"""
Database Migration: Add Lending Marketplace Tables
Run this to add borrow_requests, supplier_intents, and loan_agreements tables
"""
from database import engine, Base
from db_models import BorrowRequest, SupplierIntent, LoanAgreement
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    """Create lending marketplace tables"""
    try:
        logger.info("Creating lending marketplace tables...")
        
        # Create tables
        Base.metadata.create_all(bind=engine, tables=[
            BorrowRequest.__table__,
            SupplierIntent.__table__,
            LoanAgreement.__table__
        ])
        
        logger.info("✓ Successfully created lending marketplace tables:")
        logger.info("  - borrow_requests")
        logger.info("  - supplier_intents")
        logger.info("  - loan_agreements")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    migrate()
