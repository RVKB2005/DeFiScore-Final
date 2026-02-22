"""
Check Redis cache for wallet credit score
"""
import sys
from redis_cache import redis_cache

def check_redis_cache(wallet_address: str):
    """Check what's cached in Redis for a wallet"""
    wallet_lower = wallet_address.lower()
    
    print(f"\n{'='*80}")
    print(f"REDIS CACHE CHECK: {wallet_address}")
    print(f"{'='*80}\n")
    
    # Get cached score
    cached = redis_cache.get_score(wallet_lower)
    
    if cached:
        print("✓ Score found in Redis cache:")
        print(f"  Score: {cached.get('score', 'N/A')}")
        print(f"  Networks analyzed: {cached.get('networks_analyzed', [])}")
        print(f"  Total networks: {cached.get('total_networks', 0)}")
        
        breakdown = cached.get('score_breakdown', {})
        if breakdown:
            print(f"\n  Score Breakdown:")
            print(f"  - Total Score: {breakdown.get('total_score', 0)}")
            print(f"  - Repayment Behavior: {breakdown.get('repayment_behavior', 0)}")
            print(f"  - Capital Management: {breakdown.get('capital_management', 0)}")
            print(f"  - Wallet Longevity: {breakdown.get('wallet_longevity', 0)}")
            print(f"  - Activity Patterns: {breakdown.get('activity_patterns', 0)}")
            print(f"  - Protocol Diversity: {breakdown.get('protocol_diversity', 0)}")
            print(f"  - Risk Penalties: {breakdown.get('risk_penalties', 0)}")
            print(f"  - Rating: {breakdown.get('rating', 'N/A')}")
        
        classification = cached.get('classification', {})
        if classification:
            print(f"\n  Classification:")
            print(f"  - Longevity: {classification.get('longevity_class', 'N/A')}")
            print(f"  - Activity: {classification.get('activity_class', 'N/A')}")
            print(f"  - Capital: {classification.get('capital_class', 'N/A')}")
            print(f"  - Credit Behavior: {classification.get('credit_behavior_class', 'N/A')}")
            print(f"  - Risk: {classification.get('risk_class', 'N/A')}")
    else:
        print("❌ No score found in Redis cache")
    
    print(f"\n{'='*80}\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_redis_cache.py <wallet_address>")
        sys.exit(1)
    
    wallet_address = sys.argv[1]
    check_redis_cache(wallet_address)
