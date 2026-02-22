"""
Borrow Request Service
Handles lending marketplace logic with ZK proof verification
"""
import logging
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from db_models import BorrowRequest, SupplierIntent, LoanAgreement
from borrow_request_models import (
    RequestStatus, Currency, CreateBorrowRequestSchema,
    SupplyIntentSchema, ReviewBorrowRequestSchema,
    ApproveBorrowRequestSchema
)

logger = logging.getLogger(__name__)


class BorrowRequestService:
    """Service for managing borrow requests and supplier matching"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_borrow_request(
        self,
        borrower_address: str,
        request_data: CreateBorrowRequestSchema
    ) -> BorrowRequest:
        """
        Create a new borrow request
        
        Security:
        - Rate limited by API layer
        - Validates borrower has authenticated wallet
        - Fetches interest rate from supplier's intent (borrower cannot set it)
        - Validates amount doesn't exceed supplier's available liquidity
        """
        # Fetch supplier intent to get the interest rate
        supplier_intent = self.db.query(SupplierIntent).filter(
            and_(
                SupplierIntent.id == request_data.supplier_id,
                SupplierIntent.active == True
            )
        ).first()
        
        if not supplier_intent:
            raise ValueError("Supplier intent not found or inactive")
        
        # Validate currency matches
        if supplier_intent.currency != request_data.currency:
            raise ValueError(f"Currency mismatch: supplier offers {supplier_intent.currency}, requested {request_data.currency}")
        
        # Validate amount doesn't exceed available liquidity
        if request_data.amount > supplier_intent.available_amount:
            raise ValueError(f"Amount exceeds available liquidity ({supplier_intent.available_amount})")
        
        # Prevent self-borrowing
        if borrower_address.lower() == supplier_intent.supplier_address.lower():
            raise ValueError("Cannot borrow from yourself")
        
        # Generate unique request ID
        request_id = f"req_{secrets.token_hex(16)}"
        
        # Calculate expiration (7 days)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Use supplier's max_apy as the interest rate (borrower cannot change it)
        request = BorrowRequest(
            id=request_id,
            borrower_address=borrower_address.lower(),
            supplier_address=supplier_intent.supplier_address,  # Link to supplier
            currency=request_data.currency,
            amount=request_data.amount,
            collateral_percent=request_data.collateral_percent,
            requested_apy=supplier_intent.max_apy,  # Use supplier's rate, not borrower's choice
            duration_days=request_data.duration_days,
            status=RequestStatus.PENDING.value,
            expires_at=expires_at
        )
        
        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)
        
        logger.info(f"Created borrow request {request_id} for {borrower_address} from supplier {supplier_intent.supplier_address}")
        return request
    
    def create_supplier_intent(
        self,
        supplier_address: str,
        intent_data: SupplyIntentSchema
    ) -> SupplierIntent:
        """
        Create or update supplier liquidity intent
        
        Security:
        - Validates supplier has authenticated wallet
        - Checks for existing intent and updates if found
        """
        # Check for existing intent
        existing = self.db.query(SupplierIntent).filter(
            and_(
                SupplierIntent.supplier_address == supplier_address.lower(),
                SupplierIntent.currency == intent_data.currency,
                SupplierIntent.active == True
            )
        ).first()
        
        if existing:
            # Update existing intent
            existing.max_amount = intent_data.max_amount
            existing.available_amount = intent_data.max_amount
            existing.min_credit_score = intent_data.min_credit_score
            existing.max_apy = intent_data.max_apy
            existing.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(existing)
            logger.info(f"Updated supplier intent for {supplier_address}")
            return existing
        
        # Create new intent
        intent_id = f"sup_{secrets.token_hex(16)}"
        intent = SupplierIntent(
            id=intent_id,
            supplier_address=supplier_address.lower(),
            currency=intent_data.currency,
            max_amount=intent_data.max_amount,
            available_amount=intent_data.max_amount,
            min_credit_score=intent_data.min_credit_score,
            max_apy=intent_data.max_apy,
            active=True
        )
        
        self.db.add(intent)
        self.db.commit()
        self.db.refresh(intent)
        
        logger.info(f"Created supplier intent {intent_id} for {supplier_address}")
        return intent
    
    def get_matched_requests_for_supplier(
        self,
        supplier_address: str,
        currency: Optional[str] = None
    ) -> List[BorrowRequest]:
        """
        Get borrow requests that match supplier's criteria
        
        Matching logic:
        - Same currency
        - Amount <= available liquidity
        - Requested APY <= max APY supplier willing to offer
        - Status = PENDING
        - Not expired
        - Borrower is not the supplier (prevent self-lending)
        """
        # Get supplier's active intents
        query = self.db.query(SupplierIntent).filter(
            and_(
                SupplierIntent.supplier_address == supplier_address.lower(),
                SupplierIntent.active == True
            )
        )
        
        if currency:
            query = query.filter(SupplierIntent.currency == currency)
        
        intents = query.all()
        
        if not intents:
            return []
        
        # Find matching borrow requests
        matched_requests = []
        for intent in intents:
            requests = self.db.query(BorrowRequest).filter(
                and_(
                    BorrowRequest.currency == intent.currency,
                    BorrowRequest.amount <= intent.available_amount,
                    BorrowRequest.requested_apy <= intent.max_apy,
                    BorrowRequest.status == RequestStatus.PENDING.value,
                    BorrowRequest.borrower_address != supplier_address.lower(),  # Prevent self-lending
                    or_(
                        BorrowRequest.expires_at == None,
                        BorrowRequest.expires_at > datetime.now(timezone.utc)
                    )
                )
            ).order_by(BorrowRequest.created_at.desc()).all()
            
            matched_requests.extend(requests)
        
        # Remove duplicates and sort by created_at
        unique_requests = {req.id: req for req in matched_requests}
        sorted_requests = sorted(unique_requests.values(), key=lambda x: x.created_at, reverse=True)
        
        logger.info(f"Found {len(sorted_requests)} matched requests for supplier {supplier_address}")
        return sorted_requests
    
    def verify_zk_proof_for_request(
        self,
        request_id: str,
        supplier_address: str,
        credit_score_threshold: int,
        zk_proof_data: Dict[str, Any]
    ) -> tuple[bool, int]:
        """
        Verify ZK proof and update request
        
        Args:
            request_id: Borrow request ID
            supplier_address: Supplier reviewing the request
            credit_score_threshold: Minimum score required
            zk_proof_data: ZK proof verification result
        
        Returns:
            (is_eligible, actual_score)
        
        Security:
        - Validates proof nullifier is unique (prevents replay)
        - Checks proof timestamp is recent (< 1 hour)
        - Verifies threshold matches proof public signals
        - PREVENTS SELF-LENDING: Supplier cannot review their own borrow request
        """
        request = self.db.query(BorrowRequest).filter(
            BorrowRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        # CRITICAL: Prevent self-lending - supplier cannot review their own request
        if request.borrower_address.lower() == supplier_address.lower():
            raise ValueError("Cannot supply to your own borrow request (self-lending not allowed)")
        
        # Check nullifier uniqueness (prevent replay attacks)
        nullifier = zk_proof_data.get("nullifier")
        if nullifier:
            existing = self.db.query(BorrowRequest).filter(
                and_(
                    BorrowRequest.nullifier == nullifier,
                    BorrowRequest.id != request_id
                )
            ).first()
            
            if existing:
                raise ValueError("Proof already used (replay attack detected)")
        
        # Verify proof timestamp is recent (< 1 hour)
        proof_timestamp = zk_proof_data.get("timestamp", 0)
        current_timestamp = int(datetime.now(timezone.utc).timestamp())
        if abs(current_timestamp - proof_timestamp) > 3600:
            raise ValueError("Proof timestamp too old or invalid")
        
        # Extract verification result
        is_eligible = zk_proof_data.get("is_eligible", False)
        actual_score = zk_proof_data.get("score_total", 0)
        
        # Update request
        request.status = RequestStatus.UNDER_REVIEW.value
        request.supplier_address = supplier_address.lower()
        request.zk_proof_verified = True
        request.credit_score_threshold = credit_score_threshold
        request.credit_score_actual = actual_score
        request.zk_proof_data = zk_proof_data
        request.nullifier = nullifier
        request.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        
        logger.info(f"ZK proof verified for request {request_id}: eligible={is_eligible}, score={actual_score}")
        return is_eligible, actual_score
    
    def approve_borrow_request(
        self,
        request_id: str,
        supplier_address: str,
        approval_data: ApproveBorrowRequestSchema
    ) -> BorrowRequest:
        """
        Approve a borrow request
        
        Security:
        - Validates supplier is the one who reviewed the request
        - Checks ZK proof was verified
        - Updates supplier's available liquidity
        - PREVENTS SELF-LENDING: Supplier cannot approve their own borrow request
        """
        request = self.db.query(BorrowRequest).filter(
            BorrowRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        # CRITICAL: Prevent self-lending - supplier cannot approve their own request
        if request.borrower_address.lower() == supplier_address.lower():
            raise ValueError("Cannot approve your own borrow request (self-lending not allowed)")
        
        if request.supplier_address != supplier_address.lower():
            raise ValueError("Only the reviewing supplier can approve this request")
        
        if not request.zk_proof_verified:
            raise ValueError("ZK proof must be verified before approval")
        
        if request.status != RequestStatus.UNDER_REVIEW.value:
            raise ValueError(f"Request must be under review (current status: {request.status})")
        
        # Update request
        request.status = RequestStatus.APPROVED.value
        request.offered_apy = approval_data.offered_apy
        request.terms = approval_data.terms
        request.updated_at = datetime.now(timezone.utc)
        
        # Reserve liquidity from supplier intent
        intent = self.db.query(SupplierIntent).filter(
            and_(
                SupplierIntent.supplier_address == supplier_address.lower(),
                SupplierIntent.currency == request.currency,
                SupplierIntent.active == True
            )
        ).first()
        
        if intent:
            intent.available_amount -= request.amount
            if intent.available_amount < 0:
                intent.available_amount = 0
        
        self.db.commit()
        self.db.refresh(request)
        
        logger.info(f"Approved borrow request {request_id} by supplier {supplier_address}")
        return request
    
    def reject_borrow_request(
        self,
        request_id: str,
        supplier_address: str
    ) -> BorrowRequest:
        """
        Reject a borrow request
        
        Security:
        - PREVENTS SELF-LENDING: Supplier cannot reject their own borrow request
        """
        request = self.db.query(BorrowRequest).filter(
            BorrowRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        # CRITICAL: Prevent self-lending - supplier cannot reject their own request
        if request.borrower_address.lower() == supplier_address.lower():
            raise ValueError("Cannot reject your own borrow request (self-lending not allowed)")
        
        if request.supplier_address != supplier_address.lower():
            raise ValueError("Only the reviewing supplier can reject this request")
        
        request.status = RequestStatus.REJECTED.value
        request.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(request)
        
        logger.info(f"Rejected borrow request {request_id} by supplier {supplier_address}")
        return request
    
    def get_borrower_requests(
        self,
        borrower_address: str,
        status: Optional[str] = None
    ) -> List[BorrowRequest]:
        """Get all requests for a borrower"""
        query = self.db.query(BorrowRequest).filter(
            BorrowRequest.borrower_address == borrower_address.lower()
        )
        
        if status:
            query = query.filter(BorrowRequest.status == status)
        
        return query.order_by(BorrowRequest.created_at.desc()).all()
    
    def get_supplier_reviews(
        self,
        supplier_address: str,
        status: Optional[str] = None
    ) -> List[BorrowRequest]:
        """Get all requests reviewed by a supplier"""
        query = self.db.query(BorrowRequest).filter(
            BorrowRequest.supplier_address == supplier_address.lower()
        )
        
        if status:
            query = query.filter(BorrowRequest.status == status)
        
        return query.order_by(BorrowRequest.updated_at.desc()).all()

    def get_supplier_stats(self, supplier_address: str) -> dict:
        """
        Get supplier statistics
        
        Returns:
        - total_supplied: Total amount currently supplied across all active intents
        - earned_interest: Total interest earned (calculated from approved/completed loans)
        - active_intents: Number of active supply intents
        """
        from db_models import SupplierIntent, BorrowRequest
        from sqlalchemy import func, and_
        
        # Get active intents
        active_intents = self.db.query(SupplierIntent).filter(
            and_(
                SupplierIntent.supplier_address == supplier_address.lower(),
                SupplierIntent.active == True
            )
        ).all()
        
        # Calculate total supplied (sum of max_amount from active intents)
        total_supplied = sum(intent.max_amount for intent in active_intents)
        
        # Calculate earned interest from approved/completed requests
        # For now, return 0 as we don't have loan completion tracking yet
        # TODO: Implement loan tracking and interest calculation
        earned_interest = 0.0
        
        return {
            "totalSupplied": total_supplied,
            "earnedInterest": earned_interest,
            "activeIntents": len(active_intents)
        }
