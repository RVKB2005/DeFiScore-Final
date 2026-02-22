"""
Celery Tasks
Background tasks for credit scoring
"""
from celery_app import celery_app
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name='celery_tasks.calculate_credit_score_task')
def calculate_credit_score_task(self, wallet_address: str, networks: Optional[list] = None):
    """
    Background task to calculate credit score
    
    Args:
        self: Celery task instance
        wallet_address: Wallet address to score
        networks: Optional list of networks to analyze
    """
    import sys
    import os
    
    # Add Backend directory to Python path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    from multi_chain_ingestion_service import MultiChainIngestionService
    from multi_chain_feature_service import MultiChainFeatureService
    from database import SessionLocal
    from db_models import CreditScore
    from redis_cache import redis_cache
    import json
    
    logger.info(f"========== CELERY TASK STARTED ==========")
    logger.info(f"Task ID: {self.request.id}")
    logger.info(f"Wallet: {wallet_address}")
    logger.info(f"Networks: {networks}")
    
    try:
        # Update progress: Starting
        self.update_state(state='PROGRESS', meta={'progress': 0, 'status': 'Starting ingestion'})
        logger.info(f"Task state updated: PROGRESS 0%")
        
        # Initialize services
        logger.info(f"Initializing services...")
        ingestion_service = MultiChainIngestionService(mainnet_only=True)
        feature_service = MultiChainFeatureService(mainnet_only=True)
        logger.info(f"✓ Services initialized")
        
        # Ingest data
        self.update_state(state='PROGRESS', meta={'progress': 10, 'status': 'Ingesting blockchain data'})
        logger.info(f"========== STEP 1: INGESTING BLOCKCHAIN DATA ==========")
        logger.info(f"Starting ingestion for {wallet_address}")
        
        ingestion_summary = ingestion_service.ingest_wallet_all_networks(
            wallet_address=wallet_address,
            days_back=30,
            parallel=True
        )
        
        logger.info(f"✓ Ingestion completed")
        logger.info(f"Ingestion summary: {ingestion_summary}")
        
        self.update_state(state='PROGRESS', meta={'progress': 50, 'status': 'Extracting features'})
        logger.info(f"Task state updated: PROGRESS 50%")
        
        # Extract features
        logger.info(f"========== STEP 2: EXTRACTING FEATURES ==========")
        logger.info(f"Extracting features for {wallet_address}")
        multi_features = feature_service.extract_features_all_networks(
            wallet_address=wallet_address,
            window_days=30,
            parallel=True
        )
        
        logger.info(f"✓ Feature extraction completed")
        logger.info(f"Features: {multi_features}")
        
        self.update_state(state='PROGRESS', meta={'progress': 80, 'status': 'Calculating score'})
        logger.info(f"Task state updated: PROGRESS 80%")
        
        # Calculate score
        logger.info(f"========== STEP 3: CALCULATING CREDIT SCORE ==========")
        from credit_score_engine import CreditScoreEngine
        
        score_engine = CreditScoreEngine()
        
        logger.info(f"Using full FICO-based credit score engine")
        
        # Calculate score using the proper engine with feature vectors
        # For multi-chain, we need to use the primary network's features
        if multi_features.network_features:
            # Use the first network's features (typically ethereum)
            primary_network = list(multi_features.network_features.keys())[0]
            primary_features = multi_features.network_features[primary_network]
            
            logger.info(f"Using features from primary network: {primary_network}")
            
            score_result = score_engine.calculate_score(primary_features)
            score = score_result.credit_score
            
            # Convert breakdown to dict for storage
            score_breakdown = {
                "total_score": score,
                "repayment_behavior": score_result.breakdown.repayment_behavior,
                "capital_management": score_result.breakdown.capital_management,
                "wallet_longevity": score_result.breakdown.wallet_longevity,
                "activity_patterns": score_result.breakdown.activity_patterns,
                "protocol_diversity": score_result.breakdown.protocol_diversity,
                "risk_penalties": score_result.breakdown.risk_penalties,
                "rating": score_result.score_band
            }
        else:
            # No features available - wallet has no activity
            # Create minimal feature data for ZK proof generation
            logger.warning(f"No network features available, creating minimal feature data for empty wallet")
            score = 300
            score_breakdown = {
                "total_score": 300,
                "repayment_behavior": 0.0,
                "capital_management": 0.0,
                "wallet_longevity": 0.0,
                "activity_patterns": 0.0,
                "protocol_diversity": 0.0,
                "risk_penalties": 0.0,
                "rating": "Poor"
            }
            
            # Create minimal feature data for empty wallet so ZK proofs can still be generated
            logger.info(f"Creating minimal feature data for empty wallet...")
            from feature_extraction_models import (
                FeatureVector, ActivityFeatures, FinancialFeatures,
                ProtocolInteractionFeatures, RiskFeatures, TemporalFeatures,
                BehavioralClassification, AnalysisWindow
            )
            
            # Create minimal feature vector with all zeros
            now = datetime.now(timezone.utc)
            minimal_features = FeatureVector(
                wallet_address=wallet_address.lower(),
                network="ethereum",
                chain_id=1,
                analysis_window=AnalysisWindow(
                    name="30d",
                    days=30,
                    start_timestamp=now,
                    end_timestamp=now
                ),
                activity=ActivityFeatures(
                    total_transactions=0,
                    transactions_per_day=0.0,
                    active_days=0,
                    total_days=0,
                    active_days_ratio=0.0,
                    longest_inactivity_gap_days=0,
                    recent_activity_days=0
                ),
                financial=FinancialFeatures(
                    total_value_transferred_eth=0.0,
                    average_transaction_value_eth=0.0,
                    current_balance_eth=0.0,
                    max_balance_eth=0.0,
                    min_balance_eth=0.0,
                    balance_volatility=0.0,
                    sudden_drops_count=0
                ),
                protocol=ProtocolInteractionFeatures(
                    total_protocol_events=0,
                    borrow_count=0,
                    repay_count=0,
                    deposit_count=0,
                    withdraw_count=0,
                    liquidation_count=0,
                    repay_to_borrow_ratio=0.0,
                    average_borrow_duration_days=0.0
                ),
                risk=RiskFeatures(
                    failed_transaction_count=0,
                    failed_transaction_ratio=0.0,
                    liquidation_count=0,
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
                    longevity_class="new",
                    activity_class="dormant",
                    capital_class="micro",
                    credit_behavior_class="no_history",
                    risk_class="unknown"
                ),
                extracted_at=now,
                feature_version="1.0.0"
            )
            
            # Add minimal features to multi_features so it can be saved later
            multi_features.network_features = {"ethereum": minimal_features}
            multi_features.networks_analyzed = ["ethereum"]
            multi_features.total_networks = 1
            
            logger.info(f"✓ Minimal feature data created for empty wallet")
        
        logger.info(f"✓ Score calculated: {score}")
        logger.info(f"Score breakdown: {score_breakdown}")
        
        # Create classification dict from multi_features for database storage
        classification_dict = {
            "longevity_class": multi_features.overall_classification.longevity_class,
            "activity_class": multi_features.overall_classification.activity_class,
            "capital_class": multi_features.overall_classification.capital_class,
            "credit_behavior_class": multi_features.overall_classification.credit_behavior_class,
            "risk_class": multi_features.overall_classification.risk_class
        }
        
        self.update_state(state='PROGRESS', meta={'progress': 90, 'status': 'Saving to database'})
        logger.info(f"Task state updated: PROGRESS 90%")
        logger.info(f"========== STEP 4: SAVING TO DATABASE ==========")
        # Save to database
        db = SessionLocal()
        try:
            logger.info(f"Saving score to database...")
            db_score = CreditScore(
                wallet_address=wallet_address.lower(),
                score=score,
                score_breakdown=json.dumps(score_breakdown),
                classification=json.dumps(classification_dict),
                networks_analyzed=json.dumps(multi_features.networks_analyzed),
                total_networks=multi_features.total_networks,
                calculated_at=datetime.now(timezone.utc)
            )
            db.add(db_score)
            
            # Save feature data for each network for ZK proof generation
            logger.info(f"Saving feature data for {len(multi_features.network_features)} networks...")
            from db_models import FeatureData
            
            for network, features in multi_features.network_features.items():
                # Convert FeatureVector to JSON
                features_dict = features.dict()
                
                db_features = FeatureData(
                    wallet_address=wallet_address.lower(),
                    network=network,
                    chain_id=features.chain_id,
                    features_json=json.dumps(features_dict, default=str),
                    extracted_at=features.extracted_at
                )
                db.add(db_features)
            
            db.commit()
            db.refresh(db_score)
            logger.info(f"✓ Score saved to database (ID: {db_score.id})")
            logger.info(f"✓ Feature data saved for {len(multi_features.network_features)} networks")
            
            # Cache in Redis
            logger.info(f"Caching score in Redis...")
            redis_cache.set_score(
                wallet_address=wallet_address,
                score=score,
                score_breakdown=score_breakdown,
                classification=classification_dict,
                networks_analyzed=multi_features.networks_analyzed,
                total_networks=multi_features.total_networks,
                ttl_hours=24
            )
            logger.info(f"✓ Score cached in Redis")
            
            logger.info(f"✓✓✓ Score calculation completed for {wallet_address}: {score}")
            logger.info(f"========== CELERY TASK COMPLETED SUCCESSFULLY ==========")
            
            # Trigger webhook
            send_webhook_task.delay(
                wallet_address=wallet_address,
                event_type='score_calculated',
                data={'score': score, 'task_id': self.request.id}
            )
            
            return {
                'score': score,
                'score_breakdown': score_breakdown,
                'classification': classification_dict,
                'networks_analyzed': multi_features.networks_analyzed,
                'task_id': self.request.id
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌❌❌ Score calculation failed for {wallet_address}: {e}", exc_info=True)
        logger.error(f"========== CELERY TASK FAILED ==========")
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise


@celery_app.task(bind=True, name='celery_tasks.refresh_score_task')
def refresh_score_task(self, wallet_address: str, incremental: bool = True):
    """
    Background task to refresh credit score
    
    Args:
        self: Celery task instance
        wallet_address: Wallet address
        incremental: If True, only fetch new data
    """
    # Invalidate cache
    from redis_cache import redis_cache
    redis_cache.delete_score(wallet_address)
    
    # Recalculate
    return calculate_credit_score_task(wallet_address)


@celery_app.task(name='celery_tasks.generate_zk_proof_task')
def generate_zk_proof_task(wallet_address: str, threshold: int = 700):
    """
    Background task to generate ZK proof
    
    Args:
        wallet_address: Wallet address
        threshold: Score threshold to prove (0-900)
        
    Returns:
        Dict with proof data or error
    """
    import sys
    import os
    import subprocess
    import json
    
    # Add Backend directory to Python path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    from database import SessionLocal
    from db_models import CreditScore, FeatureData
    from zk_witness_service import zk_witness_service
    from feature_extraction_models import FeatureVector
    from credit_score_models import CreditScoreResult, CreditScoreBreakdown
    
    try:
        logger.info(f"Starting ZK proof generation for {wallet_address}, threshold: {threshold}")
        
        db = SessionLocal()
        try:
            # Get credit score
            score_data = db.query(CreditScore).filter(
                CreditScore.wallet_address == wallet_address.lower()
            ).first()
            
            if not score_data:
                raise Exception("No credit score found. Calculate score first.")
            
            # Get feature data
            feature_data = db.query(FeatureData).filter(
                FeatureData.wallet_address == wallet_address.lower()
            ).first()
            
            if not feature_data:
                raise Exception("No feature data found. Calculate score first.")
            
            # Reconstruct feature vector
            features_dict = json.loads(feature_data.features_json)
            from feature_extraction_models import (
                ActivityFeatures, FinancialFeatures, ProtocolInteractionFeatures,
                RiskFeatures, TemporalFeatures, BehavioralClassification, AnalysisWindow
            )
            
            features = FeatureVector(
                wallet_address=feature_data.wallet_address,
                network=feature_data.network,
                chain_id=feature_data.chain_id,
                analysis_window=AnalysisWindow(**features_dict["analysis_window"]),
                activity=ActivityFeatures(**features_dict["activity"]),
                financial=FinancialFeatures(**features_dict["financial"]),
                protocol=ProtocolInteractionFeatures(**features_dict["protocol"]),
                risk=RiskFeatures(**features_dict["risk"]),
                temporal=TemporalFeatures(**features_dict["temporal"]),
                classification=BehavioralClassification(**features_dict["classification"]),
                extracted_at=feature_data.extracted_at,
                feature_version=features_dict.get("feature_version", "1.0.0")
            )
            
            # Reconstruct score result
            breakdown_dict = json.loads(score_data.breakdown_json)
            breakdown = CreditScoreBreakdown(**breakdown_dict)
            
            score_result = CreditScoreResult(
                credit_score=score_data.credit_score,
                score_band=score_data.score_band,
                breakdown=breakdown,
                raw_score=score_data.raw_score,
                timestamp=score_data.calculated_at,
                feature_version=score_data.feature_version,
                engine_version=score_data.engine_version
            )
            
            # Generate witness
            logger.info("Generating ZK witness...")
            witness = zk_witness_service.generate_witness(
                features=features,
                score_result=score_result,
                threshold=threshold,
                wallet_address=wallet_address
            )
            
            # Validate witness
            zk_witness_service.validate_witness(witness)
            
            # Save witness to temp file
            witness_file = os.path.join(backend_dir, f'witness_{wallet_address[:10]}.json')
            circuit_input = {**witness['public_inputs'], **witness['private_inputs']}
            
            with open(witness_file, 'w') as f:
                json.dump(circuit_input, f, indent=2)
            
            logger.info(f"Witness saved to {witness_file}")
            
            # Check if circuit files exist
            circuit_dir = os.path.join(os.path.dirname(backend_dir), 'circuits')
            test_script = os.path.join(circuit_dir, 'scripts', 'test-proof.js')
            
            if not os.path.exists(test_script):
                logger.warning("Circuit not built. Returning witness only.")
                return {
                    'wallet_address': wallet_address,
                    'witness': witness,
                    'status': 'witness_generated',
                    'message': 'Circuit not built. Run: cd circuits && npm run full-build'
                }
            
            # Generate proof using Node.js script
            logger.info("Generating proof via Node.js...")
            result = subprocess.run(
                ['node', test_script],
                cwd=circuit_dir,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                # Parse proof report
                report_file = os.path.join(circuit_dir, 'build', 'test-proof-report.json')
                if os.path.exists(report_file):
                    with open(report_file, 'r') as f:
                        report = json.load(f)
                    
                    logger.info(f"Proof generated successfully in {report['performance']['proof_generation_ms']/1000:.2f}s")
                    
                    return {
                        'wallet_address': wallet_address,
                        'witness': witness,
                        'proof_report': report,
                        'status': 'success',
                        'message': 'Proof generated successfully'
                    }
                else:
                    return {
                        'wallet_address': wallet_address,
                        'witness': witness,
                        'status': 'success',
                        'message': 'Proof generated (report not found)'
                    }
            else:
                logger.error(f"Proof generation failed: {result.stderr}")
                return {
                    'wallet_address': wallet_address,
                    'witness': witness,
                    'status': 'proof_failed',
                    'error': result.stderr,
                    'message': 'Witness generated but proof failed'
                }
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"ZK proof generation failed for {wallet_address}: {e}")
        return {
            'wallet_address': wallet_address,
            'status': 'error',
            'error': str(e)
        }


@celery_app.task(name='celery_tasks.send_webhook_task')
def send_webhook_task(wallet_address: str, event_type: str, data: Dict[str, Any]):
    """
    Send webhook notification
    
    Args:
        wallet_address: Wallet address
        event_type: Type of event (score_calculated, score_refreshed, etc.)
        data: Event data
    """
    from database import SessionLocal
    from db_models import WebhookSubscription
    import requests
    
    db = SessionLocal()
    try:
        # Get webhook subscriptions for this wallet
        # Silently skip if webhook table doesn't exist or query fails
        try:
            subscriptions = db.query(WebhookSubscription).filter(
                WebhookSubscription.wallet_address == wallet_address.lower(),
                WebhookSubscription.is_active == True
            ).all()
            
            # Filter by event type in Python since JSON contains() has issues
            subscriptions = [s for s in subscriptions if event_type in s.events]
        except Exception as e:
            logger.debug(f"Webhook query failed (non-critical): {e}")
            return  # Silently skip webhooks
        
        for sub in subscriptions:
            try:
                payload = {
                    'event_type': event_type,
                    'wallet_address': wallet_address,
                    'data': data,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                response = requests.post(
                    sub.webhook_url,
                    json=payload,
                    headers={'X-Webhook-Secret': sub.secret},
                    timeout=10
                )
                
                if response.status_code == 200:
                    logger.info(f"Webhook sent to {sub.webhook_url} for {wallet_address}")
                else:
                    logger.warning(f"Webhook failed: {response.status_code}")
                    
            except Exception as e:
                logger.error(f"Failed to send webhook to {sub.webhook_url}: {e}")
                
    finally:
        db.close()


@celery_app.task(name='celery_tasks.cleanup_old_scores')
def cleanup_old_scores():
    """Periodic task to cleanup old scores"""
    from database import SessionLocal
    from db_models import CreditScore
    from datetime import timedelta
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)
        deleted = db.query(CreditScore).filter(
            CreditScore.calculated_at < cutoff_date
        ).delete()
        db.commit()
        
        logger.info(f"Cleaned up {deleted} old credit scores")
        
    finally:
        db.close()


# Periodic tasks
celery_app.conf.beat_schedule = {
    'cleanup-old-scores': {
        'task': 'celery_tasks.cleanup_old_scores',
        'schedule': 86400.0,  # Daily
    },
}
