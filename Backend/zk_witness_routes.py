"""
ZK Witness Routes
API endpoints for ZK proof witness generation
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Optional
import logging
from datetime import datetime, timezone

from zk_witness_models import (
    ZKWitnessRequest,
    ZKWitnessResponse
)
from zk_witness_service import zk_witness_service
from dependencies import get_current_wallet
from database import get_db
from sqlalchemy.orm import Session
from db_models import CreditScore
from feature_extraction_models import FeatureVector
from credit_score_models import CreditScoreResult, CreditScoreBreakdown
from credit_score_engine import credit_score_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zk", tags=["zk-proof"])


@router.post("/witness/{wallet_address}", response_model=ZKWitnessResponse)
async def generate_witness(
    wallet_address: str,
    request: ZKWitnessRequest,
    authenticated_wallet: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Generate ZK circuit witness data for a wallet
    
    This endpoint:
    1. Retrieves or computes credit score
    2. Formats feature vector for circuit
    3. Scales all values appropriately
    4. Returns structured witness data
    
    The witness can then be used by the client-side prover to generate a ZK proof.
    
    Args:
        wallet_address: Ethereum address to generate witness for
        request: Witness generation parameters
        current_user: Authenticated user (must match wallet_address)
        db: Database session
        
    Returns:
        ZKWitnessResponse with public and private inputs
        
    Raises:
        403: If user doesn't own the wallet
        404: If no score data exists
        500: If witness generation fails
    """
    try:
        # Normalize address
        wallet_address = wallet_address.lower()
        request_wallet = request.wallet_address.lower()
        
        # Authorization: user must own the wallet
        if current_user.lower() != wallet_address:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only generate witness for your own wallet"
            )
        
        if wallet_address != request_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wallet address mismatch"
            )
        
        logger.info(f"Generating ZK witness for {wallet_address}, threshold: {request.threshold}")
        
        # Get existing score or compute new one
        if request.force_refresh:
            # Force recalculation
            score_data, feature_data = await _compute_fresh_score(wallet_address, db)
        else:
            # Try to get cached score
            score_data = db.query(CreditScore).filter(
                CreditScore.wallet_address == wallet_address
            ).first()
            
            if not score_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No credit score found. Please calculate score first."
                )
            
            # Check if score is stale (>24 hours)
            age_hours = (datetime.now(timezone.utc) - score_data.calculated_at).total_seconds() / 3600
            if age_hours > 24:
                logger.warning(f"Score is {age_hours:.1f} hours old, consider refresh")
        
        # Reconstruct score result from database
        score_result = _reconstruct_score_result(score_data)
        
        # For features, we'll need to recalculate or use cached data
        # Since we don't have a separate FeatureData table, we'll use the score breakdown
        features = None  # Features are embedded in score_result
        
        # Validate threshold
        if not (0 <= request.threshold <= 900):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Threshold must be between 0 and 900"
            )
        
        # Generate witness
        witness = zk_witness_service.generate_witness(
            features=features,
            score_result=score_result,
            threshold=request.threshold,
            wallet_address=wallet_address
        )
        
        # Validate witness
        zk_witness_service.validate_witness(witness)
        
        logger.info(f"Successfully generated witness for {wallet_address}")
        
        return ZKWitnessResponse(**witness)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate witness for {wallet_address}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Witness generation failed: {str(e)}"
        )


@router.get("/witness/{wallet_address}/status")
async def get_witness_status(
    wallet_address: str,
    authenticated_wallet: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Check if witness can be generated for a wallet
    
    Returns:
        Status information about score availability and freshness
    """
    try:
        wallet_address = wallet_address.lower()
        
        # Authorization
        if current_user.lower() != wallet_address:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only check status for your own wallet"
            )
        
        # Check for existing score
        score_data = db.query(CreditScore).filter(
            CreditScore.wallet_address == wallet_address
        ).first()
        
        if not score_data:
            return {
                "wallet_address": wallet_address,
                "can_generate_witness": False,
                "reason": "No credit score found",
                "action": "Calculate credit score first"
            }
        
        # Check freshness
        age_hours = (datetime.now(timezone.utc) - score_data.calculated_at).total_seconds() / 3600
        is_fresh = age_hours <= 24
        
        return {
            "wallet_address": wallet_address,
            "can_generate_witness": True,
            "score": score_data.credit_score,
            "score_band": score_data.score_band,
            "calculated_at": score_data.calculated_at,
            "age_hours": round(age_hours, 2),
            "is_fresh": is_fresh,
            "recommendation": "Ready for witness generation" if is_fresh else "Consider refreshing score"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get witness status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


async def _compute_fresh_score(wallet_address: str, db: Session):
    """
    Compute fresh score and features by triggering full pipeline
    
    This triggers:
    1. Data ingestion (multi-chain)
    2. Feature extraction
    3. Credit score calculation
    4. Database persistence
    
    Args:
        wallet_address: Wallet address
        db: Database session
        
    Returns:
        Tuple of (score_data, feature_data)
    """
    from multi_chain_ingestion_service import MultiChainIngestionService
    from multi_chain_feature_service import MultiChainFeatureService
    from credit_score_service_production import ProductionCreditScoreService
    import json
    
    try:
        logger.info(f"Force refresh: Starting full pipeline for {wallet_address}")
        
        # Initialize services
        ingestion_service = MultiChainIngestionService(mainnet_only=True)
        feature_service = MultiChainFeatureService(mainnet_only=True)
        score_service = ProductionCreditScoreService()
        
        # Step 1: Ingest data
        logger.info("Step 1/3: Ingesting blockchain data...")
        ingestion_summary = ingestion_service.ingest_wallet_all_networks(
            wallet_address=wallet_address,
            days_back=30,
            parallel=True
        )
        
        # Step 2: Extract features
        logger.info("Step 2/3: Extracting features...")
        multi_features = feature_service.extract_features_all_networks(
            wallet_address=wallet_address,
            window_days=30,
            parallel=True
        )
        
        # Step 3: Calculate score
        logger.info("Step 3/3: Calculating credit score...")
        classification_dict = {
            "longevity_class": multi_features.overall_classification.longevity_class,
            "activity_class": multi_features.overall_classification.activity_class,
            "capital_class": multi_features.overall_classification.capital_class,
            "credit_behavior_class": multi_features.overall_classification.credit_behavior_class,
            "risk_class": multi_features.overall_classification.risk_class
        }
        
        score = score_service._calculate_score(
            activity=multi_features.overall_features.activity,
            financial=multi_features.overall_features.financial,
            protocol=multi_features.overall_features.protocol,
            risk=multi_features.overall_features.risk,
            temporal=multi_features.overall_features.temporal
        )
        
        score_breakdown = score_service._create_score_breakdown(
            activity=multi_features.overall_features.activity,
            financial=multi_features.overall_features.financial,
            protocol=multi_features.overall_features.protocol,
            risk=multi_features.overall_features.risk,
            temporal=multi_features.overall_features.temporal
        )
        
        # Save to database
        from db_models import CreditScore
        from datetime import datetime, timezone
        
        # Delete old score
        db.query(CreditScore).filter(
            CreditScore.wallet_address == wallet_address.lower()
        ).delete()
        
        # Save new score
        db_score = CreditScore(
            wallet_address=wallet_address.lower(),
            credit_score=score,
            breakdown_json=json.dumps(score_breakdown),
            classification_json=json.dumps(classification_dict),
            networks_analyzed=json.dumps(multi_features.networks_analyzed),
            total_networks=multi_features.total_networks,
            calculated_at=datetime.now(timezone.utc),
            feature_version="1.0.0",
            engine_version="1.0.0",
            score_band=score_service._get_score_band(score),
            raw_score=score
        )
        db.add(db_score)
        
        db.commit()
        db.refresh(db_score)
        
        logger.info(f"Force refresh complete: Score = {score}/900")
        
        return db_score
        
    except Exception as e:
        logger.error(f"Force refresh failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Force refresh failed: {str(e)}"
        )


def _reconstruct_score_result(score_data: CreditScore) -> CreditScoreResult:
    """Reconstruct CreditScoreResult from database model"""
    import json
    breakdown_dict = json.loads(score_data.breakdown_json)
    
    breakdown = CreditScoreBreakdown(**breakdown_dict)
    
    return CreditScoreResult(
        credit_score=score_data.credit_score,
        score_band=score_data.score_band,
        breakdown=breakdown,
        raw_score=score_data.raw_score,
        timestamp=score_data.calculated_at,
        feature_version=score_data.feature_version,
        engine_version=score_data.engine_version
    )
