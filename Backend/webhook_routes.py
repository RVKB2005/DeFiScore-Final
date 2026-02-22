"""
Webhook Management Routes
Allow users to register webhooks for notifications
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl
from typing import List
from database import SessionLocal
from db_models import WebhookSubscription
from dependencies import get_current_wallet
import secrets
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])


class WebhookRegisterRequest(BaseModel):
    webhook_url: HttpUrl
    events: List[str]  # ['score_calculated', 'score_refreshed', etc.]


class WebhookResponse(BaseModel):
    id: int
    webhook_url: str
    events: List[str]
    secret: str
    is_active: bool


@router.post("/register", response_model=WebhookResponse)
async def register_webhook(
    request: WebhookRegisterRequest,
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Register a webhook for notifications
    
    SECURITY:
    - Requires JWT authentication
    - Generates secret for webhook verification
    - Rate limited to 5 registrations per day
    
    Events:
    - score_calculated: When score calculation completes
    - score_refreshed: When score is refreshed
    - zk_proof_generated: When ZK proof is ready
    """
    from rate_limiter import rate_limiter
    
    # Rate limiting
    allowed, retry_after = rate_limiter.check_rate_limit(current_wallet, 'webhook_register')
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds."
        )
    
    # Generate secret
    secret = secrets.token_urlsafe(32)
    
    db = SessionLocal()
    try:
        webhook = WebhookSubscription(
            wallet_address=current_wallet.lower(),
            webhook_url=str(request.webhook_url),
            secret=secret,
            events=request.events,
            is_active=True
        )
        db.add(webhook)
        db.commit()
        db.refresh(webhook)
        
        logger.info(f"Webhook registered for {current_wallet}: {request.webhook_url}")
        
        return WebhookResponse(
            id=webhook.id,
            webhook_url=webhook.webhook_url,
            events=webhook.events,
            secret=webhook.secret,
            is_active=webhook.is_active
        )
        
    finally:
        db.close()


@router.get("/list", response_model=List[WebhookResponse])
async def list_webhooks(
    current_wallet: str = Depends(get_current_wallet)
):
    """List all webhooks for authenticated wallet"""
    db = SessionLocal()
    try:
        webhooks = db.query(WebhookSubscription).filter(
            WebhookSubscription.wallet_address == current_wallet.lower()
        ).all()
        
        return [
            WebhookResponse(
                id=w.id,
                webhook_url=w.webhook_url,
                events=w.events,
                secret=w.secret,
                is_active=w.is_active
            )
            for w in webhooks
        ]
        
    finally:
        db.close()


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    current_wallet: str = Depends(get_current_wallet)
):
    """Delete a webhook"""
    db = SessionLocal()
    try:
        webhook = db.query(WebhookSubscription).filter(
            WebhookSubscription.id == webhook_id,
            WebhookSubscription.wallet_address == current_wallet.lower()
        ).first()
        
        if not webhook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook not found"
            )
        
        db.delete(webhook)
        db.commit()
        
        return {"message": "Webhook deleted successfully"}
        
    finally:
        db.close()


@router.patch("/{webhook_id}/toggle")
async def toggle_webhook(
    webhook_id: int,
    current_wallet: str = Depends(get_current_wallet)
):
    """Enable/disable a webhook"""
    db = SessionLocal()
    try:
        webhook = db.query(WebhookSubscription).filter(
            WebhookSubscription.id == webhook_id,
            WebhookSubscription.wallet_address == current_wallet.lower()
        ).first()
        
        if not webhook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook not found"
            )
        
        webhook.is_active = not webhook.is_active
        db.commit()
        
        return {
            "message": f"Webhook {'enabled' if webhook.is_active else 'disabled'}",
            "is_active": webhook.is_active
        }
        
    finally:
        db.close()
