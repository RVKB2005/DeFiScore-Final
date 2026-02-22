"""
Delete credit score for a specific wallet to force recalculation
Run this with: python Backend/delete_wallet_score.py <wallet_address>
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

from database import SessionLocal
from db_models import CreditScore, FeatureData
from redis_cache import redis_cache

def delete_wallet_score(wallet_address: str):
    """Delete credit score and feature data for a wallet"""
    db = SessionLocal()
    try:
        wallet_lower = wallet_address.lower()
        
        print(f"\n{'='*100}")
        print(f"DELETING CREDIT SCORE DATA")
        print(f"Wallet: {wallet_address}")
        print(f"{'='*100}\n")
        
        # Delete from database
        print("1. Deleting from database...")
        
        # Delete credit scores
        scores_deleted = db.query(CreditScore).filter(
            CreditScore.wallet_address == wallet_lower
        ).delete()
        
        # Delete feature data
        features_deleted = db.query(FeatureData).filter(
            FeatureData.wallet_address == wallet_lower
        ).delete()
        
        db.commit()
        
        print(f"   ✓ Deleted {scores_deleted} credit score record(s)")
        print(f"   ✓ Deleted {features_deleted} feature data record(s)")
        
        # Delete from Redis cache
        print("\n2. Deleting from Redis cache...")
        redis_cache.delete_score(wallet_lower)
        print(f"   ✓ Deleted from Redis cache")
        
        print(f"\n{'='*100}")
        print("✓ CLEANUP COMPLETE")
        print(f"{'='*100}\n")
        
        print("Next steps:")
        print("1. Restart Celery worker: celery -A celery_app worker --loglevel=info --pool=solo")
        print("2. Go to Credit Score page in the app")
        print("3. Click 'View Score' to trigger recalculation")
        print("4. The new score should be 300 (for wallets with 0 transactions)")
        print()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage: python Backend/delete_wallet_score.py <wallet_address>")
        print("\nExample:")
        print("  python Backend/delete_wallet_score.py 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\n")
        sys.exit(1)
    
    wallet_address = sys.argv[1]
    
    # Confirm deletion
    print(f"\n⚠️  WARNING: This will delete all credit score data for {wallet_address}")
    confirm = input("Are you sure? (yes/no): ")
    
    if confirm.lower() == 'yes':
        delete_wallet_score(wallet_address)
    else:
        print("\nCancelled.")
