"""
Etherscan API Client
Fetches transaction history for wallets using Etherscan API
"""
import requests
import time
from typing import List, Optional
from datetime import datetime, timezone
from data_ingestion_models import TransactionRecord
import logging

logger = logging.getLogger(__name__)


class EtherscanClient:
    """
    Client for Etherscan API
    Free tier: 5 calls/second, 100,000 calls/day
    """
    
    def __init__(self, api_key: Optional[str] = None, network: str = "mainnet"):
        self.api_key = api_key or "YourApiKeyToken"
        
        if not api_key or api_key == "YourApiKeyToken":
            logger.warning("No valid Etherscan API key provided")
            logger.warning("Get free API key at: https://etherscan.io/apis")
        else:
            logger.info(f"Etherscan API initialized with key: {api_key[:8]}...")
        
        # API V2 endpoints and chain IDs by network
        self.network_config = {
            "mainnet": {
                "url": "https://api.etherscan.io/v2/api",
                "chainid": "1"
            },
            "sepolia": {
                "url": "https://api-sepolia.etherscan.io/v2/api",
                "chainid": "11155111"
            },
            "goerli": {
                "url": "https://api-goerli.etherscan.io/v2/api",
                "chainid": "5"
            },
        }
        
        config = self.network_config.get(network, self.network_config["mainnet"])
        self.base_url = config["url"]
        self.chainid = config["chainid"]
        self.rate_limit_delay = 0.2  # 5 calls/second = 0.2s between calls
        
        logger.info(f"Using Etherscan API V2: {self.base_url} (chainid: {self.chainid})")
    
    def _make_request(self, params: dict) -> dict:
        """
        Make API request with rate limiting
        
        Args:
            params: Query parameters
            
        Returns:
            API response as dict
        """
        params["apikey"] = self.api_key
        params["chainid"] = self.chainid  # Required for V2 API
        
        try:
            # Log the request for debugging
            logger.debug(f"Etherscan API request: {params.get('module')}.{params.get('action')}")
            
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Log full response for debugging
            logger.debug(f"Etherscan response: {data}")
            
            # Check for API errors
            if data.get("status") == "0":
                message = data.get("message", "Unknown error")
                result = data.get("result", "")
                
                # Common error messages
                if "No transactions found" in message:
                    # This is normal - wallet has no transactions in range
                    logger.info(f"No transactions found in specified range")
                elif "Invalid API Key" in str(result) or "Invalid API Key" in message:
                    logger.error(f"❌ Invalid Etherscan API Key!")
                    logger.error(f"Current key: {self.api_key[:8]}...")
                    logger.error("Please verify your API key at: https://etherscan.io/myapikey")
                elif "NOTOK" in message:
                    logger.error(f"❌ Etherscan API error: {message}")
                    logger.error(f"Result: {result}")
                    logger.error("Please check your API key and try again")
                elif "rate limit" in message.lower():
                    logger.warning(f"⚠️ Etherscan rate limit hit: {message}")
                else:
                    logger.warning(f"Etherscan API warning: {message}")
                    if result:
                        logger.warning(f"Details: {result}")
            
            # Rate limiting
            time.sleep(self.rate_limit_delay)
            
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Etherscan API request failed: {e}")
            return {"status": "0", "message": str(e), "result": []}
    
    def get_normal_transactions(
        self,
        address: str,
        start_block: int = 0,
        end_block: int = 99999999,
        page: int = 1,
        offset: int = 1000
    ) -> List[dict]:
        """
        Get normal transactions for address
        
        Args:
            address: Wallet address
            start_block: Starting block number
            end_block: Ending block number
            page: Page number
            offset: Number of transactions per page (max 10000)
            
        Returns:
            List of transaction dictionaries
        """
        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": start_block,
            "endblock": end_block,
            "page": page,
            "offset": offset,
            "sort": "asc"
        }
        
        response = self._make_request(params)
        
        if response.get("status") == "1":
            return response.get("result", [])
        
        return []
    
    def get_internal_transactions(
        self,
        address: str,
        start_block: int = 0,
        end_block: int = 99999999,
        page: int = 1,
        offset: int = 1000
    ) -> List[dict]:
        """
        Get internal transactions for address
        
        Args:
            address: Wallet address
            start_block: Starting block number
            end_block: Ending block number
            page: Page number
            offset: Number of transactions per page (max 10000)
            
        Returns:
            List of internal transaction dictionaries
        """
        params = {
            "module": "account",
            "action": "txlistinternal",
            "address": address,
            "startblock": start_block,
            "endblock": end_block,
            "page": page,
            "offset": offset,
            "sort": "asc"
        }
        
        response = self._make_request(params)
        
        if response.get("status") == "1":
            return response.get("result", [])
        
        return []
    
    def parse_transaction(self, tx: dict, wallet_address: str) -> TransactionRecord:
        """
        Parse Etherscan transaction into TransactionRecord
        
        Args:
            tx: Raw transaction from Etherscan
            wallet_address: Wallet address being analyzed
            
        Returns:
            TransactionRecord object
        """
        # Parse timestamp
        timestamp = datetime.fromtimestamp(int(tx["timeStamp"]), tz=timezone.utc)
        
        # Parse values
        value_wei = int(tx["value"])
        value_eth = value_wei / 1e18
        
        gas_used = int(tx.get("gasUsed", 0))
        gas_price_wei = int(tx.get("gasPrice", 0))
        
        # Check if transaction was successful
        # isError: 0 = success, 1 = error
        status = tx.get("isError", "0") == "0" and tx.get("txreceipt_status", "1") == "1"
        
        # Check if contract interaction
        is_contract = tx.get("to", "") == "" or tx.get("input", "0x") != "0x"
        
        return TransactionRecord(
            tx_hash=tx["hash"],
            wallet_address=wallet_address.lower(),
            block_number=int(tx["blockNumber"]),
            timestamp=timestamp,
            from_address=tx["from"].lower(),
            to_address=tx.get("to", "").lower() if tx.get("to") else None,
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
        end_block: int = 99999999,
        max_transactions: int = 100000  # Increased to support wallets with many transactions
    ) -> List[TransactionRecord]:
        """
        Fetch all transactions for address within block range
        
        IMPORTANT: Etherscan has a limit of PageNo × Offset ≤ 10,000
        So we use offset=5000 to allow 2 pages (10,000 total transactions)
        For wallets with >10k transactions, we need to use block range filtering
        
        Args:
            address: Wallet address
            start_block: Starting block number
            end_block: Ending block number
            max_transactions: Maximum transactions to fetch
            
        Returns:
            List of TransactionRecord objects
        """
        all_transactions = []
        
        logger.info(f"Fetching transactions from Etherscan for {address}")
        logger.info(f"Block range: {start_block} to {end_block}")
        
        # Use offset=5000 to allow fetching up to 10,000 transactions (2 pages)
        # Etherscan limit: PageNo × Offset ≤ 10,000
        page = 1
        offset = 5000
        
        while len(all_transactions) < max_transactions:
            logger.info(f"Fetching page {page} (offset: {offset})...")
            
            txs = self.get_normal_transactions(
                address=address,
                start_block=start_block,
                end_block=end_block,
                page=page,
                offset=offset
            )
            
            if not txs:
                logger.info(f"No more transactions returned on page {page}")
                break
            
            logger.info(f"Received {len(txs)} transactions on page {page}")
            
            # Parse transactions
            for tx in txs:
                if len(all_transactions) >= max_transactions:
                    break
                
                try:
                    tx_record = self.parse_transaction(tx, address)
                    all_transactions.append(tx_record)
                except Exception as e:
                    logger.warning(f"Failed to parse transaction {tx.get('hash')}: {e}")
            
            # If we got less than offset, we've reached the end
            if len(txs) < offset:
                logger.info(f"Received {len(txs)} < {offset}, reached end of transactions")
                break
            
            # Check if we've hit the Etherscan pagination limit (page × offset ≤ 10,000)
            if (page + 1) * offset > 10000:
                logger.warning(f"Reached Etherscan pagination limit (page × offset ≤ 10,000)")
                logger.warning(f"Fetched {len(all_transactions)} transactions. Wallet may have more.")
                logger.info(f"To fetch more, use block range filtering or smaller time windows")
                break
            
            logger.info(f"Total transactions so far: {len(all_transactions)}")
            page += 1
        
        logger.info(f"Fetched {len(all_transactions)} transactions from Etherscan")
        
        return all_transactions
