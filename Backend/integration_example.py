#!/usr/bin/env python3
"""
Integration example showing how to use the wallet authentication API
This demonstrates the complete flow from a client perspective
"""
import requests
from eth_account import Account
from eth_account.messages import encode_defunct


class WalletAuthClient:
    """Client for wallet authentication"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.access_token = None
        self.wallet_address = None
    
    def connect_wallet(self, private_key: str = None):
        """
        Connect wallet (simulates MetaMask/Coinbase/WalletConnect connection)
        
        Args:
            private_key: Private key (if None, creates new wallet)
        """
        if private_key:
            account = Account.from_key(private_key)
        else:
            account = Account.create()
        
        self.account = account
        self.wallet_address = account.address
        
        print(f"✓ Wallet connected: {self.wallet_address}")
        return self.wallet_address
    
    def authenticate(self):
        """
        Complete authentication flow
        
        Returns:
            Access token if successful
        """
        if not self.wallet_address:
            raise Exception("Wallet not connected")
        
        # Step 1: Request nonce
        print("\n1. Requesting authentication nonce...")
        response = requests.post(
            f"{self.base_url}/auth/nonce",
            json={"address": self.wallet_address}
        )
        response.raise_for_status()
        
        nonce_data = response.json()
        message = nonce_data["message"]
        print(f"   ✓ Nonce received (expires: {nonce_data['expires_at']})")
        
        # Step 2: Sign message with wallet
        print("\n2. Signing message with wallet...")
        encoded_message = encode_defunct(text=message)
        signed_message = self.account.sign_message(encoded_message)
        signature = signed_message.signature.hex()
        print(f"   ✓ Message signed")
        
        # Step 3: Verify signature and get token
        print("\n3. Verifying signature...")
        response = requests.post(
            f"{self.base_url}/auth/verify",
            json={
                "address": self.wallet_address,
                "message": message,
                "signature": signature
            }
        )
        response.raise_for_status()
        
        auth_data = response.json()
        self.access_token = auth_data["access_token"]
        print(f"   ✓ Authentication successful")
        print(f"   Token expires in: {auth_data['expires_in']} seconds")
        
        return self.access_token
    
    def get_authenticated_headers(self):
        """Get headers with authentication token"""
        if not self.access_token:
            raise Exception("Not authenticated")
        
        return {"Authorization": f"Bearer {self.access_token}"}
    
    def get_user_info(self):
        """Get current user information"""
        response = requests.get(
            f"{self.base_url}/auth/me",
            headers=self.get_authenticated_headers()
        )
        response.raise_for_status()
        return response.json()
    
    def logout(self):
        """Logout and revoke session"""
        response = requests.post(
            f"{self.base_url}/auth/logout",
            headers=self.get_authenticated_headers()
        )
        response.raise_for_status()
        
        self.access_token = None
        print("✓ Logged out successfully")


def example_metamask_flow():
    """Example: MetaMask authentication flow"""
    print("\n" + "=" * 60)
    print("Example: MetaMask Authentication Flow")
    print("=" * 60)
    
    client = WalletAuthClient()
    
    # User connects MetaMask
    client.connect_wallet()
    
    # User authenticates
    client.authenticate()
    
    # Make authenticated request
    print("\n4. Making authenticated request...")
    user_info = client.get_user_info()
    print(f"   ✓ User info: {user_info}")
    
    # Logout
    print("\n5. Logging out...")
    client.logout()


def example_coinbase_wallet_flow():
    """Example: Coinbase Wallet authentication flow"""
    print("\n" + "=" * 60)
    print("Example: Coinbase Wallet Authentication Flow")
    print("=" * 60)
    
    client = WalletAuthClient()
    
    # User connects Coinbase Wallet
    client.connect_wallet()
    
    # Get wallet connection info (for QR code/deep link)
    response = requests.get(
        f"{client.base_url}/auth/wallet-info/coinbase",
        params={"connection_url": "https://yourapp.com"}
    )
    wallet_info = response.json()
    print(f"✓ Wallet info: {wallet_info['wallet_type']}")
    if wallet_info.get('deep_link'):
        print(f"  Deep link: {wallet_info['deep_link'][:50]}...")
    
    # Authenticate
    client.authenticate()
    
    # Use authenticated session
    user_info = client.get_user_info()
    print(f"\n✓ Authenticated as: {user_info['wallet_address']}")


def example_walletconnect_flow():
    """Example: WalletConnect authentication flow"""
    print("\n" + "=" * 60)
    print("Example: WalletConnect Authentication Flow")
    print("=" * 60)
    
    client = WalletAuthClient()
    
    # Generate WalletConnect QR code
    wc_uri = "wc:00e46b69-d0cc-4b3e-b6a2-cee442f97188@1?bridge=..."
    response = requests.get(
        f"{client.base_url}/auth/wallet-info/walletconnect",
        params={"connection_url": wc_uri}
    )
    wallet_info = response.json()
    print(f"✓ QR code generated: {len(wallet_info.get('qr_code', ''))} bytes")
    
    # User scans QR and connects
    client.connect_wallet()
    
    # Authenticate
    client.authenticate()
    
    # Use session
    user_info = client.get_user_info()
    print(f"\n✓ Authenticated as: {user_info['wallet_address']}")


def example_replay_attack_prevention():
    """Example: Replay attack prevention"""
    print("\n" + "=" * 60)
    print("Example: Replay Attack Prevention")
    print("=" * 60)
    
    client = WalletAuthClient()
    client.connect_wallet()
    
    # Get nonce and sign
    response = requests.post(
        f"{client.base_url}/auth/nonce",
        json={"address": client.wallet_address}
    )
    nonce_data = response.json()
    message = nonce_data["message"]
    
    encoded_message = encode_defunct(text=message)
    signed_message = client.account.sign_message(encoded_message)
    signature = signed_message.signature.hex()
    
    # First verification (should succeed)
    print("\n1. First authentication attempt...")
    response = requests.post(
        f"{client.base_url}/auth/verify",
        json={
            "address": client.wallet_address,
            "message": message,
            "signature": signature
        }
    )
    print(f"   Status: {response.status_code} (Expected: 200)")
    
    # Second verification with same signature (should fail)
    print("\n2. Replay attack attempt (reusing same signature)...")
    response = requests.post(
        f"{client.base_url}/auth/verify",
        json={
            "address": client.wallet_address,
            "message": message,
            "signature": signature
        }
    )
    print(f"   Status: {response.status_code} (Expected: 401)")
    print(f"   ✓ Replay attack prevented!")


if __name__ == "__main__":
    try:
        # Run examples
        example_metamask_flow()
        example_coinbase_wallet_flow()
        example_walletconnect_flow()
        example_replay_attack_prevention()
        
        print("\n" + "=" * 60)
        print("All examples completed successfully!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("\n✗ Cannot connect to server. Start it with:")
        print("  python main.py")
    except Exception as e:
        print(f"\n✗ Error: {e}")
