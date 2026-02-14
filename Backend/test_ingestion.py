"""
Test script for data ingestion functionality
"""
import asyncio
from blockchain_client import BlockchainClient
from data_ingestion_service import DataIngestionService
from wallet_connection_service import WalletConnectionService
from data_ingestion_models import WalletType, WalletConnectionRequest
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_blockchain_connection():
    """Test blockchain client connection"""
    logger.info("Testing blockchain connection...")
    try:
        client = BlockchainClient()
        is_connected = client.is_connected()
        logger.info(f"Connected: {is_connected}")
        
        if is_connected:
            latest_block = client.get_latest_block_number()
            logger.info(f"Latest block: {latest_block}")
            logger.info(f"Chain ID: {client.w3.eth.chain_id}")
        
        return is_connected
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return False


def test_wallet_metadata(wallet_address: str):
    """Test fetching wallet metadata"""
    logger.info(f"\nTesting wallet metadata for {wallet_address}...")
    try:
        client = BlockchainClient()
        service = DataIngestionService(client)
        
        metadata = service.fetch_wallet_metadata(wallet_address)
        logger.info(f"Wallet Address: {metadata.wallet_address}")
        logger.info(f"Balance: {metadata.current_balance_eth:.4f} ETH")
        logger.info(f"Transaction Count: {metadata.transaction_count}")
        logger.info(f"First Seen Block: {metadata.first_seen_block}")
        
        return metadata
    except Exception as e:
        logger.error(f"Metadata test failed: {e}")
        return None


def test_ingestion_window(wallet_address: str, days_back: int = 30):
    """Test ingestion window determination"""
    logger.info(f"\nTesting ingestion window ({days_back} days)...")
    try:
        client = BlockchainClient()
        service = DataIngestionService(client)
        
        window = service.determine_ingestion_window(wallet_address, days_back=days_back)
        logger.info(f"Start Block: {window.start_block}")
        logger.info(f"End Block: {window.end_block}")
        logger.info(f"Block Range: {window.end_block - window.start_block}")
        
        return window
    except Exception as e:
        logger.error(f"Window test failed: {e}")
        return None


def test_wallet_connections():
    """Test wallet connection methods"""
    logger.info("\nTesting wallet connection methods...")
    try:
        service = WalletConnectionService()
        
        # Test MetaMask
        logger.info("\n1. MetaMask Connection:")
        metamask = service.create_metamask_connection()
        logger.info(f"   Method: {metamask.connection_method}")
        logger.info(f"   Deep Link: {metamask.deep_link[:50]}...")
        
        # Test WalletConnect
        logger.info("\n2. WalletConnect Connection:")
        wc = service.create_walletconnect_session()
        logger.info(f"   Method: {wc.connection_method}")
        logger.info(f"   Session ID: {wc.session_id}")
        logger.info(f"   Has QR Code: {wc.qr_code_data is not None}")
        
        # Test Coinbase
        logger.info("\n3. Coinbase Wallet Connection:")
        coinbase = service.create_coinbase_connection()
        logger.info(f"   Method: {coinbase.connection_method}")
        logger.info(f"   Deep Link: {coinbase.deep_link[:50]}...")
        logger.info(f"   Has QR Code: {coinbase.qr_code_data is not None}")
        
        # Test Generic
        logger.info("\n4. Generic Wallet Connection:")
        generic = service.create_generic_wallet_connection()
        logger.info(f"   Method: {generic.connection_method}")
        logger.info(f"   Session ID: {generic.session_id}")
        logger.info(f"   Has QR Code: {generic.qr_code_data is not None}")
        
        return True
    except Exception as e:
        logger.error(f"Wallet connection test failed: {e}")
        return False


def test_full_ingestion(wallet_address: str):
    """Test full data ingestion"""
    logger.info(f"\nTesting full ingestion for {wallet_address}...")
    try:
        client = BlockchainClient()
        service = DataIngestionService(client)
        
        summary = service.ingest_wallet_data(wallet_address, days_back=7)
        
        logger.info(f"\nIngestion Summary:")
        logger.info(f"Status: {summary.status}")
        logger.info(f"Transactions: {summary.total_transactions}")
        logger.info(f"Protocol Events: {summary.total_protocol_events}")
        logger.info(f"Balance Snapshots: {summary.balance_snapshots}")
        logger.info(f"Duration: {(summary.ingestion_completed_at - summary.ingestion_started_at).total_seconds():.2f}s")
        
        if summary.errors:
            logger.warning(f"Errors: {summary.errors}")
        
        return summary
    except Exception as e:
        logger.error(f"Full ingestion test failed: {e}")
        return None


def main():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("DATA INGESTION MODULE TEST SUITE")
    logger.info("=" * 60)
    
    # Test 1: Blockchain connection
    if not test_blockchain_connection():
        logger.error("Blockchain connection failed. Check your RPC URL in .env")
        return
    
    # Test 2: Wallet connections
    test_wallet_connections()
    
    # Test 3: Use a known wallet with activity (Vitalik's address for testing)
    test_wallet = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    
    # Test 4: Wallet metadata
    test_wallet_metadata(test_wallet)
    
    # Test 5: Ingestion window
    test_ingestion_window(test_wallet, days_back=30)
    
    # Test 6: Full ingestion (7 days to keep it quick)
    test_full_ingestion(test_wallet)
    
    logger.info("\n" + "=" * 60)
    logger.info("TEST SUITE COMPLETED")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
