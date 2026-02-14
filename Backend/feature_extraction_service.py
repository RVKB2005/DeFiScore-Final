"""
Feature Extraction Service
Converts raw blockchain data into behavioral features
"""
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging
import statistics
from data_ingestion_models import (
    WalletMetadata,
    TransactionRecord,
    ProtocolEvent,
    BalanceSnapshot,
    IngestionWindow
)
from feature_extraction_models import (
    AnalysisWindow,
    ActivityFeatures,
    FinancialFeatures,
    ProtocolInteractionFeatures,
    RiskFeatures,
    TemporalFeatures,
    BehavioralClassification,
    FeatureVector,
    FeatureExtractionSummary
)

logger = logging.getLogger(__name__)


class FeatureExtractionService:
    """
    Service for extracting behavioral features from raw blockchain data
    Implements deterministic, rule-based feature engineering
    """
    
    def __init__(self):
        self.feature_version = "1.0.0"
    
    def create_analysis_window(
        self,
        name: str,
        days: Optional[int],
        end_timestamp: Optional[datetime] = None
    ) -> AnalysisWindow:
        """Create analysis window"""
        if end_timestamp is None:
            end_timestamp = datetime.now(timezone.utc)
        
        if days is None:
            # Lifetime window
            start_timestamp = datetime(2015, 7, 30, tzinfo=timezone.utc)  # Ethereum genesis
        else:
            start_timestamp = end_timestamp - timedelta(days=days)
        
        return AnalysisWindow(
            name=name,
            days=days,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp
        )
    
    def extract_activity_features(
        self,
        transactions: List[TransactionRecord],
        window: AnalysisWindow,
        wallet_metadata: WalletMetadata
    ) -> ActivityFeatures:
        """Extract activity-based features"""
        
        total_transactions = len(transactions)
        
        if total_transactions == 0:
            return ActivityFeatures(
                total_transactions=wallet_metadata.transaction_count,
                transactions_per_day=0.0,
                active_days=0,
                total_days=0,
                active_days_ratio=0.0,
                longest_inactivity_gap_days=0,
                recent_activity_days=0
            )
        
        # Calculate time span
        total_days = (window.end_timestamp - window.start_timestamp).days
        if total_days == 0:
            total_days = 1
        
        # Extract transaction dates
        tx_dates = set()
        for tx in transactions:
            if tx.timestamp:
                tx_dates.add(tx.timestamp.date())
        
        active_days = len(tx_dates)
        active_days_ratio = active_days / total_days if total_days > 0 else 0.0
        
        # Calculate inactivity gaps
        sorted_dates = sorted(tx_dates)
        max_gap = 0
        if len(sorted_dates) > 1:
            for i in range(1, len(sorted_dates)):
                gap = (sorted_dates[i] - sorted_dates[i-1]).days
                max_gap = max(max_gap, gap)
        
        # Days since last activity
        if sorted_dates:
            last_activity = sorted_dates[-1]
            days_since = (window.end_timestamp.date() - last_activity).days
        else:
            days_since = total_days
        
        # Transactions per day
        tx_per_day = total_transactions / total_days if total_days > 0 else 0.0
        
        return ActivityFeatures(
            total_transactions=total_transactions,
            transactions_per_day=round(tx_per_day, 4),
            active_days=active_days,
            total_days=total_days,
            active_days_ratio=round(active_days_ratio, 4),
            longest_inactivity_gap_days=max_gap,
            recent_activity_days=days_since
        )
    
    def extract_financial_features(
        self,
        transactions: List[TransactionRecord],
        snapshots: List[BalanceSnapshot],
        wallet_metadata: WalletMetadata
    ) -> FinancialFeatures:
        """Extract financial behavior features"""
        
        # Total value transferred
        total_value = sum(tx.value_eth for tx in transactions if tx.value_eth)
        
        # Average transaction value
        avg_value = total_value / len(transactions) if transactions else 0.0
        
        # Balance analysis from snapshots
        balances = [s.balance_eth for s in snapshots if s.balance_eth is not None]
        
        if balances:
            max_balance = max(balances)
            min_balance = min(balances)
            
            # Calculate volatility (standard deviation)
            if len(balances) > 1:
                volatility = statistics.stdev(balances)
            else:
                volatility = 0.0
            
            # Detect sudden drops (>50% decrease)
            sudden_drops = 0
            for i in range(1, len(balances)):
                if balances[i-1] > 0:
                    drop_ratio = (balances[i-1] - balances[i]) / balances[i-1]
                    if drop_ratio > 0.5:
                        sudden_drops += 1
        else:
            max_balance = wallet_metadata.current_balance_eth
            min_balance = wallet_metadata.current_balance_eth
            volatility = 0.0
            sudden_drops = 0
        
        return FinancialFeatures(
            total_value_transferred_eth=round(total_value, 6),
            average_transaction_value_eth=round(avg_value, 6),
            current_balance_eth=round(wallet_metadata.current_balance_eth, 6),
            max_balance_eth=round(max_balance, 6),
            min_balance_eth=round(min_balance, 6),
            balance_volatility=round(volatility, 6),
            sudden_drops_count=sudden_drops
        )
    
    def extract_protocol_features(
        self,
        protocol_events: List[ProtocolEvent]
    ) -> ProtocolInteractionFeatures:
        """Extract DeFi protocol interaction features"""
        
        borrow_events = [e for e in protocol_events if e.event_type == "borrow"]
        repay_events = [e for e in protocol_events if e.event_type == "repay"]
        deposit_events = [e for e in protocol_events if e.event_type == "deposit"]
        withdraw_events = [e for e in protocol_events if e.event_type == "withdraw"]
        liquidation_events = [e for e in protocol_events if e.event_type == "liquidation"]
        
        borrow_count = len(borrow_events)
        repay_count = len(repay_events)
        
        # Repay to borrow ratio
        repay_ratio = repay_count / borrow_count if borrow_count > 0 else 0.0
        
        # Average borrow duration (simplified - would need matching borrow/repay pairs)
        avg_duration = 0.0
        if borrow_events and repay_events:
            # Simplified: average time between first borrow and last repay
            borrow_times = [e.timestamp for e in borrow_events if e.timestamp]
            repay_times = [e.timestamp for e in repay_events if e.timestamp]
            
            if borrow_times and repay_times:
                first_borrow = min(borrow_times)
                last_repay = max(repay_times)
                duration = (last_repay - first_borrow).days
                avg_duration = duration / borrow_count if borrow_count > 0 else 0.0
        
        return ProtocolInteractionFeatures(
            total_protocol_events=len(protocol_events),
            borrow_count=borrow_count,
            repay_count=repay_count,
            deposit_count=len(deposit_events),
            withdraw_count=len(withdraw_events),
            liquidation_count=len(liquidation_events),
            repay_to_borrow_ratio=round(repay_ratio, 4),
            average_borrow_duration_days=round(avg_duration, 2)
        )
    
    def extract_risk_features(
        self,
        transactions: List[TransactionRecord],
        protocol_events: List[ProtocolEvent],
        snapshots: List[BalanceSnapshot]
    ) -> RiskFeatures:
        """Extract risk indicator features"""
        
        # Failed transactions
        failed_txs = [tx for tx in transactions if not tx.success]
        failed_count = len(failed_txs)
        failed_ratio = failed_count / len(transactions) if transactions else 0.0
        
        # Liquidations
        liquidations = [e for e in protocol_events if e.event_type == "liquidation"]
        
        # High gas spikes (simplified - would need gas price analysis)
        high_gas_spikes = 0
        
        # Zero balance periods
        zero_balance_count = 0
        if snapshots:
            for snapshot in snapshots:
                if snapshot.balance_eth == 0:
                    zero_balance_count += 1
        
        return RiskFeatures(
            failed_transaction_count=failed_count,
            failed_transaction_ratio=round(failed_ratio, 4),
            liquidation_count=len(liquidations),
            high_gas_spike_count=high_gas_spikes,
            zero_balance_periods=zero_balance_count
        )
    
    def extract_temporal_features(
        self,
        transactions: List[TransactionRecord],
        wallet_metadata: WalletMetadata,
        window: AnalysisWindow
    ) -> TemporalFeatures:
        """Extract temporal consistency features"""
        
        # Wallet age
        wallet_age = (window.end_timestamp - wallet_metadata.first_seen_timestamp).days
        
        # Days since last activity
        if transactions:
            tx_times = [tx.timestamp for tx in transactions if tx.timestamp]
            if tx_times:
                last_activity = max(tx_times)
                days_since = (window.end_timestamp - last_activity).days
            else:
                days_since = wallet_age
        else:
            days_since = wallet_age
        
        # Transaction regularity (coefficient of variation of inter-transaction times)
        regularity_score = 0.0
        if len(transactions) > 2:
            tx_times = sorted([tx.timestamp for tx in transactions if tx.timestamp])
            intervals = [(tx_times[i] - tx_times[i-1]).total_seconds() for i in range(1, len(tx_times))]
            
            if intervals:
                mean_interval = statistics.mean(intervals)
                if mean_interval > 0 and len(intervals) > 1:
                    std_interval = statistics.stdev(intervals)
                    cv = std_interval / mean_interval
                    # Convert to 0-1 score (lower CV = higher regularity)
                    regularity_score = 1.0 / (1.0 + cv)
        
        # Burst activity ratio (transactions in top 10% active days / total)
        burst_ratio = 0.0
        if transactions:
            # Group by day
            daily_counts = {}
            for tx in transactions:
                if tx.timestamp:
                    day = tx.timestamp.date()
                    daily_counts[day] = daily_counts.get(day, 0) + 1
            
            if daily_counts:
                sorted_counts = sorted(daily_counts.values(), reverse=True)
                top_10_percent = max(1, len(sorted_counts) // 10)
                burst_txs = sum(sorted_counts[:top_10_percent])
                burst_ratio = burst_txs / len(transactions)
        
        return TemporalFeatures(
            wallet_age_days=wallet_age,
            transaction_regularity_score=round(regularity_score, 4),
            burst_activity_ratio=round(burst_ratio, 4),
            days_since_last_activity=days_since
        )
    
    def classify_behavior(
        self,
        activity: ActivityFeatures,
        financial: FinancialFeatures,
        protocol: ProtocolInteractionFeatures,
        risk: RiskFeatures,
        temporal: TemporalFeatures
    ) -> BehavioralClassification:
        """Classify wallet behavior into categories"""
        
        # Longevity classification
        if temporal.wallet_age_days < 30:
            longevity = "new"
        elif temporal.wallet_age_days < 180:
            longevity = "established"
        else:
            longevity = "veteran"
        
        # Activity classification
        if activity.transactions_per_day == 0:
            activity_class = "dormant"
        elif activity.transactions_per_day < 0.1:
            activity_class = "occasional"
        elif activity.transactions_per_day < 1.0:
            activity_class = "active"
        else:
            activity_class = "hyperactive"
        
        # Capital classification
        balance = financial.current_balance_eth
        if balance < 0.01:
            capital_class = "micro"
        elif balance < 0.1:
            capital_class = "small"
        elif balance < 1.0:
            capital_class = "medium"
        elif balance < 10.0:
            capital_class = "large"
        else:
            capital_class = "whale"
        
        # Credit behavior classification
        if protocol.total_protocol_events == 0:
            credit_class = "no_history"
        elif protocol.liquidation_count > 0:
            credit_class = "defaulter"
        elif protocol.repay_to_borrow_ratio < 0.5:
            credit_class = "risky"
        else:
            credit_class = "responsible"
        
        # Risk classification
        risk_score = 0
        if risk.liquidation_count > 0:
            risk_score += 3
        if risk.failed_transaction_ratio > 0.1:
            risk_score += 2
        if financial.sudden_drops_count > 2:
            risk_score += 1
        if risk.zero_balance_periods > 3:
            risk_score += 1
        
        if risk_score == 0:
            risk_class = "low"
        elif risk_score <= 2:
            risk_class = "medium"
        elif risk_score <= 4:
            risk_class = "high"
        else:
            risk_class = "critical"
        
        return BehavioralClassification(
            longevity_class=longevity,
            activity_class=activity_class,
            capital_class=capital_class,
            credit_behavior_class=credit_class,
            risk_class=risk_class
        )
    
    def extract_features(
        self,
        wallet_address: str,
        network: str,
        chain_id: int,
        wallet_metadata: WalletMetadata,
        transactions: List[TransactionRecord],
        protocol_events: List[ProtocolEvent],
        snapshots: List[BalanceSnapshot],
        window_days: Optional[int] = 90
    ) -> FeatureVector:
        """
        Extract complete feature vector from raw data
        
        This is the main entry point for feature extraction
        """
        start_time = datetime.utcnow()
        
        try:
            # Create analysis window
            window_name = f"{window_days}d" if window_days else "lifetime"
            analysis_window = self.create_analysis_window(window_name, window_days)
            
            # Extract feature groups
            activity = self.extract_activity_features(transactions, analysis_window, wallet_metadata)
            financial = self.extract_financial_features(transactions, snapshots, wallet_metadata)
            protocol = self.extract_protocol_features(protocol_events)
            risk = self.extract_risk_features(transactions, protocol_events, snapshots)
            temporal = self.extract_temporal_features(transactions, wallet_metadata, analysis_window)
            
            # Classify behavior
            classification = self.classify_behavior(activity, financial, protocol, risk, temporal)
            
            # Create feature vector
            feature_vector = FeatureVector(
                wallet_address=wallet_address.lower(),
                network=network,
                chain_id=chain_id,
                analysis_window=analysis_window,
                activity=activity,
                financial=financial,
                protocol=protocol,
                risk=risk,
                temporal=temporal,
                classification=classification,
                extracted_at=datetime.utcnow(),
                feature_version=self.feature_version
            )
            
            logger.info(f"Feature extraction completed for {wallet_address} on {network}")
            return feature_vector
            
        except Exception as e:
            logger.error(f"Feature extraction failed: {e}")
            raise
