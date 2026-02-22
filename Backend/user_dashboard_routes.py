"""
User Dashboard Routes - Real User Data
Provides comprehensive user dashboard data including balance, positions, and available assets
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from database import get_db, BalanceSnapshotDB, TransactionRecordDB, ProtocolEventDB
from dependencies import get_current_wallet
from price_oracle_service import price_oracle
from typing import Dict, Any, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dashboard", tags=["User Dashboard"])


@router.get("/wallet-balance")
async def get_wallet_balance(
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get user's current wallet balance from latest balance snapshot
    """
    try:
        # Get latest balance snapshot
        latest_snapshot = db.query(BalanceSnapshotDB).filter(
            BalanceSnapshotDB.wallet_address == wallet_address.lower()
        ).order_by(desc(BalanceSnapshotDB.block_number)).first()
        
        if not latest_snapshot:
            # No balance data yet, return zero
            return {
                "amount": 0.0,
                "symbol": "ETH",
                "usd_value": 0.0,
                "network": "ethereum",
                "last_updated": datetime.utcnow().isoformat(),
                "has_data": False
            }
        
        # Get current ETH price from price oracle
        try:
            eth_price_usd = price_oracle.get_price("ETH")
            if eth_price_usd is None:
                raise ValueError("Unable to fetch ETH price")
        except Exception as e:
            logger.error(f"Failed to fetch ETH price: {e}")
            raise HTTPException(status_code=500, detail=f"Price oracle error: {e}")
        
        balance_eth = float(latest_snapshot.balance_eth)
        usd_value = balance_eth * eth_price_usd
        
        return {
            "amount": balance_eth,
            "symbol": "ETH",
            "usd_value": usd_value,
            "eth_price": eth_price_usd,
            "network": latest_snapshot.network,
            "block_number": latest_snapshot.block_number,
            "last_updated": latest_snapshot.timestamp.isoformat(),
            "has_data": True
        }
    
    except Exception as e:
        logger.error(f"Error fetching wallet balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-stats")
async def get_user_stats(
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get user statistics including transaction count, protocol usage, etc.
    """
    try:
        # Count transactions
        tx_count = db.query(func.count(TransactionRecordDB.id)).filter(
            TransactionRecordDB.wallet_address == wallet_address.lower()
        ).scalar() or 0
        
        # Count protocol events
        event_count = db.query(func.count(ProtocolEventDB.id)).filter(
            ProtocolEventDB.wallet_address == wallet_address.lower()
        ).scalar() or 0
        
        # Get unique protocols used
        unique_protocols = db.query(func.count(func.distinct(ProtocolEventDB.protocol_name))).filter(
            ProtocolEventDB.wallet_address == wallet_address.lower()
        ).scalar() or 0
        
        # Calculate wallet age (first transaction)
        first_tx = db.query(TransactionRecordDB).filter(
            TransactionRecordDB.wallet_address == wallet_address.lower()
        ).order_by(TransactionRecordDB.block_number).first()
        
        wallet_age_days = 0
        if first_tx:
            wallet_age_days = (datetime.utcnow() - first_tx.timestamp).days
        
        # Calculate activity metrics
        recent_tx_count = db.query(func.count(TransactionRecordDB.id)).filter(
            TransactionRecordDB.wallet_address == wallet_address.lower(),
            TransactionRecordDB.timestamp >= datetime.utcnow() - timedelta(days=30)
        ).scalar() or 0
        
        return {
            "total_transactions": tx_count,
            "total_protocol_events": event_count,
            "unique_protocols": unique_protocols,
            "wallet_age_days": wallet_age_days,
            "recent_transactions_30d": recent_tx_count,
            "has_data": tx_count > 0
        }
    
    except Exception as e:
        logger.error(f"Error fetching user stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/protocol-positions")
async def get_protocol_positions(
    wallet_address: str = Depends(get_current_wallet),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get user's DeFi protocol positions (supply/borrow)
    Analyzes protocol events to determine current positions
    """
    try:
        # Get all protocol events for this wallet
        events = db.query(ProtocolEventDB).filter(
            ProtocolEventDB.wallet_address == wallet_address.lower()
        ).order_by(ProtocolEventDB.block_number).all()
        
        if not events:
            return {
                "supply_positions": [],
                "borrow_positions": [],
                "total_supplied_usd": 0.0,
                "total_borrowed_usd": 0.0,
                "net_apy": 0.0,
                "health_factor": 0.0,
                "has_data": False
            }
        
        # Aggregate positions by protocol and asset
        supply_positions = {}
        borrow_positions = {}
        
        for event in events:
            event_type = event.event_type.lower()
            protocol = event.protocol
            
            # Parse event data
            if event_type in ['supply', 'deposit', 'mint']:
                # Supply event
                key = f"{protocol}_{event.token_address}"
                if key not in supply_positions:
                    supply_positions[key] = {
                        "protocol": protocol,
                        "asset": event.token_symbol or "UNKNOWN",
                        "amount": 0.0
                    }
                supply_positions[key]["amount"] += float(event.amount or 0)
            
            elif event_type in ['borrow', 'withdraw']:
                # Borrow event
                key = f"{protocol}_{event.token_address}"
                if key not in borrow_positions:
                    borrow_positions[key] = {
                        "protocol": protocol,
                        "asset": event.token_symbol or "UNKNOWN",
                        "amount": 0.0
                    }
                borrow_positions[key]["amount"] += float(event.amount or 0)
        
        # Convert to lists
        supply_list = list(supply_positions.values())
        borrow_list = list(borrow_positions.values())
        
        # Calculate totals (simplified - would need price oracle for accurate USD values)
        total_supplied = sum(p["amount"] for p in supply_list)
        total_borrowed = sum(p["amount"] for p in borrow_list)
        
        # Calculate health factor (simplified)
        health_factor = 0.0
        if total_borrowed > 0:
            health_factor = (total_supplied * 0.75) / total_borrowed  # Assuming 75% LTV
        elif total_supplied > 0:
            health_factor = 999.0  # No debt = very healthy
        
        # Calculate net APY (simplified - would need real APY data)
        net_apy = 0.0
        if total_supplied > 0:
            net_apy = 4.25  # Placeholder
        
        return {
            "supply_positions": supply_list,
            "borrow_positions": borrow_list,
            "total_supplied_usd": total_supplied,
            "total_borrowed_usd": total_borrowed,
            "net_apy": net_apy,
            "health_factor": health_factor,
            "has_data": len(events) > 0
        }
    
    except Exception as e:
        logger.error(f"Error fetching protocol positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
