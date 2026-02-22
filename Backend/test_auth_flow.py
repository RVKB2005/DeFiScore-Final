"""
Test Authentication Flow and API Endpoints
Run this to diagnose 401/404 errors
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """Test if backend is running"""
    print("\n=== Testing Backend Health ===")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✓ Backend is running: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"✗ Backend not accessible: {e}")
        return False

def test_endpoint_exists():
    """Test if the generate-proof-for-borrower endpoint exists"""
    print("\n=== Testing Endpoint Existence ===")
    
    # Test without auth (should get 401, not 404)
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/lending/supply-intent/generate-proof-for-borrower",
            json={
                "request_id": "test",
                "borrower_address": "0x1234567890123456789012345678901234567890",
                "threshold": 700
            }
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✓ Endpoint exists (401 = needs authentication)")
            return True
        elif response.status_code == 404:
            print("✗ Endpoint not found (404)")
            return False
        else:
            print(f"? Unexpected status: {response.status_code}")
            return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_supplier_intents():
    """Test supplier intents endpoint"""
    print("\n=== Testing Supplier Intents Endpoint ===")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/lending/supplier-intents")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            print("✓ Endpoint exists (requires auth)")
            return True
        elif response.status_code == 404:
            print("✗ Endpoint not found")
            return False
        else:
            print(f"Status: {response.status_code}")
            return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_cors():
    """Test CORS headers"""
    print("\n=== Testing CORS Configuration ===")
    try:
        response = requests.options(
            f"{BASE_URL}/api/v1/lending/supply-intent/generate-proof-for-borrower",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type"
            }
        )
        print(f"Status Code: {response.status_code}")
        print(f"CORS Headers:")
        for header, value in response.headers.items():
            if 'access-control' in header.lower():
                print(f"  {header}: {value}")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("DeFiScore API Diagnostics")
    print("=" * 60)
    
    # Run tests
    health_ok = test_health()
    if not health_ok:
        print("\n✗ Backend is not running. Start it with: python Backend/main.py")
        return
    
    endpoint_ok = test_endpoint_exists()
    supplier_ok = test_supplier_intents()
    cors_ok = test_cors()
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"Backend Health: {'✓' if health_ok else '✗'}")
    print(f"Endpoint Exists: {'✓' if endpoint_ok else '✗'}")
    print(f"Supplier Intents: {'✓' if supplier_ok else '✗'}")
    print(f"CORS Config: {'✓' if cors_ok else '✗'}")
    
    if endpoint_ok and supplier_ok:
        print("\n✓ All endpoints are accessible!")
        print("\nIf you're getting 401 errors in the frontend:")
        print("1. Check that the wallet is connected")
        print("2. Verify the JWT token is being sent in Authorization header")
        print("3. Check browser console for the actual token value")
        print("4. Token format should be: 'Bearer <token>'")
    else:
        print("\n✗ Some endpoints are not accessible")
        print("Check the backend logs for errors")

if __name__ == "__main__":
    main()
