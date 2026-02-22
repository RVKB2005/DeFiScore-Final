"""
Simple Redis-only diagnostic script
Run this with: python Backend/diagnose_redis_only.py <wallet_address>
"""
import sys
import os

# Add Backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from redis_cache import redis_cache

def diagnose_redis(wallet_address: str):
    """Check Redis cache for wallet credit score"""
    wallet_lower = wallet_address.lower()
    
    print(f"\n{'='*100}")
    print(f"REDIS CACHE DIAGNOSIS")
    print(f"Wallet: {wallet_address}")
    print(f"{'='*100}\n")
    
    # Get cached score
    cached = redis_cache.get_score(wallet_lower)
    
    if not cached:
        print("❌ NO SCORE FOUND IN REDIS CACHE")
        print("\nPossible reasons:")
        print("1. Score has never been calculated for this wallet")
        print("2. Cache has expired (TTL: 24 hours)")
        print("3. Cache was cleared")
        print("\nNext steps:")
        print("1. Go to Credit Score page in the app")
        print("2. Click 'View Score' to trigger calculation")
        print("3. Wait for Celery task to complete")
        print("4. Run this script again")
    else:
        print("✓ SCORE FOUND IN REDIS CACHE\n")
        
        score = cached.get('score', 0)
        print(f"CREDIT SCORE: {score}")
        print(f"{'='*100}\n")
        
        # Score breakdown
        breakdown = cached.get('score_breakdown', {})
        if breakdown:
            print("SCORE BREAKDOWN:")
            print("-" * 100)
            
            total = breakdown.get('total_score', 0)
            repayment = breakdown.get('repayment_behavior', 0)
            capital = breakdown.get('capital_management', 0)
            longevity = breakdown.get('wallet_longevity', 0)
            activity = breakdown.get('activity_patterns', 0)
            protocol = breakdown.get('protocol_diversity', 0)
            risk = breakdown.get('risk_penalties', 0)
            rating = breakdown.get('rating', 'N/A')
            
            print(f"Total Score:          {total}")
            print(f"Rating:               {rating}")
            print(f"\nComponent Breakdown:")
            print(f"  Repayment Behavior: {repayment:+.2f}")
            print(f"  Capital Management: {capital:+.2f}")
            print(f"  Wallet Longevity:   {longevity:+.2f}")
            print(f"  Activity Patterns:  {activity:+.2f}")
            print(f"  Protocol Diversity: {protocol:+.2f}")
            print(f"  Risk Penalties:     {risk:+.2f}")
            
            # Calculate base score
            base_score = 300
            contributions = repayment + capital + longevity + activity + protocol + risk
            expected_total = base_score + contributions
            
            print(f"\nScore Calculation:")
            print(f"  Base Score:         {base_score}")
            print(f"  + Contributions:    {contributions:+.2f}")
            print(f"  = Expected Total:   {expected_total:.2f}")
            print(f"  Actual Total:       {total}")
            
            if abs(expected_total - total) > 1:
                print(f"\n  ⚠️  MISMATCH: Expected {expected_total:.2f} but got {total}")
            else:
                print(f"\n  ✓ Calculation matches")
        
        # Classification
        classification = cached.get('classification', {})
        if classification:
            print(f"\n{'='*100}")
            print("WALLET CLASSIFICATION:")
            print("-" * 100)
            print(f"  Longevity:          {classification.get('longevity_class', 'N/A')}")
            print(f"  Activity:           {classification.get('activity_class', 'N/A')}")
            print(f"  Capital:            {classification.get('capital_class', 'N/A')}")
            print(f"  Credit Behavior:    {classification.get('credit_behavior_class', 'N/A')}")
            print(f"  Risk:               {classification.get('risk_class', 'N/A')}")
        
        # Networks
        networks = cached.get('networks_analyzed', [])
        total_networks = cached.get('total_networks', 0)
        if networks:
            print(f"\n{'='*100}")
            print("NETWORKS ANALYZED:")
            print("-" * 100)
            print(f"  Networks: {', '.join(networks)}")
            print(f"  Total: {total_networks}")
        
        # Analysis
        print(f"\n{'='*100}")
        print("DIAGNOSIS:")
        print("-" * 100)
        
        if score == 300:
            print("⚠️  Score is at MINIMUM (300)")
            print("\nThis means:")
            print("  1. Wallet has NO transactions, OR")
            print("  2. Wallet has minimal activity with no positive contributions")
            print("\nTo verify:")
            print("  - Check if wallet has any transactions on Etherscan")
            print("  - If wallet has transactions, check component scores above")
            print("  - All components should be 0 for a truly empty wallet")
            
            if contributions > 0:
                print(f"\n  ⚠️  ISSUE: Wallet has {contributions:.2f} in contributions but score is still 300")
                print("     This suggests the score was capped at minimum")
        
        elif score > 300 and score < 400:
            print(f"✓ Score is SLIGHTLY ABOVE MINIMUM ({score})")
            print("\nThis means:")
            print("  - Wallet has some activity")
            print(f"  - Total contributions: {contributions:+.2f}")
            print("  - This is normal for wallets with minimal DeFi activity")
        
        elif score >= 400 and score < 600:
            print(f"✓ Score is FAIR ({score})")
            print("\nThis means:")
            print("  - Wallet has moderate activity")
            print(f"  - Total contributions: {contributions:+.2f}")
            print("  - Wallet is building credit history")
        
        elif score >= 600:
            print(f"✓ Score is GOOD/EXCELLENT ({score})")
            print("\nThis means:")
            print("  - Wallet has significant DeFi activity")
            print(f"  - Total contributions: {contributions:+.2f}")
            print("  - Strong credit profile")
        
        # Check if score is 542 specifically
        if score == 542:
            print(f"\n{'='*100}")
            print("SPECIFIC ISSUE: Score is 542")
            print("-" * 100)
            print("This exact score suggests:")
            print("  1. Wallet has some transactions (not zero)")
            print("  2. Check component breakdown above to see what's contributing")
            print(f"  3. Total contributions from base (300): {contributions:+.2f}")
            
            if contributions > 0:
                print("\n  Components contributing to score:")
                if repayment > 0:
                    print(f"    - Repayment: {repayment:.2f} (good repayment history)")
                if capital > 0:
                    print(f"    - Capital: {capital:.2f} (wallet has/had balance)")
                if longevity > 0:
                    print(f"    - Longevity: {longevity:.2f} (wallet age)")
                if activity > 0:
                    print(f"    - Activity: {activity:.2f} (transaction frequency)")
                if protocol > 0:
                    print(f"    - Protocol: {protocol:.2f} (DeFi interactions)")
                if risk < 0:
                    print(f"    - Risk: {risk:.2f} (penalties applied)")
    
    print(f"\n{'='*100}\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage: python Backend/diagnose_redis_only.py <wallet_address>")
        print("\nExample:")
        print("  python Backend/diagnose_redis_only.py 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\n")
        sys.exit(1)
    
    wallet_address = sys.argv[1]
    diagnose_redis(wallet_address)
