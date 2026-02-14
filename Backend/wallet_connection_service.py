"""
Wallet Connection Service
Handles connection for MetaMask, WalletConnect, Coinbase, and other wallets
"""
import qrcode
import io
import base64
from typing import Optional
import uuid
import logging
from data_ingestion_models import (
    WalletType,
    WalletConnectionRequest,
    WalletConnectionResponse
)

logger = logging.getLogger(__name__)


class WalletConnectionService:
    """
    Service for handling wallet connections
    Supports MetaMask, WalletConnect, Coinbase, and generic wallets via QR
    """
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
    
    def generate_qr_code(self, data: str) -> str:
        """
        Generate QR code as base64 encoded image
        
        Args:
            data: Data to encode in QR code
            
        Returns:
            Base64 encoded PNG image
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    def create_walletconnect_session(self) -> WalletConnectionResponse:
        """
        Create WalletConnect session
        
        Returns:
            Connection response with QR code and deep link
        """
        session_id = str(uuid.uuid4())
        
        # WalletConnect URI format
        # In production, this would use actual WalletConnect SDK
        wc_uri = f"wc:{session_id}@1?bridge=https://bridge.walletconnect.org&key=..."
        
        qr_code = self.generate_qr_code(wc_uri)
        
        return WalletConnectionResponse(
            wallet_type=WalletType.WALLETCONNECT,
            connection_method="qr_code",
            qr_code_data=qr_code,
            deep_link=wc_uri,
            session_id=session_id
        )
    
    def create_metamask_connection(self) -> WalletConnectionResponse:
        """
        Create MetaMask connection
        
        Returns:
            Connection response with deep link
        """
        # MetaMask deep link for mobile
        deep_link = f"https://metamask.app.link/dapp/{self.base_url.replace('http://', '').replace('https://', '')}"
        
        return WalletConnectionResponse(
            wallet_type=WalletType.METAMASK,
            connection_method="deep_link",
            deep_link=deep_link,
            session_id=None
        )
    
    def create_coinbase_connection(self) -> WalletConnectionResponse:
        """
        Create Coinbase Wallet connection
        
        Returns:
            Connection response with deep link and QR
        """
        session_id = str(uuid.uuid4())
        
        # Coinbase Wallet deep link
        deep_link = f"https://go.cb-w.com/dapp?url={self.base_url}"
        
        # Also provide QR code for desktop users
        qr_code = self.generate_qr_code(deep_link)
        
        return WalletConnectionResponse(
            wallet_type=WalletType.COINBASE,
            connection_method="deep_link_or_qr",
            qr_code_data=qr_code,
            deep_link=deep_link,
            session_id=session_id
        )
    
    def create_generic_wallet_connection(self, wallet_address: Optional[str] = None) -> WalletConnectionResponse:
        """
        Create generic wallet connection via QR code
        For wallets not directly supported
        
        Args:
            wallet_address: Optional wallet address
            
        Returns:
            Connection response with QR code
        """
        session_id = str(uuid.uuid4())
        
        # Create connection URL
        connection_url = f"{self.base_url}/connect?session={session_id}"
        if wallet_address:
            connection_url += f"&address={wallet_address}"
        
        qr_code = self.generate_qr_code(connection_url)
        
        return WalletConnectionResponse(
            wallet_type=WalletType.OTHER,
            connection_method="qr_code",
            qr_code_data=qr_code,
            deep_link=connection_url,
            session_id=session_id
        )
    
    def handle_connection_request(self, request: WalletConnectionRequest) -> WalletConnectionResponse:
        """
        Handle wallet connection request
        
        Args:
            request: Wallet connection request
            
        Returns:
            Connection response with appropriate method
        """
        logger.info(f"Handling connection request for wallet type: {request.wallet_type}")
        
        if request.wallet_type == WalletType.METAMASK:
            return self.create_metamask_connection()
        
        elif request.wallet_type == WalletType.WALLETCONNECT:
            return self.create_walletconnect_session()
        
        elif request.wallet_type == WalletType.COINBASE:
            return self.create_coinbase_connection()
        
        else:
            return self.create_generic_wallet_connection(request.wallet_address)
