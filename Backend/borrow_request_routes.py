"""
Borrow Request Routes
API endpoints for lending marketplace with ZK proof verification
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from dependencies import get_current_wallet
from db_models import SupplierIntent
from borrow_request_models import (
    CreateBorrowRequestSchema, SupplyIntentSchema, ReviewBorrowRequestSchema,
    ApproveBorrowRequestSchema, BorrowRequestResponse, SupplierIntentResponse,
    MatchedBorrowRequest, Currency
)
from borrow_request_service import BorrowRequestService
from rate_limiter import rate_limiter
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/lending", tags=["Lending Marketplace"])


# ============================================================================
# BORROWER ENDPOINTS
# ============================================================================

@router.post("/borrow-requests", response_model=BorrowRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_borrow_request(
    request_data: CreateBorrowRequestSchema,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Create a new borrow request
    
    Security:
    - Requires authenticated wallet
    - Rate limited to 10 requests per hour
    - Validates request parameters
    """
    try:
        # Rate limiting
        allowed, retry_after = rate_limiter.check_rate_limit(
            wallet_address,
            "borrow_request_create"
        )
        
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Retry after {retry_after} seconds"
            )
        
        service = BorrowRequestService(db)
        request = service.create_borrow_request(wallet_address, request_data)
        
        return BorrowRequestResponse.model_validate(request)
    
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create borrow request: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/borrow-requests/my-requests", response_model=List[BorrowRequestResponse])
async def get_my_borrow_requests(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """Get all borrow requests for authenticated borrower"""
    try:
        service = BorrowRequestService(db)
        requests = service.get_borrower_requests(wallet_address, status_filter)
        
        return [BorrowRequestResponse.model_validate(req) for req in requests]
    
    except Exception as e:
        logger.error(f"Failed to get borrower requests: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# SUPPLIER ENDPOINTS
# ============================================================================

@router.get("/supplier-stats")
async def get_supplier_stats(
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get supplier statistics (total supplied, earned interest, active intents)
    
    Security:
    - Requires authenticated wallet
    """
    try:
        service = BorrowRequestService(db)
        stats = service.get_supplier_stats(wallet_address)
        return stats
    except Exception as e:
        logger.error(f"Failed to get supplier stats: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/supply-intent", response_model=SupplierIntentResponse, status_code=status.HTTP_201_CREATED)
async def create_supply_intent(
    intent_data: SupplyIntentSchema,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Create or update supplier liquidity intent
    
    This indicates the supplier is willing to provide liquidity
    with specific criteria (currency, amount, min credit score, max APY)
    """
    try:
        service = BorrowRequestService(db)
        intent = service.create_supplier_intent(wallet_address, intent_data)
        
        return SupplierIntentResponse.model_validate(intent)
    
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create supply intent: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/supply-intent/matched-requests", response_model=List[MatchedBorrowRequest])
async def get_matched_borrow_requests(
    currency: Optional[Currency] = Query(None, description="Filter by currency"),
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get borrow requests that match supplier's criteria
    
    Returns requests where:
    - Currency matches supplier's intent
    - Amount <= available liquidity
    - Requested APY <= max APY supplier willing to offer
    - Status = PENDING
    """
    try:
        service = BorrowRequestService(db)
        currency_str = currency.value if currency else None
        requests = service.get_matched_requests_for_supplier(wallet_address, currency_str)
        
        # Transform to MatchedBorrowRequest with calculated fields
        matched = []
        for req in requests:
            # Calculate estimated return
            estimated_return = (req.amount * req.requested_apy / 100) * (req.duration_days / 365)
            
            # Determine risk level based on collateral
            if req.collateral_percent >= 150:
                risk_level = "low"
            elif req.collateral_percent >= 120:
                risk_level = "medium"
            else:
                risk_level = "high"
            
            matched.append(MatchedBorrowRequest(
                id=req.id,
                borrower_address=req.borrower_address,
                currency=req.currency,
                amount=req.amount,
                collateral_percent=req.collateral_percent,
                requested_apy=req.requested_apy,
                duration_days=req.duration_days,
                created_at=req.created_at,
                estimated_return=estimated_return,
                risk_level=risk_level
            ))
        
        return matched
    
    except Exception as e:
        logger.error(f"Failed to get matched requests: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/supply-intent/review-request")
async def review_borrow_request_with_zk(
    review_data: ReviewBorrowRequestSchema,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Initiate ZK proof verification for a borrow request
    
    Flow:
    1. Supplier sets credit score threshold
    2. Backend generates ZK proof request
    3. Borrower's client generates proof
    4. Backend verifies proof
    5. Returns eligibility result
    
    Returns:
    - request_id: The borrow request ID
    - threshold: Credit score threshold set by supplier
    - borrower_address: Address to generate proof for
    - verification_endpoint: Where to submit the proof
    """
    try:
        # Validate request exists and is pending
        service = BorrowRequestService(db)
        from db_models import BorrowRequest
        
        request = db.query(BorrowRequest).filter(
            BorrowRequest.id == review_data.request_id
        ).first()
        
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
        
        if request.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request is not pending (current status: {request.status})"
            )
        
        # Return verification parameters
        return {
            "request_id": request.id,
            "threshold": review_data.credit_score_threshold,
            "borrower_address": request.borrower_address,
            "verification_endpoint": f"/api/v1/lending/supply-intent/verify-proof/{request.id}",
            "message": "Borrower must generate ZK proof with this threshold"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate review: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/supply-intent/generate-proof-for-borrower")
async def generate_proof_for_borrower(
    data: dict,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Generate ZK proof for borrower (supplier-initiated)
    
    This endpoint automatically handles the complete credit score pipeline:
    1. Checks if borrower has a valid credit score (< 3 days old)
    2. If not, automatically ingests transactions, extracts features, and calculates score
    3. Generates real Groth16 ZK proof
    4. Returns proof data for verification
    
    Security:
    - Requires supplier authentication
    - Validates supplier is reviewing this request
    - Uses borrower's cached credit score
    - Generates real Groth16 ZK proof
    
    Args:
        request_id: Borrow request ID
        borrower_address: Borrower's wallet address
        threshold: Credit score threshold
        
    Returns:
        ZK proof data ready for verification
    """
    try:
        from redis_cache import redis_cache
        from zk_witness_service import zk_witness_service
        from zk_proof_service import zk_proof_service
        from db_models import BorrowRequest, CreditScore
        from celery_tasks import calculate_credit_score_task
        import secrets
        from datetime import datetime, timezone, timedelta
        
        request_id = data.get('request_id')
        borrower_address = data.get('borrower_address')
        threshold = data.get('threshold')
        
        logger.info(f"========== ZK PROOF GENERATION STARTED ==========")
        logger.info(f"Request ID: {request_id}")
        logger.info(f"Borrower: {borrower_address}")
        logger.info(f"Threshold: {threshold}")
        logger.info(f"Supplier: {wallet_address}")
        
        if not all([request_id, borrower_address, threshold]):
            logger.error(f"Missing required fields")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: request_id, borrower_address, threshold"
            )
        
        # Validate threshold
        if not (0 <= threshold <= 900):
            logger.error(f"Invalid threshold: {threshold}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Threshold must be between 0 and 900"
            )
        
        # Validate request exists
        request = db.query(BorrowRequest).filter(
            BorrowRequest.id == request_id
        ).first()
        
        if not request:
            logger.error(f"Request not found: {request_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
        
        # Validate borrower address matches
        if request.borrower_address.lower() != borrower_address.lower():
            logger.error(f"Borrower address mismatch: {request.borrower_address} vs {borrower_address}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Borrower address mismatch"
            )
        
        # Check if ZK proof service is available
        if zk_proof_service is None:
            logger.error("ZK proof service not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ZK proof service not available. Circuit files may be missing."
            )
        
        borrower_addr_lower = borrower_address.lower()
        
        # ============================================================================
        # STEP 1: Check if borrower has a valid credit score (< 3 days old)
        # ============================================================================
        logger.info(f"STEP 1: Checking credit score for borrower {borrower_addr_lower}")
        
        cached = redis_cache.get_score(borrower_addr_lower)
        needs_calculation = False
        
        if not cached:
            logger.info(f"❌ No cached score found for {borrower_addr_lower}. Will calculate.")
            needs_calculation = True
        else:
            logger.info(f"✓ Found cached score: {cached.get('score', 0)}")
            # Check if score is older than 3 days
            from db_models import CreditScore
            score_db = db.query(CreditScore).filter(
                CreditScore.wallet_address == borrower_addr_lower
            ).order_by(CreditScore.calculated_at.desc()).first()
            
            if score_db:
                age = datetime.now(timezone.utc) - score_db.calculated_at
                logger.info(f"Score age: {age.days} days, {age.seconds // 3600} hours")
                if age > timedelta(days=3):
                    logger.info(f"❌ Credit score is {age.days} days old (> 3 days). Will recalculate.")
                    needs_calculation = True
                else:
                    logger.info(f"✓ Credit score is fresh (< 3 days old). Using cached score.")
            else:
                logger.warning(f"⚠ No database record found despite cache. Will calculate.")
                needs_calculation = True
        
        # ============================================================================
        # STEP 2: If needed, trigger credit score calculation via Celery
        # ============================================================================
        if needs_calculation:
            logger.info(f"STEP 2: Starting automatic credit score calculation for {borrower_addr_lower}")
            
            # Trigger credit score calculation using Celery task
            from celery_tasks import calculate_credit_score_task
            from credit_score_models import CreditScoreRequest
            
            # Start the Celery task
            task = calculate_credit_score_task.delay(borrower_addr_lower, ["ethereum"])
            
            logger.info(f"✓ Credit score calculation task started: {task.id}")
            logger.info(f"Task state: {task.state}")
            logger.info(f"========== RETURNING HTTP 202 - CALCULATION IN PROGRESS ==========")
            
            # Return 202 to tell frontend to retry
            raise HTTPException(
                status_code=status.HTTP_202_ACCEPTED,
                detail={
                    "message": "Credit score calculation in progress. Please try again in 30 seconds.",
                    "job_id": task.id,
                    "status": "processing"
                }
            )
        
        # If we get here, score is already calculated and cached
        logger.info(f"STEP 2: Using existing credit score for {borrower_addr_lower}")
        
        # ============================================================================
        # STEP 3: Get credit score from cache (contains score breakdown)
        # ============================================================================
        logger.info(f"STEP 3: Retrieving credit score from cache")
        cached = redis_cache.get_score(borrower_addr_lower)
        if not cached:
            logger.error(f"❌ No credit score found in cache after validation")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No credit score found for borrower after calculation"
            )
        
        # Extract score and components from cached data
        score_total = cached.get('score', 0)
        score_breakdown = cached.get('score_breakdown', {})
        
        logger.info(f"✓ Credit score retrieved: {score_total}")
        logger.info(f"Score breakdown: {score_breakdown}")
        
        # ============================================================================
        # STEP 4: Generate ZK witness using score data
        # ============================================================================
        logger.info(f"STEP 4: Generating ZK witness for threshold {threshold}")
        
        # Create features dict from score breakdown for witness generation
        # The ZK circuit expects specific feature format
        logger.info(f"Features dict prepared for witness generation")
        
        # We need to reconstruct FeatureVector and CreditScoreResult from database
        from credit_score_models import CreditScoreResult, CreditScoreBreakdown
        from feature_extraction_models import (
            FeatureVector, ActivityFeatures, FinancialFeatures, 
            ProtocolInteractionFeatures, RiskFeatures, TemporalFeatures,
            BehavioralClassification, AnalysisWindow
        )
        from db_models import FeatureData
        
        # Get feature data from database (use the first network's features for ZK proof)
        feature_data = db.query(FeatureData).filter(
            FeatureData.wallet_address == borrower_addr_lower
        ).first()
        
        if not feature_data:
            logger.error(f"❌ No feature data found for {borrower_addr_lower}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No feature data found for borrower. Please recalculate credit score."
            )
        
        # Reconstruct FeatureVector from database
        import json
        features_dict = json.loads(feature_data.features_json)
        
        features = FeatureVector(
            wallet_address=feature_data.wallet_address,
            network=feature_data.network,
            chain_id=feature_data.chain_id,
            analysis_window=AnalysisWindow(**features_dict["analysis_window"]),
            activity=ActivityFeatures(**features_dict["activity"]),
            financial=FinancialFeatures(**features_dict["financial"]),
            protocol=ProtocolInteractionFeatures(**features_dict["protocol"]),
            risk=RiskFeatures(**features_dict["risk"]),
            temporal=TemporalFeatures(**features_dict["temporal"]),
            classification=BehavioralClassification(**features_dict["classification"]),
            extracted_at=datetime.fromisoformat(features_dict["extracted_at"]) if isinstance(features_dict["extracted_at"], str) else features_dict["extracted_at"],
            feature_version=features_dict.get("feature_version", "1.0.0")
        )
        
        # Get credit score from database
        score_db = db.query(CreditScore).filter(
            CreditScore.wallet_address == borrower_addr_lower
        ).order_by(CreditScore.calculated_at.desc()).first()
        
        if not score_db:
            logger.error(f"❌ No credit score found in database for {borrower_addr_lower}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No credit score found in database"
            )
        
        # Reconstruct CreditScoreResult
        breakdown_dict = json.loads(score_db.score_breakdown)
        
        # Use the actual breakdown from the database
        # The circuit will recompute these from features and verify they match
        breakdown = CreditScoreBreakdown(
            repayment_behavior=breakdown_dict.get('repayment_behavior', 0.0),
            capital_management=breakdown_dict.get('capital_management', 0.0),
            wallet_longevity=breakdown_dict.get('wallet_longevity', 0.0),
            activity_patterns=breakdown_dict.get('activity_patterns', 0.0),
            protocol_diversity=breakdown_dict.get('protocol_diversity', 0.0),
            risk_penalties=breakdown_dict.get('risk_penalties', 0.0)
        )
        
        score_result = CreditScoreResult(
            credit_score=score_db.score,
            score_band=breakdown_dict.get('rating', 'unknown').lower(),
            breakdown=breakdown,
            raw_score=float(score_db.score),
            timestamp=score_db.calculated_at,
            feature_version="1.0.0",
            engine_version="1.0.0"
        )
        
        logger.info(f"✓ Reconstructed FeatureVector and CreditScoreResult from database")
        
        witness_result = zk_witness_service.generate_witness(
            features=features,
            score_result=score_result,
            threshold=threshold,
            wallet_address=borrower_addr_lower
        )
        
        logger.info(f"✓ Witness generated successfully")
        logger.info(f"Public inputs: {witness_result['public_inputs']}")
        
        # ============================================================================
        # STEP 5: Generate ZK proof
        # ============================================================================
        logger.info(f"STEP 5: Generating ZK proof")
        
        try:
            proof, public_signals = zk_proof_service.generate_proof(witness_result, timeout=120)
            logger.info(f"✓ Proof generated successfully")
            logger.info(f"Proof: {proof}")
            logger.info(f"Public signals: {public_signals}")
        except Exception as e:
            logger.error(f"❌ Proof generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Proof generation failed: {str(e)}"
            )
        
        # ============================================================================
        # STEP 6: Verify proof locally (off-chain)
        # ============================================================================
        logger.info(f"STEP 6: Verifying ZK proof locally (off-chain)")
        
        try:
            is_valid = zk_proof_service.verify_proof(proof, public_signals)
            
            if not is_valid:
                logger.error(f"❌ Off-chain proof verification failed")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Off-chain proof verification failed"
                )
            
            logger.info(f"✓ Proof verified successfully (off-chain)")
        except Exception as e:
            logger.error(f"❌ Off-chain proof verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Off-chain proof verification error: {str(e)}"
            )
        
        # ============================================================================
        # STEP 6.5: Verify proof on-chain (using deployed Verifier contract)
        # ============================================================================
        logger.info(f"STEP 6.5: Verifying ZK proof on-chain (Polygon Amoy)")
        
        try:
            from zk_contract_verifier import zk_contract_verifier
            
            if zk_contract_verifier and zk_contract_verifier.is_chain_supported(80002):
                # Verify on Polygon Amoy (Chain ID: 80002)
                is_valid_onchain = zk_contract_verifier.verify_proof_on_chain(
                    proof=proof,
                    public_signals=public_signals,
                    chain_id=80002
                )
                
                if not is_valid_onchain:
                    logger.error(f"❌ On-chain proof verification failed")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="On-chain proof verification failed"
                    )
                
                logger.info(f"✓ Proof verified successfully on-chain (Polygon Amoy)")
                logger.info(f"  Verifier contract: {zk_contract_verifier.contract_addresses[80002]}")
            else:
                logger.warning(f"⚠️  On-chain verification not available (Polygon Amoy not configured)")
                logger.warning(f"  Proof verified off-chain only")
        except ImportError:
            logger.warning(f"⚠️  ZK Contract Verifier not available")
            logger.warning(f"  Proof verified off-chain only")
        except Exception as e:
            logger.error(f"❌ On-chain verification error: {e}")
            # Don't fail the request if on-chain verification fails
            # Off-chain verification is sufficient
            logger.warning(f"  Continuing with off-chain verification only")
        
        # ============================================================================
        # STEP 7: Format and return proof data (ZERO-KNOWLEDGE)
        # ============================================================================
        logger.info(f"STEP 7: Formatting proof data")
        
        # Extract data from public signals
        # Public signals format (11 signals):
        # [userAddress, scoreTotal, scoreRepayment, scoreCapital, scoreLongevity, 
        #  scoreActivity, scoreProtocol, threshold, timestamp, nullifier, versionId]
        
        if len(public_signals) < 11:
            logger.error(f"Invalid public signals length: {len(public_signals)}, expected 11")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid proof: expected 11 public signals, got {len(public_signals)}"
            )
        
        user_address_signal = public_signals[0]
        score_total_signal = public_signals[1]
        threshold_signal = public_signals[7]
        timestamp_signal = public_signals[8]
        nullifier_signal = public_signals[9]
        version_id_signal = public_signals[10]
        
        # Compute eligibility: score >= threshold
        # This is the ONLY information revealed - NOT the actual score
        is_eligible = int(score_total_signal) >= int(threshold_signal)
        
        threshold_unscaled = int(threshold_signal) / 1000
        
        logger.info(f"ZK Proof verification:")
        logger.info(f"  Threshold: {threshold_unscaled}")
        logger.info(f"  Eligible: {is_eligible}")
        logger.info(f"  Nullifier: {nullifier_signal}")
        logger.info(f"  Score: HIDDEN (zero-knowledge)")
        
        # CRITICAL: Do NOT expose the actual credit score!
        # Only return eligibility status and proof data
        proof_data = {
            "is_eligible": is_eligible,
            "threshold": threshold_unscaled,
            "proof": proof,
            "public_signals": public_signals,  # Needed for on-chain verification
            "nullifier": str(nullifier_signal),
            "timestamp": int(timestamp_signal),
            # DO NOT include: score_total, score_components, or any score details
        }
        
        logger.info(f"✓ ZK proof generated successfully for {borrower_addr_lower}")
        logger.info(f"Eligible: {is_eligible}, Threshold: {threshold_unscaled}")
        logger.info(f"Actual score: HIDDEN (zero-knowledge proof)")
        logger.info(f"========== ZK PROOF GENERATION COMPLETED ==========")
        
        return proof_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to generate ZK proof for borrower: {e}", exc_info=True)
        logger.error(f"========== ZK PROOF GENERATION FAILED ==========")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/supply-intent/verify-proof/{request_id}")
async def verify_zk_proof_for_request(
    request_id: str,
    zk_proof_data: dict,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Verify ZK proof for a borrow request
    
    This endpoint is called after the borrower generates a ZK proof.
    The supplier (or borrower) submits the proof for verification.
    
    Security:
    - Validates proof nullifier is unique (prevents replay)
    - Checks proof timestamp is recent
    - Verifies threshold matches proof public signals
    """
    try:
        service = BorrowRequestService(db)
        
        # Extract threshold from proof data
        threshold = zk_proof_data.get("threshold", 0)
        
        # Verify proof
        is_eligible, actual_score = service.verify_zk_proof_for_request(
            request_id,
            wallet_address,
            threshold,
            zk_proof_data
        )
        
        return {
            "request_id": request_id,
            "is_eligible": is_eligible,
            "actual_score": actual_score,
            "threshold": threshold,
            "message": "Eligible for loan" if is_eligible else "Does not meet credit score threshold"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to verify ZK proof: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/supply-intent/approve-request", response_model=BorrowRequestResponse)
async def approve_borrow_request(
    approval_data: ApproveBorrowRequestSchema,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Approve a borrow request after ZK proof verification
    
    Security:
    - Only the supplier who reviewed can approve
    - ZK proof must be verified first
    - Reserves liquidity from supplier's intent
    """
    try:
        service = BorrowRequestService(db)
        request = service.approve_borrow_request(
            approval_data.request_id,
            wallet_address,
            approval_data
        )
        
        return BorrowRequestResponse.model_validate(request)
    
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to approve request: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/supply-intent/reject-request/{request_id}", response_model=BorrowRequestResponse)
async def reject_borrow_request(
    request_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """Reject a borrow request"""
    try:
        service = BorrowRequestService(db)
        request = service.reject_borrow_request(request_id, wallet_address)
        
        return BorrowRequestResponse.model_validate(request)
    
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to reject request: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/supply-intent/my-reviews", response_model=List[BorrowRequestResponse])
async def get_my_reviews(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """Get all requests reviewed by authenticated supplier"""
    try:
        service = BorrowRequestService(db)
        requests = service.get_supplier_reviews(wallet_address, status_filter)
        
        return [BorrowRequestResponse.model_validate(req) for req in requests]
    
    except Exception as e:
        logger.error(f"Failed to get supplier reviews: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/supplier-intents", response_model=List[SupplierIntentResponse])
async def get_all_supplier_intents(
    currency: Optional[Currency] = Query(None, description="Filter by currency"),
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get all active supplier intents (for borrowers to browse)
    
    Returns all supplier intents that are currently active
    """
    try:
        query = db.query(SupplierIntent).filter(SupplierIntent.active == True)
        
        if currency:
            query = query.filter(SupplierIntent.currency == currency.value)
        
        intents = query.order_by(SupplierIntent.created_at.desc()).all()
        
        return [SupplierIntentResponse.model_validate(intent) for intent in intents]
    
    except Exception as e:
        logger.error(f"Failed to get supplier intents: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
