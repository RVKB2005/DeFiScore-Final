"""
Protocol Event Decoder
Decodes DeFi protocol events from transaction logs
"""
from web3 import Web3
from typing import List, Dict, Any, Optional
from data_ingestion_models import ProtocolEvent, ProtocolEventType
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class ProtocolDecoder:
    """
    Decodes events from major DeFi protocols
    Currently supports: Aave V2, Aave V3, Compound
    """
    
    # Aave V2/V3 Event Signatures
    AAVE_DEPOSIT_SIGNATURE = Web3.keccak(text="Deposit(address,address,uint256,uint16)").hex()
    AAVE_WITHDRAW_SIGNATURE = Web3.keccak(text="Withdraw(address,address,address,uint256)").hex()
    AAVE_BORROW_SIGNATURE = Web3.keccak(text="Borrow(address,address,address,uint256,uint256,uint256,uint16)").hex()
    AAVE_REPAY_SIGNATURE = Web3.keccak(text="Repay(address,address,address,uint256)").hex()
    AAVE_LIQUIDATION_SIGNATURE = Web3.keccak(text="LiquidationCall(address,address,address,uint256,uint256,address,bool)").hex()
    
    # Compound Event Signatures
    COMPOUND_MINT_SIGNATURE = Web3.keccak(text="Mint(address,uint256,uint256)").hex()
    COMPOUND_REDEEM_SIGNATURE = Web3.keccak(text="Redeem(address,uint256,uint256)").hex()
    COMPOUND_BORROW_SIGNATURE = Web3.keccak(text="Borrow(address,uint256,uint256,uint256)").hex()
    COMPOUND_REPAY_SIGNATURE = Web3.keccak(text="RepayBorrow(address,address,uint256,uint256,uint256)").hex()
    
    # Known protocol contracts (Ethereum Mainnet)
    KNOWN_PROTOCOLS = {
        "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9": "Aave V2 Lending Pool",
        "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2": "Aave V3 Pool",
        "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B": "Compound Comptroller",
    }
    
    def __init__(self):
        self.event_signatures = {
            self.AAVE_DEPOSIT_SIGNATURE: ("Aave", ProtocolEventType.DEPOSIT),
            self.AAVE_WITHDRAW_SIGNATURE: ("Aave", ProtocolEventType.WITHDRAW),
            self.AAVE_BORROW_SIGNATURE: ("Aave", ProtocolEventType.BORROW),
            self.AAVE_REPAY_SIGNATURE: ("Aave", ProtocolEventType.REPAY),
            self.AAVE_LIQUIDATION_SIGNATURE: ("Aave", ProtocolEventType.LIQUIDATION),
            self.COMPOUND_MINT_SIGNATURE: ("Compound", ProtocolEventType.SUPPLY),
            self.COMPOUND_REDEEM_SIGNATURE: ("Compound", ProtocolEventType.WITHDRAW),
            self.COMPOUND_BORROW_SIGNATURE: ("Compound", ProtocolEventType.BORROW),
            self.COMPOUND_REPAY_SIGNATURE: ("Compound", ProtocolEventType.REPAY),
        }
    
    def is_known_protocol(self, address: str) -> bool:
        """Check if address is a known protocol contract"""
        return address.lower() in [k.lower() for k in self.KNOWN_PROTOCOLS.keys()]
    
    def get_protocol_name(self, address: str) -> str:
        """Get protocol name from contract address"""
        for known_addr, name in self.KNOWN_PROTOCOLS.items():
            if known_addr.lower() == address.lower():
                return name
        return "Unknown Protocol"
    
    def decode_log(
        self,
        log: Dict[str, Any],
        wallet_address: str,
        block_timestamp: datetime
    ) -> Optional[ProtocolEvent]:
        """
        Decode a log entry into a protocol event
        
        Args:
            log: Raw log entry from blockchain
            wallet_address: Wallet being analyzed
            block_timestamp: Block timestamp
            
        Returns:
            ProtocolEvent or None if not decodable
        """
        if not log.get('topics') or len(log['topics']) == 0:
            return None
        
        # Get event signature (first topic)
        event_signature = log['topics'][0].hex() if isinstance(log['topics'][0], bytes) else log['topics'][0]
        
        # Check if this is a known event
        if event_signature not in self.event_signatures:
            return None
        
        protocol_name, event_type = self.event_signatures[event_signature]
        
        # Extract amount from data field (simplified - production would use ABI decoding)
        amount_wei = None
        try:
            if log.get('data') and log['data'] != '0x':
                # First 32 bytes typically contain amount
                data_hex = log['data'][2:] if log['data'].startswith('0x') else log['data']
                if len(data_hex) >= 64:
                    amount_wei = int(data_hex[:64], 16)
        except Exception as e:
            logger.warning(f"Failed to decode amount from log: {e}")
        
        return ProtocolEvent(
            event_type=event_type,
            wallet_address=wallet_address.lower(),
            protocol_name=protocol_name,
            contract_address=log['address'].lower() if isinstance(log['address'], str) else log['address'],
            tx_hash=log['transactionHash'].hex() if isinstance(log['transactionHash'], bytes) else log['transactionHash'],
            block_number=log['blockNumber'],
            timestamp=block_timestamp,
            asset=None,  # Would need token contract lookup
            amount_wei=amount_wei,
            amount_eth=float(Web3.from_wei(amount_wei, 'ether')) if amount_wei else None,
            log_index=log['logIndex']
        )
    
    def decode_logs(
        self,
        logs: List[Dict[str, Any]],
        wallet_address: str,
        block_timestamps: Dict[int, datetime]
    ) -> List[ProtocolEvent]:
        """
        Decode multiple logs into protocol events
        
        Args:
            logs: List of raw log entries
            wallet_address: Wallet being analyzed
            block_timestamps: Map of block number to timestamp
            
        Returns:
            List of decoded protocol events
        """
        events = []
        
        for log in logs:
            block_number = log.get('blockNumber')
            if not block_number or block_number not in block_timestamps:
                continue
            
            event = self.decode_log(log, wallet_address, block_timestamps[block_number])
            if event:
                events.append(event)
        
        return events
