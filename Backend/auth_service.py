from datetime import datetime, timedelta
from typing import Tuple, Optional
from models import NonceResponse, AuthResponse
from crypto_utils import CryptoUtils
from nonce_store import get_nonce_store
from jwt_handler import JWTHandler
from config import settings


class AuthService:
    """Core authentication service for wallet-based auth"""
    
    def __init__(self):
        self.nonce_store = get_nonce_store()
        self.crypto_utils = CryptoUtils()
        self.jwt_handler = JWTHandler()
    
    def generate_nonce(self, address: str) -> NonceResponse:
        """
        Generate authentication nonce for wallet address
        
        Args:
            address: Ethereum wallet address
        
        Returns:
            NonceResponse with nonce, message, and expiration
        
        Raises:
            ValueError: If address is invalid
        """
        # Validate address format
        if not self.crypto_utils.is_valid_ethereum_address(address):
            raise ValueError("Invalid Ethereum address")
        
        # Normalize address
        address = address.lower()
        
        # Generate cryptographically secure nonce
        nonce = self.crypto_utils.generate_nonce()
        
        # Create authentication message
        timestamp = datetime.utcnow().isoformat()
        message = self.crypto_utils.create_auth_message(address, nonce, timestamp)
        
        # Store nonce with expiration
        expires_at = self.nonce_store.store_nonce(
            address,
            nonce,
            settings.NONCE_EXPIRE_SECONDS
        )
        
        return NonceResponse(
            nonce=nonce,
            message=message,
            expires_at=expires_at
        )
    
    def verify_signature(
        self,
        address: str,
        message: str,
        signature: str
    ) -> Tuple[bool, Optional[AuthResponse], Optional[str]]:
        """
        Verify wallet signature and create authenticated session
        
        Args:
            address: Wallet address claiming to have signed
            message: Original message that was signed
            signature: Signature from wallet
        
        Returns:
            Tuple of (success, AuthResponse or None, error message or None)
        """
        # Normalize address
        address = address.lower()
        
        # Extract nonce from message
        nonce = self.crypto_utils.extract_nonce_from_message(message)
        if nonce is None:
            return False, None, "Invalid message format: nonce not found"
        
        # Extract address from message
        message_address = self.crypto_utils.extract_address_from_message(message)
        if message_address is None:
            return False, None, "Invalid message format: address not found"
        
        # Verify address in message matches claimed address
        if message_address.lower() != address:
            return False, None, "Address mismatch between message and request"
        
        # Verify nonce exists and is unused
        if not self.nonce_store.verify_and_consume_nonce(address, nonce):
            return False, None, "Invalid or expired nonce"
        
        # Verify cryptographic signature
        if not self.crypto_utils.verify_signature(message, signature, address):
            return False, None, "Invalid signature"
        
        # All checks passed - create authenticated session
        access_token = self.jwt_handler.create_access_token(address)
        
        auth_response = AuthResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            wallet_address=address
        )
        
        return True, auth_response, None
    
    def verify_token(self, token: str) -> Optional[str]:
        """
        Verify JWT token and extract wallet address
        
        Args:
            token: JWT token
        
        Returns:
            Wallet address if valid, None otherwise
        """
        return self.jwt_handler.verify_token(token)
    
    def revoke_nonce(self, address: str) -> bool:
        """
        Revoke/delete nonce for address
        
        Args:
            address: Wallet address
        
        Returns:
            True if nonce was deleted
        """
        return self.nonce_store.delete_nonce(address.lower())
