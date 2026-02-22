"""
Test balance snapshot creation using EXISTING data from database
This bypasses API calls and uses already-fetched transaction data
"""
from database import SessionLocal, WalletMetadataDB, TransactionRecordDB, BalanceSnapshotDB
from data_ingestion_service import DataIngestionService
from data_ingestion_models import TransactionRecord, IngestionWindow
from blockchain_client import BlockchainClient
from config import settings
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_balance_snapshots_from_db():
    """Create balance snapshots using existing database data"""
    
    wallet_address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    
    db = SessionLocal()
    try:
        # Get wallet metadata from database
        metadata = db.query(WalletMetadataDB).filter(
            WalletMetadataDB.wallet_address == wallet_address.lower()
        ).first()
        
        if not metadata:
            logger.error(f"No metadata found for {wallet_address}")
            return False
        
        logger.info(f"Found wallet metadata: {metadata.transaction_count} transactions, {metadata.current_balance_eth:.4f} ETH")
        
        # Get all transactions from database
        db_transactions = db.query(TransactionRecordDB).filter(
            TransactionRecordDB.wallet_address == wallet_address.lower()
        ).order_by(TransactionRecordDB.block_number).all()
        
        logger.info(f"Retrieved {len(db_transactions)} transactions from database")
        
        # Convert to TransactionRecord objects
        transactions = []
        for tx in db_transactions:
            transactions.append(TransactionRecord(
                tx_hash=tx.tx_hash,
                wallet_address=tx.wallet_address,
                block_number=tx.block_number,
                timestamp=tx.timestamp,
                from_address=tx.from_address,
                to_address=tx.to_address,
                value_wei=int(tx.value_wei),
                value_eth=tx.value_eth,
                gas_used=tx.gas_used,
                gas_price_wei=int(tx.gas_price_wei) if tx.gas_price_wei else 0,
                status=tx.status,
                is_contract_interaction=tx.is_contract_interaction
            ))
        
        # Create ingestion service (without connecting to avoid rate limits)
        # We'll create a minimal client that only has required methods
        class MinimalClient:
            def __init__(self):
                self.rpc_url = "http://localhost:8545"  # Dummy URL
                self.network = "ethereum"
                self.chain_id = 1
            
            @staticmethod
            def wei_to_ether(wei):
                from web3 import Web3
                return Web3.from_wei(wei, 'ether')
        
        client = MinimalClient()
        service = DataIngestionService(client)
        
        # Create dummy window
        window = IngestionWindow(
            start_block=transactions[0].block_number if transactions else 0,
            end_block=transactions[-1].block_number if transactions else 0
        )
        
        # Create balance snapshots
        logger.info("Creating balance snapshots...")
        balance_wei_int = int(metadata.current_balance_wei)
        
        snapshots = service.create_balance_snapshots(
            wallet_address=wallet_address,
            window=window,
            transactions=transactions,
            current_balance_wei=balance_wei_int
        )
        
        logger.info(f"Created {len(snapshots)} balance snapshots")
        
        # Save to database
        if snapshots:
            logger.info(f"Saving {len(snapshots)} snapshots to database...")
            
            # Delete existing snapshots for this wallet
            db.query(BalanceSnapshotDB).filter(
                BalanceSnapshotDB.wallet_address == wallet_address.lower()
            ).delete()
            
            saved_count = 0
            for snapshot in snapshots:
                db_snapshot = BalanceSnapshotDB(
                    wallet_address=snapshot.wallet_address.lower(),
                    network="ethereum",
                    chain_id=1,
                    block_number=snapshot.block_number,
                    timestamp=snapshot.timestamp,
                    balance_wei=snapshot.balance_wei,
                    balance_eth=snapshot.balance_eth
                )
                db.add(db_snapshot)
                saved_count += 1
            
            db.commit()
            logger.info(f"✓ Saved {saved_count} balance snapshots to database")
            
            # Verify
            count = db.query(BalanceSnapshotDB).filter(
                BalanceSnapshotDB.wallet_address == wallet_address.lower()
            ).count()
            logger.info(f"✓ Verified: {count} balance snapshots in database")
            
            return True
        else:
            logger.warning("No balance snapshots created")
            return False
            
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = test_balance_snapshots_from_db()
    exit(0 if success else 1)
