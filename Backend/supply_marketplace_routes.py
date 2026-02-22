"""
Supply Marketplace Routes
Public endpoints for marketplace statistics (no auth required)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import get_db
from db_models import SupplierIntent, BorrowRequest
from market_data_service import market_data_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/supply-marketplace", tags=["Supply Marketplace"])


@router.get("/stats")
async def get_marketplace_stats(db: Session = Depends(get_db)):
    """
    Get public marketplace statistics
    No authentication required - public data
    """
    try:
        # Get total liquidity from active supplier intents
        total_liquidity = db.query(
            func.sum(SupplierIntent.available_amount)
        ).filter(
            SupplierIntent.active == True
        ).scalar() or 0
        
        # Get active suppliers count
        active_suppliers = db.query(
            func.count(func.distinct(SupplierIntent.supplier_address))
        ).filter(
            SupplierIntent.active == True
        ).scalar() or 0
        
        # Get pending borrow requests count
        pending_requests = db.query(
            func.count(BorrowRequest.id)
        ).filter(
            BorrowRequest.status == "pending"
        ).scalar() or 0
        
        # Calculate average APY from active intents
        avg_apy = db.query(
            func.avg(SupplierIntent.max_apy)
        ).filter(
            SupplierIntent.active == True
        ).scalar() or 0
        
        return {
            "total_liquidity": float(total_liquidity),
            "active_suppliers": active_suppliers,
            "pending_requests": pending_requests,
            "average_apy": float(avg_apy)
        }
    
    except Exception as e:
        logger.error(f"Failed to get marketplace stats: {e}", exc_info=True)
        # Return fallback data if database query fails
        return {
            "total_liquidity": 0,
            "active_suppliers": 0,
            "pending_requests": 0,
            "average_apy": 0
        }


@router.get("/top-opportunities")
async def get_top_supply_opportunities(db: Session = Depends(get_db)):
    """
    Get top supply opportunities by currency
    Shows best APY for each currency from active intents
    """
    try:
        # Get best APY per currency from supplier intents
        from sqlalchemy import desc
        
        opportunities = []
        currencies = ["USDC", "ETH", "DAI", "USDT", "WBTC"]
        
        for currency in currencies:
            # Get highest APY for this currency
            best_intent = db.query(SupplierIntent).filter(
                and_(
                    SupplierIntent.currency == currency,
                    SupplierIntent.active == True,
                    SupplierIntent.available_amount > 0
                )
            ).order_by(desc(SupplierIntent.max_apy)).first()
            
            if best_intent:
                # Get total available liquidity for this currency
                total_liquidity = db.query(
                    func.sum(SupplierIntent.available_amount)
                ).filter(
                    and_(
                        SupplierIntent.currency == currency,
                        SupplierIntent.active == True
                    )
                ).scalar() or 0
                
                opportunities.append({
                    "currency": currency,
                    "apy": float(best_intent.max_apy),
                    "available_liquidity": float(total_liquidity)
                })
        
        # If no data in database, fetch from market data service
        if not opportunities:
            try:
                assets = await market_data_service.get_top_assets(10)
                
                # Map to supply opportunities
                currency_map = {
                    "ETH": "ethereum",
                    "USDC": "usd-coin",
                    "USDT": "tether",
                    "DAI": "dai",
                    "WBTC": "wrapped-bitcoin"
                }
                
                for currency, asset_id in currency_map.items():
                    asset = next((a for a in assets if a["id"] == asset_id), None)
                    if asset:
                        opportunities.append({
                            "currency": currency,
                            "apy": asset.get("supplyApy", 5.0),
                            "available_liquidity": asset.get("volume24h", 0)
                        })
            except Exception as e:
                logger.warning(f"Failed to fetch market data: {e}")
        
        # Sort by APY descending
        opportunities.sort(key=lambda x: x["apy"], reverse=True)
        
        return opportunities[:5]  # Return top 5
    
    except Exception as e:
        logger.error(f"Failed to get supply opportunities: {e}", exc_info=True)
        return []


@router.get("/supplier-intents")
async def get_public_supplier_intents(
    currency: str = None,
    exclude_address: str = None,
    db: Session = Depends(get_db)
):
    """
    Get all active supplier intents (public endpoint for borrowers)
    No authentication required
    
    Args:
        currency: Filter by currency (optional)
        exclude_address: Exclude intents from this wallet address (optional, for preventing self-borrowing)
    """
    try:
        query = db.query(SupplierIntent).filter(SupplierIntent.active == True)
        
        if currency:
            query = query.filter(SupplierIntent.currency == currency)
        
        if exclude_address:
            query = query.filter(SupplierIntent.supplier_address != exclude_address.lower())
        
        intents = query.order_by(SupplierIntent.created_at.desc()).all()
        
        return [{
            "id": str(intent.id),
            "supplier_address": intent.supplier_address,
            "currency": intent.currency,
            "max_amount": float(intent.max_amount),
            "available_amount": float(intent.available_amount),
            "min_credit_score": intent.min_credit_score,
            "max_apy": float(intent.max_apy),
            "created_at": intent.created_at.isoformat()
        } for intent in intents]
    
    except Exception as e:
        logger.error(f"Failed to get public supplier intents: {e}", exc_info=True)
        return []
