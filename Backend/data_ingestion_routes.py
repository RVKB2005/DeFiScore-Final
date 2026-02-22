"""
API Routes for Data Ingestion
Supports both single-chain and multi-chain ingestion
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import Optional, List
from data_ingestion_models import (
    WalletConnectionRequest,
    WalletConnectionResponse,
    IngestionSummary
)
from wallet_connection_service import WalletConnectionService
from data_ingestion_service import DataIngestionService
from multi_chain_ingestion_service import MultiChainIngestionService
from blockchain_client import BlockchainClient
from config import settings
from dependencies import get_current_wallet
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ingestion", tags=["Data Ingestion"])

# Initialize services
wallet_service = WalletConnectionService(base_url=settings.BASE_URL)


def get_blockchain_client():
    """Dependency for blockchain client (Polygon Amoy testnet)"""
    return BlockchainClient(settings.POLYGON_AMOY_RPC)


def get_ingestion_service(client: BlockchainClient = Depends(get_blockchain_client)):
    """Dependency for ingestion service (single chain)"""
    from config import settings
    return DataIngestionService(
        client, 
        network="polygon_amoy", 
        chain_id=80002,
        etherscan_api_key=settings.ETHERSCAN_API_KEY
    )


def get_multi_chain_service(
    networks: Optional[List[str]] = Query(None),
    mainnet_only: bool = Query(True)
):
    """Dependency for multi-chain ingestion service"""
    return MultiChainIngestionService(networks=networks, mainnet_only=mainnet_only)


@router.post("/wallet/connect", response_model=WalletConnectionResponse)
async def connect_wallet(request: WalletConnectionRequest):
    """
    Initiate wallet connection
    
    Supports:
    - MetaMask (deep link)
    - WalletConnect (QR code)
    - Coinbase Wallet (deep link + QR)
    - Other wallets (QR code)
    """
    try:
        response = wallet_service.handle_connection_request(request)
        return response
    except Exception as e:
        logger.error(f"Wallet connection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


@router.post("/wallet/{wallet_address}/ingest", response_model=IngestionSummary)
async def ingest_wallet_data(
    wallet_address: str,
    days_back: Optional[int] = 90,
    full_history: bool = False,
    background_tasks: BackgroundTasks = None,
    ingestion_service: DataIngestionService = Depends(get_ingestion_service),
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Ingest blockchain data for a wallet (Polygon Amoy Testnet)
    
    This endpoint triggers data collection for credit scoring.
    
    Parameters:
    - wallet_address: Ethereum wallet address
    - days_back: Number of days of history to fetch (default: 90)
    - full_history: Fetch complete wallet history (default: false)
    
    Requires authentication (wallet must be verified)
    """
    # Verify wallet ownership
    if wallet_address.lower() != current_wallet.lower():
        raise HTTPException(
            status_code=403,
            detail="Can only ingest data for authenticated wallet"
        )
    
    try:
        logger.info(f"Starting data ingestion for wallet: {wallet_address}")
        
        # Run ingestion
        summary = ingestion_service.ingest_wallet_data(
            wallet_address=wallet_address,
            days_back=days_back,
            full_history=full_history
        )
        
        if summary.status == "failed":
            raise HTTPException(
                status_code=500,
                detail=f"Ingestion failed: {', '.join(summary.errors)}"
            )
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.post("/wallet/{wallet_address}/ingest-multi-chain")
async def ingest_wallet_multi_chain(
    wallet_address: str,
    days_back: Optional[int] = 90,
    full_history: bool = False,
    parallel: bool = True,
    networks: Optional[List[str]] = Query(None, description="Specific networks to ingest (leave empty for all)"),
    mainnet_only: bool = Query(True, description="Only ingest from mainnet networks"),
    current_wallet: str = Depends(get_current_wallet)
):
    """
    Ingest blockchain data for a wallet across ALL NETWORKS
    
    This endpoint collects data from multiple blockchain networks in parallel:
    - Ethereum Mainnet
    - Polygon
    - Arbitrum
    - Optimism
    - Base
    - BSC
    - Avalanche
    - Fantom
    
    Parameters:
    - wallet_address: Wallet address (same across all EVM chains)
    - days_back: Number of days of history to fetch (default: 90)
    - full_history: Fetch complete wallet history (default: false)
    - parallel: Execute ingestions in parallel (default: true)
    - networks: Specific networks to ingest (optional, leave empty for all)
    - mainnet_only: Only ingest from mainnet networks (default: true)
    
    Requires authentication (wallet must be verified)
    """
    # Verify wallet ownership
    if wallet_address.lower() != current_wallet.lower():
        raise HTTPException(
            status_code=403,
            detail="Can only ingest data for authenticated wallet"
        )
    
    try:
        logger.info(f"Starting MULTI-CHAIN ingestion for wallet: {wallet_address}")
        
        # Initialize multi-chain service
        multi_service = MultiChainIngestionService(networks=networks, mainnet_only=mainnet_only)
        
        # Run multi-chain ingestion
        results = multi_service.ingest_wallet_all_networks(
            wallet_address=wallet_address,
            days_back=days_back,
            full_history=full_history,
            parallel=parallel
        )
        
        return results
        
    except Exception as e:
        logger.error(f"Multi-chain ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Multi-chain ingestion failed: {str(e)}")


@router.get("/wallet/{wallet_address}/summary-multi-chain")
async def get_wallet_summary_multi_chain(
    wallet_address: str,
    networks: Optional[List[str]] = Query(None),
    mainnet_only: bool = Query(True)
):
    """
    Get wallet summary across ALL NETWORKS
    
    Returns balance, transaction count, and activity status for each network.
    Does not require authentication.
    """
    try:
        multi_service = MultiChainIngestionService(networks=networks, mainnet_only=mainnet_only)
        summary = multi_service.get_wallet_summary_all_networks(wallet_address)
        return summary
    except Exception as e:
        logger.error(f"Failed to fetch multi-chain summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {str(e)}")


@router.get("/wallet/{wallet_address}/protocol-events-multi-chain")
async def get_protocol_events_multi_chain(
    wallet_address: str,
    days_back: int = 30,
    networks: Optional[List[str]] = Query(None),
    mainnet_only: bool = Query(True)
):
    """
    Get protocol events across ALL NETWORKS
    
    Returns DeFi protocol interactions from all connected networks.
    """
    try:
        multi_service = MultiChainIngestionService(networks=networks, mainnet_only=mainnet_only)
        events = multi_service.get_protocol_events_all_networks(wallet_address, days_back)
        return events
    except Exception as e:
        logger.error(f"Failed to fetch multi-chain events: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@router.get("/wallet/{wallet_address}/metadata")
async def get_wallet_metadata(
    wallet_address: str,
    ingestion_service: DataIngestionService = Depends(get_ingestion_service)
):
    """
    Get current wallet metadata (Polygon Amoy Testnet)
    
    Returns basic wallet information without full ingestion
    """
    try:
        metadata = ingestion_service.fetch_wallet_metadata(wallet_address)
        return metadata
    except Exception as e:
        logger.error(f"Failed to fetch metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {str(e)}")


@router.get("/wallet/{wallet_address}/protocol-events")
async def get_protocol_events(
    wallet_address: str,
    days_back: int = 30,
    ingestion_service: DataIngestionService = Depends(get_ingestion_service)
):
    """
    Get protocol interaction events for wallet (Polygon Amoy Testnet)
    
    Returns DeFi protocol interactions (Aave, Compound, etc.)
    """
    try:
        window = ingestion_service.determine_ingestion_window(
            wallet_address=wallet_address,
            days_back=days_back
        )
        
        events = ingestion_service.fetch_protocol_events(wallet_address, window)
        
        return {
            "wallet_address": wallet_address,
            "window": window,
            "total_events": len(events),
            "events": events
        }
    except Exception as e:
        logger.error(f"Failed to fetch protocol events: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@router.get("/networks")
async def get_supported_networks(
    multi_service: MultiChainIngestionService = Depends(get_multi_chain_service)
):
    """
    Get list of all supported networks and their connection status
    
    Returns information about all blockchain networks supported by the platform.
    """
    try:
        summary = multi_service.get_network_summary()
        return summary
    except Exception as e:
        logger.error(f"Failed to fetch network summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch networks: {str(e)}")


@router.get("/health")
async def health_check(client: BlockchainClient = Depends(get_blockchain_client)):
    """
    Health check for data ingestion service
    
    Verifies blockchain connection (Polygon Amoy Testnet)
    """
    try:
        is_connected = client.is_connected()
        latest_block = client.get_latest_block_number() if is_connected else None
        
        return {
            "status": "healthy" if is_connected else "unhealthy",
            "blockchain_connected": is_connected,
            "latest_block": latest_block,
            "chain_id": client.w3.eth.chain_id if is_connected else None
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
