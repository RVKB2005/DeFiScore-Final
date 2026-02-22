"""
Celery Application Configuration
Production-grade async task queue
"""
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
from config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    'defiscore',
    broker=f'redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/1',
    backend=f'redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/2'
)

# Celery Configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max
    task_soft_time_limit=540,  # 9 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=3600,  # Results expire after 1 hour
    broker_connection_retry_on_startup=True
)

# Task routes - Use default queue for simplicity
# celery_app.conf.task_routes = {
#     'celery_tasks.calculate_credit_score_task': {'queue': 'scoring'},
#     'celery_tasks.refresh_score_task': {'queue': 'scoring'},
#     'celery_tasks.generate_zk_proof_task': {'queue': 'proofs'},
#     'celery_tasks.send_webhook_task': {'queue': 'webhooks'},
# }


@task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    """Log when task starts"""
    logger.info(f"Task {task.name} [{task_id}] started")


@task_postrun.connect
def task_postrun_handler(task_id, task, *args, **kwargs):
    """Log when task completes"""
    logger.info(f"Task {task.name} [{task_id}] completed")


@task_failure.connect
def task_failure_handler(task_id, exception, *args, **kwargs):
    """Log when task fails"""
    logger.error(f"Task [{task_id}] failed: {exception}")


# Import tasks to register them
import celery_tasks  # noqa: F401
