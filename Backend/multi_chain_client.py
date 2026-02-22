"""
Multi-Chain Blockchain Client
Manages connections to multiple blockchain networks simultaneously
"""
from typing import Dict, List, Optional, Any
from web3 import Web3
from blockchain_client import BlockchainClient
from config import settings
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class MultiChainClient:
    """
    Client for managing multiple blockchain network connections
    Supports parallel data fetching across all networks
    """
    
    # Network metadata
    NETWORK_INFO = {
        # Ethereum
        "ethereum": {"name": "Ethereum Mainnet", "chain_id": 1, "type": "mainnet"},
        "ethereum_sepolia": {"name": "Ethereum Sepolia", "chain_id": 11155111, "type": "testnet"},
        "ethereum_hoodi": {"name": "Ethereum Hoodi", "chain_id": 17000, "type": "testnet"},
        # Arbitrum
        "arbitrum": {"name": "Arbitrum One", "chain_id": 42161, "type": "mainnet"},
        "arbitrum_sepolia": {"name": "Arbitrum Sepolia", "chain_id": 421614, "type": "testnet"},
        "arbitrum_nova": {"name": "Arbitrum Nova", "chain_id": 42170, "type": "mainnet"},
        # Optimism
        "optimism": {"name": "Optimism", "chain_id": 10, "type": "mainnet"},
        "optimism_sepolia": {"name": "Optimism Sepolia", "chain_id": 11155420, "type": "testnet"},
        # Base
        "base": {"name": "Base", "chain_id": 8453, "type": "mainnet"},
        "base_sepolia": {"name": "Base Sepolia", "chain_id": 84532, "type": "testnet"},
        # zkSync
        "zksync": {"name": "zkSync Era", "chain_id": 324, "type": "mainnet"},
        "zksync_sepolia": {"name": "zkSync Sepolia", "chain_id": 300, "type": "testnet"},
        # Polygon
        "polygon": {"name": "Polygon", "chain_id": 137, "type": "mainnet"},
        "polygon_amoy": {"name": "Polygon Amoy", "chain_id": 80002, "type": "testnet"},
        # BNB
        "bnb": {"name": "BNB Smart Chain", "chain_id": 56, "type": "mainnet"},
        "bnb_testnet": {"name": "BNB Testnet", "chain_id": 97, "type": "testnet"},
        "opbnb": {"name": "opBNB", "chain_id": 204, "type": "mainnet"},
        "opbnb_testnet": {"name": "opBNB Testnet", "chain_id": 5611, "type": "testnet"},
        # Emerging L2s
        "zora": {"name": "Zora", "chain_id": 7777777, "type": "mainnet"},
        "zora_sepolia": {"name": "Zora Sepolia", "chain_id": 999999999, "type": "testnet"},
        "worldchain": {"name": "World Chain", "chain_id": 480, "type": "mainnet"},
        "worldchain_sepolia": {"name": "World Chain Sepolia", "chain_id": 4801, "type": "testnet"},
        "unichain": {"name": "Unichain", "chain_id": 130, "type": "mainnet"},
        "unichain_sepolia": {"name": "Unichain Sepolia", "chain_id": 1301, "type": "testnet"},
        "shape": {"name": "Shape", "chain_id": 360, "type": "mainnet"},
        "shape_sepolia": {"name": "Shape Sepolia", "chain_id": 11011, "type": "testnet"},
        "ink": {"name": "Ink", "chain_id": 57073, "type": "mainnet"},
        "ink_sepolia": {"name": "Ink Sepolia", "chain_id": 763373, "type": "testnet"},
        "soneium": {"name": "Soneium", "chain_id": 1868, "type": "mainnet"},
        "soneium_minato": {"name": "Soneium Minato", "chain_id": 1946, "type": "testnet"},
        "story": {"name": "Story", "chain_id": 1514, "type": "mainnet"},
        "story_aeneid": {"name": "Story Aeneid", "chain_id": 1315, "type": "testnet"},
        # Gaming
        "animechain": {"name": "AnimeChain", "chain_id": 69000, "type": "mainnet"},
        "animechain_sepolia": {"name": "AnimeChain Sepolia", "chain_id": 6900, "type": "testnet"},
        "degen": {"name": "Degen", "chain_id": 666666666, "type": "mainnet"},
        # DeFi
        "frax": {"name": "Frax", "chain_id": 252, "type": "mainnet"},
        "hyperliquid": {"name": "Hyperliquid", "chain_id": 999, "type": "mainnet"},
        "hyperliquid_testnet": {"name": "Hyperliquid Testnet", "chain_id": 998, "type": "testnet"},
        # Other
        "celo": {"name": "Celo", "chain_id": 42220, "type": "mainnet"},
        "celo_sepolia": {"name": "Celo Sepolia", "chain_id": 11142220, "type": "testnet"},
        "berachain": {"name": "Berachain", "chain_id": 80094, "type": "mainnet"},
        "boba": {"name": "Boba", "chain_id": 288, "type": "mainnet"},
        "boba_sepolia": {"name": "Boba Sepolia", "chain_id": 28882, "type": "testnet"},
        "monad": {"name": "Monad", "chain_id": 143, "type": "mainnet"},
        "monad_testnet": {"name": "Monad Testnet", "chain_id": 10143, "type": "testnet"},
        "avalanche": {"name": "Avalanche C-Chain", "chain_id": 43114, "type": "mainnet"},
        "avalanche_fuji": {"name": "Avalanche Fuji", "chain_id": 43113, "type": "testnet"},
        "fantom": {"name": "Fantom Opera", "chain_id": 250, "type": "mainnet"},
        "fantom_testnet": {"name": "Fantom Testnet", "chain_id": 4002, "type": "testnet"},
        # Additional L2s
        "scroll": {"name": "Scroll", "chain_id": 534352, "type": "mainnet"},
        "scroll_sepolia": {"name": "Scroll Sepolia", "chain_id": 534351, "type": "testnet"},
        "linea": {"name": "Linea", "chain_id": 59144, "type": "mainnet"},
        "linea_sepolia": {"name": "Linea Sepolia", "chain_id": 59141, "type": "testnet"},
        "blast": {"name": "Blast", "chain_id": 81457, "type": "mainnet"},
        "blast_sepolia": {"name": "Blast Sepolia", "chain_id": 168587773, "type": "testnet"},
        "mantle": {"name": "Mantle", "chain_id": 5000, "type": "mainnet"},
        "mantle_sepolia": {"name": "Mantle Sepolia", "chain_id": 5003, "type": "testnet"},
        "metis": {"name": "Metis Andromeda", "chain_id": 1088, "type": "mainnet"},
        "metis_sepolia": {"name": "Metis Sepolia", "chain_id": 59902, "type": "testnet"},
        "mode": {"name": "Mode", "chain_id": 34443, "type": "mainnet"},
        "mode_sepolia": {"name": "Mode Sepolia", "chain_id": 919, "type": "testnet"},
        "polygon_zkevm": {"name": "Polygon zkEVM", "chain_id": 1101, "type": "mainnet"},
        # Gaming chains
        "ronin": {"name": "Ronin", "chain_id": 2020, "type": "mainnet"},
        "ronin_saigon": {"name": "Ronin Saigon", "chain_id": 2021, "type": "testnet"},
        # Other EVM chains
        "gnosis": {"name": "Gnosis Chain", "chain_id": 100, "type": "mainnet"},
        "gnosis_chiado": {"name": "Gnosis Chiado", "chain_id": 10200, "type": "testnet"},
        "moonbeam": {"name": "Moonbeam", "chain_id": 1284, "type": "mainnet"},
        "moonriver": {"name": "Moonriver", "chain_id": 1285, "type": "mainnet"},
        "astar": {"name": "Astar", "chain_id": 592, "type": "mainnet"},
        "cronos": {"name": "Cronos", "chain_id": 25, "type": "mainnet"},
        "kava": {"name": "Kava EVM", "chain_id": 2222, "type": "mainnet"},
        "fuse": {"name": "Fuse", "chain_id": 122, "type": "mainnet"},
        "harmony": {"name": "Harmony", "chain_id": 1666600000, "type": "mainnet"},
        "aurora": {"name": "Aurora", "chain_id": 1313161554, "type": "mainnet"},
    }
    
    def __init__(self, networks: Optional[List[str]] = None, mainnet_only: bool = False, lazy_init: bool = True):
        """
        Initialize multi-chain client
        
        Args:
            networks: List of network names to connect to (None = all networks)
            mainnet_only: If True, only connect to mainnet networks
            lazy_init: If True, only initialize networks when first accessed (default: True)
        """
        self.clients: Dict[str, BlockchainClient] = {}
        self.connection_status: Dict[str, bool] = {}
        self.lazy_init = lazy_init
        self.mainnet_only = mainnet_only
        self.specified_networks = networks
        
        # Determine which networks are available
        if mainnet_only:
            self.available_networks = settings.get_mainnet_networks()
        else:
            self.available_networks = settings.get_all_networks()
        
        # Filter by specified networks if provided
        if networks:
            self.available_networks = {k: v for k, v in self.available_networks.items() if k in networks}
        
        # Initialize clients immediately if not lazy
        if not lazy_init:
            self._initialize_clients(self.available_networks)
        else:
            logger.info(f"Multi-chain client initialized with lazy loading for {len(self.available_networks)} networks")
    
    def _initialize_clients(self, network_configs: Dict[str, str]):
        """Initialize blockchain clients for each network"""
        logger.info(f"Initializing connections to {len(network_configs)} networks...")
        
        for network_name, rpc_url in network_configs.items():
            try:
                client = BlockchainClient(rpc_url)
                if client.is_connected():
                    self.clients[network_name] = client
                    self.connection_status[network_name] = True
                    logger.debug(f"✓ Connected to {self.NETWORK_INFO[network_name]['name']}")
                else:
                    self.connection_status[network_name] = False
                    logger.warning(f"✗ Failed to connect to {network_name}")
            except Exception as e:
                self.connection_status[network_name] = False
                logger.error(f"✗ Error connecting to {network_name}: {e}")
    
    def _ensure_network_initialized(self, network: str) -> bool:
        """
        Ensure a specific network is initialized (lazy initialization)
        
        Args:
            network: Network name to initialize
            
        Returns:
            True if network is connected, False otherwise
        """
        # Already initialized
        if network in self.clients:
            return self.connection_status.get(network, False)
        
        # Network not available
        if network not in self.available_networks:
            logger.warning(f"Network {network} not available")
            return False
        
        # Initialize this network
        rpc_url = self.available_networks[network]
        try:
            client = BlockchainClient(rpc_url)
            if client.is_connected():
                self.clients[network] = client
                self.connection_status[network] = True
                logger.debug(f"✓ Lazy-loaded {self.NETWORK_INFO[network]['name']}")
                return True
            else:
                self.connection_status[network] = False
                logger.warning(f"✗ Failed to connect to {network}")
                return False
        except Exception as e:
            self.connection_status[network] = False
            logger.error(f"✗ Error connecting to {network}: {e}")
            return False
    
    def get_connected_networks(self) -> List[str]:
        """Get list of successfully connected networks"""
        return [net for net, status in self.connection_status.items() if status]
    
    def get_network_info(self, network: str) -> Dict[str, Any]:
        """Get metadata for a network"""
        return self.NETWORK_INFO.get(network, {})
    
    def get_wallet_balance_all_networks(self, wallet_address: str) -> Dict[str, Dict[str, Any]]:
        """
        Get wallet balance across all connected networks
        
        Args:
            wallet_address: Wallet address
            
        Returns:
            Dict mapping network name to balance info
        """
        results = {}
        
        def fetch_balance(network: str, client: BlockchainClient):
            try:
                # Convert to checksum address
                checksum_addr = Web3.to_checksum_address(wallet_address)
                
                balance_wei = client.get_wallet_balance(checksum_addr)
                balance_eth = client.wei_to_ether(balance_wei)
                return network, {
                    "network": self.NETWORK_INFO[network]["name"],
                    "chain_id": self.NETWORK_INFO[network]["chain_id"],
                    "balance_wei": balance_wei,
                    "balance_native": balance_eth,
                    "status": "success"
                }
            except Exception as e:
                logger.error(f"Error fetching balance on {network}: {e}")
                return network, {
                    "network": self.NETWORK_INFO[network]["name"],
                    "chain_id": self.NETWORK_INFO[network]["chain_id"],
                    "balance_wei": 0,
                    "balance_native": 0.0,
                    "status": "error",
                    "error": str(e)
                }
        
        # Parallel execution
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {
                executor.submit(fetch_balance, net, client): net 
                for net, client in self.clients.items()
            }
            
            for future in as_completed(futures):
                network, result = future.result()
                results[network] = result
        
        return results
    
    def get_wallet_metadata_all_networks(self, wallet_address: str) -> Dict[str, Dict[str, Any]]:
        """
        Get wallet metadata across all connected networks
        
        Args:
            wallet_address: Wallet address
            
        Returns:
            Dict mapping network name to metadata
        """
        results = {}
        
        def fetch_metadata(network: str, client: BlockchainClient):
            try:
                # Convert to checksum address
                checksum_addr = Web3.to_checksum_address(wallet_address)
                
                balance_wei = client.get_wallet_balance(checksum_addr)
                tx_count = client.get_transaction_count(checksum_addr)
                latest_block = client.get_latest_block_number()
                
                return network, {
                    "network": self.NETWORK_INFO[network]["name"],
                    "chain_id": self.NETWORK_INFO[network]["chain_id"],
                    "balance_wei": balance_wei,
                    "balance_native": client.wei_to_ether(balance_wei),
                    "transaction_count": tx_count,
                    "latest_block": latest_block,
                    "has_activity": tx_count > 0,
                    "status": "success"
                }
            except Exception as e:
                # Log all errors for debugging
                logger.error(f"Error fetching metadata on {network}: {e}")
                return network, {
                    "network": self.NETWORK_INFO[network]["name"],
                    "chain_id": self.NETWORK_INFO[network]["chain_id"],
                    "status": "error",
                    "error": str(e)
                }
        
        # Parallel execution
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {
                executor.submit(fetch_metadata, net, client): net 
                for net, client in self.clients.items()
            }
            
            for future in as_completed(futures):
                network, result = future.result()
                results[network] = result
        
        return results
    
    def get_active_networks(self, wallet_address: str) -> List[str]:
        """
        Get list of networks where wallet has activity
        
        Args:
            wallet_address: Wallet address
            
        Returns:
            List of network names with activity
        """
        metadata = self.get_wallet_metadata_all_networks(wallet_address)
        return [
            net for net, data in metadata.items() 
            if data.get("status") == "success" and data.get("has_activity", False)
        ]
    
    def get_total_balance_usd(self, wallet_address: str, prices: Optional[Dict[str, float]] = None) -> float:
        """
        Calculate total balance across all networks in USD
        
        Args:
            wallet_address: Wallet address
            prices: Dict mapping network to native token price in USD
            
        Returns:
            Total balance in USD
        """
        if prices is None:
            # Default prices (would fetch from price oracle in production)
            prices = {
                "ethereum": 2500.0,
                "polygon": 0.8,
                "arbitrum": 2500.0,
                "optimism": 2500.0,
                "base": 2500.0,
                "bsc": 300.0,
                "avalanche": 35.0,
                "fantom": 0.5,
            }
        
        balances = self.get_wallet_balance_all_networks(wallet_address)
        total_usd = 0.0
        
        for network, data in balances.items():
            if data.get("status") == "success":
                balance_native = data.get("balance_native", 0.0)
                price = prices.get(network, 0.0)
                total_usd += balance_native * price
        
        return total_usd
    
    def get_client(self, network: str) -> Optional[BlockchainClient]:
        """Get blockchain client for specific network (with lazy initialization)"""
        if self.lazy_init:
            self._ensure_network_initialized(network)
        return self.clients.get(network)
    
    def get_connection_summary(self) -> Dict[str, Any]:
        """Get summary of all network connections"""
        connected = self.get_connected_networks()
        total = len(self.connection_status)
        
        return {
            "total_networks": total,
            "connected_networks": len(connected),
            "failed_networks": total - len(connected),
            "networks": {
                net: {
                    "name": self.NETWORK_INFO[net]["name"],
                    "chain_id": self.NETWORK_INFO[net]["chain_id"],
                    "type": self.NETWORK_INFO[net]["type"],
                    "connected": status
                }
                for net, status in self.connection_status.items()
            }
        }
