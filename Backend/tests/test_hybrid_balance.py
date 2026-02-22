"""
Test Hybrid Balance Snapshot Approach
Tests recent + old transaction split
"""
from datetime import datetime
from blockchain_client import BlockchainClient
from data_ingestion_service import DataIngestionService
from config import settings
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_hybrid_balance():
    """Test hybrid balance snapshot approach"""
    
    print("\n" + "="*80)
    print("HYBRID BALANCE SNAPSHOT TEST")
    print("="*80)
    
    # Test with a wallet that has recent activity
    # Using a smaller wallet for faster testing
    test_wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"  # Small active wallet
    
    logger.info(f"Testing with wallet: {test_wallet}")
    
    # Initialize services
    client = BlockchainClient(settings.ETHEREUM_MAINNET_RPC)
    service = DataIngestionService(client)
    
    # Get latest block
    latest_block = client.get_latest_block_number()
    logger.info(f"Latest block: {latest_block:,}")
    
    # Fetch transactions
    from data_ingestion_models import IngestionWindow
    window = IngestionWindow(
        start_block=0,
        end_block=latest_block,
        start_time=datetime(2015, 1, 1),
        end_time=datetime.now()
    )
    
    logger.info("Fetching transactions...")
    transactions = service.etherscan.fetch_all_transactions(test_wallet, 0, latest_block)
    logger.info(f"Fetched {len(transactions)} transactions")
    
    if not transactions:
        logger.error("No transactions found")
        return
    
    # Sort by block
    sorted_txs = sorted(transactions, key=lambda tx: tx.block_number)
    logger.info(f"Block range: {sorted_txs[0].block_number:,} to {sorted_txs[-1].block_number:,}")
    
    # Check how many are recent
    RECENT_THRESHOLD = 1000
    recent_cutoff = latest_block - RECENT_THRESHOLD
    recent_count = sum(1 for tx in sorted_txs if tx.block_number >= recent_cutoff)
    old_count = len(sorted_txs) - recent_count
    
    logger.info(f"Recent transactions (last {RECENT_THRESHOLD} blocks): {recent_count}")
    logger.info(f"Old transactions: {old_count}")
    
    # Create balance snapshots using hybrid approach
    logger.info("\nCreating balance snapshots with hybrid approach...")
    snapshots = service.create_balance_snapshots(
        wallet_address=test_wallet,
        window=window,
        transactions=transactions,
        snapshot_count=100
    )
    
    logger.info(f"\n✓ Created {len(snapshots)} balance snapshots")
    
    if snapshots:
        logger.info(f"Balance range: {min(s.balance_eth for s in snapshots):.6f} to {max(s.balance_eth for s in snapshots):.6f} ETH")
        logger.info(f"First snapshot: Block {snapshots[0].block_number:,}, {snapshots[0].balance_eth:.6f} ETH")
        logger.info(f"Last snapshot: Block {snapshots[-1].block_number:,}, {snapshots[-1].balance_eth:.6f} ETH")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    test_hybrid_balance()
