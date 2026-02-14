#!/usr/bin/env python3
"""
Test script for wallet authentication flow
"""
from eth_account import Account
from eth_account.messages import encode_defunct
import requests
import json


def test_authentication_flow():
    """Test complete authentication flow"""
    
    BASE_URL = "http://localhost:8000"
    
    print("=" * 60)
    print("Testing Wallet Authentication Flow")
    print("=" * 60)
    
    # Create test wallet
    print("\n1. Creating test wallet...")
    account = Account.create()
    wallet_address = account.address
    private_key = account.key
    print(f"   Wallet: {wallet_address}")
    
    # Request nonce
    print("\n2. Requesting nonce...")
    response = requests.post(
        f"{BASE_URL}/auth/nonce",
        json={"address": wallet_address}
    )
    
    if response.status_code != 200:
        print(f"   ✗ Failed: {response.text}")
        return False
    
    nonce_data = response.json()
    message = nonce_data["message"]
    print(f"   ✓ Nonce received")
    print(f"   Message preview: {message[:100]}...")
    
    # Sign message
    print("\n3. Signing message with wallet...")
    encoded_message = encode_defunct(text=message)
    signed_message = Account.sign_message(encoded_message, private_key)
    signature = signed_message.signature.hex()
    print(f"   ✓ Message signed")
    print(f"   Signature: {signature[:20]}...")
    
    # Verify signature
    print("\n4. Verifying signature...")
    response = requests.post(
        f"{BASE_URL}/auth/verify",
        json={
            "address": wallet_address,
            "message": message,
            "signature": signature
        }
    )
    
    if response.status_code != 200:
        print(f"   ✗ Failed: {response.text}")
        return False
    
    auth_data = response.json()
    access_token = auth_data["access_token"]
    print(f"   ✓ Authentication successful")
    print(f"   Token: {access_token[:30]}...")
    
    # Test authenticated endpoint
    print("\n5. Testing authenticated endpoint...")
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    if response.status_code != 200:
        print(f"   ✗ Failed: {response.text}")
        return False
    
    user_data = response.json()
    print(f"   ✓ Authenticated as: {user_data['wallet_address']}")
    
    # Test replay attack prevention
    print("\n6. Testing replay attack prevention...")
    response = requests.post(
        f"{BASE_URL}/auth/verify",
        json={
            "address": wallet_address,
            "message": message,
            "signature": signature
        }
    )
    
    if response.status_code == 401:
        print(f"   ✓ Replay attack prevented (nonce already used)")
    else:
        print(f"   ✗ Replay attack not prevented!")
        return False
    
    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = test_authentication_flow()
        exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print("\n✗ Cannot connect to server. Make sure it's running:")
        print("  python main.py")
        exit(1)
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        exit(1)
