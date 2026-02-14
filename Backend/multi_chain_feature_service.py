"""
Multi-Chain Feature Extraction Service
Aggregates features across multiple blockchain networks
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from feature_extraction_service import FeatureExtractionService
from feature_extraction_models import (
    FeatureVector,
    MultiChainFeatureVector,
    BehavioralClassification
)
from multi_chain_ingestion_service import MultiChainIngestionService
from data_ingestion_service import DataIngestionService

logger = logging.getLogger(__name__)


class MultiChainFeatureService:
    """
    Service for extracting and aggregating features across multiple chains
    """
    
    def __init__(self, networks: Optional[List[str]] = None, mainnet_only: bool = True):
        """
        Initialize multi-chain feature service
        
        Args:
            networks: List of specific networks (None = all)
            mainnet_only: Only use mainnet networks
        """
        self.ingestion_service = MultiChainIngestionService(networks=networks, mainnet_only=mainnet_only)
        self.feature_service = FeatureExtractionService()
        
        logger.info(f"Multi-chain feature service initialized with {len(self.ingestion_service.ingestion_services)} networks")
    
    def extract_features_single_network(
        self,
        wallet_address: str,
        network: str,
        window_days: Optional[int] = 90
    ) -> Optional[FeatureVector]:
        """
        Extract features for a wallet on a single network
        
        Args:
            wallet_address: Wallet address
            network: Network name
            window_days: Analysis window in days
            
        Returns:
            FeatureVector or None if extraction fails
        """
        try:
            # Get ingestion service for network
            ingestion_svc = self.ingestion_service.ingestion_services.get(network)
            if not ingestion_svc:
                logger.error(f"No ingestion service for network: {network}")
                return None
            
            # Get network info
            network_info = self.ingestion_service.multi_client.NETWORK_INFO.get(network)
            if not network_info:
                logger.error(f"No network info for: {network}")
                return None
            
            chain_id = network_info["chain_id"]
            
            # Fetch wallet metadata
            metadata = ingestion_svc.fetch_wallet_metadata(wallet_address)
            
            # Determine ingestion window
            window = ingestion_svc.determine_ingestion_window(wallet_address, days_back=window_days)
            
            # Fetch data
            transactions = ingestion_svc.fetch_transaction_history(wallet_address, window)
            protocol_events = ingestion_svc.fetch_protocol_events(wallet_address, window)
            snapshots = ingestion_svc.create_balance_snapshots(wallet_address, window, snapshot_count=10)
            
            # Extract features
            features = self.feature_service.extract_features(
                wallet_address=wallet_address,
                network=network,
                chain_id=chain_id,
                wallet_metadata=metadata,
                transactions=transactions,
                protocol_events=protocol_events,
                snapshots=snapshots,
                window_days=window_days
            )
            
            return features
            
        except Exception as e:
            # Silently handle POA chain errors
            error_str = str(e)
            if "extraData" in error_str and "POA" in error_str:
                # POA chain error - already handled with middleware
                pass
            else:
                logger.error(f"Feature extraction failed for {network}: {e}")
            return None
    
    def extract_features_all_networks(
        self,
        wallet_address: str,
        window_days: Optional[int] = 90,
        parallel: bool = True
    ) -> MultiChainFeatureVector:
        """
        Extract features across all networks
        
        Args:
            wallet_address: Wallet address
            window_days: Analysis window in days
            parallel: Execute in parallel
            
        Returns:
            MultiChainFeatureVector with aggregated features
        """
        logger.info(f"Extracting features for {wallet_address} across all networks")
        start_time = datetime.utcnow()
        
        # Get active networks
        active_networks = self.ingestion_service.multi_client.get_active_networks(wallet_address)
        logger.info(f"Wallet active on {len(active_networks)} networks")
        
        # Extract features per network
        network_features = {}
        
        if parallel and len(active_networks) > 1:
            network_features = self._extract_parallel(wallet_address, active_networks, window_days)
        else:
            network_features = self._extract_sequential(wallet_address, active_networks, window_days)
        
        # Aggregate features
        aggregated = self._aggregate_features(wallet_address, network_features)
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"Multi-chain feature extraction completed in {duration:.2f}s")
        
        return aggregated
    
    def _extract_parallel(
        self,
        wallet_address: str,
        networks: List[str],
        window_days: Optional[int]
    ) -> Dict[str, FeatureVector]:
        """Extract features in parallel"""
        results = {}
        
        def extract_network(network: str):
            try:
                features = self.extract_features_single_network(wallet_address, network, window_days)
                return network, features
            except Exception as e:
                logger.error(f"Parallel extraction failed for {network}: {e}")
                return network, None
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(extract_network, net): net 
                for net in networks
            }
            
            for future in as_completed(futures):
                network, features = future.result()
                if features:
                    results[network] = features
        
        return results
    
    def _extract_sequential(
        self,
        wallet_address: str,
        networks: List[str],
        window_days: Optional[int]
    ) -> Dict[str, FeatureVector]:
        """Extract features sequentially"""
        results = {}
        
        for network in networks:
            try:
                features = self.extract_features_single_network(wallet_address, network, window_days)
                if features:
                    results[network] = features
                    logger.info(f"✓ Extracted features for {network}")
            except Exception as e:
                logger.error(f"✗ Feature extraction failed for {network}: {e}")
        
        return results
    
    def _aggregate_features(
        self,
        wallet_address: str,
        network_features: Dict[str, FeatureVector]
    ) -> MultiChainFeatureVector:
        """Aggregate features across networks"""
        
        # Aggregate totals
        total_transactions = sum(f.activity.total_transactions for f in network_features.values())
        total_value_usd = 0.0  # Would need price conversion
        active_networks = len(network_features)
        total_protocol_interactions = sum(f.protocol.total_protocol_events for f in network_features.values())
        total_liquidations = sum(f.protocol.liquidation_count for f in network_features.values())
        
        # Determine overall classification
        # Use most conservative classification across networks
        longevity_scores = {"new": 0, "established": 1, "veteran": 2}
        activity_scores = {"dormant": 0, "occasional": 1, "active": 2, "hyperactive": 3}
        risk_scores = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        
        longevities = [f.classification.longevity_class for f in network_features.values()]
        activities = [f.classification.activity_class for f in network_features.values()]
        risks = [f.classification.risk_class for f in network_features.values()]
        
        # Take most mature longevity
        overall_longevity = max(longevities, key=lambda x: longevity_scores.get(x, 0)) if longevities else "unknown"
        
        # Take highest activity
        overall_activity = max(activities, key=lambda x: activity_scores.get(x, 0)) if activities else "unknown"
        
        # Take highest risk
        overall_risk = max(risks, key=lambda x: risk_scores.get(x, 0)) if risks else "unknown"
        
        # Credit behavior - if any network shows defaulter, mark as defaulter
        credit_behaviors = [f.classification.credit_behavior_class for f in network_features.values()]
        if "defaulter" in credit_behaviors:
            overall_credit = "defaulter"
        elif "risky" in credit_behaviors:
            overall_credit = "risky"
        elif "responsible" in credit_behaviors:
            overall_credit = "responsible"
        else:
            overall_credit = "no_history"
        
        # Capital class - use highest
        capital_scores = {"micro": 0, "small": 1, "medium": 2, "large": 3, "whale": 4}
        capitals = [f.classification.capital_class for f in network_features.values()]
        overall_capital = max(capitals, key=lambda x: capital_scores.get(x, 0)) if capitals else "unknown"
        
        overall_classification = BehavioralClassification(
            longevity_class=overall_longevity,
            activity_class=overall_activity,
            capital_class=overall_capital,
            credit_behavior_class=overall_credit,
            risk_class=overall_risk
        )
        
        return MultiChainFeatureVector(
            wallet_address=wallet_address.lower(),
            networks_analyzed=list(network_features.keys()),
            total_networks=len(network_features),
            total_transactions_all_chains=total_transactions,
            total_value_transferred_usd=total_value_usd,
            active_networks_count=active_networks,
            total_protocol_interactions=total_protocol_interactions,
            total_liquidations=total_liquidations,
            network_features=network_features,
            overall_classification=overall_classification,
            extracted_at=datetime.utcnow()
        )
    
    def get_feature_summary(
        self,
        wallet_address: str,
        window_days: Optional[int] = 90
    ) -> Dict[str, Any]:
        """
        Get simplified feature summary across all networks
        
        Args:
            wallet_address: Wallet address
            window_days: Analysis window
            
        Returns:
            Simplified feature summary
        """
        try:
            multi_features = self.extract_features_all_networks(wallet_address, window_days, parallel=True)
            
            return {
                "wallet_address": wallet_address,
                "networks_analyzed": multi_features.total_networks,
                "active_networks": multi_features.active_networks_count,
                "total_transactions": multi_features.total_transactions_all_chains,
                "total_protocol_interactions": multi_features.total_protocol_interactions,
                "total_liquidations": multi_features.total_liquidations,
                "classification": {
                    "longevity": multi_features.overall_classification.longevity_class,
                    "activity": multi_features.overall_classification.activity_class,
                    "capital": multi_features.overall_classification.capital_class,
                    "credit_behavior": multi_features.overall_classification.credit_behavior_class,
                    "risk": multi_features.overall_classification.risk_class
                },
                "extracted_at": multi_features.extracted_at.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get feature summary: {e}")
            raise
