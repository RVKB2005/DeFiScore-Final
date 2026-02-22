"""
Blockchain Lending Service
Handles smart contract interactions for collateral and loan management
"""
import logging
from typing import Dict, Any, Optional
from web3 import Web3
from eth_account import Account
import json
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class BlockchainLendingService:
    """Service for interacting with LendingEscrow smart contract"""
    
    def __init__(self):
        # Initialize Web3 connection
        rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://localhost:8545")
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        # Load contract ABI and address
        self.contract_address = os.getenv("LENDING_ESCROW_ADDRESS")
        self.contract_abi = self._load_contract_abi()
        
        if self.contract_address and self.contract_abi:
            self.contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=self.contract_abi
            )
        else:
            self.contract = None
            logger.warning("LendingEscrow contract not configured")
        
        # Load admin private key for contract interactions
        self.admin_private_key = os.getenv("ADMIN_PRIVATE_KEY")
        if self.admin_private_key:
            self.admin_account = Account.from_key(self.admin_private_key)
        else:
            self.admin_account = None
            logger.warning("Admin private key not configured")
    
    def _load_contract_abi(self) -> Optional[list]:
        """Load contract ABI from file"""
        try:
            abi_path = os.path.join(os.path.dirname(__file__), "../contracts/artifacts/LendingEscrow.json")
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    contract_json = json.load(f)
                    return contract_json.get('abi', [])
        except Exception as e:
            logger.error(f"Failed to load contract ABI: {e}")
        return None
    
    def create_loan_on_chain(
        self,
        loan_id: str,
        borrower_address: str,
        lender_address: str,
        loan_token: str,
        collateral_token: str,
        loan_amount: float,
        collateral_amount: float,
        interest_rate: float,
        duration_days: int
    ) -> Dict[str, Any]:
        """
        Create a loan agreement on the blockchain
        
        Args:
            loan_id: Unique loan identifier
            borrower_address: Borrower's wallet address
            lender_address: Lender's wallet address
            loan_token: Address of token being borrowed
            collateral_token: Address of collateral token
            loan_amount: Amount to borrow (in token units)
            collateral_amount: Collateral amount (in token units)
            interest_rate: Annual interest rate (e.g., 5.0 for 5%)
            duration_days: Loan duration in days
        
        Returns:
            Transaction receipt with loan creation details
        """
        if not self.contract or not self.admin_account:
            raise ValueError("Blockchain service not properly configured")
        
        try:
            # Convert loan_id to bytes32
            loan_id_bytes = Web3.keccak(text=loan_id)
            
            # Convert interest rate to basis points (5% = 500)
            interest_rate_bp = int(interest_rate * 100)
            
            # Convert amounts to Wei (assuming 18 decimals)
            loan_amount_wei = self.w3.to_wei(loan_amount, 'ether')
            collateral_amount_wei = self.w3.to_wei(collateral_amount, 'ether')
            
            # Build transaction
            tx = self.contract.functions.createLoan(
                loan_id_bytes,
                Web3.to_checksum_address(borrower_address),
                Web3.to_checksum_address(lender_address),
                Web3.to_checksum_address(loan_token),
                Web3.to_checksum_address(collateral_token),
                loan_amount_wei,
                collateral_amount_wei,
                interest_rate_bp,
                duration_days
            ).build_transaction({
                'from': self.admin_account.address,
                'nonce': self.w3.eth.get_transaction_count(self.admin_account.address),
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and send transaction
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.admin_private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Loan {loan_id} created on-chain. Tx: {receipt['transactionHash'].hex()}")
            
            return {
                'success': True,
                'transaction_hash': receipt['transactionHash'].hex(),
                'block_number': receipt['blockNumber'],
                'gas_used': receipt['gasUsed']
            }
        
        except Exception as e:
            logger.error(f"Failed to create loan on-chain: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_loan_status(self, loan_id: str) -> Dict[str, Any]:
        """
        Get loan status from blockchain
        
        Returns:
            Loan details including status, amounts, dates, etc.
        """
        if not self.contract:
            raise ValueError("Contract not configured")
        
        try:
            loan_id_bytes = Web3.keccak(text=loan_id)
            loan = self.contract.functions.getLoan(loan_id_bytes).call()
            
            # Parse loan tuple
            return {
                'loan_id': loan_id,
                'borrower': loan[1],
                'lender': loan[2],
                'loan_token': loan[3],
                'collateral_token': loan[4],
                'loan_amount': self.w3.from_wei(loan[5], 'ether'),
                'collateral_amount': self.w3.from_wei(loan[6], 'ether'),
                'interest_rate': loan[7] / 100,  # Convert from basis points
                'duration_days': loan[8],
                'start_time': loan[9],
                'due_date': loan[10],
                'total_repayment': self.w3.from_wei(loan[11], 'ether'),
                'amount_repaid': self.w3.from_wei(loan[12], 'ether'),
                'status': self._parse_loan_status(loan[13])
            }
        
        except Exception as e:
            logger.error(f"Failed to get loan status: {e}", exc_info=True)
            return None
    
    def is_loan_overdue(self, loan_id: str) -> bool:
        """Check if loan is past due date"""
        if not self.contract:
            return False
        
        try:
            loan_id_bytes = Web3.keccak(text=loan_id)
            return self.contract.functions.isLoanOverdue(loan_id_bytes).call()
        except Exception as e:
            logger.error(f"Failed to check if loan is overdue: {e}")
            return False
    
    def mark_loan_defaulted(self, loan_id: str) -> Dict[str, Any]:
        """Mark a loan as defaulted (callable by anyone if past due)"""
        if not self.contract or not self.admin_account:
            raise ValueError("Blockchain service not properly configured")
        
        try:
            loan_id_bytes = Web3.keccak(text=loan_id)
            
            tx = self.contract.functions.markAsDefaulted(
                loan_id_bytes
            ).build_transaction({
                'from': self.admin_account.address,
                'nonce': self.w3.eth.get_transaction_count(self.admin_account.address),
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.admin_private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Loan {loan_id} marked as defaulted. Tx: {receipt['transactionHash'].hex()}")
            
            return {
                'success': True,
                'transaction_hash': receipt['transactionHash'].hex()
            }
        
        except Exception as e:
            logger.error(f"Failed to mark loan as defaulted: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def _parse_loan_status(self, status_code: int) -> str:
        """Convert status code to string"""
        statuses = {
            0: 'PENDING',
            1: 'COLLATERALIZED',
            2: 'ACTIVE',
            3: 'REPAID',
            4: 'DEFAULTED',
            5: 'LIQUIDATED'
        }
        return statuses.get(status_code, 'UNKNOWN')
    
    def get_collateral_instructions(
        self,
        loan_id: str,
        borrower_address: str,
        collateral_token: str,
        collateral_amount: float
    ) -> Dict[str, Any]:
        """
        Generate instructions for borrower to deposit collateral
        
        Returns:
            Contract address, function call data, and amount
        """
        if not self.contract:
            raise ValueError("Contract not configured")
        
        loan_id_bytes = Web3.keccak(text=loan_id)
        
        return {
            'contract_address': self.contract_address,
            'collateral_token': collateral_token,
            'collateral_amount': collateral_amount,
            'collateral_amount_wei': str(self.w3.to_wei(collateral_amount, 'ether')),
            'function': 'depositCollateral',
            'loan_id': loan_id,
            'loan_id_bytes': loan_id_bytes.hex(),
            'instructions': [
                f"1. Approve {collateral_amount} tokens to contract {self.contract_address}",
                f"2. Call depositCollateral({loan_id_bytes.hex()})",
                "3. Wait for transaction confirmation"
            ]
        }
    
    def get_funding_instructions(
        self,
        loan_id: str,
        lender_address: str,
        loan_token: str,
        loan_amount: float
    ) -> Dict[str, Any]:
        """
        Generate instructions for lender to fund the loan
        
        Returns:
            Contract address, function call data, and amount
        """
        if not self.contract:
            raise ValueError("Contract not configured")
        
        loan_id_bytes = Web3.keccak(text=loan_id)
        
        return {
            'contract_address': self.contract_address,
            'loan_token': loan_token,
            'loan_amount': loan_amount,
            'loan_amount_wei': str(self.w3.to_wei(loan_amount, 'ether')),
            'function': 'fundLoan',
            'loan_id': loan_id,
            'loan_id_bytes': loan_id_bytes.hex(),
            'instructions': [
                f"1. Approve {loan_amount} tokens to contract {self.contract_address}",
                f"2. Call fundLoan({loan_id_bytes.hex()})",
                "3. Loan will be transferred to borrower"
            ]
        }


# Singleton instance
blockchain_lending_service = BlockchainLendingService()
