"""
Credit Score API Routes
Secure endpoints for credit scoring with authentication
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from credit_score_models import (
    CreditScoreRequest,
    CreditScoreResponse,
    ScoreRefreshRequest
)
from credit_score_service_production import production_credit_score_service
from dependencies import get_current_wallet
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/credit-score", tags=["Credit Score"])


@router.post("/calculate", response_model=CreditScoreResponse)
async def calculate_credit_score(
    request: CreditScoreRequest,
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Calculate credit score for authenticated wallet
    
    SECURITY:
    - Requires JWT authentication
    - Wallet can only request their own score
    - Returns cached score if available
    - Starts background job for new calculations
    
    Flow:
    1. First-time users: Returns job_id, calculation runs in background
    2. Returning users: Returns cached score instantly
    3. Stale scores: Returns cached score with refresh suggestion
    """
    try:
        response = await production_credit_score_service.get_credit_score(request, current_wallet)
        return response
    except Exception as e:
        logger.error(f"Credit score calculation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Score calculation failed: {str(e)}"
        )


@router.post("/refresh", response_model=CreditScoreResponse)
async def refresh_credit_score(
    request: ScoreRefreshRequest,
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Refresh existing credit score
    
    SECURITY:
    - Requires JWT authentication
    - Wallet can only refresh their own score
    - Invalidates cache and triggers new calculation
    
    Use this when:
    - User wants updated score
    - Cached score is stale
    - User made new transactions
    """
    try:
        response = await production_credit_score_service.refresh_score(request, current_wallet)
        return response
    except Exception as e:
        logger.error(f"Score refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Score refresh failed: {str(e)}"
        )


@router.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    current_wallet: str = Depends(get_current_wallet)
) -> Dict[str, Any]:
    """
    Get status of background scoring job
    
    SECURITY:
    - Requires JWT authentication
    - Only job owner can check status
    - Returns 404 if job not found or unauthorized
    
    Use this to:
    - Poll for job completion
    - Show progress to user
    - Get final result when complete
    """
    try:
        job_status = await production_credit_score_service.get_job_status(job_id, current_wallet)
        
        if not job_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found or unauthorized"
            )
        
        return job_status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}"
        )


@router.get("/my-score")
async def get_my_score(
    current_wallet: str = Depends(get_current_wallet)
) -> Dict[str, Any]:
    """
    Get current authenticated wallet's cached score
    
    SECURITY:
    - Requires JWT authentication
    - Returns only authenticated wallet's score
    - Returns 404 if no cached score exists
    
    Use this for:
    - Quick score lookup
    - Dashboard display
    - Checking if score exists
    """
    from redis_cache import redis_cache
    
    cached = redis_cache.get_score(current_wallet)
    
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cached score found. Please calculate your score first."
        )
    
    age_hours = redis_cache.get_age_hours(current_wallet)
    is_stale = redis_cache.is_stale(current_wallet)
    
    return {
        "wallet_address": cached['wallet_address'],
        "score": cached['score'],
        "score_breakdown": cached['score_breakdown'],
        "classification": cached.get('classification'),
        "networks_analyzed": cached.get('networks_analyzed'),
        "total_networks": cached.get('total_networks'),
        "calculated_at": cached['calculated_at'],
        "expires_at": cached.get('expires_at'),
        "age_hours": round(age_hours, 1),
        "is_stale": is_stale,
        "message": "Consider refreshing your score" if is_stale else "Score is up to date"
    }


@router.delete("/my-score")
async def delete_my_score(
    current_wallet: str = Depends(get_current_wallet)
) -> Dict[str, str]:
    """
    Delete cached score for authenticated wallet
    
    SECURITY:
    - Requires JWT authentication
    - Only deletes authenticated wallet's score
    
    Use this when:
    - User wants to recalculate from scratch
    - Testing purposes
    - Privacy concerns
    """
    from redis_cache import redis_cache
    
    redis_cache.delete_score(current_wallet)
    
    return {
        "message": "Cached score deleted successfully",
        "wallet_address": current_wallet
    }


# ============================================================================
# ZK PROOF ENDPOINTS - WITNESS GENERATION ONLY
# ============================================================================
# NOTE: Proof generation happens CLIENT-SIDE for zero-knowledge privacy
# Backend ONLY provides witness data (public + private inputs)
# Actual proof generation happens in browser via Web Worker
# ============================================================================

@router.post("/generate-zk-proof")
async def generate_zk_witness(
    threshold: int,
    current_wallet: str = Depends(get_current_wallet)
) -> Dict[str, Any]:
    """
    Generate ZK witness data for client-side proof generation
    
    SECURITY:
    - Requires JWT authentication
    - Wallet can only generate witness for their own score
    - Returns witness data ONLY (not proof)
    - Client generates proof in browser
    
    Args:
        threshold: Minimum score required (0-900)
        
    Returns:
        Witness data (public + private inputs) for client-side proof generation
        
    Flow:
    1. Retrieve cached score and features
    2. Generate ZK witness (public + private inputs)
    3. Return witness to client
    4. CLIENT generates proof in Web Worker
    5. CLIENT submits proof to blockchain
    """
    try:
        from redis_cache import redis_cache
        from zk_witness_service import zk_witness_service
        from feature_extraction_models import FeatureVector
        from credit_score_models import CreditScoreResult
        from database import SessionLocal
        from db_models import FeatureVectorDB, CreditScoreDB
        
        # Validate threshold
        if not (0 <= threshold <= 900):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Threshold must be between 0 and 900"
            )
        
        # Get cached score
        cached = redis_cache.get_score(current_wallet)
        if not cached:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No cached score found. Please calculate your score first."
            )
        
        # Get features from database
        db = SessionLocal()
        try:
            # Get latest feature vector
            feature_db = db.query(FeatureVectorDB).filter(
                FeatureVectorDB.wallet_address == current_wallet
            ).order_by(FeatureVectorDB.created_at.desc()).first()
            
            if not feature_db:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Feature vector not found in database"
                )
            
            # Get latest credit score
            score_db = db.query(CreditScoreDB).filter(
                CreditScoreDB.wallet_address == current_wallet
            ).order_by(CreditScoreDB.created_at.desc()).first()
            
            if not score_db:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Credit score not found in database"
                )
            
            # Convert to models
            features = FeatureVector.from_db(feature_db)
            score_result = CreditScoreResult.from_db(score_db)
            
            # Check if score meets threshold
            if score_result.credit_score < threshold:
                return {
                    "success": False,
                    "message": f"Score {score_result.credit_score} does not meet threshold {threshold}",
                    "score": score_result.credit_score,
                    "threshold": threshold,
                    "can_generate_proof": False
                }
            
            # Generate ZK witness
            logger.info(f"Generating ZK witness for {current_wallet}, threshold: {threshold}")
            witness = zk_witness_service.generate_witness(
                features=features,
                score_result=score_result,
                threshold=threshold,
                wallet_address=current_wallet
            )
            
            # Validate witness
            zk_witness_service.validate_witness(witness)
            
            logger.info(f"✓ ZK witness generated successfully for {current_wallet}")
            
            return {
                "success": True,
                "data": witness,
                "message": "Witness generated. Generate proof client-side using Web Worker.",
                "instructions": "Use zkProofService.generateProof() in browser"
            }
            
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ZK witness generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ZK witness generation failed: {str(e)}"
        )


@router.get("/zk-circuit-info")
async def get_zk_circuit_info() -> Dict[str, Any]:
    """
    Get information about the ZK circuit
    
    PUBLIC ENDPOINT - No authentication required
    
    Returns circuit configuration and file status
    """
    try:
        from zk_witness_service import zk_witness_service
        
        return {
            "available": True,
            "circuit_name": "DeFiCreditScore",
            "version": "1.0.0",
            "public_inputs": 11,
            "private_inputs": 30,
            "constraints": "~47,000",
            "proving_time": "10-30 seconds",
            "verification_gas": "~250k-300k",
            "proof_validity": "24 hours",
            "message": "Proof generation happens client-side in browser"
        }
        
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }
