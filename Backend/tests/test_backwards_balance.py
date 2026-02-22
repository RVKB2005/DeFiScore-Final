"""
Test backwards balance calculation
Verifies that calculating balance backwards from current balance works correctly
"""
import sys
from datetime import datetime, timezone
from blockchain_client import BlockchainClient
from data_ingestion_service import DataIngestionService
from data_ingestion_models import IngestionWindow, TransactionRecord
from config import settings
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_backwards_balance():
    """Test backwards balance calculation with real data"""
    
    print("=" * 80)
    print("TEST: BACKWARDS BALANCE CALCULATION")
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
    
    # Create mock transactions to test the logic
    # Simulate: wallet currently has 10 ETH
    # Transaction history (newest to oldest):
    # 1. Block 100: Received 2 ETH
    # 2. Block 90: Sent 1 ETH (gas: 0.001 ETH)
    # 3. Block 80: Received 5 ETH
    # 4. Block 70: Sent 3 ETH (gas: 0.002 ETH)
    # 5. Block 60: Received 7 ETH
    
    # Expected backwards calculation:
    # Start: 10 ETH (current)
    # After block 100: 10 - 2 = 8 ETH
    # After block 90: 8 + 1 + 0.001 = 9.001 ETH
    # After block 80: 9.001 - 5 = 4.001 ETH
    # After block 70: 4.001 + 3 + 0.002 = 7.003 ETH
    # After block 60: 7.003 - 7 = 0.003 ETH (starting balance)
    
    mock_txs = [
        TransactionRecord(
            tx_hash='0x1',
            wallet_address=wallet.lower(),
            block_number=60,
            timestamp=datetime(2020, 1, 1, tzinfo=timezone.utc),
            from_address='0xsender1',
            to_address=wallet.lower(),
            value_wei=7000000000000000000,  # 7 ETH
            value_eth=7.0,
            gas_used=21000,
            gas_price_wei=20000000000,
            status=True,
            is_contract_interaction=False
        ),
        TransactionRecord(
            tx_hash='0x2',
            wallet_address=wallet.lower(),
            block_number=70,
            timestamp=datetime(2020, 1, 2, tzinfo=timezone.utc),
            from_address=wallet.lower(),
            to_address='0xreceiver1',
            value_wei=3000000000000000000,  # 3 ETH
            value_eth=3.0,
            gas_used=21000,
            gas_price_wei=100000000000,  # 0.002 ETH gas
            status=True,
            is_contract_interaction=False
        ),
        TransactionRecord(
            tx_hash='0x3',
            wallet_address=wallet.lower(),
            block_number=80,
            timestamp=datetime(2020, 1, 3, tzinfo=timezone.utc),
            from_address='0xsender2',
            to_address=wallet.lower(),
            value_wei=5000000000000000000,  # 5 ETH
            value_eth=5.0,
            gas_used=21000,
            gas_price_wei=20000000000,
            status=True,
            is_contract_interaction=False
        ),
        TransactionRecord(
            tx_hash='0x4',
            wallet_address=wallet.lower(),
            block_number=90,
            timestamp=datetime(2020, 1, 4, tzinfo=timezone.utc),
            from_address=wallet.lower(),
            to_address='0xreceiver2',
            value_wei=1000000000000000000,  # 1 ETH
            value_eth=1.0,
            gas_used=21000,
            gas_price_wei=50000000000,  # 0.001 ETH gas
            status=True,
            is_contract_interaction=False
        ),
        TransactionRecord(
            tx_hash='0x5',
            wallet_address=wallet.lower(),
            block_number=100,
            timestamp=datetime(2020, 1, 5, tzinfo=timezone.utc),
            from_address='0xsender3',
            to_address=wallet.lower(),
            value_wei=2000000000000000000,  # 2 ETH
            value_eth=2.0,
            gas_used=21000,
            gas_price_wei=20000000000,
            status=True,
            is_contract_interaction=False
        ),
    ]
    
    # Mock the current balance to 10 ETH for testing
    original_get_balance = client.get_wallet_balance
    client.get_wallet_balance = lambda addr: 10000000000000000000  # 10 ETH
    
    window = IngestionWindow(
        start_block=0,
        end_block=1000,
        start_timestamp=datetime(2020, 1, 1, tzinfo=timezone.utc),
        end_timestamp=datetime(2020, 1, 10, tzinfo=timezone.utc)
    )
    
    print("\nTest 1: Mock Transaction Backwards Calculation")
    print("-" * 80)
    
    snapshots = service.create_balance_snapshots(wallet, window, mock_txs)
    
    print(f"\nCreated {len(snapshots)} snapshots")
    print("\nBalance History (chronological order):")
    for i, snap in enumerate(snapshots):
        print(f"{i+1}. Block {snap.block_number}: {snap.balance_eth:.6f} ETH")
    
    # Verify expected values
    expected_balances = [0.003, 7.003, 4.001, 9.001, 8.0, 10.0]
    
    print("\nVerification:")
    all_pass = True
    for i, (snap, expected) in enumerate(zip(snapshots, expected_balances)):
        actual = snap.balance_eth
        diff = abs(actual - expected)
        status = "PASS" if diff < 0.01 else "FAIL"
        if status == "FAIL":
            all_pass = False
        print(f"  Block {snap.block_number}: Expected {expected:.3f} ETH, Got {actual:.3f} ETH - {status}")
    
    # Restore original method
    client.get_wallet_balance = original_get_balance
    
    print("\n" + "=" * 80)
    if all_pass:
        print("TEST 1 RESULT: PASS - Mock transaction backwards calculation works correctly")
    else:
        print("TEST 1 RESULT: FAIL - Balance calculations don't match expected values")
    print("=" * 80)
    
    return all_pass

if __name__ == "__main__":
    try:
        result = test_backwards_balance()
        sys.exit(0 if result else 1)
    except Exception as e:
        logger.error(f"Test failed with exception: {e}", exc_info=True)
        sys.exit(1)
