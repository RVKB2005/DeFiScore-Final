"""
Background Job Queue
Handles async processing of ingestion, scoring, and ZK proof generation
"""
import uuid
import asyncio
from typing import Dict, Optional, Callable, Any
from datetime import datetime, timezone
from credit_score_models import BackgroundJob, JobStatus
import logging

logger = logging.getLogger(__name__)


class JobQueue:
    """
    Simple in-memory job queue for background processing
    In production, use Celery, RQ, or similar
    """
    
    def __init__(self):
        self.jobs: Dict[str, BackgroundJob] = {}
        self.workers: Dict[str, asyncio.Task] = {}
    
    def create_job(
        self,
        wallet_address: str,
        job_type: str
    ) -> BackgroundJob:
        """Create a new background job"""
        job_id = str(uuid.uuid4())
        
        job = BackgroundJob(
            job_id=job_id,
            wallet_address=wallet_address.lower(),
            job_type=job_type,
            status=JobStatus.QUEUED,
            progress=0,
            created_at=datetime.now(timezone.utc)
        )
        
        self.jobs[job_id] = job
        logger.info(f"Created job {job_id} for {wallet_address}: {job_type}")
        
        return job
    
    def get_job(self, job_id: str) -> Optional[BackgroundJob]:
        """Get job by ID"""
        return self.jobs.get(job_id)
    
    def get_jobs_by_wallet(self, wallet_address: str) -> list[BackgroundJob]:
        """Get all jobs for a wallet"""
        wallet_lower = wallet_address.lower()
        return [
            job for job in self.jobs.values()
            if job.wallet_address == wallet_lower
        ]
    
    def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        error_message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None
    ):
        """Update job status"""
        job = self.jobs.get(job_id)
        if not job:
            return
        
        if status:
            job.status = status
            if status == JobStatus.RUNNING and not job.started_at:
                job.started_at = datetime.now(timezone.utc)
            elif status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                job.completed_at = datetime.now(timezone.utc)
        
        if progress is not None:
            job.progress = progress
        
        if error_message:
            job.error_message = error_message
        
        if result:
            job.result = result
        
        self.jobs[job_id] = job
    
    async def execute_job(
        self,
        job_id: str,
        worker_func: Callable,
        *args,
        **kwargs
    ):
        """Execute a job asynchronously"""
        try:
            self.update_job(job_id, status=JobStatus.RUNNING, progress=0)
            
            # Execute the worker function
            result = await worker_func(job_id, *args, **kwargs)
            
            self.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                result=result
            )
            
            logger.info(f"Job {job_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            self.update_job(
                job_id,
                status=JobStatus.FAILED,
                error_message=str(e)
            )
    
    def start_job(
        self,
        job_id: str,
        worker_func: Callable,
        *args,
        **kwargs
    ):
        """Start a job in the background"""
        task = asyncio.create_task(
            self.execute_job(job_id, worker_func, *args, **kwargs)
        )
        self.workers[job_id] = task
        return task
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove old completed jobs"""
        now = datetime.now(timezone.utc)
        to_remove = []
        
        for job_id, job in self.jobs.items():
            if job.completed_at:
                age = (now - job.completed_at).total_seconds() / 3600
                if age > max_age_hours:
                    to_remove.append(job_id)
        
        for job_id in to_remove:
            del self.jobs[job_id]
            if job_id in self.workers:
                del self.workers[job_id]
        
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} old jobs")


# Global job queue instance
job_queue = JobQueue()
