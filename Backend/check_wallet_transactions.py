"""
Check wallet transaction count and credit score data
"""
import sys
from database import SessionLocal
from db_models import Transaction, CreditScore, FeatureData
import json

def check_wallet_data(wallet_address: str):
    """Check wallet's transaction count and credit score"""
    db = SessionLocal()
    try:
        wallet_lower = wallet_address.lower()
        
        print(f"\n{'='*80}")
        print(f"WALLET DATA ANALYSIS: {wallet_address}")
        print(f"{'='*80}\n")
        
        # Check transactions
        print("1. TRANSACTION COUNT:")
        tx_count = db.query(Transaction).filter(
            Transaction.from_address == wallet_lower
        ).count()
        print(f"   Outgoing transactions: {tx_count}")
        
        tx_count_incoming = db.query(Transaction).filter(
            Transaction.to_address == wallet_lower
        ).count()
        print(f"   Incoming transactions: {tx_count_incoming}")
        print(f"   Total transactions: {tx_count + tx_count_incoming}")
        
        # Show sample transactions
        if tx_count > 0:
            print("\n   Sample outgoing transactions:")
            sample_txs = db.query(Transaction).filter(
                Transaction.from_address == wallet_lower
            ).limit(5).all()
            for tx in sample_txs:
                print(f"   - {tx.hash[:10]}... | {tx.network} | Value: {tx.value} ETH")
        
        # Check credit score
        print("\n2. CREDIT SCORE:")
        score = db.query(CreditScore).filter(
            CreditScore.wallet_address == wallet_lower
        ).order_by(CreditScore.calculated_at.desc()).first()
        
        if score:
            print(f"   Score: {score.score}")
            print(f"   Calculated at: {score.calculated_at}")
            print(f"   Networks analyzed: {score.networks_analyzed}")
            
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
        else:
            print("   No credit score found")
        
        # Check feature data
        print("\n3. FEATURE DATA:")
        features = db.query(FeatureData).filter(
            FeatureData.wallet_address == wallet_lower
        ).all()
        
        if features:
            print(f"   Feature data records: {len(features)}")
            for feat in features:
                print(f"\n   Network: {feat.network}")
                print(f"   Extracted at: {feat.extracted_at}")
                
                # Parse features
                features_dict = json.loads(feat.features_json)
                activity = features_dict.get('activity', {})
                financial = features_dict.get('financial', {})
                
                print(f"   - Transaction count: {activity.get('transaction_count', 0)}")
                print(f"   - Current balance: {financial.get('current_balance_eth', 0)} ETH")
                print(f"   - Max balance: {financial.get('max_balance_eth', 0)} ETH")
        else:
            print("   No feature data found")
        
        print(f"\n{'='*80}\n")
        
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_wallet_transactions.py <wallet_address>")
        sys.exit(1)
    
    wallet_address = sys.argv[1]
    check_wallet_data(wallet_address)
