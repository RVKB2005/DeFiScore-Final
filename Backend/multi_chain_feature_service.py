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
from price_oracle_service import price_oracle

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
                error_msg = f"No ingestion service configured for network: {network}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # Get network info
            network_info = self.ingestion_service.multi_client.NETWORK_INFO.get(network)
            if not network_info:
                error_msg = f"Network not supported: {network}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            chain_id = network_info["chain_id"]
            
            # Fetch wallet metadata
            metadata = ingestion_svc.fetch_wallet_metadata(wallet_address)
            
            # Determine ingestion window
            window = ingestion_svc.determine_ingestion_window(wallet_address, days_back=window_days)
            
            # Fetch data
            transactions = ingestion_svc.fetch_transaction_history(wallet_address, window)
            protocol_events = ingestion_svc.fetch_protocol_events(wallet_address, window)
            snapshots = ingestion_svc.create_balance_snapshots(wallet_address, window, transactions, snapshot_count=30)
            
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
            error_str = str(e)
            if "extraData" in error_str and "POA" in error_str:
                logger.error(f"POA chain configuration error for {network}: {e}")
                logger.error("Please ensure POA middleware is properly configured for this network")
            else:
                logger.error(f"Feature extraction failed for {network}: {e}", exc_info=True)
            raise RuntimeError(f"Feature extraction failed for {network}: {e}") from e
    
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
        logger.info(f"========== MULTI-CHAIN FEATURE EXTRACTION STARTED ==========")
        logger.info(f"Wallet: {wallet_address}")
        logger.info(f"Window: {window_days} days, Parallel: {parallel}")
        start_time = datetime.utcnow()
        
        # Get active networks
        logger.info(f"Checking active networks...")
        active_networks = self.ingestion_service.multi_client.get_active_networks(wallet_address)
        logger.info(f"✓ Wallet active on {len(active_networks)} networks: {active_networks}")
        
        # Extract features per network
        network_features = {}
        
        if parallel and len(active_networks) > 1:
            logger.info(f"Starting PARALLEL feature extraction across {len(active_networks)} networks...")
            network_features = self._extract_parallel(wallet_address, active_networks, window_days)
        else:
            logger.info(f"Starting SEQUENTIAL feature extraction across {len(active_networks)} networks...")
            network_features = self._extract_sequential(wallet_address, active_networks, window_days)
        
        logger.info(f"✓ Feature extraction completed for {len(network_features)} networks")
        
        # Aggregate features
        logger.info(f"Aggregating features across networks...")
        aggregated = self._aggregate_features(wallet_address, network_features)
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"========== MULTI-CHAIN FEATURE EXTRACTION COMPLETED ==========")
        logger.info(f"Duration: {duration:.2f}s")
        logger.info(f"Total transactions: {aggregated.total_transactions_all_chains}")
        logger.info(f"Total protocol interactions: {aggregated.total_protocol_interactions}")
        logger.info(f"Overall classification: {aggregated.overall_classification.dict()}")
        
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
                logger.info(f"[{network}] Starting feature extraction...")
                features = self.extract_features_single_network(wallet_address, network, window_days)
                logger.info(f"[{network}] ✓ Features extracted: {features.activity.total_transactions} txs, {features.protocol.total_protocol_events} events")
                return network, features
            except Exception as e:
                logger.error(f"[{network}] ✗ Feature extraction failed: {e}")
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
        
        for i, network in enumerate(networks, 1):
            try:
                logger.info(f"[{network}] ({i}/{len(networks)}) Starting feature extraction...")
                features = self.extract_features_single_network(wallet_address, network, window_days)
                if features:
                    results[network] = features
                    logger.info(f"[{network}] ✓ Completed: {features.activity.total_transactions} txs, {features.protocol.total_protocol_events} events")
            except Exception as e:
                logger.error(f"[{network}] ✗ Failed: {e}")
        
        return results
    
    def _aggregate_features(
        self,
        wallet_address: str,
        network_features: Dict[str, FeatureVector]
    ) -> MultiChainFeatureVector:
        """Aggregate features across networks"""
        
        # Aggregate totals
        total_transactions = sum(f.activity.total_transactions for f in network_features.values())
        total_value_usd = self._calculate_total_value_usd(network_features)
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

    def _calculate_total_value_usd(self, network_features: Dict[str, FeatureVector]) -> float:
        """
        Calculate total portfolio value in USD across all networks
        
        Uses price oracle to convert native token balances to USD
        
        Args:
            network_features: Dictionary of network -> FeatureVector
            
        Returns:
            Total value in USD
        """
        total_usd = 0.0
        
        # Network to native token mapping
        network_tokens = {
            "ethereum": "ETH",
            "polygon": "MATIC",
            "arbitrum": "ETH",
            "optimism": "ETH",
            "base": "ETH",
            "zksync": "ETH",
            "scroll": "ETH",
            "linea": "ETH",
            "blast": "ETH",
            "mantle": "MNT",
            "metis": "METIS",
            "mode": "ETH",
            "bnb": "BNB",
            "opbnb": "BNB",
            "avalanche": "AVAX",
            "fantom": "FTM",
            "gnosis": "xDAI",
            "moonbeam": "GLMR",
            "moonriver": "MOVR",
            "astar": "ASTR",
            "cronos": "CRO",
            "kava": "KAVA",
            "fuse": "FUSE",
            "harmony": "ONE",
            "aurora": "ETH",
            "celo": "CELO",
            "boba": "ETH",
            "zora": "ETH",
            "worldchain": "WLD",
            "unichain": "UNI",
            "shape": "ETH",
            "ink": "ETH",
            "soneium": "ETH",
            "story": "IP",
            "animechain": "ANIME",
            "degen": "DEGEN",
            "ronin": "RON",
            "frax": "FRAX",
            "hyperliquid": "HYPE",
            "berachain": "BERA",
            "monad": "MONAD",
        }
        
        try:
            # Collect all unique tokens
            tokens_to_fetch = set()
            network_balances = {}
            
            for network, features in network_features.items():
                token = network_tokens.get(network, "ETH")
                balance = features.financial.current_balance_eth
                
                if balance > 0:
                    tokens_to_fetch.add(token)
                    if token not in network_balances:
                        network_balances[token] = 0.0
                    network_balances[token] += balance
            
            if not tokens_to_fetch:
                return 0.0
            
            # Fetch prices in batch
            logger.info(f"Fetching prices for {len(tokens_to_fetch)} tokens...")
            prices = price_oracle.get_prices_batch(list(tokens_to_fetch))
            
            # Calculate total USD value
            for token, balance in network_balances.items():
                price = prices.get(token)
                if price:
                    usd_value = balance * price
                    total_usd += usd_value
                    logger.debug(f"{token}: {balance:.4f} × ${price:.2f} = ${usd_value:.2f}")
                else:
                    logger.warning(f"No price found for {token}, skipping")
            
            logger.info(f"Total portfolio value: ${total_usd:,.2f} USD")
            return round(total_usd, 2)
            
        except Exception as e:
            logger.error(f"Failed to calculate USD value: {e}")
            # Return 0 on error, don't fail the entire feature extraction
            return 0.0
