"""
Monitoring Service
Tracks ZK proof generation metrics, performance, and errors
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
import logging
from collections import defaultdict
import json

logger = logging.getLogger(__name__)


@dataclass
class ProofMetric:
    """Proof generation metric"""
    wallet_address: str
    threshold: int
    success: bool
    duration_ms: Optional[int]
    stage: str  # 'witness', 'generation', 'submission'
    error: Optional[str]
    timestamp: datetime
    gas_used: Optional[int] = None
    tx_hash: Optional[str] = None


@dataclass
class SystemMetrics:
    """System-wide metrics"""
    total_proofs_generated: int
    successful_proofs: int
    failed_proofs: int
    average_duration_ms: float
    average_gas_used: float
    unique_users: int
    proofs_last_24h: int
    errors_last_24h: int


class MonitoringService:
    """
    Service for monitoring ZK proof system
    
    Tracks:
    - Proof generation success/failure rates
    - Performance metrics (duration, gas)
    - Error patterns
    - User activity
    """
    
    def __init__(self):
        self.metrics: List[ProofMetric] = []
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.user_activity: Dict[str, List[datetime]] = defaultdict(list)
        
    def record_proof_attempt(
        self,
        wallet_address: str,
        threshold: int,
        success: bool,
        duration_ms: Optional[int] = None,
        stage: str = 'generation',
        error: Optional[str] = None,
        gas_used: Optional[int] = None,
        tx_hash: Optional[str] = None
    ):
        """Record a proof generation attempt"""
        metric = ProofMetric(
            wallet_address=wallet_address.lower(),
            threshold=threshold,
            success=success,
            duration_ms=duration_ms,
            stage=stage,
            error=error,
            timestamp=datetime.now(timezone.utc),
            gas_used=gas_used,
            tx_hash=tx_hash
        )
        
        self.metrics.append(metric)
        
        # Track errors
        if error:
            self.error_counts[error] += 1
        
        # Track user activity
        self.user_activity[wallet_address.lower()].append(metric.timestamp)
        
        # Log
        if success:
            logger.info(
                f"Proof generated successfully: {wallet_address} "
                f"(threshold: {threshold}, duration: {duration_ms}ms, gas: {gas_used})"
            )
        else:
            logger.error(
                f"Proof generation failed: {wallet_address} "
                f"(stage: {stage}, error: {error})"
            )
    
    def get_system_metrics(self, hours: int = 24) -> SystemMetrics:
        """Get system-wide metrics for last N hours"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_metrics = [m for m in self.metrics if m.timestamp >= cutoff]
        
        if not recent_metrics:
            return SystemMetrics(
                total_proofs_generated=0,
                successful_proofs=0,
                failed_proofs=0,
                average_duration_ms=0.0,
                average_gas_used=0.0,
                unique_users=0,
                proofs_last_24h=0,
                errors_last_24h=0
            )
        
        successful = [m for m in recent_metrics if m.success]
        failed = [m for m in recent_metrics if not m.success]
        
        # Calculate averages
        durations = [m.duration_ms for m in successful if m.duration_ms]
        gas_used = [m.gas_used for m in successful if m.gas_used]
        
        avg_duration = sum(durations) / len(durations) if durations else 0.0
        avg_gas = sum(gas_used) / len(gas_used) if gas_used else 0.0
        
        # Unique users
        unique_users = len(set(m.wallet_address for m in recent_metrics))
        
        return SystemMetrics(
            total_proofs_generated=len(recent_metrics),
            successful_proofs=len(successful),
            failed_proofs=len(failed),
            average_duration_ms=avg_duration,
            average_gas_used=avg_gas,
            unique_users=unique_users,
            proofs_last_24h=len(recent_metrics),
            errors_last_24h=len(failed)
        )
    
    def get_error_summary(self, hours: int = 24) -> Dict[str, int]:
        """Get error counts for last N hours"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_errors = [
            m.error for m in self.metrics 
            if m.timestamp >= cutoff and m.error
        ]
        
        error_counts = defaultdict(int)
        for error in recent_errors:
            error_counts[error] += 1
        
        return dict(error_counts)
    
    def get_user_metrics(self, wallet_address: str) -> Dict[str, Any]:
        """Get metrics for specific user"""
        user_metrics = [
            m for m in self.metrics 
            if m.wallet_address == wallet_address.lower()
        ]
        
        if not user_metrics:
            return {
                "wallet_address": wallet_address,
                "total_attempts": 0,
                "successful_proofs": 0,
                "failed_proofs": 0,
                "last_attempt": None
            }
        
        successful = [m for m in user_metrics if m.success]
        failed = [m for m in user_metrics if not m.success]
        
        return {
            "wallet_address": wallet_address,
            "total_attempts": len(user_metrics),
            "successful_proofs": len(successful),
            "failed_proofs": len(failed),
            "last_attempt": max(m.timestamp for m in user_metrics).isoformat(),
            "average_duration_ms": (
                sum(m.duration_ms for m in successful if m.duration_ms) / len(successful)
                if successful else 0.0
            )
        }
    
    def get_performance_percentiles(self) -> Dict[str, float]:
        """Get performance percentiles"""
        successful = [m for m in self.metrics if m.success and m.duration_ms]
        
        if not successful:
            return {"p50": 0.0, "p90": 0.0, "p95": 0.0, "p99": 0.0}
        
        durations = sorted([m.duration_ms for m in successful])
        n = len(durations)
        
        return {
            "p50": durations[int(n * 0.50)],
            "p90": durations[int(n * 0.90)],
            "p95": durations[int(n * 0.95)],
            "p99": durations[int(n * 0.99)]
        }
    
    def check_alerts(self) -> List[Dict[str, Any]]:
        """Check for alert conditions"""
        alerts = []
        
        # Get recent metrics (last hour)
        metrics = self.get_system_metrics(hours=1)
        
        # Alert: High failure rate (>20%)
        if metrics.total_proofs_generated > 10:
            failure_rate = metrics.failed_proofs / metrics.total_proofs_generated
            if failure_rate > 0.20:
                alerts.append({
                    "severity": "high",
                    "type": "high_failure_rate",
                    "message": f"Failure rate: {failure_rate:.1%} (last hour)",
                    "value": failure_rate
                })
        
        # Alert: Slow proof generation (>30s average)
        if metrics.average_duration_ms > 30000:
            alerts.append({
                "severity": "medium",
                "type": "slow_performance",
                "message": f"Average duration: {metrics.average_duration_ms/1000:.1f}s",
                "value": metrics.average_duration_ms
            })
        
        # Alert: High gas usage (>500k average)
        if metrics.average_gas_used > 500000:
            alerts.append({
                "severity": "medium",
                "type": "high_gas_usage",
                "message": f"Average gas: {metrics.average_gas_used:.0f}",
                "value": metrics.average_gas_used
            })
        
        # Alert: Many errors (>10 in last hour)
        if metrics.errors_last_24h > 10:
            alerts.append({
                "severity": "high",
                "type": "many_errors",
                "message": f"Errors in last hour: {metrics.errors_last_24h}",
                "value": metrics.errors_last_24h
            })
        
        return alerts
    
    def export_metrics(self, hours: int = 24) -> str:
        """Export metrics as JSON"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_metrics = [m for m in self.metrics if m.timestamp >= cutoff]
        
        data = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "time_range_hours": hours,
            "system_metrics": asdict(self.get_system_metrics(hours)),
            "error_summary": self.get_error_summary(hours),
            "performance_percentiles": self.get_performance_percentiles(),
            "alerts": self.check_alerts(),
            "metrics": [
                {
                    **asdict(m),
                    "timestamp": m.timestamp.isoformat()
                }
                for m in recent_metrics
            ]
        }
        
        return json.dumps(data, indent=2)
    
    def clear_old_metrics(self, days: int = 7):
        """Clear metrics older than N days"""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        self.metrics = [m for m in self.metrics if m.timestamp >= cutoff]
        
        # Clear old user activity
        for wallet in list(self.user_activity.keys()):
            self.user_activity[wallet] = [
                ts for ts in self.user_activity[wallet] 
                if ts >= cutoff
            ]
            if not self.user_activity[wallet]:
                del self.user_activity[wallet]
        
        logger.info(f"Cleared metrics older than {days} days")


# Global monitoring service instance
monitoring_service = MonitoringService()
