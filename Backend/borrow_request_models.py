"""
Borrow Request Models
Data models for the lending marketplace
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RequestStatus(str, Enum):
    """Borrow request status"""
    PENDING = "pending"  # Waiting for supplier review
    UNDER_REVIEW = "under_review"  # Supplier reviewing ZK proof
    APPROVED = "approved"  # Supplier approved, awaiting blockchain tx
    FUNDED = "funded"  # Loan funded on-chain
    REJECTED = "rejected"  # Supplier rejected
    CANCELLED = "cancelled"  # Borrower cancelled
    EXPIRED = "expired"  # Request expired


class Currency(str, Enum):
    """Supported currencies"""
    ETH = "ETH"
    USDC = "USDC"
    USDT = "USDT"
    DAI = "DAI"
    WBTC = "WBTC"


class CreateBorrowRequestSchema(BaseModel):
    """Schema for creating a borrow request"""
    supplier_id: str = Field(..., description="ID of the supplier to request from")
    currency: Currency = Field(..., description="Currency to borrow")
    amount: float = Field(..., gt=0, description="Amount to borrow")
    collateral_percent: int = Field(..., ge=100, le=300, description="Collateral percentage (100-300%)")
    duration_days: int = Field(..., gt=0, le=365, description="Loan duration in days")
    
    class Config:
        use_enum_values = True
    
    # Note: Interest rate (APY) is NOT set by borrower - it comes from supplier's intent
    
    @validator('amount')
    def validate_amount(cls, v, values):
        """Validate amount based on currency"""
        if 'currency' in values:
            currency = values['currency']
            if currency == Currency.WBTC and v > 100:
                raise ValueError("WBTC amount cannot exceed 100")
            elif currency == Currency.ETH and v > 1000:
                raise ValueError("ETH amount cannot exceed 1000")
            elif currency in [Currency.USDC, Currency.USDT, Currency.DAI] and v > 1000000:
                raise ValueError("Stablecoin amount cannot exceed 1,000,000")
        return v


class SupplyIntentSchema(BaseModel):
    """Schema for supplier indicating willingness to supply"""
    currency: Currency = Field(..., description="Currency willing to supply")
    max_amount: float = Field(..., gt=0, description="Maximum amount willing to supply")
    min_credit_score: int = Field(..., ge=300, le=900, description="Minimum credit score threshold")
    max_apy: float = Field(..., gt=0, lt=100, description="Maximum APY willing to offer")
    
    class Config:
        use_enum_values = True


class ReviewBorrowRequestSchema(BaseModel):
    """Schema for supplier reviewing a borrow request"""
    request_id: str = Field(..., description="Borrow request ID")
    credit_score_threshold: int = Field(..., ge=300, le=900, description="Required credit score")
    
    class Config:
        json_schema_extra = {
            "example": {
                "request_id": "req_abc123",
                "credit_score_threshold": 700
            }
        }


class ZKProofVerificationSchema(BaseModel):
    """Schema for ZK proof verification result"""
    is_eligible: bool = Field(..., description="Whether borrower meets threshold")
    score_total: int = Field(..., description="Total credit score (public)")
    score_components: dict = Field(..., description="Score breakdown (public)")
    proof: dict = Field(..., description="ZK proof data")
    public_signals: List[int] = Field(..., description="Public signals")
    nullifier: str = Field(..., description="Unique proof identifier")
    timestamp: int = Field(..., description="Proof generation timestamp")


class ApproveBorrowRequestSchema(BaseModel):
    """Schema for approving a borrow request"""
    request_id: str = Field(..., description="Borrow request ID")
    offered_apy: float = Field(..., gt=0, lt=100, description="Offered APY")
    terms: Optional[str] = Field(None, max_length=500, description="Additional terms")


class BorrowRequestResponse(BaseModel):
    """Response model for borrow request"""
    id: str
    borrower_address: str
    currency: str
    amount: float
    collateral_percent: int
    requested_apy: float
    duration_days: int
    status: str
    created_at: datetime
    updated_at: datetime
    supplier_address: Optional[str] = None
    offered_apy: Optional[float] = None
    zk_proof_verified: bool = False
    credit_score_threshold: Optional[int] = None
    
    class Config:
        from_attributes = True


class SupplierIntentResponse(BaseModel):
    """Response model for supplier intent"""
    id: str
    supplier_address: str
    currency: str
    max_amount: float
    available_amount: float
    min_credit_score: int
    max_apy: float
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class MatchedBorrowRequest(BaseModel):
    """Borrow request matched to supplier's criteria"""
    id: str
    borrower_address: str
    currency: str
    amount: float
    collateral_percent: int
    requested_apy: float
    duration_days: int
    created_at: datetime
    estimated_return: float  # Calculated based on amount * apy * duration
    risk_level: str  # "low", "medium", "high" based on collateral
