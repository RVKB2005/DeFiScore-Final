from fastapi import APIRouter, HTTPException, status, Depends
from models import (
    NonceRequest,
    NonceResponse,
    VerifyRequest,
    AuthResponse,
    WalletConnectionInfo
)
from auth_service import AuthService
from dependencies import get_current_wallet, get_optional_wallet
from wallet_utils import WalletUtils
from typing import Optional
import logging

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()
wallet_utils = WalletUtils()


@router.post("/nonce", response_model=NonceResponse, status_code=status.HTTP_200_OK)
async def request_nonce(request: NonceRequest):
    """
    Generate authentication nonce for wallet address
    
    Flow:
    1. Client connects wallet and gets address
    2. Client requests nonce from this endpoint
    3. Backend generates random nonce and stores it temporarily
    4. Client receives nonce and constructs message to sign
    
    Security:
    - Nonce expires after configured time (default 5 minutes)
    - Each nonce is single-use
    - Nonce is cryptographically random
    """
    try:
        nonce_response = auth_service.generate_nonce(request.address)
        return nonce_response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate nonce: {str(e)}"
        )


@router.post("/verify", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def verify_signature(request: VerifyRequest):
    """
    Verify wallet signature and establish authenticated session
    
    Flow:
    1. Client signs message with wallet private key
    2. Client sends address, message, and signature to this endpoint
    3. Backend verifies:
       - Nonce exists and is unused
       - Signature is cryptographically valid
       - Signature was created by claimed address
    4. If valid, backend creates JWT session token
    
    Security:
    - Nonce is consumed immediately (replay protection)
    - Signature verification uses standard ECDSA recovery
    - Session token has limited lifetime
    """
    try:
        success, auth_response, error = auth_service.verify_signature(
            request.address,
            request.message,
            request.signature
        )
        
        if not success:
            logger.warning(f"Signature verification failed for {request.address}: {error}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error or "Authentication failed"
            )
        
        return auth_response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error for {request.address}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}"
        )


@router.get("/me", status_code=status.HTTP_200_OK)
async def get_current_user(wallet_address: str = Depends(get_current_wallet)):
    """
    Get current authenticated wallet information
    
    Requires valid JWT token in Authorization header
    """
    return {
        "wallet_address": wallet_address,
        "authenticated": True
    }


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(wallet_address: str = Depends(get_current_wallet)):
    """
    Logout current session
    
    Note: JWT tokens are stateless, so this primarily revokes any pending nonces
    Client should discard the token
    """
    auth_service.revoke_nonce(wallet_address)
    return {"message": "Logged out successfully"}


@router.get("/wallet-info/{wallet_type}", response_model=WalletConnectionInfo)
async def get_wallet_connection_info(wallet_type: str, connection_url: Optional[str] = None):
    """
    Get wallet connection information and QR codes
    
    Supports:
    - MetaMask (browser extension)
    - Coinbase Wallet (browser extension + mobile)
    - WalletConnect (QR code for any wallet)
    - Generic wallets (QR code generation)
    """
    wallet_info = wallet_utils.get_wallet_info(wallet_type)
    
    if wallet_info is None and wallet_type.lower() != "other":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported wallet type: {wallet_type}"
        )
    
    response = WalletConnectionInfo(wallet_type=wallet_type)
    
    # Generate QR code for WalletConnect or other wallets
    if wallet_type.lower() in ["walletconnect", "other"] and connection_url:
        qr_code = wallet_utils.generate_generic_wallet_qr(connection_url)
        response.qr_code = qr_code
        response.deep_link = connection_url
    
    # Generate deep link for Coinbase Wallet
    elif wallet_type.lower() == "coinbase" and connection_url:
        deep_link_template = wallet_info.get("deep_link_template")
        if deep_link_template:
            response.deep_link = deep_link_template.format(url=connection_url)
    
    return response


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "wallet-authentication"
    }
