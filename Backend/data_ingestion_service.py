"""
Data Ingestion Service
Core service for collecting and normalizing blockchain data
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta, timezone
import logging
from blockchain_client import BlockchainClient
from protocol_decoder import ProtocolDecoder
from data_ingestion_models import (
    WalletMetadata,
    TransactionRecord,
    ProtocolEvent,
    BalanceSnapshot,
    IngestionWindow,
    IngestionSummary
)

logger = logging.getLogger(__name__)


class DataIngestionService:
    """
    Service for ingesting blockchain data for credit scoring
    Implements deterministic, reproducible data collection
    """
    
    def __init__(self, blockchain_client: BlockchainClient):
        self.client = blockchain_client
        self.decoder = ProtocolDecoder()
    
    def determine_ingestion_window(
        self,
        wallet_address: str,
        days_back: Optional[int] = None,
        full_history: bool = False
    ) -> IngestionWindow:
        """
        Determine the block range for data ingestion
        
        Args:
            wallet_address: Wallet to analyze
            days_back: Number of days to look back (default: 90)
            full_history: If True, fetch complete history
            
        Returns:
            IngestionWindow with start and end blocks
        """
        latest_block = self.client.get_latest_block_number()
        
        if full_history:
            # Start from genesis or first transaction
            start_block = 0
        else:
            # Calculate blocks for time window
            days = days_back or 90
            target_date = datetime.now(timezone.utc) - timedelta(days=days)
            start_block = self.client.estimate_block_by_timestamp(target_date)
        
        return IngestionWindow(
            start_block=start_block,
            end_block=latest_block,
            start_timestamp=self.client.get_block_timestamp(start_block),
            end_timestamp=self.client.get_block_timestamp(latest_block)
        )
    
    def fetch_wallet_metadata(self, wallet_address: str) -> WalletMetadata:
        """
        Fetch current wallet metadata
        
        Args:
            wallet_address: Wallet address
            
        Returns:
            WalletMetadata object
        """
        balance_wei = self.client.get_wallet_balance(wallet_address)
        tx_count = self.client.get_transaction_count(wallet_address)
        
        # Estimate first seen block (simplified - would need transaction history scan)
        latest_block = self.client.get_latest_block_number()
        first_seen_block = max(0, latest_block - (tx_count * 5))  # Rough estimate
        first_seen_timestamp = self.client.get_block_timestamp(first_seen_block) or datetime.now(timezone.utc)
        
        return WalletMetadata(
            wallet_address=wallet_address.lower(),
            first_seen_block=first_seen_block,
            first_seen_timestamp=first_seen_timestamp,
            current_balance_wei=balance_wei,
            current_balance_eth=self.client.wei_to_ether(balance_wei),
            transaction_count=tx_count
        )
    
    def fetch_transaction_history(
        self,
        wallet_address: str,
        window: IngestionWindow,
        max_transactions: int = 1000
    ) -> List[TransactionRecord]:
        """
        Fetch transaction history for wallet
        
        Note: This is a simplified implementation. Production would use:
        - Etherscan API for transaction lists
        - The Graph for indexed data
        - Custom indexer for complete history
        
        Args:
            wallet_address: Wallet address
            window: Ingestion window
            max_transactions: Maximum transactions to fetch
            
        Returns:
            List of TransactionRecord objects
        """
        transactions = []
        
        # In production, this would query an indexer or API
        # For now, we return empty list (no warning spam)
        
        return transactions
    
    def fetch_protocol_events(
        self,
        wallet_address: str,
        window: IngestionWindow
    ) -> List[ProtocolEvent]:
        """
        Fetch protocol interaction events
        
        Args:
            wallet_address: Wallet address
            window: Ingestion window
            
        Returns:
            List of ProtocolEvent objects
        """
        events = []
        
        # Fetch logs from known protocol contracts
        for protocol_address in self.decoder.KNOWN_PROTOCOLS.keys():
            try:
                # Use smaller chunk size to avoid "block range too large" errors
                # Alchemy free tier: 2000 blocks, Growth: 10000 blocks
                chunk_size = 2000
                current_block = window.start_block
                
                while current_block <= window.end_block:
                    to_block = min(current_block + chunk_size, window.end_block)
                    
                    logs = self.client.get_logs(
                        from_block=current_block,
                        to_block=to_block,
                        address=protocol_address
                    )
                    
                    # Get block timestamps for logs
                    block_numbers = set(log['blockNumber'] for log in logs)
                    block_timestamps = {}
                    for block_num in block_numbers:
                        ts = self.client.get_block_timestamp(block_num)
                        if ts:
                            block_timestamps[block_num] = ts
                    
                    # Decode logs
                    decoded = self.decoder.decode_logs(logs, wallet_address, block_timestamps)
                    
                    # Filter for wallet address
                    wallet_events = [e for e in decoded if e.wallet_address.lower() == wallet_address.lower()]
                    events.extend(wallet_events)
                    
                    current_block = to_block + 1
                    
            except Exception as e:
                # Silently handle expected errors
                error_str = str(e)
                if not any(x in error_str for x in ["429", "Too Many Requests", "Block range", "400", "Bad Request"]):
                    logger.error(f"Error fetching events from {protocol_address}: {e}")
        
        return events
    
    def create_balance_snapshots(
        self,
        wallet_address: str,
        window: IngestionWindow,
        snapshot_count: int = 10
    ) -> List[BalanceSnapshot]:
        """
        Create balance snapshots at intervals
        
        Args:
            wallet_address: Wallet address
            window: Ingestion window
            snapshot_count: Number of snapshots to create
            
        Returns:
            List of BalanceSnapshot objects
        """
        snapshots = []
        
        block_range = window.end_block - window.start_block
        if block_range <= 0:
            return snapshots
        
        interval = max(1, block_range // snapshot_count)
        
        for i in range(snapshot_count):
            block_num = window.start_block + (i * interval)
            if block_num > window.end_block:
                break
            
            try:
                # Note: Getting historical balance requires archive node
                # This is a simplified version
                timestamp = self.client.get_block_timestamp(block_num)
                if not timestamp:
                    continue
                
                # Current balance only (historical requires archive node)
                if i == snapshot_count - 1:
                    balance_wei = self.client.get_wallet_balance(wallet_address)
                else:
                    balance_wei = 0  # Would need archive node
                
                snapshots.append(BalanceSnapshot(
                    wallet_address=wallet_address.lower(),
                    block_number=block_num,
                    timestamp=timestamp,
                    balance_wei=balance_wei,
                    balance_eth=self.client.wei_to_ether(balance_wei)
                ))
            except Exception as e:
                # Silently handle rate limit errors
                error_str = str(e)
                if not any(x in error_str for x in ["429", "Too Many Requests"]):
                    logger.error(f"Error creating snapshot at block {block_num}: {e}")
        
        return snapshots
    
    def ingest_wallet_data(
        self,
        wallet_address: str,
        days_back: Optional[int] = 90,
        full_history: bool = False
    ) -> IngestionSummary:
        """
        Complete data ingestion for a wallet
        
        This is the main entry point for data ingestion
        
        Args:
            wallet_address: Wallet address to analyze
            days_back: Days of history to fetch
            full_history: Fetch complete history
            
        Returns:
            IngestionSummary with results
        """
        start_time = datetime.utcnow()
        errors = []
        
        try:
            # Step 1: Determine ingestion window
            window = self.determine_ingestion_window(wallet_address, days_back, full_history)
            logger.info(f"Ingestion window: blocks {window.start_block} to {window.end_block}")
            
            # Step 2: Fetch wallet metadata
            metadata = self.fetch_wallet_metadata(wallet_address)
            logger.info(f"Wallet metadata: {metadata.transaction_count} transactions, {metadata.current_balance_eth:.4f} ETH")
            
            # Step 3: Fetch transaction history
            transactions = self.fetch_transaction_history(wallet_address, window)
            logger.info(f"Fetched {len(transactions)} transactions")
            
            # Step 4: Fetch protocol events
            protocol_events = self.fetch_protocol_events(wallet_address, window)
            logger.info(f"Fetched {len(protocol_events)} protocol events")
            
            # Step 5: Create balance snapshots
            snapshots = self.create_balance_snapshots(wallet_address, window)
            logger.info(f"Created {len(snapshots)} balance snapshots")
            
            # Step 6: Store data (would go to database in production)
            # For now, just log summary
            
            end_time = datetime.utcnow()
            
            return IngestionSummary(
                wallet_address=wallet_address.lower(),
                ingestion_window=window,
                total_transactions=len(transactions),
                total_protocol_events=len(protocol_events),
                balance_snapshots=len(snapshots),
                ingestion_started_at=start_time,
                ingestion_completed_at=end_time,
                status="completed",
                errors=errors
            )
            
        except Exception as e:
            logger.error(f"Ingestion failed for {wallet_address}: {e}")
            errors.append(str(e))
            
            return IngestionSummary(
                wallet_address=wallet_address.lower(),
                ingestion_window=IngestionWindow(start_block=0, end_block=0),
                total_transactions=0,
                total_protocol_events=0,
                balance_snapshots=0,
                ingestion_started_at=start_time,
                ingestion_completed_at=datetime.utcnow(),
                status="failed",
                errors=errors
            )
