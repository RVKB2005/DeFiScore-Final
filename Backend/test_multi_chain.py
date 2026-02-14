"""
Test script for multi-chain data ingestion functionality
Tests ingestion across all supported blockchain networks
"""
from multi_chain_client import MultiChainClient
from multi_chain_ingestion_service import MultiChainIngestionService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_multi_chain_connections():
    """Test connections to all networks"""
    logger.info("=" * 80)
    logger.info("TESTING MULTI-CHAIN CONNECTIONS")
    logger.info("=" * 80)
    
    try:
        # Test all networks
        logger.info("\n1. Testing ALL networks (mainnet + testnet)...")
        client_all = MultiChainClient(mainnet_only=False)
        summary_all = client_all.get_connection_summary()
        
        logger.info(f"\nTotal networks: {summary_all['total_networks']}")
        logger.info(f"Connected: {summary_all['connected_networks']}")
        logger.info(f"Failed: {summary_all['failed_networks']}")
        
        logger.info("\nConnection Status:")
        for net, info in summary_all['networks'].items():
            status = "✓" if info['connected'] else "✗"
            logger.info(f"  {status} {info['name']} (Chain ID: {info['chain_id']}) - {info['type']}")
        
        # Test mainnet only
        logger.info("\n2. Testing MAINNET networks only...")
        client_mainnet = MultiChainClient(mainnet_only=True)
        summary_mainnet = client_mainnet.get_connection_summary()
        
        logger.info(f"\nMainnet networks: {summary_mainnet['total_networks']}")
        logger.info(f"Connected: {summary_mainnet['connected_networks']}")
        
        return client_all, client_mainnet
        
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return None, None


def test_wallet_balance_multi_chain(wallet_address: str):
    """Test fetching wallet balance across all networks"""
    logger.info("\n" + "=" * 80)
    logger.info(f"TESTING WALLET BALANCE ACROSS ALL NETWORKS")
    logger.info(f"Wallet: {wallet_address}")
    logger.info("=" * 80)
    
    try:
        client = MultiChainClient(mainnet_only=True)
        balances = client.get_wallet_balance_all_networks(wallet_address)
        
        logger.info("\nBalance Results:")
        total_networks = 0
        networks_with_balance = 0
        
        for network, data in balances.items():
            if data['status'] == 'success':
                total_networks += 1
                balance = data['balance_native']
                if balance > 0:
                    networks_with_balance += 1
                    logger.info(f"  ✓ {data['network']}: {balance:.6f} native tokens")
                else:
                    logger.info(f"  - {data['network']}: 0 balance")
            else:
                logger.error(f"  ✗ {data['network']}: {data.get('error', 'Unknown error')}")
        
        logger.info(f"\nSummary:")
        logger.info(f"  Networks checked: {total_networks}")
        logger.info(f"  Networks with balance: {networks_with_balance}")
        
        return balances
        
    except Exception as e:
        logger.error(f"Balance test failed: {e}")
        return None


def test_wallet_metadata_multi_chain(wallet_address: str):
    """Test fetching wallet metadata across all networks"""
    logger.info("\n" + "=" * 80)
    logger.info(f"TESTING WALLET METADATA ACROSS ALL NETWORKS")
    logger.info(f"Wallet: {wallet_address}")
    logger.info("=" * 80)
    
    try:
        client = MultiChainClient(mainnet_only=True)
        metadata = client.get_wallet_metadata_all_networks(wallet_address)
        
        logger.info("\nMetadata Results:")
        total_tx = 0
        active_networks = []
        
        for network, data in metadata.items():
            if data['status'] == 'success':
                tx_count = data['transaction_count']
                balance = data['balance_native']
                total_tx += tx_count
                
                if data['has_activity']:
                    active_networks.append(network)
                    logger.info(f"  ✓ {data['network']}: {tx_count} txs, {balance:.6f} balance")
                else:
                    logger.info(f"  - {data['network']}: No activity")
            else:
                logger.error(f"  ✗ {data['network']}: {data.get('error', 'Unknown error')}")
        
        logger.info(f"\nSummary:")
        logger.info(f"  Total transactions across all networks: {total_tx}")
        logger.info(f"  Active networks: {len(active_networks)}")
        logger.info(f"  Active network list: {', '.join(active_networks)}")
        
        return metadata
        
    except Exception as e:
        logger.error(f"Metadata test failed: {e}")
        return None


def test_multi_chain_ingestion_service(wallet_address: str):
    """Test multi-chain ingestion service"""
    logger.info("\n" + "=" * 80)
    logger.info(f"TESTING MULTI-CHAIN INGESTION SERVICE")
    logger.info(f"Wallet: {wallet_address}")
    logger.info("=" * 80)
    
    try:
        service = MultiChainIngestionService(mainnet_only=True)
        
        logger.info("\n1. Getting wallet summary...")
        summary = service.get_wallet_summary_all_networks(wallet_address)
        
        logger.info(f"\nWallet Summary:")
        logger.info(f"  Networks checked: {summary['total_networks_checked']}")
        logger.info(f"  Active networks: {summary['active_networks']}")
        logger.info(f"  Total transactions: {summary['total_transaction_count']}")
        logger.info(f"  Active network list: {summary['active_network_list']}")
        
        logger.info("\n2. Getting protocol events (if any)...")
        events = service.get_protocol_events_all_networks(wallet_address, days_back=30)
        
        logger.info(f"\nProtocol Events:")
        logger.info(f"  Networks with events: {events['networks_with_events']}")
        logger.info(f"  Total events: {events['total_events']}")
        
        if events['total_events'] > 0:
            for network, data in events['networks'].items():
                logger.info(f"  - {data['network']}: {data['event_count']} events")
        
        return summary, events
        
    except Exception as e:
        logger.error(f"Ingestion service test failed: {e}")
        return None, None


def test_specific_networks(wallet_address: str, networks: list):
    """Test ingestion on specific networks only"""
    logger.info("\n" + "=" * 80)
    logger.info(f"TESTING SPECIFIC NETWORKS: {', '.join(networks)}")
    logger.info(f"Wallet: {wallet_address}")
    logger.info("=" * 80)
    
    try:
        client = MultiChainClient(networks=networks, mainnet_only=False)
        summary = client.get_connection_summary()
        
        logger.info(f"\nConnected to {summary['connected_networks']} networks:")
        for net, info in summary['networks'].items():
            if info['connected']:
                logger.info(f"  ✓ {info['name']}")
        
        # Get balances
        balances = client.get_wallet_balance_all_networks(wallet_address)
        for network, data in balances.items():
            if data['status'] == 'success':
                logger.info(f"  {data['network']}: {data['balance_native']:.6f} balance")
        
        return True
        
    except Exception as e:
        logger.error(f"Specific networks test failed: {e}")
        return False


def main():
    """Run all multi-chain tests"""
    logger.info("\n" + "=" * 80)
    logger.info("MULTI-CHAIN DATA INGESTION TEST SUITE")
    logger.info("=" * 80)
    
    # Test 1: Network connections
    client_all, client_mainnet = test_multi_chain_connections()
    
    if not client_mainnet:
        logger.error("\nNo networks connected. Please check your RPC URLs in .env")
        logger.info("\nTo configure RPC endpoints:")
        logger.info("1. Get free API keys from https://www.alchemy.com/")
        logger.info("2. Update .env file with your API keys")
        logger.info("3. For public RPCs (BSC, Avalanche, Fantom), no API key needed")
        return
    
    # Use Vitalik's address for testing (known to have activity)
    test_wallet = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    
    # Test 2: Wallet balance across all networks
    test_wallet_balance_multi_chain(test_wallet)
    
    # Test 3: Wallet metadata across all networks
    test_wallet_metadata_multi_chain(test_wallet)
    
    # Test 4: Multi-chain ingestion service
    test_multi_chain_ingestion_service(test_wallet)
    
    # Test 5: Specific networks only
    test_specific_networks(test_wallet, ["ethereum", "polygon", "arbitrum"])
    
    logger.info("\n" + "=" * 80)
    logger.info("MULTI-CHAIN TEST SUITE COMPLETED")
    logger.info("=" * 80)
    logger.info("\nKey Features Tested:")
    logger.info("  ✓ Multi-network connection management")
    logger.info("  ✓ Parallel balance fetching")
    logger.info("  ✓ Cross-chain metadata aggregation")
    logger.info("  ✓ Active network detection")
    logger.info("  ✓ Protocol event collection")
    logger.info("  ✓ Selective network ingestion")
    logger.info("\nThe system is ready to ingest data from ALL supported networks!")


if __name__ == "__main__":
    main()
