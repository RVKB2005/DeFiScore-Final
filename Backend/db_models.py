"""
Database Models
SQLAlchemy models for persistent storage
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Index, Float
from database import Base
from datetime import datetime, timezone


class CreditScore(Base):
    """Credit score storage"""
    __tablename__ = "credit_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    score = Column(Integer, nullable=False)
    score_breakdown = Column(Text, nullable=False)  # JSON string
    classification = Column(Text, nullable=False)  # JSON string
    networks_analyzed = Column(Text, nullable=False)  # JSON string
    total_networks = Column(Integer, nullable=False)
    calculated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_wallet_calculated', 'wallet_address', 'calculated_at'),
    )


class FeatureData(Base):
    """Feature vector storage for ZK proof generation"""
    __tablename__ = "feature_data"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    network = Column(String(50), nullable=False)
    chain_id = Column(Integer, nullable=False)
    features_json = Column(Text, nullable=False)  # Complete FeatureVector as JSON
    extracted_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_wallet_network', 'wallet_address', 'network'),
    )


class WebhookSubscription(Base):
    """Webhook subscriptions for notifications"""
    __tablename__ = "webhook_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    webhook_url = Column(String(500), nullable=False)
    secret = Column(String(100), nullable=False)  # For webhook verification
    events = Column(JSON, nullable=False)  # List of event types to subscribe to
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_wallet_active', 'wallet_address', 'is_active'),
    )


class RateLimitRecord(Base):
    """Rate limiting records"""
    __tablename__ = "rate_limit_records"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    endpoint = Column(String(100), nullable=False)
    request_count = Column(Integer, default=1, nullable=False)
    window_start = Column(DateTime(timezone=True), nullable=False)
    window_end = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_wallet_endpoint_window', 'wallet_address', 'endpoint', 'window_end'),
    )


class TaskLog(Base):
    """Celery task execution logs"""
    __tablename__ = "task_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), nullable=False, unique=True, index=True)
    task_name = Column(String(100), nullable=False)
    wallet_address = Column(String(42), nullable=False, index=True)
    status = Column(String(20), nullable=False)  # PENDING, STARTED, SUCCESS, FAILURE
    progress = Column(Integer, default=0)
    result = Column(Text, nullable=True)  # JSON string
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_wallet_status', 'wallet_address', 'status'),
        Index('idx_task_created', 'task_id', 'created_at'),
    )


class MetricsLog(Base):
    """System metrics and monitoring"""
    __tablename__ = "metrics_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    metric_type = Column(String(50), nullable=False, index=True)  # score_calculation, api_request, etc.
    metric_name = Column(String(100), nullable=False)
    value = Column(Float, nullable=False)
    tags = Column(JSON, nullable=True)  # Additional metadata
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    
    __table_args__ = (
        Index('idx_type_timestamp', 'metric_type', 'timestamp'),
    )


class AlertLog(Base):
    """System alerts and notifications"""
    __tablename__ = "alert_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), nullable=False, index=True)  # error, warning, info
    alert_level = Column(String(20), nullable=False)  # critical, high, medium, low
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    
    __table_args__ = (
        Index('idx_type_resolved', 'alert_type', 'resolved'),
    )


class BorrowRequest(Base):
    """Borrow requests from borrowers"""
    __tablename__ = "borrow_requests"
    
    id = Column(String(50), primary_key=True)  # req_xxxxx format
    borrower_address = Column(String(42), nullable=False, index=True)
    currency = Column(String(10), nullable=False)
    amount = Column(Float, nullable=False)
    collateral_percent = Column(Integer, nullable=False)
    requested_apy = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    
    # Supplier matching
    supplier_address = Column(String(42), nullable=True, index=True)
    offered_apy = Column(Float, nullable=True)
    terms = Column(Text, nullable=True)
    
    # ZK Proof verification
    zk_proof_verified = Column(Boolean, default=False)
    credit_score_threshold = Column(Integer, nullable=True)
    credit_score_actual = Column(Integer, nullable=True)
    zk_proof_data = Column(JSON, nullable=True)  # Stores proof for audit
    nullifier = Column(String(100), nullable=True, unique=True, index=True)  # Prevents replay
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    funded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Blockchain
    tx_hash = Column(String(66), nullable=True, index=True)
    
    __table_args__ = (
        Index('idx_borrower_status', 'borrower_address', 'status'),
        Index('idx_supplier_status', 'supplier_address', 'status'),
        Index('idx_currency_status', 'currency', 'status'),
    )


class SupplierIntent(Base):
    """Supplier liquidity provision intents"""
    __tablename__ = "supplier_intents"
    
    id = Column(String(50), primary_key=True)  # sup_xxxxx format
    supplier_address = Column(String(42), nullable=False, index=True)
    currency = Column(String(10), nullable=False, index=True)
    max_amount = Column(Float, nullable=False)
    available_amount = Column(Float, nullable=False)  # Decreases as loans are funded
    min_credit_score = Column(Integer, nullable=False)
    max_apy = Column(Float, nullable=False)
    active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_supplier_currency_active', 'supplier_address', 'currency', 'active'),
        Index('idx_currency_active', 'currency', 'active'),
    )


class LoanAgreement(Base):
    """Funded loan agreements"""
    __tablename__ = "loan_agreements"
    
    id = Column(String(50), primary_key=True)  # loan_xxxxx format
    borrow_request_id = Column(String(50), nullable=False, index=True)
    borrower_address = Column(String(42), nullable=False, index=True)
    lender_address = Column(String(42), nullable=False, index=True)
    
    # Loan terms
    currency = Column(String(10), nullable=False)
    amount = Column(Float, nullable=False)
    collateral_percent = Column(Integer, nullable=False)
    interest_rate = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=False)
    
    # Token addresses
    loan_token = Column(String(42), nullable=False)
    collateral_token = Column(String(42), nullable=False)
    
    # Repayment
    amount_repaid = Column(Float, default=0.0)
    is_fully_repaid = Column(Boolean, default=False)
    is_liquidated = Column(Boolean, default=False)
    
    # Status: pending_collateral, pending_funding, active, repaid, defaulted, liquidated
    status = Column(String(20), nullable=False, default="pending_collateral", index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    collateral_deposited_at = Column(DateTime(timezone=True), nullable=True)
    funded_at = Column(DateTime(timezone=True), nullable=True)
    start_time = Column(Integer, nullable=True)  # Unix timestamp from blockchain
    due_date = Column(Integer, nullable=True)  # Unix timestamp from blockchain
    repaid_at = Column(DateTime(timezone=True), nullable=True)
    defaulted_at = Column(DateTime(timezone=True), nullable=True)
    liquidated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Blockchain
    blockchain_tx_hash = Column(String(66), nullable=True, index=True)
    
    __table_args__ = (
        Index('idx_loan_borrower_status', 'borrower_address', 'status'),
        Index('idx_loan_lender_status', 'lender_address', 'status'),
    )
