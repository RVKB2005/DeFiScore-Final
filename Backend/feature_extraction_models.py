"""
Feature Extraction Models
Pydantic models for behavioral features and classification
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime


class AnalysisWindow(BaseModel):
    """Time window for feature analysis"""
    name: str = Field(..., description="Window name (e.g., '90d', 'lifetime')")
    days: Optional[int] = Field(None, description="Number of days (None for lifetime)")
    start_timestamp: datetime
    end_timestamp: datetime


class ActivityFeatures(BaseModel):
    """Activity-based behavioral features"""
    total_transactions: int = Field(0, description="Total transaction count")
    transactions_per_day: float = Field(0.0, description="Average transactions per day")
    active_days: int = Field(0, description="Number of days with activity")
    total_days: int = Field(0, description="Total days in window")
    active_days_ratio: float = Field(0.0, description="Active days / Total days")
    longest_inactivity_gap_days: int = Field(0, description="Longest period without activity")
    recent_activity_days: int = Field(0, description="Days since last activity")


class FinancialFeatures(BaseModel):
    """Financial behavior features"""
    total_value_transferred_eth: float = Field(0.0, description="Total ETH transferred")
    average_transaction_value_eth: float = Field(0.0, description="Average transaction value")
    current_balance_eth: float = Field(0.0, description="Current balance")
    max_balance_eth: float = Field(0.0, description="Maximum balance observed")
    min_balance_eth: float = Field(0.0, description="Minimum balance observed")
    balance_volatility: float = Field(0.0, description="Balance standard deviation")
    sudden_drops_count: int = Field(0, description="Number of sudden balance drops")


class ProtocolInteractionFeatures(BaseModel):
    """DeFi protocol interaction features"""
    total_protocol_events: int = Field(0, description="Total protocol interactions")
    borrow_count: int = Field(0, description="Number of borrow events")
    repay_count: int = Field(0, description="Number of repay events")
    deposit_count: int = Field(0, description="Number of deposit events")
    withdraw_count: int = Field(0, description="Number of withdraw events")
    liquidation_count: int = Field(0, description="Number of liquidations")
    repay_to_borrow_ratio: float = Field(0.0, description="Repay count / Borrow count")
    average_borrow_duration_days: float = Field(0.0, description="Average time between borrow and repay")


class RiskFeatures(BaseModel):
    """Risk indicator features"""
    failed_transaction_count: int = Field(0, description="Number of failed transactions")
    failed_transaction_ratio: float = Field(0.0, description="Failed / Total transactions")
    liquidation_count: int = Field(0, description="Number of liquidations")
    high_gas_spike_count: int = Field(0, description="Unusual gas usage events")
    zero_balance_periods: int = Field(0, description="Times balance went to zero")


class TemporalFeatures(BaseModel):
    """Temporal consistency features"""
    wallet_age_days: int = Field(0, description="Days since first activity")
    transaction_regularity_score: float = Field(0.0, description="Consistency of activity (0-1)")
    burst_activity_ratio: float = Field(0.0, description="Burst vs steady usage")
    days_since_last_activity: int = Field(0, description="Days since last transaction")


class BehavioralClassification(BaseModel):
    """Classification of wallet behavior"""
    longevity_class: str = Field("unknown", description="new/established/veteran")
    activity_class: str = Field("unknown", description="dormant/occasional/active/hyperactive")
    capital_class: str = Field("unknown", description="micro/small/medium/large/whale")
    credit_behavior_class: str = Field("unknown", description="no_history/responsible/risky/defaulter")
    risk_class: str = Field("unknown", description="low/medium/high/critical")


class FeatureVector(BaseModel):
    """Complete feature vector for a wallet"""
    wallet_address: str
    network: str
    chain_id: int
    analysis_window: AnalysisWindow
    
    # Feature groups
    activity: ActivityFeatures
    financial: FinancialFeatures
    protocol: ProtocolInteractionFeatures
    risk: RiskFeatures
    temporal: TemporalFeatures
    
    # Classification
    classification: BehavioralClassification
    
    # Metadata
    extracted_at: datetime
    feature_version: str = "1.0.0"


class MultiChainFeatureVector(BaseModel):
    """Aggregated feature vector across multiple chains"""
    wallet_address: str
    networks_analyzed: List[str]
    total_networks: int
    
    # Aggregated features
    total_transactions_all_chains: int = 0
    total_value_transferred_usd: float = 0.0
    active_networks_count: int = 0
    total_protocol_interactions: int = 0
    total_liquidations: int = 0
    
    # Per-network features
    network_features: Dict[str, FeatureVector]
    
    # Cross-chain classification
    overall_classification: BehavioralClassification
    
    # Metadata
    extracted_at: datetime
    feature_version: str = "1.0.0"


class FeatureExtractionSummary(BaseModel):
    """Summary of feature extraction process"""
    wallet_address: str
    network: str
    status: str = Field(..., description="completed/failed/partial")
    features_extracted: int = 0
    extraction_started_at: datetime
    extraction_completed_at: datetime
    errors: List[str] = []
