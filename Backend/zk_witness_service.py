"""
ZK Witness Service
Formats feature vectors into circuit-compatible witness data
Uses circuit-compatible score computation to ensure exact match
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging
from feature_extraction_models import FeatureVector
from credit_score_models import CreditScoreResult
from circuit_score_engine import circuit_score_engine
import hashlib
import json

logger = logging.getLogger(__name__)


class ZKWitnessService:
    """
    Service for generating ZK circuit witness data
    
    Responsibilities:
    1. Scale float features to integers (x1000)
    2. Format data for circuit consumption
    3. Generate nonce for nullifier
    4. Validate feature ranges
    """
    
    SCALE_FACTOR = 1000
    VERSION_ID = 1
    
    def __init__(self):
        self.version = "1.0.0"
    
    def generate_witness(
        self,
        features: FeatureVector,
        score_result: CreditScoreResult,
        threshold: int,
        wallet_address: str
    ) -> Dict[str, Any]:
        """
        Generate complete witness data for ZK proof
        
        Args:
            features: Extracted feature vector
            score_result: Computed credit score result
            threshold: Lender's threshold (0-900)
            wallet_address: User's Ethereum address
            
        Returns:
            Dictionary with public_inputs and private_inputs
        """
        try:
            timestamp = int(datetime.now(timezone.utc).timestamp())
            nonce = self._generate_nonce(wallet_address, timestamp)
            
            # Convert address to field element (remove 0x prefix)
            user_address_field = int(wallet_address, 16) if wallet_address.startswith('0x') else int(wallet_address, 16)
            
            # Use pre-scaled scores from circuit engine to avoid rounding errors
            # The circuit engine computes everything in integer arithmetic (scaled x1000)
            # We need to recompute to get the scaled versions
            from circuit_score_engine import circuit_score_engine
            circuit_scores = circuit_score_engine.compute_total_score(features)
            
            # Use the scaled versions directly (these are integers)
            score_total_scaled = int(circuit_scores['total_score_scaled'])
            score_repayment_scaled = int(circuit_scores['repayment_behavior_scaled'])
            score_capital_scaled = int(circuit_scores['capital_management_scaled'])
            score_longevity_scaled = int(circuit_scores['wallet_longevity_scaled'])
            score_activity_scaled = int(circuit_scores['activity_patterns_scaled'])
            score_protocol_scaled = int(circuit_scores['protocol_diversity_scaled'])
            threshold_scaled = int(threshold * self.SCALE_FACTOR)
            
            # Generate nullifier (will be recomputed in circuit)
            nullifier_int = self._compute_nullifier(user_address_field, nonce, timestamp, self.VERSION_ID)
            
            # Validate nullifier is within field bounds
            # BN254 field modulus
            BN254_FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617
            
            if nullifier_int >= BN254_FIELD_MODULUS:
                logger.warning(f"Nullifier too large ({nullifier_int}), reducing to fit BN254 field")
                nullifier_int = nullifier_int % BN254_FIELD_MODULUS
            
            logger.info(f"Nullifier: {nullifier_int}")
            logger.info(f"Nullifier type: {type(nullifier_int)}")
            logger.info(f"Nullifier fits in BN254 field: {nullifier_int < BN254_FIELD_MODULUS}")
            
            public_inputs = {
                "userAddress": str(user_address_field),
                "scoreTotal": int(score_total_scaled),
                "scoreRepayment": int(score_repayment_scaled),
                "scoreCapital": int(score_capital_scaled),
                "scoreLongevity": int(score_longevity_scaled),
                "scoreActivity": int(score_activity_scaled),
                "scoreProtocol": int(score_protocol_scaled),
                "threshold": int(threshold_scaled),
                "timestamp": int(timestamp),
                "nullifier": int(nullifier_int),  # Use integer directly, not string
                "versionId": int(self.VERSION_ID)
            }
            
            logger.info(f"Public inputs prepared:")
            logger.info(f"  userAddress: {public_inputs['userAddress']} (type: {type(public_inputs['userAddress'])})")
            logger.info(f"  scoreTotal: {public_inputs['scoreTotal']} (type: {type(public_inputs['scoreTotal'])})")
            logger.info(f"  threshold: {public_inputs['threshold']} (type: {type(public_inputs['threshold'])})")
            logger.info(f"  nullifier: {public_inputs['nullifier']} (type: {type(public_inputs['nullifier'])})")
            
            private_inputs = self._format_private_inputs(features, nonce)
            
            # DEBUG: Log key private inputs
            logger.info(f"=== DEBUG: Private Inputs ===")
            logger.info(f"  borrowCount: {private_inputs['borrowCount']}")
            logger.info(f"  repayCount: {private_inputs['repayCount']}")
            logger.info(f"  repayToBorrowRatio: {private_inputs['repayToBorrowRatio']}")
            logger.info(f"  liquidationCount: {private_inputs['liquidationCount']}")
            logger.info(f"  currentBalanceScaled: {private_inputs['currentBalanceScaled']}")
            logger.info(f"  balanceVolatilityScaled: {private_inputs['balanceVolatilityScaled']}")
            logger.info(f"  nonce: {private_inputs['nonce']}")
            logger.info(f"================================")
            
            witness = {
                "version_id": self.VERSION_ID,
                "timestamp": timestamp,
                "engine_version": score_result.engine_version,
                "feature_version": score_result.feature_version,
                "wallet_address": wallet_address,
                "public_inputs": public_inputs,
                "private_inputs": private_inputs,
                "metadata": {
                    "score_band": score_result.score_band,
                    "raw_score": score_result.raw_score,
                    "network": features.network,
                    "chain_id": features.chain_id
                }
            }
            
            logger.info(f"Generated ZK witness for {wallet_address}, score: {score_result.credit_score}")
            return witness
            
        except Exception as e:
            logger.error(f"Failed to generate witness: {e}")
            raise
    
    def _format_private_inputs(self, features: FeatureVector, nonce: int) -> Dict[str, int]:
        """
        Format feature vector into circuit-compatible private inputs
        
        CRITICAL: The circuit's LogScale template expects UNSCALED values for balances!
        - For balances (ETH values): pass as integers (e.g., 5 for 5.42 ETH)
        - For ratios/percentages: scale by 1000 (e.g., 667 for 0.667)
        - For counts: pass as-is (e.g., 8 for 8 borrows)
        
        All values must be integers for circuit compatibility
        All values must be non-negative and fit in BN254 field
        """
        # BN254 field modulus
        BN254_FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617
        
        def safe_int(value: float) -> int:
            """Convert to int and ensure it fits in BN254 field"""
            result = int(value)
            if result < 0:
                result = 0  # Clamp negative values to 0
            if result >= BN254_FIELD_MODULUS:
                result = result % BN254_FIELD_MODULUS
            return result
        
        # CRITICAL FIX: Pass UNSCALED balance values to circuit
        # The circuit's LogScale computes log(value + 1), so it expects actual ETH amounts
        # For example: 5.42 ETH should be passed as 5 (integer part)
        return {
            # Financial Features (7) - UNSCALED for balances
            "currentBalanceScaled": safe_int(features.financial.current_balance_eth),  # UNSCALED
            "maxBalanceScaled": safe_int(features.financial.max_balance_eth),  # UNSCALED
            "balanceVolatilityScaled": safe_int(self._scale(features.financial.balance_volatility)),  # SCALED (ratio)
            "suddenDropsCount": safe_int(features.financial.sudden_drops_count),
            "totalValueTransferred": safe_int(features.financial.total_value_transferred_eth),  # UNSCALED
            "avgTxValue": safe_int(features.financial.average_transaction_value_eth),  # UNSCALED
            "minBalanceScaled": safe_int(features.financial.min_balance_eth),  # UNSCALED
            
            # Protocol Features (8)
            "borrowCount": safe_int(features.protocol.borrow_count),
            "repayCount": safe_int(features.protocol.repay_count),
            "repayToBorrowRatio": safe_int(self._scale(features.protocol.repay_to_borrow_ratio)),  # SCALED (ratio)
            "liquidationCount": safe_int(features.protocol.liquidation_count),
            "totalProtocolEvents": safe_int(features.protocol.total_protocol_events),
            "depositCount": safe_int(features.protocol.deposit_count),
            "withdrawCount": safe_int(features.protocol.withdraw_count),
            "avgBorrowDuration": safe_int(features.protocol.average_borrow_duration_days),
            
            # Activity Features (6)
            "totalTransactions": safe_int(features.activity.total_transactions),
            "activeDays": safe_int(features.activity.active_days),
            "totalDays": safe_int(features.activity.total_days),
            "activeDaysRatio": safe_int(self._scale(features.activity.active_days_ratio)),  # SCALED (ratio)
            "longestInactivityGap": safe_int(features.activity.longest_inactivity_gap_days),
            "transactionsPerDay": safe_int(self._scale(features.activity.transactions_per_day)),  # SCALED (ratio)
            
            # Temporal Features (4)
            "walletAgeDays": safe_int(features.temporal.wallet_age_days),
            "transactionRegularity": safe_int(self._scale(features.temporal.transaction_regularity_score)),  # SCALED (ratio)
            "burstActivityRatio": safe_int(self._scale(features.temporal.burst_activity_ratio)),  # SCALED (ratio)
            "daysSinceLastActivity": safe_int(features.temporal.days_since_last_activity),
            
            # Risk Features (4)
            "failedTxCount": safe_int(features.risk.failed_transaction_count),
            "failedTxRatio": safe_int(self._scale(features.risk.failed_transaction_ratio)),  # SCALED (ratio)
            "highGasSpikeCount": safe_int(features.risk.high_gas_spike_count),
            "zeroBalancePeriods": safe_int(features.risk.zero_balance_periods),
            
            # Anti-Replay (1)
            "nonce": safe_int(nonce)
        }
    
    def _scale(self, value: float) -> int:
        """Scale float to integer by multiplying by SCALE_FACTOR"""
        return int(value * self.SCALE_FACTOR)
    
    def _generate_nonce(self, wallet_address: str, timestamp: int) -> int:
        """
        Generate unique nonce for nullifier
        Uses hash of address + timestamp + random component
        
        Returns a positive integer that fits in the BN254 field
        BN254 field modulus: 21888242871839275222246405745257275088548364400416034343698204186575808495617
        
        TEMPORARY: Using smaller nonce values to debug circuit issue
        """
        import secrets
        
        # TEMPORARY: Use a much smaller nonce to test if size is the issue
        # Generate a random 128-bit number instead of 256-bit
        random_bytes = secrets.token_bytes(16)  # 16 bytes = 128 bits
        data = f"{wallet_address}{timestamp}{random_bytes.hex()}".encode()
        hash_digest = hashlib.sha256(data).digest()
        
        # Take only first 16 bytes (128 bits) to keep nonce smaller
        nonce = int.from_bytes(hash_digest[:16], byteorder='big')
        
        # Ensure nonce is positive and non-zero
        if nonce <= 0:
            nonce = 1
        
        logger.info(f"Generated nonce: {nonce}")
        logger.info(f"Nonce bit length: {nonce.bit_length()} bits")
        return nonce
    
    def _compute_nullifier(self, user_address: int, nonce: int, timestamp: int, version_id: int) -> int:
        """
        Compute nullifier hash using SHA256 (TEMPORARY - circuit will recompute with Poseidon)
        
        The circuit recomputes the nullifier using Poseidon internally.
        This backend nullifier is just for tracking/logging purposes.
        
        Args:
            user_address: User address as field element
            nonce: Unique nonce for replay protection
            timestamp: Unix timestamp
            version_id: Circuit version
            
        Returns:
            Nullifier hash as integer (within BN254 field)
        """
        try:
            # BN254 field modulus
            BN254_FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617
            
            # Use SHA256 for backend nullifier (circuit will use Poseidon)
            data = f"{user_address}{nonce}{timestamp}{version_id}".encode()
            hash_digest = hashlib.sha256(data).digest()
            # Convert to integer
            nullifier_int = int.from_bytes(hash_digest, byteorder='big')
            
            # Reduce modulo BN254 field
            nullifier_int = nullifier_int % BN254_FIELD_MODULUS
            
            logger.info(f"Generated SHA256 nullifier (circuit will use Poseidon): {nullifier_int}")
            logger.info(f"Nullifier fits in BN254 field: {nullifier_int < BN254_FIELD_MODULUS}")
            return nullifier_int
            
        except Exception as e:
            logger.error(f"Nullifier generation failed: {e}")
            raise RuntimeError(f"Nullifier generation failed: {e}")
    
    def validate_witness(self, witness: Dict[str, Any]) -> bool:
        """
        Validate witness data structure and ranges
        
        Returns:
            True if valid, raises exception otherwise
        """
        try:
            # Check required fields
            required_fields = ["version_id", "timestamp", "public_inputs", "private_inputs"]
            for field in required_fields:
                if field not in witness:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate score ranges (0-900000 scaled)
            public = witness["public_inputs"]
            if not (0 <= public["scoreTotal"] <= 900000):
                raise ValueError(f"Invalid scoreTotal: {public['scoreTotal']}")
            
            # Validate threshold
            if not (0 <= public["threshold"] <= 900000):
                raise ValueError(f"Invalid threshold: {public['threshold']}")
            
            # Validate timestamp (not in future)
            current_time = int(datetime.now(timezone.utc).timestamp())
            if public["timestamp"] > current_time + 300:  # 5 min tolerance
                raise ValueError("Timestamp in future")
            
            # Validate version
            if public["versionId"] != self.VERSION_ID:
                raise ValueError(f"Invalid version: {public['versionId']}")
            
            logger.info("Witness validation passed")
            return True
            
        except Exception as e:
            logger.error(f"Witness validation failed: {e}")
            raise


# Global service instance
zk_witness_service = ZKWitnessService()
