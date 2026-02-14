import qrcode
from io import BytesIO
import base64
from typing import Optional


class WalletUtils:
    """Utilities for wallet connection support"""
    
    SUPPORTED_WALLETS = {
        "metamask": {
            "name": "MetaMask",
            "type": "browser_extension",
            "deep_link_template": None
        },
        "coinbase": {
            "name": "Coinbase Wallet",
            "type": "browser_extension",
            "deep_link_template": "https://go.cb-w.com/dapp?cb_url={url}"
        },
        "walletconnect": {
            "name": "WalletConnect",
            "type": "qr_code",
            "deep_link_template": None
        }
    }
    
    @staticmethod
    def generate_walletconnect_qr(uri: str) -> str:
        """
        Generate QR code for WalletConnect URI
        
        Args:
            uri: WalletConnect connection URI
        
        Returns:
            Base64 encoded QR code image
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"
    
    @staticmethod
    def generate_generic_wallet_qr(connection_url: str) -> str:
        """
        Generate QR code for generic wallet connection
        
        Args:
            connection_url: URL for wallet connection
        
        Returns:
            Base64 encoded QR code image
        """
        return WalletUtils.generate_walletconnect_qr(connection_url)
    
    @staticmethod
    def get_wallet_info(wallet_type: str) -> Optional[dict]:
        """
        Get information about supported wallet
        
        Args:
            wallet_type: Type of wallet (metamask, coinbase, walletconnect)
        
        Returns:
            Wallet information dictionary or None
        """
        return WalletUtils.SUPPORTED_WALLETS.get(wallet_type.lower())
    
    @staticmethod
    def is_supported_wallet(wallet_type: str) -> bool:
        """
        Check if wallet type is supported
        
        Args:
            wallet_type: Type of wallet
        
        Returns:
            True if supported
        """
        return wallet_type.lower() in WalletUtils.SUPPORTED_WALLETS
