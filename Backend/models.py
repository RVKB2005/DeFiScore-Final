from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class NonceRequest(BaseModel):
    address: str = Field(..., description="Ethereum wallet address")
    
    @field_validator('address')
    @classmethod
    def validate_address(cls, v: str) -> str:
        # Remove any whitespace
        v = v.strip()
        
        # Check basic format
        if not v.startswith('0x'):
            raise ValueError('Address must start with 0x')
        
        if len(v) != 42:
            raise ValueError(f'Address must be 42 characters long (got {len(v)})')
        
        # Check if it's a valid hex string
        try:
            int(v, 16)
        except ValueError:
            raise ValueError('Address must be a valid hexadecimal string')
        
        return v.lower()


class NonceResponse(BaseModel):
    nonce: str
    message: str
    expires_at: datetime


class VerifyRequest(BaseModel):
    address: str = Field(..., description="Ethereum wallet address")
    message: str = Field(..., description="Signed message")
    signature: str = Field(..., description="Signature from wallet")
    
    @field_validator('address')
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not v.startswith('0x') or len(v) != 42:
            raise ValueError('Invalid Ethereum address format')
        return v.lower()
    
    @field_validator('signature')
    @classmethod
    def validate_signature(cls, v: str) -> str:
        if not v.startswith('0x'):
            raise ValueError('Invalid signature format')
        return v


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    wallet_address: str


class WalletConnectionInfo(BaseModel):
    wallet_type: str
    qr_code: Optional[str] = None
    deep_link: Optional[str] = None
