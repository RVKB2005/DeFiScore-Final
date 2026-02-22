"""
Circuit-Compatible Score Engine - PRODUCTION SPECIFICATION

Implements TRUE LOGARITHMIC scaling as per specification.
Matches circuit's LogScale template EXACTLY with piecewise linear approximation.

FORMULA:
Final_Score = CLAMP(Base_Score + Positive_Contributions + Risk_Penalties, 0, 900)

Base_Score = 300
Positive_Contributions = Repayment + Capital + Longevity + Activity + Protocol
Risk_Penalties = Sum of negative adjustments (always ≤ 0)

WEIGHTS (FICO-based):
- Repayment Behavior: 35% = 210 points max
- Capital Management: 30% = 180 points max  
- Wallet Longevity: 15% = 90 points max
- Activity Patterns: 10% = 60 points max
- Protocol Diversity: 10% = 60 points max

LOGARITHMIC SCALING:
- Balance: log(ETH + 1) / log(11) - rewards growth but with diminishing returns
- Age: log(days + 1) / log(731) - 2 years = max score
- Transactions: log(count + 1) / log(1001) - 1000 txs = max score

This provides more accurate credit assessment than linear scaling.
All calculations use integer arithmetic (scaled x1000) to match circuit exactly.
"""
import math
from typing import Dict
from feature_extraction_models import FeatureVector


class CircuitScoreEngine:
    """
    Computes credit scores using EXACT specification formula
    All values scaled by 1000 to match circuit integer arithmetic
    """
    
    SCALE_FACTOR = 1000
    BASE_SCORE = 300000  # 300 * 1000
    
    @staticmethod
    def _log_scale_exact(value: int, base: int) -> int:
        """
        TRUE LOGARITHMIC SCALING - Matches Circuit's LogScale Template
        
        The circuit uses piecewise linear approximation of logarithms.
        This function replicates that EXACTLY.
        
        Formula: log(value + 1) / log(base) * 1000, approximated with piecewise linear
        
        Args:
            value: Input value (raw integer - e.g., 5 for 5 ETH, 450 for 450 days)
            base: Determines the scaling (11 for balance, 731 for age, 1001 for transactions)
        
        Returns:
            Scaled result [0, 1000] representing 0.0 to 1.0
        """
        if value == 0:
            return 0
        
        # Piecewise linear approximation matching circuit EXACTLY
        # These formulas match the circuit's LogScale template
        
        if value <= 10:
            # Range [0, 10]: log(1+x) ≈ 0.693*x
            log_value = (value * 693) // 1000
        elif value <= 100:
            # Range [10, 100]: log(1+x) ≈ 2.398 + 0.0223*(x-10)
            log_value = 2398 + ((value - 10) * 223) // 10000
        elif value <= 1000:
            # Range [100, 1000]: log(1+x) ≈ 4.615 + 0.00246*(x-100)
            log_value = 4615 + ((value - 100) * 246) // 100000
        else:
            # Range [1000+]: log(1+x) ≈ 6.908 + 0.000231*(x-1000)
            log_value = 6908 + ((value - 1000) * 231) // 1000000
        
        # Precomputed log(base) values (scaled x1000)
        if base == 11:
            log_base = 2398  # log(11) ≈ 2.398
        elif base == 731:
            log_base = 6594  # log(731) ≈ 6.594
        else:  # 1001
            log_base = 6909  # log(1001) ≈ 6.909
        
        # Compute ratio: log(value+1) / log(base) * 1000
        ratio = (log_value * 1000) // log_base
        
        # Cap at 1000 (represents 1.0)
        return min(ratio, 1000)
    
    @staticmethod
    def _min(a: int, b: int) -> int:
        """Min function"""
        return a if a < b else b
    
    @staticmethod
    def _max(a: int, b: int) -> int:
        """Max function"""
        return a if a > b else b
    
    def compute_repayment_score(self, features: FeatureVector) -> int:
        """
        REPAYMENT BEHAVIOR (35% weight = 210 points max)
        
        Formula:
        Repayment_Score = (Repay_Ratio_Score) + (No_Liquidation_Bonus)
        
        Where:
        Repay_Ratio_Score = min(repay_count / borrow_count, 1.0) × 150
        No_Liquidation_Bonus = 60 if (liquidation_count == 0 AND borrow_count > 0) else 0
        
        Returns scaled score (0-210000)
        """
        borrow_count = features.protocol.borrow_count
        repay_count = features.protocol.repay_count
        liquidation_count = features.protocol.liquidation_count
        
        # If never borrowed, score = 0 (no credit history)
        if borrow_count == 0:
            return 0
        
        # Compute repay ratio: min(repay_count / borrow_count, 1.0)
        # Scale to 0-1000 range (representing 0.0-1.0)
        repay_ratio = (repay_count * 1000) // borrow_count
        ratio_capped = self._min(repay_ratio, 1000)  # Cap at 1.0
        
        # Repay ratio score: ratio × 150
        ratio_score = ratio_capped * 150  # Max 150000 (150 points)
        
        # No liquidation bonus: 60 points if zero liquidations
        no_liquidation_bonus = 0
        if liquidation_count == 0:
            no_liquidation_bonus = 60000  # 60 points
        
        score = ratio_score + no_liquidation_bonus
        return score
    
    def compute_capital_score(self, features: FeatureVector) -> int:
        """
        CAPITAL MANAGEMENT (30% weight = 180 points max)
        
        Formula:
        Capital_Score = (Balance_Score) + (Stability_Score) + (History_Score)
        
        Where:
        Balance_Score = log(balance_eth + 1) / log(11) × 90
        Stability_Score = (1 - min(volatility / 1.0, 1.0)) × 60  [if volatility < 1.0]
        History_Score = log(max_balance_eth + 1) / log(11) × 30
        
        CRITICAL: Pass UNSCALED balance values to _log_scale_exact (integer ETH amounts)
        The circuit's LogScale expects actual values, not scaled values
        
        Returns scaled score (0-180000)
        """
        # CRITICAL FIX: Use UNSCALED balance values (integer part only)
        current_balance_unscaled = int(features.financial.current_balance_eth)
        max_balance_unscaled = int(features.financial.max_balance_eth)
        volatility_scaled = int(features.financial.balance_volatility * self.SCALE_FACTOR)
        
        # 1. Balance score: log(balance + 1) / log(11) × 90
        # EXACT logarithmic scaling as per specification
        # Pass UNSCALED value to match circuit
        balance_log = self._log_scale_exact(current_balance_unscaled, 11)
        balance_score = balance_log * 90  # Max 90000 (90 points)
        
        # 2. Stability score: (1 - min(volatility / 1.0, 1.0)) × 60
        # CRITICAL: Must match circuit's exact computation order
        # Circuit: stabilityScore = stabilityRatio * 60 * volCheck
        vol_capped = self._min(volatility_scaled, 1000)
        stability_ratio = 1000 - vol_capped  # Inverted: low volatility = high score
        vol_check = 1 if volatility_scaled < 1000 else 0  # Only applies if volatility < 1.0
        stability_score = stability_ratio * 60 * vol_check  # Max 60000 (60 points)
        
        # 3. History score: log(max_balance + 1) / log(11) × 30
        # EXACT logarithmic scaling as per specification
        # Pass UNSCALED value to match circuit
        max_balance_log = self._log_scale_exact(max_balance_unscaled, 11)
        history_score = max_balance_log * 30  # Max 30000 (30 points)
        
        # DEBUG logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"=== Capital Score Breakdown ===")
        logger.info(f"  current_balance_unscaled: {current_balance_unscaled}")
        logger.info(f"  balance_log: {balance_log}")
        logger.info(f"  balance_score: {balance_score}")
        logger.info(f"  volatility_scaled: {volatility_scaled}")
        logger.info(f"  vol_capped: {vol_capped}")
        logger.info(f"  stability_ratio: {stability_ratio}")
        logger.info(f"  vol_check: {vol_check}")
        logger.info(f"  stability_score: {stability_score}")
        logger.info(f"  max_balance_unscaled: {max_balance_unscaled}")
        logger.info(f"  max_balance_log: {max_balance_log}")
        logger.info(f"  history_score: {history_score}")
        logger.info(f"  TOTAL: {balance_score + stability_score + history_score}")
        logger.info(f"===============================")
        
        score = balance_score + stability_score + history_score
        return score
    
    def compute_longevity_score(self, features: FeatureVector) -> int:
        """
        WALLET LONGEVITY (15% weight = 90 points max)
        
        Formula:
        Longevity_Score = (Age_Score) + (Consistency_Score)
        
        Where:
        Age_Score = log(age_days + 1) / log(731) × 60
        Consistency_Score = active_days_ratio × 30
        
        Returns scaled score (0-90000)
        """
        wallet_age_days = features.temporal.wallet_age_days
        active_days_ratio_scaled = int(features.activity.active_days_ratio * self.SCALE_FACTOR)
        
        # 1. Age score: log(age + 1) / log(731) × 60
        # EXACT logarithmic scaling as per specification
        age_log = self._log_scale_exact(wallet_age_days, 731)
        age_score = age_log * 60  # Max 60000 (60 points)
        
        # 2. Consistency score: active_days_ratio × 30
        consistency_score = active_days_ratio_scaled * 30  # Max 30000 (30 points)
        
        score = age_score + consistency_score
        return score
    
    def compute_activity_score(self, features: FeatureVector) -> int:
        """
        ACTIVITY PATTERNS (10% weight = 60 points max)
        
        Formula:
        Activity_Score = (Frequency_Score) + (Regularity_Score)
        
        Where:
        Frequency_Score = log(tx_count + 1) / log(1001) × 30
        Regularity_Score = transaction_regularity_score × 30
        transaction_regularity_score = 1 / (1 + CV)
        
        Returns scaled score (0-60000)
        """
        total_transactions = features.activity.total_transactions
        transaction_regularity_scaled = int(features.temporal.transaction_regularity_score * self.SCALE_FACTOR)
        
        # 1. Frequency score: log(tx + 1) / log(1001) × 30
        # EXACT logarithmic scaling as per specification
        tx_log = self._log_scale_exact(total_transactions, 1001)
        frequency_score = tx_log * 30  # Max 30000 (30 points)
        
        # 2. Regularity score: transaction_regularity_score × 30
        # transaction_regularity_score = 1 / (1 + CV) already computed in features
        regularity_score = transaction_regularity_scaled * 30  # Max 30000 (30 points)
        
        score = frequency_score + regularity_score
        return score
    
    def compute_protocol_score(self, features: FeatureVector) -> int:
        """
        PROTOCOL DIVERSITY (10% weight = 60 points max)
        
        Formula:
        Protocol_Score = (Interaction_Score) + (Borrow_Experience_Score)
        
        Where:
        Interaction_Score = min(protocol_event_count / 100, 1.0) × 30
        Borrow_Experience_Score = min(borrow_count / 10, 1.0) × 30
        
        Returns scaled score (0-60000)
        """
        total_protocol_events = features.protocol.total_protocol_events
        borrow_count = features.protocol.borrow_count
        
        # 1. Interaction score: min(events / 100, 1.0) × 30
        # Linear scaling: 100 events = max score
        interaction_ratio = self._min(total_protocol_events * 10, 1000)  # Scale to 0-1000
        interaction_score = interaction_ratio * 30  # Max 30000 (30 points)
        
        # 2. Borrow experience score: min(borrows / 10, 1.0) × 30
        # Linear scaling: 10 borrows = max score
        borrow_ratio = self._min(borrow_count * 100, 1000)  # Scale to 0-1000
        borrow_experience_score = borrow_ratio * 30  # Max 30000 (30 points)
        
        score = interaction_score + borrow_experience_score
        return score
    
    def compute_risk_penalties(self, features: FeatureVector) -> int:
        """
        RISK PENALTIES (Negative Adjustments)
        
        Critical Penalties:
        - Liquidation_Penalty = liquidation_count × (-100)
        
        Volatility Penalties:
        - High_Volatility_Penalty = -50  [if volatility ≥ 1.0 ETH]
        - Sudden_Drop_Penalty = sudden_drops_count × (-15)
        
        Inactivity Penalties:
        - Dormancy_Penalty = (days_inactive / 180) × (-30)  [if days_inactive > 180]
        - Zero_Balance_Penalty = max(0, zero_periods - 5) × (-10)
        
        Manipulation Penalties:
        - Burst_Activity_Penalty = -25  [if burst_ratio > 0.5]
        - Failed_TX_Penalty = (failed_ratio / 0.05) × (-20)  [if failed_ratio > 0.05]
        
        Returns scaled penalty (always ≥ 0, will be subtracted from score)
        """
        liquidation_count = features.protocol.liquidation_count
        volatility_scaled = int(features.financial.balance_volatility * self.SCALE_FACTOR)
        sudden_drops_count = features.financial.sudden_drops_count
        days_since_last_activity = features.temporal.days_since_last_activity
        zero_balance_periods = features.risk.zero_balance_periods
        burst_activity_ratio_scaled = int(features.temporal.burst_activity_ratio * self.SCALE_FACTOR)
        failed_tx_ratio_scaled = int(features.risk.failed_transaction_ratio * self.SCALE_FACTOR)
        
        total_penalty = 0
        
        # 1. Liquidation penalty: -100 per liquidation (MOST SEVERE)
        liquidation_penalty = liquidation_count * 100000  # 100 points each
        total_penalty += liquidation_penalty
        
        # 2. High volatility penalty: -50 if volatility ≥ 1.0 ETH
        if volatility_scaled >= 1000:
            total_penalty += 50000  # 50 points
        
        # 3. Sudden drop penalty: -15 per drop
        sudden_drop_penalty = sudden_drops_count * 15000  # 15 points each
        total_penalty += sudden_drop_penalty
        
        # 4. Dormancy penalty: (days / 180) × -30 if days > 180
        if days_since_last_activity > 180:
            dormancy_penalty = (days_since_last_activity * 30000) // 180  # Scaled division
            total_penalty += dormancy_penalty
        
        # 5. Zero balance penalty: max(0, periods - 5) × -10
        if zero_balance_periods > 5:
            excess_periods = zero_balance_periods - 5
            zero_penalty = excess_periods * 10000  # 10 points each
            total_penalty += zero_penalty
        
        # 6. Burst activity penalty: -25 if burst_ratio > 0.5
        if burst_activity_ratio_scaled > 500:  # 0.5 scaled
            total_penalty += 25000  # 25 points
        
        # 7. Failed transaction penalty: (ratio / 0.05) × -20 if ratio > 0.05
        if failed_tx_ratio_scaled > 50:  # 0.05 scaled
            failed_penalty = (failed_tx_ratio_scaled * 20000) // 50  # Scaled division
            total_penalty += failed_penalty
        
        return total_penalty
    
    def compute_total_score(self, features: FeatureVector) -> Dict[str, float]:
        """
        Computes total credit score matching EXACT specification formula
        
        Formula:
        Final_Score = CLAMP(Base_Score + Positive_Contributions + Risk_Penalties, 0, 900)
        
        Returns both unscaled (0-900) and scaled (0-900000) scores
        """
        # Compute all components (scaled x1000)
        repayment_scaled = self.compute_repayment_score(features)
        capital_scaled = self.compute_capital_score(features)
        longevity_scaled = self.compute_longevity_score(features)
        activity_scaled = self.compute_activity_score(features)
        protocol_scaled = self.compute_protocol_score(features)
        risk_penalty_scaled = self.compute_risk_penalties(features)
        
        # Sum positive contributions
        positive_scores = (
            repayment_scaled +
            capital_scaled +
            longevity_scaled +
            activity_scaled +
            protocol_scaled
        )
        
        # Raw score = base + positive - penalties
        raw_score = self.BASE_SCORE + positive_scores - risk_penalty_scaled
        
        # Clamp to [0, 900000]
        final_score_scaled = self._max(0, self._min(raw_score, 900000))
        
        # Return both unscaled and scaled versions
        return {
            # Unscaled (for display)
            "total_score": final_score_scaled / self.SCALE_FACTOR,
            "repayment_behavior": repayment_scaled / self.SCALE_FACTOR,
            "capital_management": capital_scaled / self.SCALE_FACTOR,
            "wallet_longevity": longevity_scaled / self.SCALE_FACTOR,
            "activity_patterns": activity_scaled / self.SCALE_FACTOR,
            "protocol_diversity": protocol_scaled / self.SCALE_FACTOR,
            "risk_penalties": risk_penalty_scaled / self.SCALE_FACTOR,
            # Scaled (for circuit witness - EXACT integers)
            "total_score_scaled": int(final_score_scaled),
            "repayment_behavior_scaled": int(repayment_scaled),
            "capital_management_scaled": int(capital_scaled),
            "wallet_longevity_scaled": int(longevity_scaled),
            "activity_patterns_scaled": int(activity_scaled),
            "protocol_diversity_scaled": int(protocol_scaled),
            "risk_penalties_scaled": int(risk_penalty_scaled)
        }


# Global instance
circuit_score_engine = CircuitScoreEngine()
