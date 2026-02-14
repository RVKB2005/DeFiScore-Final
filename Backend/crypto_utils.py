from eth_account.messages import encode_defunct
from eth_account import Account
from web3 import Web3
import secrets
from datetime import datetime, timedelta
from typing import Tuple, Optional


class CryptoUtils:
    """Cryptographic utilities for wallet authentication"""
    
    @staticmethod
    def generate_nonce() -> str:
        """Generate cryptographically secure random nonce"""
        return secrets.token_hex(32)
    
    @staticmethod
    def create_auth_message(address: str, nonce: str, timestamp: Optional[str] = None) -> str:
        """
        Create authentication message for wallet signing
        
        Args:
            address: Ethereum wallet address
            nonce: Unique nonce for this authentication attempt
            timestamp: ISO format timestamp (optional)
        
        Returns:
            Human-readable message string
        """
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat()
        
        message = f"""DeFiScore Authentication

Wallet: {address}
Nonce: {nonce}
Timestamp: {timestamp}

By signing this message, you are authenticating with DeFiScore.
This request will not trigger a blockchain transaction or cost any gas fees."""
        
        return message
    
    @staticmethod
    def verify_signature(message: str, signature: str, expected_address: str) -> bool:
        """
        Verify that signature was created by the expected address
        
        Args:
            message: Original message that was signed
            signature: Signature from wallet
            expected_address: Address that should have signed the message
        
        Returns:
            True if signature is valid and matches expected address
        """
        try:
            # Normalize addresses to lowercase
            expected_address = Web3.to_checksum_address(expected_address.lower())
            
            # Encode message for Ethereum signing
            encoded_message = encode_defunct(text=message)
            
            # Recover address from signature
            recovered_address = Account.recover_message(encoded_message, signature=signature)
            
            # Compare addresses
            return recovered_address.lower() == expected_address.lower()
            
        except Exception as e:
            print(f"Signature verification error: {e}")
            return False
    
    @staticmethod
    def extract_nonce_from_message(message: str) -> Optional[str]:
        """
        Extract nonce from authentication message
        
        Args:
            message: Authentication message
        
        Returns:
            Nonce string or None if not found
        """
        try:
            lines = message.split('\n')
            for line in lines:
                if line.startswith('Nonce:'):
                    return line.split('Nonce:')[1].strip()
            return None
        except Exception:
            return None
    
    @staticmethod
    def extract_address_from_message(message: str) -> Optional[str]:
        """
        Extract wallet address from authentication message
        
        Args:
            message: Authentication message
        
        Returns:
            Address string or None if not found
        """
        try:
            lines = message.split('\n')
            for line in lines:
                if line.startswith('Wallet:'):
                    return line.split('Wallet:')[1].strip()
            return None
        except Exception:
            return None
    
    @staticmethod
    def is_valid_ethereum_address(address: str) -> bool:
        """
        Validate Ethereum address format
        
        Args:
            address: Address to validate
        
        Returns:
            True if valid Ethereum address
        """
        try:
            return Web3.is_address(address)
        except Exception:
            return False
