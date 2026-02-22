"""
Credit Score Models
Pydantic models for credit scoring system
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ScoreStatus(str, Enum):
    """Status of credit score calculation"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    STALE = "stale"  # Needs refresh


class JobStatus(str, Enum):
    """Background job status"""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CreditScoreRequest(BaseModel):
    """Request to calculate credit score"""
    wallet_address: str = Field(..., description="Wallet address to score")
    force_refresh: bool = Field(default=False, description="Force re-ingestion even if cached")
    include_zk_proof: bool = Field(default=False, description="Generate ZK proof")
    networks: Optional[List[str]] = Field(default=None, description="Specific networks to analyze")


class CreditScoreResponse(BaseModel):
    """Response with credit score or job status"""
    wallet_address: str
    status: ScoreStatus
    score: Optional[int] = Field(None, ge=0, le=900, description="Credit score (0-900)")
    score_breakdown: Optional[Dict[str, Any]] = None
    last_updated: Optional[datetime] = None
    job_id: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    message: str


class CachedScore(BaseModel):
    """Cached credit score data"""
    wallet_address: str
    score: int = Field(..., ge=0, le=900)
    score_breakdown: Dict[str, Any]
    classification: Dict[str, str]
    networks_analyzed: List[str]
    total_networks: int
    calculated_at: datetime
    expires_at: datetime
    data_hash: str  # Hash of input data for verification


class BackgroundJob(BaseModel):
    """Background job tracking"""
    job_id: str
    wallet_address: str
    job_type: str  # "ingestion", "scoring", "zk_proof"
    status: JobStatus
    progress: int = Field(default=0, ge=0, le=100)
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class ScoreRefreshRequest(BaseModel):
    """Request to refresh existing score"""
    wallet_address: str
    incremental: bool = Field(default=True, description="Only fetch new data since last update")


class ZKProofRequest(BaseModel):
    """Request to generate ZK proof"""
    wallet_address: str
    score_threshold: Optional[int] = Field(None, ge=0, le=900, description="Minimum score to prove")


class ZKProofResponse(BaseModel):
    """ZK proof response"""
    wallet_address: str
    proof: Optional[str] = None
    public_inputs: Optional[Dict[str, Any]] = None
    status: JobStatus
    job_id: Optional[str] = None
    generated_at: Optional[datetime] = None
    message: str



class CreditScoreBreakdown(BaseModel):
    """
    Detailed breakdown of credit score components
    Based on FICO methodology adapted for DeFi
    """
    repayment_behavior: float = Field(..., description="Repayment discipline score (35% weight)")
    capital_management: float = Field(..., description="Capital stability score (30% weight)")
    wallet_longevity: float = Field(..., description="Wallet age and consistency (15% weight)")
    activity_patterns: float = Field(..., description="Transaction patterns (10% weight)")
    protocol_diversity: float = Field(..., description="DeFi protocol usage (10% weight)")
    risk_penalties: float = Field(..., description="Risk penalties (negative)")


class CreditScoreResult(BaseModel):
    """
    Complete credit score result with explainable breakdown
    """
    credit_score: int = Field(..., ge=0, le=900, description="Final credit score (0-900)")
    score_band: str = Field(..., description="Score classification: Poor/Fair/Good/Excellent")
    breakdown: CreditScoreBreakdown = Field(..., description="Detailed score breakdown")
    raw_score: float = Field(..., description="Raw score before normalization")
    timestamp: datetime = Field(..., description="Score calculation timestamp")
    feature_version: str = Field(..., description="Feature extraction version")
    engine_version: str = Field(..., description="Scoring engine version")
    
    class Config:
        json_schema_extra = {
            "example": {
                "credit_score": 742,
                "score_band": "Excellent",
                "breakdown": {
                    "repayment_behavior": 180.0,
                    "capital_management": 120.0,
                    "wallet_longevity": 90.0,
                    "activity_patterns": 50.0,
                    "protocol_diversity": 40.0,
                    "risk_penalties": -38.0
                },
                "raw_score": 742.0,
                "timestamp": "2024-01-15T10:30:00Z",
                "feature_version": "1.0.0",
                "engine_version": "1.0.0"
            }
        }
