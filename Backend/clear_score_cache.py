"""
Clear credit score cache for a wallet
Run this to force recalculation with the new scoring engine
"""
import redis
import sys

def clear_score_cache(wallet_address: str):
    """Clear cached score for a wallet"""
    try:
        r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        
        # Clear the score cache
        cache_key = f"score:{wallet_address.lower()}"
        deleted = r.delete(cache_key)
        
        if deleted:
            print(f"✓ Cache cleared for {wallet_address}")
            print(f"  Next score request will trigger recalculation with new engine")
        else:
            print(f"No cache found for {wallet_address}")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure Redis is running on localhost:6379")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        wallet = sys.argv[1]
    else:
        wallet = "0x995c6b8bd893afd139437da4322190beb5e6ddd6"  # Default test wallet
    
    clear_score_cache(wallet)
