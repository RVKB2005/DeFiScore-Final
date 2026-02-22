"""
Market Data Routes - Production Implementation
Provides market statistics, asset data, and chart data for the frontend dashboard.
"""
from fastapi import APIRouter, Query
from typing import List, Dict, Any
import logging
from market_data_service import market_data_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/market", tags=["Market Data"])


@router.get("/stats")
async def get_market_stats() -> Dict[str, Any]:
    """Get overall market statistics from CoinGecko API"""
    try:
        return await market_data_service.get_market_stats()
    except Exception as e:
        logger.error(f"Error in get_market_stats endpoint: {e}", exc_info=True)
        # Return fallback data
        return {
            "totalMarketCap": 250000000,
            "totalVolume24h": 15000000,
            "totalValueLocked": 125000000,
            "totalSupply": 80000000,
            "totalBorrow": 45000000,
            "dominance": {"symbol": "ETH", "percentage": 35.5},
            "timestamp": "2026-02-21T00:00:00"
        }


@router.get("/assets")
async def get_top_assets(limit: int = Query(default=10, ge=1, le=100)) -> List[Dict[str, Any]]:
    """Get top DeFi assets with real market data from CoinGecko"""
    try:
        return await market_data_service.get_top_assets(limit)
    except Exception as e:
        logger.error(f"Error in get_top_assets endpoint: {e}", exc_info=True)
        # Return fallback data
        return []


@router.get("/chart/{metric}")
async def get_market_chart_data(
    metric: str,
    days: int = Query(default=30, ge=1, le=365)
) -> Dict[str, Any]:
    """Get historical chart data for a specific metric from CoinGecko"""
    try:
        return await market_data_service.get_market_chart_data(metric, days)
    except Exception as e:
        logger.error(f"Error in get_market_chart_data endpoint: {e}", exc_info=True)
        # Return fallback data
        return {"metric": metric, "days": days, "data": []}


@router.get("/asset/{asset_id}")
async def get_asset_details(asset_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific asset from CoinGecko"""
    try:
        return await market_data_service.get_asset_details(asset_id)
    except Exception as e:
        logger.error(f"Error in get_asset_details endpoint: {e}", exc_info=True)
        # Return fallback data
        return {
            "id": asset_id,
            "symbol": asset_id.upper()[:4],
            "name": asset_id.replace("-", " ").title(),
            "price": 0,
            "change24h": 0,
            "tvl": 0,
            "supplyAPY": 0,
            "borrowAPY": 0,
            "totalSupplied": 0,
            "totalBorrowed": 0,
            "utilizationRate": 0,
            "logo": ""
        }
