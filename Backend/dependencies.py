from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from auth_service import AuthService


security = HTTPBearer()
auth_service = AuthService()


async def get_current_wallet(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Dependency to extract and verify authenticated wallet from JWT token
    
    Args:
        credentials: HTTP Bearer token credentials
    
    Returns:
        Authenticated wallet address
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    
    wallet_address = auth_service.verify_token(token)
    
    if wallet_address is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return wallet_address


async def get_optional_wallet(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[str]:
    """
    Dependency to extract wallet from JWT token (optional)
    
    Args:
        credentials: HTTP Bearer token credentials (optional)
    
    Returns:
        Authenticated wallet address or None
    """
    if credentials is None:
        return None
    
    token = credentials.credentials
    return auth_service.verify_token(token)
