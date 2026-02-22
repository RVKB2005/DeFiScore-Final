"""
Feature Data API Routes
Endpoints for retrieving feature data for ZK proof generation
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from dependencies import get_current_wallet
from database import get_db
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/features", tags=["Features"])


@router.get("/{wallet_address}")
async def get_feature_data(
    wallet_address: str,
    current_wallet: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get feature data for ZK proof generation
    
    SECURITY:
    - Requires JWT authentication
    - Can query any wallet's features (public data for lending)
    - Returns 404 if no feature data exists
    
    Returns feature data in format compatible with zkProofService
    """
    from db_models import FeatureData
    import json
    
    wallet_address_lower = wallet_address.lower()
    
    # Get feature data from database
    feature_data = db.query(FeatureData).filter(
        FeatureData.wallet_address == wallet_address_lower
    ).first()
    
    if not feature_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No feature data found for this wallet. Please calculate credit score first."
        )
    
    # Parse features JSON
    features_dict = json.loads(feature_data.features_json)
    
    # Extract the specific features needed for ZK proof
    # These must match the FeatureData interface in zkProofService.ts
    financial = features_dict.get('financial', {})
    protocol = features_dict.get('protocol', {})
    activity = features_dict.get('activity', {})
    temporal = features_dict.get('temporal', {})
    risk = features_dict.get('risk', {})
    
    return {
        # Financial features
        "currentBalance": financial.get('current_balance_eth', 0),
        "maxBalance": financial.get('max_balance_eth', 0),
        "balanceVolatility": financial.get('balance_volatility', 0),
        "suddenDropsCount": financial.get('sudden_drops_count', 0),
        "totalValueTransferred": financial.get('total_value_transferred_eth', 0),
        "avgTxValue": financial.get('avg_tx_value_eth', 0),
        "minBalance": financial.get('min_balance_eth', 0),
        
        # Protocol features
        "borrowCount": protocol.get('borrow_count', 0),
        "repayCount": protocol.get('repay_count', 0),
        "liquidationCount": protocol.get('liquidation_count', 0),
        "totalProtocolEvents": protocol.get('total_protocol_events', 0),
        "depositCount": protocol.get('deposit_count', 0),
        "withdrawCount": protocol.get('withdraw_count', 0),
        "avgBorrowDuration": protocol.get('avg_borrow_duration_days', 0),
        
        # Activity features
        "totalTransactions": activity.get('total_transactions', 0),
        "activeDays": activity.get('active_days', 0),
        "totalDays": activity.get('total_days', 0),
        "longestInactivityGap": activity.get('longest_inactivity_gap_days', 0),
        "transactionsPerDay": activity.get('transactions_per_day', 0),
        
        # Temporal features
        "walletAgeDays": temporal.get('wallet_age_days', 0),
        "transactionRegularity": temporal.get('transaction_regularity', 0),
        "burstActivityRatio": temporal.get('burst_activity_ratio', 0),
        "daysSinceLastActivity": temporal.get('days_since_last_activity', 0),
        
        # Risk features
        "failedTxCount": risk.get('failed_tx_count', 0),
        "failedTxRatio": risk.get('failed_tx_ratio', 0),
        "highGasSpikeCount": risk.get('high_gas_spike_count', 0),
        "zeroBalancePeriods": risk.get('zero_balance_periods', 0),
        
        # Metadata
        "wallet_address": wallet_address_lower,
        "network": feature_data.network,
        "extracted_at": feature_data.extracted_at.isoformat() if feature_data.extracted_at else None
    }
