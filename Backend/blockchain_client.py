"""
Blockchain Client for Data Ingestion
Handles connection to Ethereum blockchain and data fetching
"""
from web3 import Web3
from web3.middleware import geth_poa_middleware
from web3.exceptions import BlockNotFound, TransactionNotFound
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
import logging
from config import settings

logger = logging.getLogger(__name__)


class BlockchainClient:
    """
    Client for interacting with Ethereum blockchain
    Supports Mainnet and Testnets
    """
    
    # POA chains that need special middleware
    POA_CHAIN_IDS = {56, 97, 137, 80002, 100, 10200, 1284, 1285, 592, 25, 2222, 122, 1666600000, 1313161554}
    
    def __init__(self, rpc_url: Optional[str] = None):
        """
        Initialize blockchain client
        
        Args:
            rpc_url: RPC endpoint URL (defaults to config)
        """
        self.rpc_url = rpc_url or settings.ETHEREUM_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to Ethereum node at {self.rpc_url}")
        
        # Inject POA middleware for POA chains
        try:
            chain_id = self.w3.eth.chain_id
            if chain_id in self.POA_CHAIN_IDS:
                self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
                logger.info(f"POA middleware injected for chain {chain_id}")
        except Exception as e:
            logger.warning(f"Could not inject POA middleware: {e}")
        
        logger.info(f"Connected to Ethereum node. Chain ID: {self.w3.eth.chain_id}")
    
    def is_connected(self) -> bool:
        """Check if connected to blockchain"""
        return self.w3.is_connected()
    
    def get_latest_block_number(self) -> int:
        """Get the latest block number"""
        return self.w3.eth.block_number
    
    def get_block(self, block_identifier: int) -> Optional[Dict[str, Any]]:
        """
        Get block data by number
        
        Args:
            block_identifier: Block number
            
        Returns:
            Block data dictionary or None if not found
        """
        try:
            block = self.w3.eth.get_block(block_identifier, full_transactions=False)
            return dict(block)
        except BlockNotFound:
            logger.warning(f"Block {block_identifier} not found")
            return None
    
    def get_wallet_balance(self, address: str) -> int:
        """
        Get current ETH balance for wallet
        
        Args:
            address: Wallet address
            
        Returns:
            Balance in Wei
        """
        checksum_address = Web3.to_checksum_address(address)
        return self.w3.eth.get_balance(checksum_address)
    
    def get_transaction_count(self, address: str) -> int:
        """
        Get transaction count (nonce) for wallet
        
        Args:
            address: Wallet address
            
        Returns:
            Transaction count
        """
        checksum_address = Web3.to_checksum_address(address)
        return self.w3.eth.get_transaction_count(checksum_address)
    
    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """
        Get transaction data
        
        Args:
            tx_hash: Transaction hash
            
        Returns:
            Transaction data or None
        """
        try:
            tx = self.w3.eth.get_transaction(tx_hash)
            return dict(tx)
        except TransactionNotFound:
            logger.warning(f"Transaction {tx_hash} not found")
            return None
    
    def get_transaction_receipt(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """
        Get transaction receipt
        
        Args:
            tx_hash: Transaction hash
            
        Returns:
            Receipt data or None
        """
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            return dict(receipt)
        except TransactionNotFound:
            logger.warning(f"Receipt for {tx_hash} not found")
            return None
    
    def get_block_timestamp(self, block_number: int) -> Optional[datetime]:
        """
        Get timestamp for a block
        
        Args:
            block_number: Block number
            
        Returns:
            Datetime object or None
        """
        block = self.get_block(block_number)
        if block:
            return datetime.fromtimestamp(block['timestamp'], tz=timezone.utc)
        return None
    
    def estimate_block_by_timestamp(self, target_timestamp: datetime) -> int:
        """
        Estimate block number for a given timestamp
        Uses binary search approximation
        
        Args:
            target_timestamp: Target datetime
            
        Returns:
            Estimated block number
        """
        latest_block = self.get_latest_block_number()
        latest_block_data = self.get_block(latest_block)
        
        if not latest_block_data:
            return latest_block
        
        latest_timestamp = latest_block_data['timestamp']
        target_ts = int(target_timestamp.timestamp())
        
        # Average block time (12 seconds for Ethereum)
        avg_block_time = 12
        
        # Estimate blocks back
        time_diff = latest_timestamp - target_ts
        blocks_back = int(time_diff / avg_block_time)
        
        estimated_block = max(0, latest_block - blocks_back)
        return estimated_block
    
    def get_logs(
        self,
        from_block: int,
        to_block: int,
        address: Optional[str] = None,
        topics: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get event logs for specified parameters
        
        Args:
            from_block: Starting block
            to_block: Ending block
            address: Contract address filter
            topics: Event topics filter
            
        Returns:
            List of log entries
        """
        filter_params = {
            'fromBlock': from_block,
            'toBlock': to_block
        }
        
        if address:
            filter_params['address'] = Web3.to_checksum_address(address)
        
        if topics:
            filter_params['topics'] = topics
        
        try:
            logs = self.w3.eth.get_logs(filter_params)
            return [dict(log) for log in logs]
        except Exception as e:
            # Silently handle common errors to reduce noise
            error_str = str(e)
            if "429" in error_str or "Too Many Requests" in error_str:
                # Rate limit - expected with free tier
                pass
            elif "Block range is too large" in error_str or "32062" in error_str:
                # Block range too large - caller should chunk
                pass
            elif "400" in error_str or "Bad Request" in error_str:
                # Bad request - likely invalid parameters
                pass
            else:
                # Log unexpected errors
                logger.error(f"Error fetching logs: {e}")
            return []
    
    def wei_to_ether(self, wei: int) -> float:
        """Convert Wei to Ether"""
        return float(Web3.from_wei(wei, 'ether'))
    
    def ether_to_wei(self, ether: float) -> int:
        """Convert Ether to Wei"""
        return Web3.to_wei(ether, 'ether')
