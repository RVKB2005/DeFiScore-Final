"""
Comprehensive diagnostic script to understand credit score calculation
Run this with: python Backend/diagnose_score_issue.py <wallet_address>
"""
import sys
import os

# Add Backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

from database import SessionLocal, TransactionRecordDB
from db_models import CreditScore, FeatureData
from redis_cache import redis_cache
import json

def diagnose_wallet(wallet_address: str):
    """Comprehensive diagnosis of wallet credit score"""
    db = SessionLocal()
    try:
        wallet_lower = wallet_address.lower()
        
        print(f"\n{'='*100}")
        print(f"COMPREHENSIVE CREDIT SCORE DIAGNOSIS")
        print(f"Wallet: {wallet_address}")
        print(f"{'='*100}\n")
        
        # ============================================================================
        # STEP 1: Check Database Transactions
        # ============================================================================
        print("STEP 1: DATABASE TRANSACTION CHECK")
        print("-" * 100)
        
        # Outgoing transactions
        outgoing_txs = db.query(TransactionRecordDB).filter(
            TransactionRecordDB.from_address == wallet_lower
        ).all()
        
        # Incoming transactions
        incoming_txs = db.query(TransactionRecordDB).filter(
            TransactionRecordDB.to_address == wallet_lower
        ).all()
        
        total_txs = len(outgoing_txs) + len(incoming_txs)
        
        print(f"Outgoing transactions: {len(outgoing_txs)}")
        print(f"Incoming transactions: {len(incoming_txs)}")
        print(f"Total transactions: {total_txs}")
        
        if total_txs == 0:
            print("\n⚠️  WALLET HAS ZERO TRANSACTIONS IN DATABASE")
            print("   Expected score: 300 (minimum)")
        else:
            print(f"\n✓ Wallet has {total_txs} transactions")
            
            # Show sample transactions
            if len(outgoing_txs) > 0:
                print("\n   Sample outgoing transactions (first 3):")
                for tx in outgoing_txs[:3]:
                    print(f"   - Hash: {tx.hash[:16]}...")
                    print(f"     Network: {tx.network}")
                    print(f"     Value: {tx.value} ETH")
                    print(f"     Timestamp: {tx.timestamp}")
                    print()
        
        # ============================================================================
        # STEP 2: Check Feature Data
        # ============================================================================
        print("\nSTEP 2: FEATURE DATA CHECK")
        print("-" * 100)
        
        features = db.query(FeatureData).filter(
            FeatureData.wallet_address == wallet_lower
        ).all()
        
        if not features:
            print("❌ No feature data found in database")
            print("   This means credit score was calculated BEFORE feature data was saved")
            print("   OR the wallet has no activity on any network")
        else:
            print(f"✓ Found {len(features)} feature data record(s)")
            
            for feat in features:
                print(f"\n   Network: {feat.network}")
                print(f"   Chain ID: {feat.chain_id}")
                print(f"   Extracted at: {feat.extracted_at}")
                
                # Parse features
                features_dict = json.loads(feat.features_json)
                
                # Activity features
                activity = features_dict.get('activity', {})
                print(f"\n   Activity Features:")
                print(f"   - Transaction count: {activity.get('transaction_count', 0)}")
                print(f"   - Active days: {activity.get('active_days', 0)}")
                print(f"   - Avg tx per day: {activity.get('avg_transactions_per_day', 0):.2f}")
                
                # Financial features
                financial = features_dict.get('financial', {})
                print(f"\n   Financial Features:")
                print(f"   - Current balance: {financial.get('current_balance_eth', 0):.4f} ETH")
                print(f"   - Max balance: {financial.get('max_balance_eth', 0):.4f} ETH")
                print(f"   - Avg balance: {financial.get('avg_balance_eth', 0):.4f} ETH")
                
                # Temporal features
                temporal = features_dict.get('temporal', {})
                print(f"\n   Temporal Features:")
                print(f"   - Wallet age (days): {temporal.get('wallet_age_days', 0)}")
                print(f"   - First tx: {temporal.get('first_transaction_date', 'N/A')}")
                print(f"   - Last tx: {temporal.get('last_transaction_date', 'N/A')}")
                
                # Risk features
                risk = features_dict.get('risk', {})
                print(f"\n   Risk Features:")
                print(f"   - Failed tx count: {risk.get('failed_transaction_count', 0)}")
                print(f"   - Failed tx ratio: {risk.get('failed_transaction_ratio', 0):.2%}")
        
        # ============================================================================
        # STEP 3: Check Credit Score in Database
        # ============================================================================
        print("\n\nSTEP 3: DATABASE CREDIT SCORE CHECK")
        print("-" * 100)
        
        score = db.query(CreditScore).filter(
            CreditScore.wallet_address == wallet_lower
        ).order_by(CreditScore.calculated_at.desc()).first()
        
        if not score:
            print("❌ No credit score found in database")
        else:
            print(f"✓ Credit score found")
            print(f"\n   Score: {score.score}")
            print(f"   Calculated at: {score.calculated_at}")
            print(f"   Networks analyzed: {score.networks_analyzed}")
            print(f"   Total networks: {score.total_networks}")
            
            breakdown = json.loads(score.score_breakdown)
            print(f"\n   Score Breakdown:")
            print(f"   - Total Score: {breakdown.get('total_score', 0)}")
            print(f"   - Repayment Behavior: {breakdown.get('repayment_behavior', 0)}")
            print(f"   - Capital Management: {breakdown.get('capital_management', 0)}")
            print(f"   - Wallet Longevity: {breakdown.get('wallet_longevity', 0)}")
            print(f"   - Activity Patterns: {breakdown.get('activity_patterns', 0)}")
            print(f"   - Protocol Diversity: {breakdown.get('protocol_diversity', 0)}")
            print(f"   - Risk Penalties: {breakdown.get('risk_penalties', 0)}")
            print(f"   - Rating: {breakdown.get('rating', 'N/A')}")
            
            # Calculate what the score SHOULD be
            base_score = 300
            total_contributions = (
                breakdown.get('repayment_behavior', 0) +
                breakdown.get('capital_management', 0) +
                breakdown.get('wallet_longevity', 0) +
                breakdown.get('activity_patterns', 0) +
                breakdown.get('protocol_diversity', 0) +
                breakdown.get('risk_penalties', 0)
            )
            expected_score = base_score + total_contributions
            
            print(f"\n   Score Calculation:")
            print(f"   - Base Score: {base_score}")
            print(f"   - Total Contributions: {total_contributions:.2f}")
            print(f"   - Expected Score: {expected_score:.2f}")
            print(f"   - Actual Score: {score.score}")
            
            if abs(expected_score - score.score) > 1:
                print(f"\n   ⚠️  MISMATCH: Expected {expected_score:.2f} but got {score.score}")
            else:
                print(f"\n   ✓ Score calculation matches expected value")
        
        # ============================================================================
        # STEP 4: Check Redis Cache
        # ============================================================================
        print("\n\nSTEP 4: REDIS CACHE CHECK")
        print("-" * 100)
        
        cached = redis_cache.get_score(wallet_lower)
        
        if not cached:
            print("❌ No score found in Redis cache")
        else:
            print("✓ Score found in Redis cache")
            print(f"   Score: {cached.get('score', 'N/A')}")
            
            cached_breakdown = cached.get('score_breakdown', {})
            if cached_breakdown:
                print(f"\n   Cached Breakdown:")
                print(f"   - Total Score: {cached_breakdown.get('total_score', 0)}")
                print(f"   - Repayment: {cached_breakdown.get('repayment_behavior', 0)}")
                print(f"   - Capital: {cached_breakdown.get('capital_management', 0)}")
                print(f"   - Longevity: {cached_breakdown.get('wallet_longevity', 0)}")
                print(f"   - Activity: {cached_breakdown.get('activity_patterns', 0)}")
                print(f"   - Protocol: {cached_breakdown.get('protocol_diversity', 0)}")
                print(f"   - Risk: {cached_breakdown.get('risk_penalties', 0)}")
        
        # ============================================================================
        # STEP 5: Diagnosis Summary
        # ============================================================================
        print("\n\nSTEP 5: DIAGNOSIS SUMMARY")
        print("-" * 100)
        
        if total_txs == 0:
            print("🔍 DIAGNOSIS: Wallet has ZERO transactions")
            print("   Expected behavior: Score should be 300 (minimum)")
            if score and score.score != 300:
                print(f"   ❌ ISSUE FOUND: Score is {score.score} instead of 300")
                print("   Possible causes:")
                print("   1. Old score calculated with different engine")
                print("   2. Feature extraction returned non-zero features despite no transactions")
                print("   3. Score was calculated before transaction data was ingested")
                print("\n   SOLUTION:")
                print("   1. Clear Redis cache: python Backend/clear_score_cache.py")
                print("   2. Delete old score from database")
                print("   3. Restart Celery worker")
                print("   4. Recalculate score")
            else:
                print("   ✓ Score is correct (300)")
        else:
            print(f"🔍 DIAGNOSIS: Wallet has {total_txs} transactions")
            print("   Expected behavior: Score calculated based on activity")
            if score:
                print(f"   Current score: {score.score}")
                if score.score == 300:
                    print("   ⚠️  Score is at minimum despite having transactions")
                    print("   This could mean:")
                    print("   1. All features are zero/minimal")
                    print("   2. Heavy risk penalties")
                    print("   3. Very recent wallet with minimal activity")
                elif score.score > 300:
                    print(f"   ✓ Score reflects wallet activity (+{score.score - 300} above base)")
        
        print(f"\n{'='*100}\n")
        
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage: python Backend/diagnose_score_issue.py <wallet_address>")
        print("\nExample:")
        print("  python Backend/diagnose_score_issue.py 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\n")
        sys.exit(1)
    
    wallet_address = sys.argv[1]
    diagnose_wallet(wallet_address)
