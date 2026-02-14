from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from config import settings


class JWTHandler:
    """JWT token generation and validation"""
    
    @staticmethod
    def create_access_token(wallet_address: str, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create JWT access token for authenticated wallet
        
        Args:
            wallet_address: Authenticated wallet address
            expires_delta: Token expiration time (default from settings)
        
        Returns:
            JWT token string
        """
        if expires_delta is None:
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        expire = datetime.utcnow() + expires_delta
        
        payload = {
            "sub": wallet_address.lower(),
            "wallet_address": wallet_address.lower(),
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        encoded_jwt = jwt.encode(
            payload,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[str]:
        """
        Verify JWT token and extract wallet address
        
        Args:
            token: JWT token string
        
        Returns:
            Wallet address if valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            
            wallet_address: str = payload.get("wallet_address")
            
            if wallet_address is None:
                return None
            
            return wallet_address
            
        except JWTError:
            return None
    
    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        """
        Decode JWT token without verification (for debugging)
        
        Args:
            token: JWT token string
        
        Returns:
            Decoded payload or None
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            return payload
        except JWTError:
            return None
