"""
API Routes for Feature Extraction
Supports both single-chain and multi-chain feature extraction
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from feature_extraction_models import FeatureVector, MultiChainFeatureVector
from multi_chain_feature_service import MultiChainFeatureService
from dependencies import get_current_wallet
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/features", tags=["Feature Extraction"])


def get_multi_chain_feature_service(
    networks: Optional[List[str]] = Query(None),
    mainnet_only: bool = Query(True)
):
    """Dependency for multi-chain feature service"""
    return MultiChainFeatureService(networks=networks, mainnet_only=mainnet_only)


@router.post("/wallet/{wallet_address}/extract")
async def extract_wallet_features(
    wallet_address: str,
    window_days: Optional[int] = Query(90, description="Analysis window in days (None for lifetime)"),
    networks: Optional[List[str]] = Query(None, description="Specific networks (leave empty for all)"),
    mainnet_only: bool = Query(True, description="Only analyze mainnet networks"),
    parallel: bool = Query(True, description="Execute in parallel"),
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Extract behavioral features for a wallet across ALL NETWORKS
    
    This endpoint performs feature extraction (Module 2 Part 2):
    - Activity features (transaction patterns)
    - Financial features (balance, value transferred)
    - Protocol interaction features (DeFi behavior)
    - Risk features (liquidations, failures)
    - Temporal features (consistency, regularity)
    - Behavioral classification
    
    Parameters:
    - wallet_address: Wallet address
    - window_days: Analysis window in days (default: 90, None for lifetime)
    - networks: Specific networks to analyze (optional)
    - mainnet_only: Only analyze mainnet networks (default: true)
    - parallel: Execute feature extraction in parallel (default: true)
    
    Requires authentication (wallet must be verified)
    
    Returns:
    - MultiChainFeatureVector with features from all networks
    """
    # Verify wallet ownership
    if wallet_address.lower() != current_wallet.lower():
        raise HTTPException(
            status_code=403,
            detail="Can only extract features for authenticated wallet"
        )
    
    try:
        logger.info(f"Starting feature extraction for wallet: {wallet_address}")
        
        # Initialize service
        feature_service = MultiChainFeatureService(networks=networks, mainnet_only=mainnet_only)
        
        # Extract features
        features = feature_service.extract_features_all_networks(
            wallet_address=wallet_address,
            window_days=window_days,
            parallel=parallel
        )
        
        return features
        
    except Exception as e:
        logger.error(f"Feature extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(e)}")


@router.get("/wallet/{wallet_address}/summary")
async def get_feature_summary(
    wallet_address: str,
    window_days: Optional[int] = Query(90, description="Analysis window in days"),
    networks: Optional[List[str]] = Query(None),
    mainnet_only: bool = Query(True)
):
    """
    Get simplified feature summary for a wallet
    
    Returns high-level behavioral classification and key metrics.
    Does not require authentication.
    
    Parameters:
    - wallet_address: Wallet address
    - window_days: Analysis window in days (default: 90)
    - networks: Specific networks (optional)
    - mainnet_only: Only mainnet networks (default: true)
    """
    try:
        feature_service = MultiChainFeatureService(networks=networks, mainnet_only=mainnet_only)
        summary = feature_service.get_feature_summary(wallet_address, window_days)
        return summary
    except Exception as e:
        logger.error(f"Failed to get feature summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get summary: {str(e)}")


@router.get("/wallet/{wallet_address}/network/{network}")
async def get_network_features(
    wallet_address: str,
    network: str,
    window_days: Optional[int] = Query(90, description="Analysis window in days")
):
    """
    Get features for a wallet on a specific network
    
    Parameters:
    - wallet_address: Wallet address
    - network: Network name (e.g., 'ethereum', 'polygon', 'arbitrum')
    - window_days: Analysis window in days (default: 90)
    
    Returns:
    - FeatureVector for the specified network
    """
    try:
        feature_service = MultiChainFeatureService(mainnet_only=False)
        features = feature_service.extract_features_single_network(
            wallet_address=wallet_address,
            network=network,
            window_days=window_days
        )
        
        if not features:
            raise HTTPException(
                status_code=404,
                detail=f"Could not extract features for {network}"
            )
        
        return features
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get network features: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get features: {str(e)}")


@router.get("/wallet/{wallet_address}/classification")
async def get_behavioral_classification(
    wallet_address: str,
    window_days: Optional[int] = Query(90),
    networks: Optional[List[str]] = Query(None),
    mainnet_only: bool = Query(True)
):
    """
    Get behavioral classification for a wallet
    
    Returns classification across dimensions:
    - Longevity (new/established/veteran)
    - Activity (dormant/occasional/active/hyperactive)
    - Capital (micro/small/medium/large/whale)
    - Credit Behavior (no_history/responsible/risky/defaulter)
    - Risk (low/medium/high/critical)
    
    Parameters:
    - wallet_address: Wallet address
    - window_days: Analysis window in days (default: 90)
    - networks: Specific networks (optional)
    - mainnet_only: Only mainnet networks (default: true)
    """
    try:
        feature_service = MultiChainFeatureService(networks=networks, mainnet_only=mainnet_only)
        features = feature_service.extract_features_all_networks(
            wallet_address=wallet_address,
            window_days=window_days,
            parallel=True
        )
        
        return {
            "wallet_address": wallet_address,
            "classification": features.overall_classification,
            "networks_analyzed": features.total_networks,
            "extracted_at": features.extracted_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get classification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get classification: {str(e)}")


@router.get("/health")
async def health_check():
    """
    Health check for feature extraction service
    """
    try:
        # Test service initialization
        service = MultiChainFeatureService(mainnet_only=True)
        network_count = len(service.ingestion_service.ingestion_services)
        
        return {
            "status": "healthy",
            "networks_available": network_count,
            "feature_version": service.feature_service.feature_version
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
