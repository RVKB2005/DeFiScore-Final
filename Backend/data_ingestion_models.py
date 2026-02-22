"""
Data models for blockchain data ingestion
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class IngestionWindow(BaseModel):
    """Time window for data ingestion"""
    start_block: int
    end_block: int
    start_timestamp: Optional[datetime] = None
    end_timestamp: Optional[datetime] = None


class WalletMetadata(BaseModel):
    """Wallet metadata snapshot"""
    wallet_address: str
    first_seen_block: int
    first_seen_timestamp: datetime
    current_balance_wei: int
    current_balance_eth: float
    transaction_count: int
    ingestion_timestamp: datetime = Field(default_factory=datetime.utcnow)


class TransactionRecord(BaseModel):
    """Normalized transaction record"""
    tx_hash: str
    wallet_address: str
    block_number: int
    timestamp: datetime
    from_address: str
    to_address: Optional[str]
    value_wei: int
    value_eth: float
    gas_used: Optional[int]
    gas_price_wei: Optional[int]
    status: bool
    is_contract_interaction: bool


class ProtocolEventType(str, Enum):
    """DeFi protocol event types"""
    DEPOSIT = "deposit"
    WITHDRAW = "withdraw"
    BORROW = "borrow"
    REPAY = "repay"
    LIQUIDATION = "liquidation"
    SUPPLY = "supply"
    SWAP = "swap"
    UNKNOWN = "unknown"



class ProtocolEvent(BaseModel):
    """Protocol interaction event"""
    event_type: ProtocolEventType
    wallet_address: str
    protocol_name: str
    contract_address: str
    tx_hash: str
    block_number: int
    timestamp: datetime
    asset: Optional[str]
    amount_wei: Optional[int]
    amount_eth: Optional[float]
    log_index: int


class BalanceSnapshot(BaseModel):
    """Balance snapshot at specific time"""
    wallet_address: str
    block_number: int
    timestamp: datetime
    balance_wei: int
    balance_eth: float


class IngestionSummary(BaseModel):
    """Summary of ingestion operation"""
    wallet_address: str
    ingestion_window: IngestionWindow
    total_transactions: int
    total_protocol_events: int
    balance_snapshots: int
    ingestion_started_at: datetime
    ingestion_completed_at: datetime
    status: str
    errors: List[str] = []


class WalletType(str, Enum):
    """Supported wallet types"""
    METAMASK = "metamask"
    WALLETCONNECT = "walletconnect"
    COINBASE = "coinbase"
    OTHER = "other"


class WalletConnectionRequest(BaseModel):
    """Request for wallet connection"""
    wallet_type: WalletType
    wallet_address: Optional[str] = None


class WalletConnectionResponse(BaseModel):
    """Response for wallet connection"""
    wallet_type: WalletType
    connection_method: str
    qr_code_data: Optional[str] = None
    deep_link: Optional[str] = None
    session_id: Optional[str] = None
