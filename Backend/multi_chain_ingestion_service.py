"""
Multi-Chain Data Ingestion Service
Orchestrates data collection across multiple blockchain networks
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from multi_chain_client import MultiChainClient
from data_ingestion_service import DataIngestionService
from data_ingestion_models import IngestionSummary, IngestionWindow

logger = logging.getLogger(__name__)


class MultiChainIngestionService:
    """
    Service for ingesting data across multiple blockchain networks
    Coordinates parallel ingestion and aggregates results
    """
    
    def __init__(self, networks: Optional[List[str]] = None, mainnet_only: bool = True):
        """
        Initialize multi-chain ingestion service
        
        Args:
            networks: List of specific networks to use (None = all)
            mainnet_only: Only use mainnet networks (default: True)
        """
        # Use lazy initialization to avoid connecting to all networks upfront
        self.multi_client = MultiChainClient(networks=networks, mainnet_only=mainnet_only, lazy_init=True)
        self.ingestion_services: Dict[str, DataIngestionService] = {}
        
        logger.info(f"Multi-chain ingestion service initialized with lazy loading for {len(self.multi_client.available_networks)} networks")
    
    def _get_ingestion_service(self, network: str) -> Optional[DataIngestionService]:
        """
        Get or create ingestion service for a network (lazy initialization)
        
        Args:
            network: Network name
            
        Returns:
            DataIngestionService instance or None if network unavailable
        """
        # Return cached service if exists
        if network in self.ingestion_services:
            return self.ingestion_services[network]
        
        # Get or initialize network client
        client = self.multi_client.get_client(network)
        if not client:
            return None
        
        # Create and cache ingestion service
        service = DataIngestionService(client)
        self.ingestion_services[network] = service
        return service
    
    def get_wallet_summary_all_networks(self, wallet_address: str) -> Dict[str, Any]:
        """
        Get comprehensive wallet summary across all networks
        
        Args:
            wallet_address: Wallet address
            
        Returns:
            Aggregated wallet data from all networks
        """
        logger.info(f"Fetching wallet summary for {wallet_address} across all networks...")
        
        metadata = self.multi_client.get_wallet_metadata_all_networks(wallet_address)
        active_networks = self.multi_client.get_active_networks(wallet_address)
        
        # Calculate totals
        total_tx_count = sum(
            data.get("transaction_count", 0) 
            for data in metadata.values() 
            if data.get("status") == "success"
        )
        
        return {
            "wallet_address": wallet_address.lower(),
            "total_networks_checked": len(metadata),
            "active_networks": len(active_networks),
            "total_transaction_count": total_tx_count,
            "networks": metadata,
            "active_network_list": active_networks,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def ingest_wallet_all_networks(
        self,
        wallet_address: str,
        days_back: Optional[int] = 90,
        full_history: bool = False,
        parallel: bool = True
    ) -> Dict[str, Any]:
        """
        Ingest wallet data from all connected networks
        
        Args:
            wallet_address: Wallet address
            days_back: Days of history to fetch
            full_history: Fetch complete history
            parallel: Execute ingestions in parallel
            
        Returns:
            Aggregated ingestion results from all networks
        """
        logger.info(f"========== MULTI-CHAIN INGESTION STARTED ==========")
        logger.info(f"Wallet: {wallet_address}")
        logger.info(f"Days back: {days_back}, Full history: {full_history}, Parallel: {parallel}")
        start_time = datetime.utcnow()
        
        # First, check which networks have activity
        logger.info(f"Checking wallet activity across networks...")
        active_networks = self.multi_client.get_active_networks(wallet_address)
        logger.info(f"✓ Wallet has activity on {len(active_networks)} networks: {active_networks}")
        
        if not active_networks:
            logger.warning(f"No activity found on any network for {wallet_address}")
            return {
                "wallet_address": wallet_address.lower(),
                "networks_ingested": 0,
                "successful_ingestions": 0,
                "failed_ingestions": 0,
                "total_transactions": 0,
                "total_protocol_events": 0,
                "total_balance_snapshots": 0,
                "duration_seconds": 0,
                "message": "No activity found"
            }
        
        results = {}
        
        if parallel and len(active_networks) > 1:
            # Parallel ingestion
            logger.info(f"Starting PARALLEL ingestion across {len(active_networks)} networks...")
            results = self._ingest_parallel(wallet_address, active_networks, days_back, full_history)
        else:
            # Sequential ingestion
            logger.info(f"Starting SEQUENTIAL ingestion across {len(active_networks)} networks...")
            results = self._ingest_sequential(wallet_address, active_networks, days_back, full_history)
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        # Aggregate statistics
        total_transactions = sum(r.total_transactions for r in results.values() if isinstance(r, IngestionSummary))
        total_events = sum(r.total_protocol_events for r in results.values() if isinstance(r, IngestionSummary))
        total_snapshots = sum(r.balance_snapshots for r in results.values() if isinstance(r, IngestionSummary))
        
        successful = sum(1 for r in results.values() if isinstance(r, IngestionSummary) and r.status == "completed")
        failed = len(results) - successful
        
        logger.info(f"========== MULTI-CHAIN INGESTION COMPLETED ==========")
        logger.info(f"Duration: {duration:.2f}s")
        logger.info(f"Networks: {successful} successful, {failed} failed")
        logger.info(f"Total transactions: {total_transactions}")
        logger.info(f"Total protocol events: {total_events}")
        logger.info(f"Total balance snapshots: {total_snapshots}")
        
        return {
            "wallet_address": wallet_address.lower(),
            "networks_ingested": len(results),
            "successful_ingestions": successful,
            "failed_ingestions": failed,
            "total_transactions": total_transactions,
            "total_protocol_events": total_events,
            "total_balance_snapshots": total_snapshots,
            "duration_seconds": duration,
            "started_at": start_time.isoformat(),
            "completed_at": end_time.isoformat(),
            "network_results": {
                net: self._summary_to_dict(summary) 
                for net, summary in results.items()
            }
        }
    
    def _ingest_parallel(
        self,
        wallet_address: str,
        networks: List[str],
        days_back: Optional[int],
        full_history: bool
    ) -> Dict[str, IngestionSummary]:
        """Execute ingestions in parallel"""
        results = {}
        
        def ingest_network(network: str):
            try:
                logger.info(f"[{network}] Starting ingestion...")
                service = self.ingestion_services[network]
                summary = service.ingest_wallet_data(wallet_address, days_back, full_history)
                logger.info(f"[{network}] ✓ Ingestion completed: {summary.total_transactions} txs, {summary.total_protocol_events} events")
                return network, summary
            except Exception as e:
                logger.error(f"[{network}] ✗ Ingestion failed: {e}")
                return network, None
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(ingest_network, net): net 
                for net in networks
            }
            
            for future in as_completed(futures):
                network, summary = future.result()
                if summary:
                    results[network] = summary
        
        return results
    
    def _ingest_sequential(
        self,
        wallet_address: str,
        networks: List[str],
        days_back: Optional[int],
        full_history: bool
    ) -> Dict[str, IngestionSummary]:
        """Execute ingestions sequentially"""
        results = {}
        
        for i, network in enumerate(networks, 1):
            try:
                logger.info(f"[{network}] ({i}/{len(networks)}) Starting ingestion...")
                service = self.ingestion_services[network]
                summary = service.ingest_wallet_data(wallet_address, days_back, full_history)
                results[network] = summary
                logger.info(f"[{network}] ✓ Completed: {summary.total_transactions} txs, {summary.total_protocol_events} events")
            except Exception as e:
                logger.error(f"[{network}] ✗ Failed: {e}")
        
        return results
    
    def get_protocol_events_all_networks(
        self,
        wallet_address: str,
        days_back: int = 30
    ) -> Dict[str, Any]:
        """
        Get protocol events across all networks
        
        Args:
            wallet_address: Wallet address
            days_back: Days to look back
            
        Returns:
            Aggregated protocol events from all networks
        """
        logger.info(f"Fetching protocol events for {wallet_address} across all networks")
        
        all_events = {}
        
        for network, service in self.ingestion_services.items():
            try:
                window = service.determine_ingestion_window(wallet_address, days_back=days_back)
                events = service.fetch_protocol_events(wallet_address, window)
                
                if events:
                    all_events[network] = {
                        "network": self.multi_client.NETWORK_INFO[network]["name"],
                        "chain_id": self.multi_client.NETWORK_INFO[network]["chain_id"],
                        "event_count": len(events),
                        "events": [e.dict() for e in events]
                    }
            except Exception as e:
                logger.error(f"Failed to fetch events from {network}: {e}")
        
        total_events = sum(data["event_count"] for data in all_events.values())
        
        return {
            "wallet_address": wallet_address.lower(),
            "networks_with_events": len(all_events),
            "total_events": total_events,
            "networks": all_events,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _summary_to_dict(self, summary: IngestionSummary) -> Dict[str, Any]:
        """Convert IngestionSummary to dict"""
        if not summary:
            return {"status": "failed"}
        
        return {
            "status": summary.status,
            "total_transactions": summary.total_transactions,
            "total_protocol_events": summary.total_protocol_events,
            "balance_snapshots": summary.balance_snapshots,
            "started_at": summary.ingestion_started_at.isoformat(),
            "completed_at": summary.ingestion_completed_at.isoformat(),
            "errors": summary.errors
        }
    
    def get_network_summary(self) -> Dict[str, Any]:
        """Get summary of all network connections"""
        return self.multi_client.get_connection_summary()
