"""
Blockchain Lending Routes
API endpoints for coordinating blockchain transactions with database state
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from dependencies import get_current_wallet
from blockchain_lending_service import blockchain_lending_service
from db_models import BorrowRequest, LoanAgreement
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/blockchain/lending", tags=["Blockchain Lending"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateLoanOnChainRequest(BaseModel):
    """Request to create loan on blockchain"""
    request_id: str = Field(..., description="Borrow request ID")
    collateral_token: str = Field(..., description="Collateral token address")
    loan_token: str = Field(..., description="Loan token address")


class DepositCollateralRequest(BaseModel):
    """Request to get collateral deposit instructions"""
    loan_id: str = Field(..., description="Loan ID")


class FundLoanRequest(BaseModel):
    """Request to get loan funding instructions"""
    loan_id: str = Field(..., description="Loan ID")


class RepayLoanRequest(BaseModel):
    """Request to make a repayment"""
    loan_id: str = Field(..., description="Loan ID")
    amount: float = Field(..., gt=0, description="Repayment amount")


class LiquidateCollateralRequest(BaseModel):
    """Request to liquidate collateral"""
    loan_id: str = Field(..., description="Loan ID")


# ============================================================================
# LOAN CREATION & SETUP
# ============================================================================

@router.post("/create-loan-on-chain")
async def create_loan_on_blockchain(
    request: CreateLoanOnChainRequest,
    background_tasks: BackgroundTasks,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Create a loan agreement on the blockchain after supplier approves
    
    Flow:
    1. Supplier approves borrow request (off-chain)
    2. Backend creates loan on blockchain
    3. Borrower deposits collateral
    4. Supplier funds the loan
    
    Security:
    - Only supplier who approved can trigger this
    - Validates request is approved
    - Creates loan agreement in database
    """
    try:
        # Get borrow request
        borrow_request = db.query(BorrowRequest).filter(
            BorrowRequest.id == request.request_id
        ).first()
        
        if not borrow_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Borrow request not found"
            )
        
        # Validate supplier is the one who approved
        if borrow_request.supplier_address.lower() != wallet_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the approving supplier can create the loan"
            )
        
        # Validate request is approved
        if borrow_request.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request must be approved (current status: {borrow_request.status})"
            )
        
        # Check if loan already exists on blockchain
        existing_loan = db.query(LoanAgreement).filter(
            LoanAgreement.borrow_request_id == request.request_id
        ).first()
        
        if existing_loan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loan already created on blockchain"
            )
        
        # Create loan on blockchain
        result = blockchain_lending_service.create_loan_on_chain(
            loan_id=borrow_request.id,
            borrower_address=borrow_request.borrower_address,
            lender_address=borrow_request.supplier_address,
            loan_token=request.loan_token,
            collateral_token=request.collateral_token,
            loan_amount=float(borrow_request.amount),
            collateral_amount=float(borrow_request.amount * borrow_request.collateral_percent / 100),
            interest_rate=float(borrow_request.requested_apy),
            duration_days=borrow_request.duration_days
        )
        
        if not result.get('success'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create loan on blockchain: {result.get('error')}"
            )
        
        # Create loan agreement in database
        loan_agreement = LoanAgreement(
            id=f"loan_{borrow_request.id}",
            borrow_request_id=borrow_request.id,
            borrower_address=borrow_request.borrower_address,
            lender_address=borrow_request.supplier_address,
            currency=borrow_request.currency,
            amount=borrow_request.amount,
            collateral_percent=borrow_request.collateral_percent,
            interest_rate=borrow_request.requested_apy,
            duration_days=borrow_request.duration_days,
            loan_token=request.loan_token,
            collateral_token=request.collateral_token,
            blockchain_tx_hash=result.get('transaction_hash'),
            status="pending_collateral",  # Waiting for borrower to deposit collateral
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(loan_agreement)
        
        # Update borrow request status
        borrow_request.status = "funded"
        
        db.commit()
        db.refresh(loan_agreement)
        
        logger.info(f"Loan created on blockchain: {borrow_request.id}, tx: {result.get('transaction_hash')}")
        
        return {
            "success": True,
            "loan_id": loan_agreement.id,
            "transaction_hash": result.get('transaction_hash'),
            "block_number": result.get('block_number'),
            "status": "pending_collateral",
            "message": "Loan created on blockchain. Borrower must now deposit collateral."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create loan on blockchain: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/collateral-instructions/{loan_id}")
async def get_collateral_deposit_instructions(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get instructions for borrower to deposit collateral
    
    Returns:
    - Contract address
    - Token addresses
    - Amounts
    - Function call data
    """
    try:
        # Get loan agreement
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Validate borrower
        if loan.borrower_address.lower() != wallet_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only borrower can get collateral instructions"
            )
        
        # Validate status
        if loan.status != "pending_collateral":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loan is not awaiting collateral (current status: {loan.status})"
            )
        
        # Calculate collateral amount
        collateral_amount = float(loan.amount) * float(loan.collateral_percent) / 100
        
        # Get instructions from blockchain service
        instructions = blockchain_lending_service.get_collateral_instructions(
            loan_id=loan.borrow_request_id,
            borrower_address=loan.borrower_address,
            collateral_token=loan.collateral_token,
            collateral_amount=collateral_amount
        )
        
        return {
            "loan_id": loan_id,
            "borrower": loan.borrower_address,
            "collateral_token": loan.collateral_token,
            "collateral_amount": collateral_amount,
            "instructions": instructions,
            "status": loan.status
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get collateral instructions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/confirm-collateral-deposit/{loan_id}")
async def confirm_collateral_deposited(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Confirm that collateral has been deposited (called after blockchain tx)
    
    Updates loan status to pending_funding
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Verify on blockchain
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        if not blockchain_loan:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify loan status on blockchain"
            )
        
        # Check if collateral is deposited (status should be COLLATERALIZED)
        if blockchain_loan.get('status') != 'COLLATERALIZED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Collateral not yet deposited on blockchain"
            )
        
        # Update loan status
        loan.status = "pending_funding"
        loan.collateral_deposited_at = datetime.now(timezone.utc)
        
        db.commit()
        
        logger.info(f"Collateral deposited for loan {loan_id}")
        
        return {
            "success": True,
            "loan_id": loan_id,
            "status": "pending_funding",
            "message": "Collateral confirmed. Waiting for lender to fund the loan."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to confirm collateral deposit: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/funding-instructions/{loan_id}")
async def get_loan_funding_instructions(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get instructions for lender to fund the loan
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Validate lender
        if loan.lender_address.lower() != wallet_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only lender can get funding instructions"
            )
        
        # Validate status
        if loan.status != "pending_funding":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loan is not ready for funding (current status: {loan.status})"
            )
        
        # Get instructions
        instructions = blockchain_lending_service.get_funding_instructions(
            loan_id=loan.borrow_request_id,
            lender_address=loan.lender_address,
            loan_token=loan.loan_token,
            loan_amount=float(loan.amount)
        )
        
        return {
            "loan_id": loan_id,
            "lender": loan.lender_address,
            "loan_token": loan.loan_token,
            "loan_amount": float(loan.amount),
            "instructions": instructions,
            "status": loan.status
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get funding instructions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/confirm-loan-funded/{loan_id}")
async def confirm_loan_funded(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Confirm that loan has been funded (called after blockchain tx)
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Verify on blockchain
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        if not blockchain_loan:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify loan status on blockchain"
            )
        
        # Check if loan is active
        if blockchain_loan.get('status') != 'ACTIVE':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loan not yet funded on blockchain"
            )
        
        # Update loan status
        loan.status = "active"
        loan.funded_at = datetime.now(timezone.utc)
        loan.start_time = blockchain_loan.get('start_time')
        loan.due_date = blockchain_loan.get('due_date')
        
        db.commit()
        
        logger.info(f"Loan funded: {loan_id}")
        
        return {
            "success": True,
            "loan_id": loan_id,
            "status": "active",
            "start_time": loan.start_time,
            "due_date": loan.due_date,
            "message": "Loan is now active. Borrower can make repayments."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to confirm loan funding: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================================
# REPAYMENT & LIQUIDATION
# ============================================================================

@router.get("/loan-details/{loan_id}")
async def get_loan_details(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get detailed loan information from both database and blockchain
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Validate access (borrower or lender)
        if (loan.borrower_address.lower() != wallet_address.lower() and
            loan.lender_address.lower() != wallet_address.lower()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get blockchain status
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        # Check if overdue
        is_overdue = False
        if loan.status == "active":
            is_overdue = blockchain_lending_service.is_loan_overdue(loan.borrow_request_id)
        
        return {
            "loan_id": loan_id,
            "borrower": loan.borrower_address,
            "lender": loan.lender_address,
            "currency": loan.currency,
            "amount": float(loan.amount),
            "collateral_percent": loan.collateral_percent,
            "interest_rate": float(loan.interest_rate),
            "duration_days": loan.duration_days,
            "status": loan.status,
            "blockchain_status": blockchain_loan.get('status') if blockchain_loan else None,
            "start_time": loan.start_time,
            "due_date": loan.due_date,
            "is_overdue": is_overdue,
            "total_repayment": blockchain_loan.get('total_repayment') if blockchain_loan else None,
            "amount_repaid": blockchain_loan.get('amount_repaid') if blockchain_loan else None,
            "created_at": loan.created_at.isoformat(),
            "funded_at": loan.funded_at.isoformat() if loan.funded_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get loan details: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/my-loans")
async def get_my_loans(
    role: Optional[str] = None,  # "borrower" or "lender"
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get all loans for the authenticated user (as borrower or lender)
    """
    try:
        query = db.query(LoanAgreement)
        
        if role == "borrower":
            query = query.filter(LoanAgreement.borrower_address == wallet_address.lower())
        elif role == "lender":
            query = query.filter(LoanAgreement.lender_address == wallet_address.lower())
        else:
            # Get both
            query = query.filter(
                (LoanAgreement.borrower_address == wallet_address.lower()) |
                (LoanAgreement.lender_address == wallet_address.lower())
            )
        
        loans = query.order_by(LoanAgreement.created_at.desc()).all()
        
        return [{
            "loan_id": loan.id,
            "borrower": loan.borrower_address,
            "lender": loan.lender_address,
            "currency": loan.currency,
            "amount": float(loan.amount),
            "interest_rate": float(loan.interest_rate),
            "duration_days": loan.duration_days,
            "status": loan.status,
            "created_at": loan.created_at.isoformat(),
            "due_date": loan.due_date,
            "role": "borrower" if loan.borrower_address.lower() == wallet_address.lower() else "lender"
        } for loan in loans]
    
    except Exception as e:
        logger.error(f"Failed to get user loans: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/repayment-instructions/{loan_id}")
async def get_repayment_instructions(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Get repayment instructions for borrower
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Validate borrower
        if loan.borrower_address.lower() != wallet_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only borrower can get repayment instructions"
            )
        
        # Validate status
        if loan.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loan is not active (current status: {loan.status})"
            )
        
        # Get blockchain loan details
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        if not blockchain_loan:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get loan status from blockchain"
            )
        
        total_repayment = float(blockchain_loan.get('total_repayment', 0))
        amount_repaid = float(blockchain_loan.get('amount_repaid', 0))
        remaining = total_repayment - amount_repaid
        
        return {
            "loan_id": loan_id,
            "borrower": loan.borrower_address,
            "loan_token": loan.loan_token,
            "total_repayment": total_repayment,
            "amount_repaid": amount_repaid,
            "remaining_amount": remaining,
            "due_date": loan.due_date,
            "is_overdue": blockchain_lending_service.is_loan_overdue(loan.borrow_request_id),
            "contract_address": blockchain_lending_service.contract_address,
            "instructions": [
                f"1. Approve {remaining} tokens to contract",
                f"2. Call makeRepayment with amount",
                "3. Collateral will be returned when fully repaid"
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get repayment instructions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/confirm-repayment/{loan_id}")
async def confirm_repayment(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Confirm repayment has been made (called after blockchain tx)
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Get blockchain status
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        if not blockchain_loan:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify repayment on blockchain"
            )
        
        # Update database with latest repayment info
        loan.amount_repaid = blockchain_loan.get('amount_repaid', 0)
        
        # Check if fully repaid
        if blockchain_loan.get('status') == 'REPAID':
            loan.status = "repaid"
            loan.is_fully_repaid = True
            loan.repaid_at = datetime.now(timezone.utc)
            
            logger.info(f"Loan fully repaid: {loan_id}")
            
            return {
                "success": True,
                "loan_id": loan_id,
                "status": "repaid",
                "message": "Loan fully repaid! Collateral has been returned."
            }
        else:
            db.commit()
            
            return {
                "success": True,
                "loan_id": loan_id,
                "status": "active",
                "amount_repaid": float(loan.amount_repaid),
                "message": "Partial repayment confirmed."
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to confirm repayment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/mark-defaulted/{loan_id}")
async def mark_loan_as_defaulted(
    loan_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark a loan as defaulted if past due date
    Can be called by anyone
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Check if overdue
        is_overdue = blockchain_lending_service.is_loan_overdue(loan.borrow_request_id)
        
        if not is_overdue:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loan is not past due date"
            )
        
        # Mark as defaulted on blockchain
        result = blockchain_lending_service.mark_loan_defaulted(loan.borrow_request_id)
        
        if not result.get('success'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to mark loan as defaulted: {result.get('error')}"
            )
        
        # Update database
        loan.status = "defaulted"
        loan.defaulted_at = datetime.now(timezone.utc)
        
        db.commit()
        
        logger.info(f"Loan marked as defaulted: {loan_id}")
        
        return {
            "success": True,
            "loan_id": loan_id,
            "status": "defaulted",
            "transaction_hash": result.get('transaction_hash'),
            "message": "Loan marked as defaulted. Lender can now liquidate collateral."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark loan as defaulted: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/liquidate-collateral/{loan_id}")
async def liquidate_collateral(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Liquidate collateral after loan default (lender only)
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Validate lender
        if loan.lender_address.lower() != wallet_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only lender can liquidate collateral"
            )
        
        # Validate status
        if loan.status != "defaulted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loan must be defaulted to liquidate (current status: {loan.status})"
            )
        
        # Check blockchain status
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        if blockchain_loan.get('status') != 'DEFAULTED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loan not marked as defaulted on blockchain"
            )
        
        # Liquidate on blockchain (this will be done via frontend)
        # Backend just confirms the liquidation
        
        return {
            "loan_id": loan_id,
            "lender": loan.lender_address,
            "collateral_token": loan.collateral_token,
            "collateral_amount": float(loan.amount * loan.collateral_percent / 100),
            "contract_address": blockchain_lending_service.contract_address,
            "instructions": [
                "1. Call liquidateCollateral on the contract",
                "2. Collateral will be transferred to your wallet",
                "3. Loan will be marked as liquidated"
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get liquidation instructions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/confirm-liquidation/{loan_id}")
async def confirm_liquidation(
    loan_id: str,
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
):
    """
    Confirm collateral has been liquidated
    """
    try:
        loan = db.query(LoanAgreement).filter(
            LoanAgreement.id == loan_id
        ).first()
        
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan not found"
            )
        
        # Verify on blockchain
        blockchain_loan = blockchain_lending_service.get_loan_status(loan.borrow_request_id)
        
        if blockchain_loan.get('status') != 'LIQUIDATED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Collateral not yet liquidated on blockchain"
            )
        
        # Update database
        loan.status = "liquidated"
        loan.is_liquidated = True
        loan.liquidated_at = datetime.now(timezone.utc)
        
        db.commit()
        
        logger.info(f"Collateral liquidated for loan: {loan_id}")
        
        return {
            "success": True,
            "loan_id": loan_id,
            "status": "liquidated",
            "message": "Collateral liquidated successfully."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to confirm liquidation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
