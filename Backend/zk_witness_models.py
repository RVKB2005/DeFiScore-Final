"""
ZK Witness Models
Pydantic models for ZK proof witness data
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime


class ZKWitnessRequest(BaseModel):
    """Request to generate ZK witness data"""
    wallet_address: str = Field(..., description="Wallet address")
    threshold: int = Field(..., ge=0, le=900, description="Score threshold (0-900)")
    force_refresh: bool = Field(default=False, description="Force score recalculation")


class ZKPublicInputs(BaseModel):
    """Public inputs for ZK circuit"""
    userAddress: str = Field(..., description="User address as field element")
    scoreTotal: int = Field(..., description="Total score (scaled x1000)")
    scoreRepayment: int = Field(..., description="Repayment score (scaled x1000)")
    scoreCapital: int = Field(..., description="Capital score (scaled x1000)")
    scoreLongevity: int = Field(..., description="Longevity score (scaled x1000)")
    scoreActivity: int = Field(..., description="Activity score (scaled x1000)")
    scoreProtocol: int = Field(..., description="Protocol score (scaled x1000)")
    threshold: int = Field(..., description="Threshold (scaled x1000)")
    timestamp: int = Field(..., description="Unix timestamp")
    nullifier: str = Field(..., description="Nullifier hash")
    versionId: int = Field(..., description="Circuit version")


class ZKPrivateInputs(BaseModel):
    """Private inputs for ZK circuit"""
    # Financial Features (7)
    currentBalanceScaled: int
    maxBalanceScaled: int
    balanceVolatilityScaled: int
    suddenDropsCount: int
    totalValueTransferred: int
    avgTxValue: int
    minBalanceScaled: int
    
    # Protocol Features (8)
    borrowCount: int
    repayCount: int
    repayToBorrowRatio: int
    liquidationCount: int
    totalProtocolEvents: int
    depositCount: int
    withdrawCount: int
    avgBorrowDuration: int
    
    # Activity Features (6)
    totalTransactions: int
    activeDays: int
    totalDays: int
    activeDaysRatio: int
    longestInactivityGap: int
    transactionsPerDay: int
    
    # Temporal Features (4)
    walletAgeDays: int
    transactionRegularity: int
    burstActivityRatio: int
    daysSinceLastActivity: int
    
    # Risk Features (4)
    failedTxCount: int
    failedTxRatio: int
    highGasSpikeCount: int
    zeroBalancePeriods: int
    
    # Anti-Replay (1)
    nonce: int


class ZKWitnessMetadata(BaseModel):
    """Metadata for witness"""
    score_band: str
    raw_score: float
    network: str
    chain_id: int


class ZKWitnessResponse(BaseModel):
    """Complete ZK witness response"""
    version_id: int
    timestamp: int
    engine_version: str
    feature_version: str
    wallet_address: str
    public_inputs: ZKPublicInputs
    private_inputs: ZKPrivateInputs
    metadata: ZKWitnessMetadata
    
    class Config:
        json_schema_extra = {
            "example": {
                "version_id": 1,
                "timestamp": 1708560000,
                "engine_version": "1.0.0",
                "feature_version": "1.0.0",
                "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
                "public_inputs": {
                    "userAddress": "123456789012345678901234567890",
                    "scoreTotal": 742000,
                    "scoreRepayment": 180000,
                    "scoreCapital": 120000,
                    "scoreLongevity": 90000,
                    "scoreActivity": 50000,
                    "scoreProtocol": 40000,
                    "threshold": 700000,
                    "timestamp": 1708560000,
                    "nullifier": "0x1234...",
                    "versionId": 1
                },
                "private_inputs": {
                    "currentBalanceScaled": 5420,
                    "maxBalanceScaled": 12300,
                    "balanceVolatilityScaled": 450,
                    "suddenDropsCount": 2,
                    "totalValueTransferred": 45000,
                    "avgTxValue": 250,
                    "minBalanceScaled": 100,
                    "borrowCount": 8,
                    "repayCount": 8,
                    "repayToBorrowRatio": 1000,
                    "liquidationCount": 0,
                    "totalProtocolEvents": 45,
                    "depositCount": 12,
                    "withdrawCount": 10,
                    "avgBorrowDuration": 15000,
                    "totalTransactions": 234,
                    "activeDays": 120,
                    "totalDays": 180,
                    "activeDaysRatio": 667,
                    "longestInactivityGap": 15,
                    "transactionsPerDay": 1300,
                    "walletAgeDays": 450,
                    "transactionRegularity": 750,
                    "burstActivityRatio": 300,
                    "daysSinceLastActivity": 2,
                    "failedTxCount": 5,
                    "failedTxRatio": 21,
                    "highGasSpikeCount": 1,
                    "zeroBalancePeriods": 3,
                    "nonce": 123456789
                },
                "metadata": {
                    "score_band": "Excellent",
                    "raw_score": 742.0,
                    "network": "ethereum",
                    "chain_id": 1
                }
            }
        }


class ZKProofSubmission(BaseModel):
    """ZK proof submission to smart contract"""
    proof: str = Field(..., description="Hex-encoded proof")
    public_signals: list = Field(..., description="Public signals array")
    wallet_address: str = Field(..., description="Prover's address")


class ZKProofVerificationRequest(BaseModel):
    """Request to verify ZK proof"""
    proof: str
    public_signals: list
    wallet_address: str
