"""
ZK Witness Service
Formats feature vectors into circuit-compatible witness data
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging
from feature_extraction_models import FeatureVector
from credit_score_models import CreditScoreResult
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
            
            # Scale scores (already in 0-900 range, scale to 0-900000)
            score_total_scaled = int(score_result.credit_score * self.SCALE_FACTOR)
            score_repayment_scaled = int(score_result.breakdown.repayment_behavior * self.SCALE_FACTOR)
            score_capital_scaled = int(score_result.breakdown.capital_management * self.SCALE_FACTOR)
            score_longevity_scaled = int(score_result.breakdown.wallet_longevity * self.SCALE_FACTOR)
            score_activity_scaled = int(score_result.breakdown.activity_patterns * self.SCALE_FACTOR)
            score_protocol_scaled = int(score_result.breakdown.protocol_diversity * self.SCALE_FACTOR)
            threshold_scaled = int(threshold * self.SCALE_FACTOR)
            
            # Generate nullifier (will be recomputed in circuit)
            nullifier_hex = self._compute_nullifier(user_address_field, nonce, timestamp, self.VERSION_ID)
            
            # Convert nullifier from hex to decimal for circuit input
            logger.info(f"Nullifier hex: {nullifier_hex}")
            logger.info(f"Nullifier hex type: {type(nullifier_hex)}")
            
            try:
                # Ensure we're working with a string
                nullifier_hex_str = str(nullifier_hex)
                
                # Remove 0x prefix if present
                if nullifier_hex_str.startswith('0x'):
                    nullifier_hex_str = nullifier_hex_str[2:]
                
                # Convert hex to decimal integer
                nullifier_decimal = int(nullifier_hex_str, 16)
                
                logger.info(f"Nullifier decimal: {nullifier_decimal}")
                logger.info(f"Nullifier decimal type: {type(nullifier_decimal)}")
                
                # Verify it's actually an integer
                if not isinstance(nullifier_decimal, int):
                    raise ValueError(f"Nullifier decimal is not an integer: {type(nullifier_decimal)}")
                    
            except ValueError as e:
                logger.error(f"Failed to convert nullifier hex to decimal: {e}")
                logger.error(f"Nullifier hex value: {nullifier_hex}")
                raise ValueError(f"Invalid nullifier hex format: {nullifier_hex}")
            
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
                "nullifier": int(nullifier_decimal),  # Use integer directly, not string
                "versionId": int(self.VERSION_ID)
            }
            
            logger.info(f"Public inputs prepared:")
            logger.info(f"  userAddress: {public_inputs['userAddress']} (type: {type(public_inputs['userAddress'])})")
            logger.info(f"  scoreTotal: {public_inputs['scoreTotal']} (type: {type(public_inputs['scoreTotal'])})")
            logger.info(f"  threshold: {public_inputs['threshold']} (type: {type(public_inputs['threshold'])})")
            logger.info(f"  nullifier: {public_inputs['nullifier']} (type: {type(public_inputs['nullifier'])})")
            
            private_inputs = self._format_private_inputs(features, nonce)
            
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
        All floats scaled by 1000, integers kept as-is
        All values must be integers for circuit compatibility
        """
        return {
            # Financial Features (7)
            "currentBalanceScaled": int(self._scale(features.financial.current_balance_eth)),
            "maxBalanceScaled": int(self._scale(features.financial.max_balance_eth)),
            "balanceVolatilityScaled": int(self._scale(features.financial.balance_volatility)),
            "suddenDropsCount": int(features.financial.sudden_drops_count),
            "totalValueTransferred": int(self._scale(features.financial.total_value_transferred_eth)),
            "avgTxValue": int(self._scale(features.financial.average_transaction_value_eth)),
            "minBalanceScaled": int(self._scale(features.financial.min_balance_eth)),
            
            # Protocol Features (8)
            "borrowCount": int(features.protocol.borrow_count),
            "repayCount": int(features.protocol.repay_count),
            "repayToBorrowRatio": int(self._scale(features.protocol.repay_to_borrow_ratio)),
            "liquidationCount": int(features.protocol.liquidation_count),
            "totalProtocolEvents": int(features.protocol.total_protocol_events),
            "depositCount": int(features.protocol.deposit_count),
            "withdrawCount": int(features.protocol.withdraw_count),
            "avgBorrowDuration": int(self._scale(features.protocol.average_borrow_duration_days)),
            
            # Activity Features (6)
            "totalTransactions": int(features.activity.total_transactions),
            "activeDays": int(features.activity.active_days),
            "totalDays": int(features.activity.total_days),
            "activeDaysRatio": int(self._scale(features.activity.active_days_ratio)),
            "longestInactivityGap": int(features.activity.longest_inactivity_gap_days),
            "transactionsPerDay": int(self._scale(features.activity.transactions_per_day)),
            
            # Temporal Features (4)
            "walletAgeDays": int(features.temporal.wallet_age_days),
            "transactionRegularity": int(self._scale(features.temporal.transaction_regularity_score)),
            "burstActivityRatio": int(self._scale(features.temporal.burst_activity_ratio)),
            "daysSinceLastActivity": int(features.temporal.days_since_last_activity),
            
            # Risk Features (4)
            "failedTxCount": int(features.risk.failed_transaction_count),
            "failedTxRatio": int(self._scale(features.risk.failed_transaction_ratio)),
            "highGasSpikeCount": int(features.risk.high_gas_spike_count),
            "zeroBalancePeriods": int(features.risk.zero_balance_periods),
            
            # Anti-Replay (1)
            "nonce": int(nonce)
        }
    
    def _scale(self, value: float) -> int:
        """Scale float to integer by multiplying by SCALE_FACTOR"""
        return int(value * self.SCALE_FACTOR)
    
    def _generate_nonce(self, wallet_address: str, timestamp: int) -> int:
        """
        Generate unique nonce for nullifier
        Uses hash of address + timestamp + random component
        """
        import secrets
        random_bytes = secrets.token_bytes(32)
        data = f"{wallet_address}{timestamp}{random_bytes.hex()}".encode()
        hash_digest = hashlib.sha256(data).digest()
        # Convert to integer (take first 31 bytes to fit in field)
        nonce = int.from_bytes(hash_digest[:31], byteorder='big')
        return nonce
    
    def _compute_nullifier(self, user_address: int, nonce: int, timestamp: int, version_id: int) -> str:
        """
        Compute nullifier hash using Poseidon (PRODUCTION)
        
        This matches the circuit's nullifier computation exactly:
        nullifier = Poseidon(userAddress, nonce, timestamp, versionId)
        
        Uses poseidon-hash library for Python implementation
        
        Args:
            user_address: User address as field element
            nonce: Unique nonce for replay protection
            timestamp: Unix timestamp
            version_id: Circuit version
            
        Returns:
            Nullifier hash as hex string
        """
        try:
            # Try to use poseidon-hash library (production)
            from poseidon_hash import poseidon_hash
            
            # Poseidon hash with 4 inputs (matches circuit)
            inputs = [user_address, nonce, timestamp, version_id]
            nullifier_int = poseidon_hash(inputs)
            
            # Convert to hex string
            nullifier_hex = hex(nullifier_int)
            return nullifier_hex
            
        except ImportError:
            # Fallback to SHA256 if poseidon-hash not installed
            logger.warning("poseidon-hash library not installed. Using SHA256 fallback.")
            logger.warning("Install: pip install poseidon-hash")
            logger.warning("Note: This nullifier won't match circuit output!")
            
            # SHA256 fallback (for development only)
            data = f"{user_address}{nonce}{timestamp}{version_id}".encode()
            hash_digest = hashlib.sha256(data).hexdigest()
            return hash_digest
    
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
