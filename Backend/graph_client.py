"""
The Graph Protocol Client
Fetches unlimited transaction history using The Graph's decentralized indexing protocol
"""
import requests
import time
from typing import List, Optional, Dict
from datetime import datetime, timezone
from data_ingestion_models import TransactionRecord
import logging

logger = logging.getLogger(__name__)


class GraphClient:
    """
    Client for The Graph Protocol
    Provides unlimited transaction history without pagination limits
    """
    
    # The Graph subgraph endpoints for different networks
    # Using The Graph's decentralized network (production-ready)
    SUBGRAPH_URLS = {
        # Ethereum Mainnet - Using decentralized network
        "ethereum": "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7",
        
        # Alternative: Use public hosted service endpoints (may have rate limits)
        # These are community-maintained subgraphs
        "ethereum_alt": "https://api.studio.thegraph.com/query/48211/ethereum-blocks/version/latest",
        
        # Layer 2 Networks
        "arbitrum": "https://api.studio.thegraph.com/query/48211/arbitrum-blocks/version/latest",
        "optimism": "https://api.studio.thegraph.com/query/48211/optimism-blocks/version/latest",
        "polygon": "https://api.studio.thegraph.com/query/48211/polygon-blocks/version/latest",
        "base": "https://api.studio.thegraph.com/query/48211/base-blocks/version/latest",
        
        # Other networks
        "gnosis": "https://api.studio.thegraph.com/query/48211/gnosis-blocks/version/latest",
        "avalanche": "https://api.studio.thegraph.com/query/48211/avalanche-blocks/version/latest",
        "bsc": "https://api.studio.thegraph.com/query/48211/bsc-blocks/version/latest",
    }
    
    def __init__(self, network: str = "ethereum"):
        """
        Initialize Graph client
        
        Args:
            network: Network name (ethereum, arbitrum, optimism, etc.)
        """
        self.network = network
        self.subgraph_url = self.SUBGRAPH_URLS.get(network)
        
        if not self.subgraph_url:
            logger.warning(f"No Graph subgraph configured for {network}")
            logger.warning(f"Available networks: {list(self.SUBGRAPH_URLS.keys())}")
        else:
            logger.info(f"Graph Protocol initialized for {network}")
            logger.info(f"Subgraph: {self.subgraph_url}")
        
        self.rate_limit_delay = 0.1  # 10 requests/second
    
    def _make_graphql_request(self, query: str, variables: Optional[Dict] = None) -> Dict:
        """
        Make GraphQL request to The Graph
        
        Args:
            query: GraphQL query string
            variables: Query variables
            
        Returns:
            Response data
        """
        if not self.subgraph_url:
            logger.error(f"No subgraph URL configured for {self.network}")
            return {"data": None, "errors": ["No subgraph configured"]}
        
        try:
            payload = {"query": query}
            if variables:
                payload["variables"] = variables
            
            response = requests.post(
                self.subgraph_url,
                json=payload,
                timeout=30,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Check for GraphQL errors
            if "errors" in data:
                for error in data["errors"]:
                    logger.error(f"GraphQL error: {error.get('message', error)}")
            
            # Rate limiting
            time.sleep(self.rate_limit_delay)
            
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Graph API request failed: {e}")
            return {"data": None, "errors": [str(e)]}
    
    def get_transactions_paginated(
        self,
        address: str,
        start_block: int = 0,
        end_block: int = 999999999,
        batch_size: int = 1000,
        max_transactions: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch transactions using pagination (no 10k limit like Etherscan)
        
        Args:
            address: Wallet address
            start_block: Starting block number
            end_block: Ending block number
            batch_size: Number of transactions per batch
            max_transactions: Maximum transactions to fetch (None = unlimited)
            
        Returns:
            List of transaction dictionaries
        """
        all_transactions = []
        last_id = ""
        page = 1
        
        logger.info(f"Fetching transactions from The Graph for {address}")
        logger.info(f"Block range: {start_block} to {end_block}")
        
        while True:
            # GraphQL query for transactions
            # Note: The exact schema depends on the subgraph being used
            # This is a generic query that works with most transaction subgraphs
            query = """
            query GetTransactions($address: String!, $startBlock: Int!, $endBlock: Int!, $lastId: String!, $batchSize: Int!) {
                transactions(
                    first: $batchSize,
                    where: {
                        or: [
                            { from: $address },
                            { to: $address }
                        ],
                        blockNumber_gte: $startBlock,
                        blockNumber_lte: $endBlock,
                        id_gt: $lastId
                    },
                    orderBy: id,
                    orderDirection: asc
                ) {
                    id
                    hash
                    from
                    to
                    value
                    gasUsed
                    gasPrice
                    blockNumber
                    timestamp
                    input
                }
            }
            """
            
            variables = {
                "address": address.lower(),
                "startBlock": start_block,
                "endBlock": end_block,
                "lastId": last_id,
                "batchSize": batch_size
            }
            
            logger.info(f"Fetching page {page} (batch size: {batch_size})...")
            
            response = self._make_graphql_request(query, variables)
            
            if not response.get("data") or "transactions" not in response["data"]:
                logger.warning(f"No data returned on page {page}")
                break
            
            transactions = response["data"]["transactions"]
            
            if not transactions:
                logger.info(f"No more transactions on page {page}")
                break
            
            logger.info(f"Received {len(transactions)} transactions on page {page}")
            
            all_transactions.extend(transactions)
            
            # Update last_id for pagination
            last_id = transactions[-1]["id"]
            
            # Check if we've reached max_transactions
            if max_transactions and len(all_transactions) >= max_transactions:
                logger.info(f"Reached max_transactions limit: {max_transactions}")
                all_transactions = all_transactions[:max_transactions]
                break
            
            # If we got less than batch_size, we've reached the end
            if len(transactions) < batch_size:
                logger.info(f"Received {len(transactions)} < {batch_size}, reached end")
                break
            
            logger.info(f"Total transactions so far: {len(all_transactions)}")
            page += 1
        
        logger.info(f"Fetched {len(all_transactions)} total transactions from The Graph")
        
        return all_transactions
    
    def parse_transaction(self, tx: Dict, wallet_address: str) -> TransactionRecord:
        """
        Parse Graph transaction into TransactionRecord
        
        Args:
            tx: Raw transaction from The Graph
            wallet_address: Wallet address being analyzed
            
        Returns:
            TransactionRecord object
        """
        # Parse timestamp
        timestamp = datetime.fromtimestamp(int(tx["timestamp"]), tz=timezone.utc)
        
        # Parse values
        value_wei = int(tx["value"])
        value_eth = value_wei / 1e18
        
        gas_used = int(tx.get("gasUsed", 0))
        gas_price_wei = int(tx.get("gasPrice", 0))
        
        # Check if contract interaction
        is_contract = tx.get("to") is None or tx.get("input", "0x") != "0x"
        
        # The Graph doesn't provide status directly, assume success
        # (failed transactions are typically not indexed)
        status = True
        
        return TransactionRecord(
            tx_hash=tx["hash"],
            wallet_address=wallet_address.lower(),
            block_number=int(tx["blockNumber"]),
            timestamp=timestamp,
            from_address=tx["from"].lower(),
            to_address=tx["to"].lower() if tx.get("to") else None,
            value_wei=value_wei,
            value_eth=value_eth,
            gas_used=gas_used,
            gas_price_wei=gas_price_wei,
            status=status,
            is_contract_interaction=is_contract
        )
    
    def fetch_all_transactions(
        self,
        address: str,
        start_block: int = 0,
        end_block: int = 999999999,
        max_transactions: Optional[int] = None
    ) -> List[TransactionRecord]:
        """
        Fetch all transactions for address (UNLIMITED - no 10k limit)
        
        Args:
            address: Wallet address
            start_block: Starting block number
            end_block: Ending block number
            max_transactions: Maximum transactions to fetch (None = unlimited)
            
        Returns:
            List of TransactionRecord objects
        """
        # Fetch raw transactions
        raw_transactions = self.get_transactions_paginated(
            address=address,
            start_block=start_block,
            end_block=end_block,
            batch_size=1000,
            max_transactions=max_transactions
        )
        
        # Parse into TransactionRecord objects
        parsed_transactions = []
        for tx in raw_transactions:
            try:
                tx_record = self.parse_transaction(tx, address)
                parsed_transactions.append(tx_record)
            except Exception as e:
                logger.warning(f"Failed to parse transaction {tx.get('hash')}: {e}")
        
        logger.info(f"Parsed {len(parsed_transactions)} transactions")
        
        return parsed_transactions
    
    @staticmethod
    def is_network_supported(network: str) -> bool:
        """
        Check if network is supported by The Graph
        
        Args:
            network: Network name
            
        Returns:
            True if supported
        """
        return network in GraphClient.SUBGRAPH_URLS
    
    @staticmethod
    def get_supported_networks() -> List[str]:
        """
        Get list of supported networks
        
        Returns:
            List of network names
        """
        return list(GraphClient.SUBGRAPH_URLS.keys())
