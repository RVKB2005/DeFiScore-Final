"""
Monitoring and Alerting
System health monitoring and alert management
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from database import SessionLocal
from db_models import MetricsLog, AlertLog
import logging
import time
from functools import wraps

logger = logging.getLogger(__name__)


class Monitor:
    """
    System monitoring and metrics collection
    """
    
    def __init__(self):
        self.alert_thresholds = {
            'task_failure_rate': 0.1,  # 10% failure rate
            'api_response_time': 5.0,  # 5 seconds
            'cache_miss_rate': 0.5,  # 50% miss rate
            'redis_connection_failures': 5,  # 5 failures
        }
    
    def record_metric(
        self,
        metric_type: str,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, Any]] = None
    ):
        """
        Record a metric to database
        
        Args:
            metric_type: Type of metric (score_calculation, api_request, etc.)
            metric_name: Name of the metric
            value: Metric value
            tags: Additional metadata
        """
        db = SessionLocal()
        try:
            metric = MetricsLog(
                metric_type=metric_type,
                metric_name=metric_name,
                value=value,
                tags=tags,
                timestamp=datetime.now(timezone.utc)
            )
            db.add(metric)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to record metric: {e}")
            db.rollback()
        finally:
            db.close()
    
    def create_alert(
        self,
        alert_type: str,
        alert_level: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Create an alert
        
        Args:
            alert_type: Type of alert (error, warning, info)
            alert_level: Severity (critical, high, medium, low)
            message: Alert message
            details: Additional details
        """
        db = SessionLocal()
        try:
            alert = AlertLog(
                alert_type=alert_type,
                alert_level=alert_level,
                message=message,
                details=details,
                created_at=datetime.now(timezone.utc)
            )
            db.add(alert)
            db.commit()
            
            # Log critical alerts
            if alert_level == 'critical':
                logger.critical(f"ALERT: {message}")
            elif alert_level == 'high':
                logger.error(f"ALERT: {message}")
            else:
                logger.warning(f"ALERT: {message}")
                
        except Exception as e:
            logger.error(f"Failed to create alert: {e}")
            db.rollback()
        finally:
            db.close()
    
    def resolve_alert(self, alert_id: int):
        """Mark alert as resolved"""
        db = SessionLocal()
        try:
            alert = db.query(AlertLog).filter(AlertLog.id == alert_id).first()
            if alert:
                alert.resolved = True
                alert.resolved_at = datetime.now(timezone.utc)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to resolve alert: {e}")
            db.rollback()
        finally:
            db.close()
    
    def check_system_health(self) -> Dict[str, Any]:
        """
        Check overall system health
        
        Returns:
            Dict with health status
        """
        health = {
            'status': 'healthy',
            'checks': {},
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Check Redis
        try:
            from redis_cache import redis_cache
            redis_healthy = redis_cache.health_check()
            health['checks']['redis'] = 'healthy' if redis_healthy else 'unhealthy'
            if not redis_healthy:
                health['status'] = 'degraded'
        except Exception as e:
            health['checks']['redis'] = f'error: {str(e)}'
            health['status'] = 'degraded'
        
        # Check Database
        try:
            from sqlalchemy import text
            db = SessionLocal()
            db.execute(text('SELECT 1'))
            db.close()
            health['checks']['database'] = 'healthy'
        except Exception as e:
            health['checks']['database'] = f'error: {str(e)}'
            health['status'] = 'unhealthy'
        
        # Check Celery
        try:
            from celery_app import celery_app
            inspect = celery_app.control.inspect()
            active = inspect.active()
            health['checks']['celery'] = 'healthy' if active else 'no_workers'
            if not active:
                health['status'] = 'degraded'
        except Exception as e:
            health['checks']['celery'] = f'error: {str(e)}'
            health['status'] = 'degraded'
        
        return health
    
    def get_metrics_summary(
        self,
        metric_type: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get metrics summary for time period
        
        Args:
            metric_type: Type of metrics to summarize
            hours: Number of hours to look back
            
        Returns:
            Summary statistics
        """
        from datetime import timedelta
        
        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
            
            metrics = db.query(MetricsLog).filter(
                MetricsLog.metric_type == metric_type,
                MetricsLog.timestamp >= cutoff
            ).all()
            
            if not metrics:
                return {'count': 0, 'message': 'No metrics found'}
            
            values = [m.value for m in metrics]
            
            return {
                'count': len(values),
                'min': min(values),
                'max': max(values),
                'avg': sum(values) / len(values),
                'period_hours': hours
            }
            
        finally:
            db.close()


def monitor_performance(metric_name: str):
    """
    Decorator to monitor function performance
    
    Usage:
        @monitor_performance('score_calculation')
        def calculate_score():
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Record success metric
                monitor.record_metric(
                    metric_type='performance',
                    metric_name=metric_name,
                    value=duration,
                    tags={'status': 'success'}
                )
                
                # Alert if too slow
                if duration > monitor.alert_thresholds.get('api_response_time', 5.0):
                    monitor.create_alert(
                        alert_type='performance',
                        alert_level='medium',
                        message=f'{metric_name} took {duration:.2f}s',
                        details={'function': func.__name__, 'duration': duration}
                    )
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                # Record failure metric
                monitor.record_metric(
                    metric_type='performance',
                    metric_name=metric_name,
                    value=duration,
                    tags={'status': 'failure', 'error': str(e)}
                )
                
                # Create alert
                monitor.create_alert(
                    alert_type='error',
                    alert_level='high',
                    message=f'{metric_name} failed: {str(e)}',
                    details={'function': func.__name__, 'error': str(e)}
                )
                
                raise
        
        return wrapper
    return decorator


# Global monitor instance
monitor = Monitor()
