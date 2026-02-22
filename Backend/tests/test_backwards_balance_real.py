"""
Test backwards balance calculation with REAL database transactions
Second verification test to ensure it works with actual data
"""
import sys
from datetime import datetime, timezone
from blockchain_client import BlockchainClient
from data_ingestion_service import DataIngestionService
from data_ingestion_models import IngestionWindow, TransactionRecord
from database import SessionLocal, TransactionRecordDB
from config import settings
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_backwards_balance_real():
    """Test backwards balance calculation with real transactions from database"""
    
    print("=" * 80)
    print("TEST 2: BACKWARDS BALANCE WITH REAL DATABASE TRANSACTIONS")
    print("=" * 80)
    
    # Test wallet (Vitalik)
    wallet = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    
    print(f"\nTest Wallet: {wallet}")
    print("-" * 80)
    
    # Initialize clients
    client = BlockchainClient(settings.ETHEREUM_MAINNET_RPC)
    service = DataIngestionService(client)
    
    # Get current balance from blockchain
    current_balance_wei = client.get_wallet_balance(wallet)
    current_balance_eth = client.wei_to_ether(current_balance_wei)
    
    print(f"\nCurrent Balance from Blockchain: {current_balance_eth:.6f} ETH")
    print("-" * 80)
    
    # Get real transactions from database (first 100)
    db = SessionLocal()
    try:
        db_txs = db.query(TransactionRecordDB).filter(
            TransactionRecordDB.wallet_address == wallet.lower()
        ).order_by(TransactionRecordDB.block_number).limit(100).all()
        
        print(f"\nFetched {len(db_txs)} transactions from database")
        
        if len(db_txs) == 0:
            print("ERROR: No transactions found in database. Run ingestion first.")
            return False
        
        # Convert to TransactionRecord objects
        txs = []
        for db_tx in db_txs:
            txs.append(TransactionRecord(
                tx_hash=db_tx.tx_hash,
                wallet_address=db_tx.wallet_address,
                block_number=db_tx.block_number,
                timestamp=db_tx.timestamp,
                from_address=db_tx.from_address,
                to_address=db_tx.to_address or '',
                value_wei=int(db_tx.value_wei),
                value_eth=db_tx.value_eth,
                gas_used=db_tx.gas_used or 0,
                gas_price_wei=int(db_tx.gas_price_wei) if db_tx.gas_price_wei else 0,
                status=db_tx.status,
                is_contract_interaction=db_tx.is_contract_interaction
            ))
        
        print(f"First transaction: Block {txs[0].block_number}")
        print(f"Last transaction: Block {txs[-1].block_number}")
        print("-" * 80)
        
        window = IngestionWindow(
            start_block=0,
            end_block=999999999,
            start_timestamp=datetime(2015, 1, 1, tzinfo=timezone.utc),
            end_timestamp=datetime.now(timezone.utc)
        )
        
        print("\nCalculating balance snapshots...")
        snapshots = service.create_balance_snapshots(wallet, window, txs)
        
        print(f"\nCreated {len(snapshots)} snapshots")
        print("\nFirst 10 snapshots:")
        for i, snap in enumerate(snapshots[:10]):
            print(f"  {i+1}. Block {snap.block_number}: {snap.balance_eth:.6f} ETH")
        
        print("\nLast 10 snapshots:")
        for i, snap in enumerate(snapshots[-10:]):
            print(f"  {len(snapshots)-10+i+1}. Block {snap.block_number}: {snap.balance_eth:.6f} ETH")
        
        # Verification checks
        print("\n" + "=" * 80)
        print("VERIFICATION CHECKS:")
        print("=" * 80)
        
        all_pass = True
        
        # Check 1: All balances should be non-negative
        negative_balances = [s for s in snapshots if s.balance_eth < 0]
        if len(negative_balances) == 0:
            print("✓ PASS: No negative balances")
        else:
            print(f"✗ FAIL: Found {len(negative_balances)} negative balances")
            all_pass = False
        
        # Check 2: Balances should change over time (not all the same)
        unique_balances = len(set(s.balance_eth for s in snapshots))
        if unique_balances > 1:
            print(f"✓ PASS: Balances change over time ({unique_balances} unique values)")
        else:
            print(f"✗ FAIL: All balances are the same")
            all_pass = False
        
        # Check 3: Last snapshot should match current balance (or be close)
        last_balance = snapshots[-1].balance_eth
        diff = abs(last_balance - current_balance_eth)
        if diff < 0.01:  # Within 0.01 ETH
            print(f"✓ PASS: Last snapshot matches current balance (diff: {diff:.6f} ETH)")
        else:
            print(f"✗ FAIL: Last snapshot doesn't match current balance (diff: {diff:.6f} ETH)")
            all_pass = False
        
        # Check 4: Balance range is reasonable
        min_balance = min(s.balance_eth for s in snapshots)
        max_balance = max(s.balance_eth for s in snapshots)
        print(f"✓ INFO: Balance range: {min_balance:.6f} to {max_balance:.6f} ETH")
        
        # Check 5: Snapshots are in chronological order
        is_sorted = all(snapshots[i].block_number <= snapshots[i+1].block_number 
                       for i in range(len(snapshots)-1))
        if is_sorted:
            print("✓ PASS: Snapshots are in chronological order")
        else:
            print("✗ FAIL: Snapshots are not in chronological order")
            all_pass = False
        
        print("\n" + "=" * 80)
        if all_pass:
            print("TEST 2 RESULT: PASS - Real transaction backwards calculation works correctly")
        else:
            print("TEST 2 RESULT: FAIL - Some verification checks failed")
        print("=" * 80)
        
        return all_pass
        
    finally:
        db.close()

if __name__ == "__main__":
    try:
        result = test_backwards_balance_real()
        sys.exit(0 if result else 1)
    except Exception as e:
        logger.error(f"Test failed with exception: {e}", exc_info=True)
        sys.exit(1)
