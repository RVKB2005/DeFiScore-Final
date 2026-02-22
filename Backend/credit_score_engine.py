"""
Credit Score Engine - Production Implementation
Deterministic, explainable, conservative scoring based on FICO methodology
"""
from typing import Dict, Any
from datetime import datetime, timezone
import logging
from feature_extraction_models import FeatureVector
from credit_score_models import CreditScoreBreakdown, CreditScoreResult
import credit_score_config as config

logger = logging.getLogger(__name__)


class CreditScoreEngine:
    """
    Production-grade credit scoring engine
    
    Design Principles:
    1. Deterministic: Same input always produces same output
    2. Explainable: Every score component is traceable
    3. Conservative: Penalizes risk more than rewarding activity
    4. Sybil-resistant: Expensive to game with multiple wallets
    5. Upgradeable: Weights can evolve without code changes
    """
    
    def __init__(self):
        self.version = "1.0.0"
        self.score_min = config.SCORE_MIN
        self.score_max = config.SCORE_MAX
        self.base_score = config.BASE_SCORE
    
    def calculate_score(self, features: FeatureVector) -> CreditScoreResult:
        """
        Calculate credit score from feature vector
        
        Args:
            features: Extracted feature vector
            
        Returns:
            CreditScoreResult with score and breakdown
        """
        try:
            # Calculate positive contributions
            repayment_score = self._calculate_repayment_score(features)
            capital_score = self._calculate_capital_score(features)
            longevity_score = self._calculate_longevity_score(features)
            activity_score = self._calculate_activity_score(features)
            protocol_score = self._calculate_protocol_score(features)
            
            # Calculate risk penalties
            risk_penalties = self._calculate_risk_penalties(features)
            
            # Aggregate raw score
            raw_score = (
                self.base_score +
                repayment_score +
                capital_score +
                longevity_score +
                activity_score +
                protocol_score +
                risk_penalties
            )
            
            # Normalize to score range
            final_score = self._normalize_score(raw_score)
            
            # Get score band
            score_band = self._get_score_band(final_score)
            
            # Create breakdown
            breakdown = CreditScoreBreakdown(
                repayment_behavior=round(repayment_score, 2),
                capital_management=round(capital_score, 2),
                wallet_longevity=round(longevity_score, 2),
                activity_patterns=round(activity_score, 2),
                protocol_diversity=round(protocol_score, 2),
                risk_penalties=round(risk_penalties, 2)
            )
            
            result = CreditScoreResult(
                credit_score=final_score,
                score_band=score_band,
                breakdown=breakdown,
                raw_score=round(raw_score, 2),
                timestamp=datetime.now(timezone.utc),
                feature_version=features.feature_version,
                engine_version=self.version
            )
            
            logger.info(f"Credit score calculated: {final_score} ({score_band}) for {features.wallet_address}")
            return result
            
        except Exception as e:
            logger.error(f"Credit score calculation failed: {e}")
            raise
    
    def _calculate_repayment_score(self, features: FeatureVector) -> float:
        """
        Calculate repayment behavior score (35% weight - highest)
        
        Based on:
        - Repay-to-borrow ratio (25%)
        - No liquidations bonus (10%)
        """
        score = 0.0
        
        # Repay-to-borrow ratio (25% of total score = 150 points max)
        if features.protocol.borrow_count > 0:
            ratio = features.protocol.repay_to_borrow_ratio
            scaled_ratio = config.scale_repay_ratio(ratio)
            score += scaled_ratio * 150  # 25% of 600 point range
            
            logger.debug(f"Repay ratio: {ratio:.2f}, scaled: {scaled_ratio:.2f}, score: {scaled_ratio * 150:.2f}")
        
        # No liquidations bonus (10% of total score = 60 points)
        if features.protocol.liquidation_count == 0 and features.protocol.borrow_count > 0:
            score += 60
            logger.debug("No liquidations bonus: +60")
        
        return score
    
    def _calculate_capital_score(self, features: FeatureVector) -> float:
        """
        Calculate capital management score (30% weight)
        
        Based on:
        - Current balance (15%)
        - Balance stability (10%)
        - Max balance history (5%)
        """
        score = 0.0
        
        # Current balance (15% of total = 90 points max)
        balance = features.financial.current_balance_eth
        scaled_balance = config.scale_balance(balance)
        score += scaled_balance * 90
        logger.debug(f"Current balance: {balance:.4f} ETH, scaled: {scaled_balance:.2f}, score: {scaled_balance * 90:.2f}")
        
        # Balance stability (10% of total = 60 points max)
        # Lower volatility = higher score
        volatility = features.financial.balance_volatility
        if volatility < config.HIGH_VOLATILITY_THRESHOLD:
            stability_score = (1.0 - (volatility / config.HIGH_VOLATILITY_THRESHOLD)) * 60
            score += stability_score
            logger.debug(f"Balance volatility: {volatility:.4f}, stability score: {stability_score:.2f}")
        
        # Max balance history (5% of total = 30 points max)
        max_balance = features.financial.max_balance_eth
        scaled_max = config.scale_balance(max_balance)
        score += scaled_max * 30
        logger.debug(f"Max balance: {max_balance:.4f} ETH, score: {scaled_max * 30:.2f}")
        
        return score
    
    def _calculate_longevity_score(self, features: FeatureVector) -> float:
        """
        Calculate wallet longevity score (15% weight)
        
        Based on:
        - Wallet age (10%)
        - Active days ratio (5%)
        """
        score = 0.0
        
        # Wallet age (10% of total = 60 points max)
        age_days = features.temporal.wallet_age_days
        scaled_age = config.scale_wallet_age(age_days)
        score += scaled_age * 60
        logger.debug(f"Wallet age: {age_days} days, scaled: {scaled_age:.2f}, score: {scaled_age * 60:.2f}")
        
        # Active days ratio (5% of total = 30 points max)
        active_ratio = features.activity.active_days_ratio
        score += active_ratio * 30
        logger.debug(f"Active days ratio: {active_ratio:.2f}, score: {active_ratio * 30:.2f}")
        
        return score
    
    def _calculate_activity_score(self, features: FeatureVector) -> float:
        """
        Calculate activity patterns score (10% weight)
        
        Based on:
        - Transaction frequency (5%)
        - Transaction regularity (5%)
        """
        score = 0.0
        
        # Transaction frequency (5% of total = 30 points max)
        tx_count = features.activity.total_transactions
        scaled_tx = config.scale_transaction_count(tx_count)
        score += scaled_tx * 30
        logger.debug(f"Transaction count: {tx_count}, scaled: {scaled_tx:.2f}, score: {scaled_tx * 30:.2f}")
        
        # Transaction regularity (5% of total = 30 points max)
        regularity = features.temporal.transaction_regularity_score
        score += regularity * 30
        logger.debug(f"Transaction regularity: {regularity:.2f}, score: {regularity * 30:.2f}")
        
        return score
    
    def _calculate_protocol_score(self, features: FeatureVector) -> float:
        """
        Calculate protocol diversity score (10% weight)
        
        Based on:
        - Protocol interaction count (5%)
        - Borrow experience (5%)
        """
        score = 0.0
        
        # Protocol interaction count (5% of total = 30 points max)
        protocol_count = features.protocol.total_protocol_events
        scaled_protocol = config.scale_protocol_count(protocol_count)
        score += scaled_protocol * 30
        logger.debug(f"Protocol events: {protocol_count}, scaled: {scaled_protocol:.2f}, score: {scaled_protocol * 30:.2f}")
        
        # Borrow experience (5% of total = 30 points max)
        if features.protocol.borrow_count > 0:
            # Has borrowing experience
            borrow_score = min(1.0, features.protocol.borrow_count / 10.0) * 30
            score += borrow_score
            logger.debug(f"Borrow count: {features.protocol.borrow_count}, score: {borrow_score:.2f}")
        
        return score
    
    def _calculate_risk_penalties(self, features: FeatureVector) -> float:
        """
        Calculate risk penalties (negative contributions)
        
        Conservative approach: Penalize risky behavior heavily
        """
        penalties = 0.0
        
        # CRITICAL: Liquidation penalties (most severe)
        liquidation_count = features.protocol.liquidation_count
        if liquidation_count > 0:
            penalty = liquidation_count * config.LIQUIDATION_PENALTY
            penalties += penalty
            logger.warning(f"Liquidation penalty: {liquidation_count} liquidations = {penalty} points")
        
        # Failed transaction penalties
        failed_ratio = features.risk.failed_transaction_ratio
        if failed_ratio > 0.05:  # More than 5% failed
            penalty = config.FAILED_TX_PENALTY_BASE * (failed_ratio / 0.05)
            penalties += penalty
            logger.debug(f"Failed tx penalty: {failed_ratio:.2%} failed = {penalty:.2f} points")
        
        # High gas spike penalties (NEW - PRODUCTION)
        gas_spikes = features.risk.high_gas_spike_count
        if gas_spikes > 0:
            penalty = min(gas_spikes * config.GAS_SPIKE_PENALTY, config.MAX_GAS_SPIKE_PENALTY)
            penalties += penalty
            logger.debug(f"Gas spike penalty: {gas_spikes} spikes = {penalty:.2f} points")
        
        # High volatility penalty
        volatility = features.financial.balance_volatility
        if volatility >= config.HIGH_VOLATILITY_THRESHOLD:
            penalties += config.HIGH_VOLATILITY_PENALTY
            logger.debug(f"High volatility penalty: {volatility:.4f} = {config.HIGH_VOLATILITY_PENALTY} points")
        
        # Sudden drop penalties
        sudden_drops = features.financial.sudden_drops_count
        if sudden_drops > 0:
            penalty = sudden_drops * config.SUDDEN_DROP_PENALTY
            penalties += penalty
            logger.debug(f"Sudden drop penalty: {sudden_drops} drops = {penalty} points")
        
        # Dormancy penalty
        days_inactive = features.temporal.days_since_last_activity
        if days_inactive > config.DORMANCY_THRESHOLD_DAYS:
            penalty = config.DORMANCY_PENALTY_BASE * (days_inactive / config.DORMANCY_THRESHOLD_DAYS)
            penalties += penalty
            logger.debug(f"Dormancy penalty: {days_inactive} days inactive = {penalty:.2f} points")
        
        # Zero balance periods penalty
        zero_periods = features.risk.zero_balance_periods
        if zero_periods > 5:
            penalty = (zero_periods - 5) * config.ZERO_BALANCE_PENALTY
            penalties += penalty
            logger.debug(f"Zero balance penalty: {zero_periods} periods = {penalty} points")
        
        # Burst activity penalty (wash trading indicator)
        burst_ratio = features.temporal.burst_activity_ratio
        if burst_ratio > config.BURST_THRESHOLD:
            penalties += config.BURST_ACTIVITY_PENALTY
            logger.debug(f"Burst activity penalty: {burst_ratio:.2%} burst = {config.BURST_ACTIVITY_PENALTY} points")
        
        return penalties
    
    def _normalize_score(self, raw_score: float) -> int:
        """
        Normalize raw score to fixed range [0, 900]
        
        Uses clamping to ensure score stays within bounds
        """
        # Clamp to valid range
        normalized = max(self.score_min, min(self.score_max, raw_score))
        
        # Round to integer
        return int(normalized)
    
    def _get_score_band(self, score: int) -> str:
        """
        Get score band classification
        
        Returns: Poor, Fair, Good, or Excellent
        """
        for band, (min_score, max_score) in config.SCORE_BANDS.items():
            if min_score <= score <= max_score:
                return band
        
        return "Unknown"


# Global engine instance
credit_score_engine = CreditScoreEngine()

