"""
Database configuration and models for data ingestion
Uses PostgreSQL for structured data storage
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, BigInteger, Enum as SQLEnum, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from config import settings
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()


class WalletMetadataDB(Base):
    """Wallet metadata table"""
    __tablename__ = "wallet_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), index=True, nullable=False)
    network = Column(String(50), index=True, nullable=False, default="ethereum")
    chain_id = Column(Integer, nullable=False, default=1)
    first_seen_block = Column(Integer, nullable=False)
    first_seen_timestamp = Column(DateTime, nullable=False)
    current_balance_wei = Column(BigInteger, nullable=False)
    current_balance_eth = Column(Float, nullable=False)
    transaction_count = Column(Integer, nullable=False)
    ingestion_timestamp = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TransactionRecordDB(Base):
    """Transaction records table"""
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    tx_hash = Column(String(66), index=True, nullable=False)
    network = Column(String(50), index=True, nullable=False, default="ethereum")
    chain_id = Column(Integer, nullable=False, default=1)
    wallet_address = Column(String(42), index=True, nullable=False)
    block_number = Column(Integer, index=True, nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    from_address = Column(String(42), nullable=False)
    to_address = Column(String(42), nullable=True)
    value_wei = Column(BigInteger, nullable=False)
    value_eth = Column(Float, nullable=False)
    gas_used = Column(Integer, nullable=True)
    gas_price_wei = Column(BigInteger, nullable=True)
    status = Column(Boolean, nullable=False)
    is_contract_interaction = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProtocolEventDB(Base):
    """Protocol events table"""
    __tablename__ = "protocol_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), index=True, nullable=False)
    wallet_address = Column(String(42), index=True, nullable=False)
    network = Column(String(50), index=True, nullable=False, default="ethereum")
    chain_id = Column(Integer, nullable=False, default=1)
    protocol_name = Column(String(100), index=True, nullable=False)
    contract_address = Column(String(42), index=True, nullable=False)
    tx_hash = Column(String(66), index=True, nullable=False)
    block_number = Column(Integer, index=True, nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    asset = Column(String(42), nullable=True)
    amount_wei = Column(BigInteger, nullable=True)
    amount_eth = Column(Float, nullable=True)
    log_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class BalanceSnapshotDB(Base):
    """Balance snapshots table"""
    __tablename__ = "balance_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), index=True, nullable=False)
    network = Column(String(50), index=True, nullable=False, default="ethereum")
    chain_id = Column(Integer, nullable=False, default=1)
    block_number = Column(Integer, index=True, nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    balance_wei = Column(BigInteger, nullable=False)
    balance_eth = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class IngestionLogDB(Base):
    """Ingestion operation log"""
    __tablename__ = "ingestion_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), index=True, nullable=False)
    start_block = Column(Integer, nullable=False)
    end_block = Column(Integer, nullable=False)
    total_transactions = Column(Integer, default=0)
    total_protocol_events = Column(Integer, default=0)
    balance_snapshots = Column(Integer, default=0)
    status = Column(String(20), nullable=False)
    errors = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=False)


class DatabaseManager:
    """Database connection and session management"""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or settings.DATABASE_URL
        self.engine = create_engine(self.database_url, pool_pre_ping=True)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    def create_tables(self):
        """Create all tables"""
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created successfully")
    
    def get_session(self):
        """Get database session"""
        return self.SessionLocal()
    
    def drop_tables(self):
        """Drop all tables (use with caution)"""
        Base.metadata.drop_all(bind=self.engine)
        logger.warning("All database tables dropped")


# Dependency for FastAPI
def get_db():
    """Database session dependency"""
    db_manager = DatabaseManager()
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()
