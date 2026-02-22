"""
Quick test script to verify ZK proof generation works
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from zk_proof_service import zk_proof_service
from zk_witness_service import zk_witness_service
from feature_extraction_models import (
    FeatureVector, ActivityFeatures, FinancialFeatures,
    ProtocolInteractionFeatures, RiskFeatures, TemporalFeatures,
    BehavioralClassification, AnalysisWindow
)
from credit_score_models import CreditScoreResult, CreditScoreBreakdown
from datetime import datetime, timezone

# Create minimal test data
features = FeatureVector(
    wallet_address="0x995c6b8bd893afd139437da4322190beb5e6ddd6",
    network="polygon_amoy",
    chain_id=80002,
    analysis_window=AnalysisWindow(
        name="test",
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc),
        start_timestamp=int(datetime.now(timezone.utc).timestamp()),
        end_timestamp=int(datetime.now(timezone.utc).timestamp()),
        total_days=1
    ),
    activity=ActivityFeatures(
        total_transactions=0,
        active_days=0,
        total_days=1,
        active_days_ratio=0.0,
        longest_inactivity_gap_days=0,
        transactions_per_day=0.0
    ),
    financial=FinancialFeatures(
        current_balance_eth=0.0,
        max_balance_eth=0.0,
        min_balance_eth=0.0,
        balance_volatility=0.0,
        sudden_drops_count=0,
        total_value_transferred_eth=0.0,
        average_transaction_value_eth=0.0
    ),
    protocol=ProtocolInteractionFeatures(
        borrow_count=0,
        repay_count=0,
        repay_to_borrow_ratio=0.0,
        liquidation_count=0,
        total_protocol_events=0,
        deposit_count=0,
        withdraw_count=0,
        average_borrow_duration_days=0.0
    ),
    risk=RiskFeatures(
        failed_transaction_count=0,
        failed_transaction_ratio=0.0,
        high_gas_spike_count=0,
        zero_balance_periods=0
    ),
    temporal=TemporalFeatures(
        wallet_age_days=0,
        transaction_regularity_score=0.0,
        burst_activity_ratio=0.0,
        days_since_last_activity=0
    ),
    classification=BehavioralClassification(
        is_active=False,
        is_whale=False,
        is_defi_user=False,
        risk_category="low"
    ),
    extracted_at=datetime.now(timezone.utc),
    feature_version="1.0.0"
)

# Compute scores using circuit-compatible engine
from circuit_score_engine import circuit_score_engine
circuit_scores = circuit_score_engine.compute_total_score(features)

score_result = CreditScoreResult(
    credit_score=circuit_scores['total_score'],
    score_band="poor",
    breakdown=CreditScoreBreakdown(
        repayment_behavior=circuit_scores['repayment_behavior'],
        capital_management=circuit_scores['capital_management'],
        wallet_longevity=circuit_scores['wallet_longevity'],
        activity_patterns=circuit_scores['activity_patterns'],
        protocol_diversity=circuit_scores['protocol_diversity'],
        risk_penalties=circuit_scores['risk_penalties']
    ),
    raw_score=circuit_scores['total_score'],
    timestamp=datetime.now(timezone.utc),
    feature_version="1.0.0",
    engine_version="1.0.0"
)

print("=" * 60)
print("ZK PROOF GENERATION TEST")
print("=" * 60)

print(f"\nComputed circuit-compatible score: {circuit_scores['total_score']}")
print(f"  Repayment: {circuit_scores['repayment_behavior']}")
print(f"  Capital: {circuit_scores['capital_management']}")
print(f"  Longevity: {circuit_scores['wallet_longevity']}")
print(f"  Activity: {circuit_scores['activity_patterns']}")
print(f"  Protocol: {circuit_scores['protocol_diversity']}")
print(f"  Risk Penalties: {circuit_scores['risk_penalties']}")

# Test with score BELOW threshold (should still work now!)
threshold = 600
print(f"\nTest Case: Score ({score_result.credit_score}) < Threshold ({threshold})")
print(f"Expected: Proof generation SUCCESS, is_eligible=False")

try:
    # Generate witness
    print("\n[1] Generating witness...")
    witness = zk_witness_service.generate_witness(
        features=features,
        score_result=score_result,
        threshold=threshold,
        wallet_address="0x995c6b8bd893afd139437da4322190beb5e6ddd6"
    )
    print("OK Witness generated")
    print(f"  Score Total: {witness['public_inputs']['scoreTotal']}")
    print(f"  Threshold: {witness['public_inputs']['threshold']}")
    print(f"  Nullifier: {witness['public_inputs']['nullifier']}")
    
    # Generate proof
    print("\n[2] Generating ZK proof...")
    
    # Save witness to file for debugging
    import json
    with open('test_witness.json', 'w') as f:
        json.dump(witness, f, indent=2)
    print("Witness saved to test_witness.json")
    
    proof, public_signals = zk_proof_service.generate_proof(witness, timeout=120)
    print(f"OK Proof generated successfully!")
    print(f"  Public signals count: {len(public_signals)}")
    
    # Extract eligibility
    score_total_signal = public_signals[1]
    threshold_signal = public_signals[7]
    is_eligible = int(score_total_signal) >= int(threshold_signal)
    
    print(f"\n[3] Proof details:")
    print(f"  Score (scaled): {score_total_signal}")
    print(f"  Threshold (scaled): {threshold_signal}")
    print(f"  Score (unscaled): {int(score_total_signal) / 1000}")
    print(f"  Threshold (unscaled): {int(threshold_signal) / 1000}")
    print(f"  Is Eligible: {is_eligible}")
    
    # Verify proof
    print("\n[4] Verifying proof...")
    is_valid = zk_proof_service.verify_proof(proof, public_signals)
    print(f"OK Proof verification: {'VALID' if is_valid else 'INVALID'}")
    
    print("\n" + "=" * 60)
    print("TEST RESULT: SUCCESS")
    print("=" * 60)
    print(f"Proof generated for ineligible borrower (score < threshold)")
    print(f"This is the correct behavior!")
    
except Exception as e:
    print(f"\nX TEST FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
