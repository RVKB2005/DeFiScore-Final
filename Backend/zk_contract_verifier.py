"""
ZK Contract Verifier
Verifies ZK proofs on-chain using deployed Verifier contracts
"""
import logging
from typing import Dict, Any, Optional
from web3 import Web3
from config import settings
import os

logger = logging.getLogger(__name__)


class ZKContractVerifier:
    """
    Service for verifying ZK proofs on-chain using Groth16 Verifier contracts
    
    Supports multi-chain verification:
    - Polygon Amoy (Chain ID: 80002)
    - Ethereum Sepolia (Chain ID: 11155111)
    - Other EVM chains as deployed
    """
    
    # Groth16 Verifier ABI (minimal interface)
    VERIFIER_ABI = [
        {
            "inputs": [
                {"internalType": "uint256[2]", "name": "a", "type": "uint256[2]"},
                {"internalType": "uint256[2][2]", "name": "b", "type": "uint256[2][2]"},
                {"internalType": "uint256[2]", "name": "c", "type": "uint256[2]"},
                {"internalType": "uint256[]", "name": "input", "type": "uint256[]"}
            ],
            "name": "verifyProof",
            "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        }
    ]
    
    def __init__(self):
        self.version = "1.0.0"
        
        # Load contract addresses from environment
        self.contract_addresses = self._load_contract_addresses()
        
        # Initialize Web3 connections for supported chains
        self.web3_instances = self._initialize_web3_connections()
        
        logger.info(f"✓ ZK Contract Verifier initialized")
        logger.info(f"  Supported chains: {list(self.contract_addresses.keys())}")
    
    def _load_contract_addresses(self) -> Dict[int, str]:
        """Load Verifier contract addresses from environment variables"""
        addresses = {}
        
        # Polygon Amoy (primary testnet)
        amoy_verifier = os.getenv('VERIFIER_CONTRACT_ADDRESS_80002', '0xEcC1997340e84d249975f69b05112310E073d84d')
        if amoy_verifier and amoy_verifier != '':
            addresses[80002] = amoy_verifier
        
        # Ethereum Sepolia
        sepolia_verifier = os.getenv('VERIFIER_CONTRACT_ADDRESS_11155111', '')
        if sepolia_verifier and sepolia_verifier != '':
            addresses[11155111] = sepolia_verifier
        
        # Arbitrum Sepolia
        arb_sepolia_verifier = os.getenv('VERIFIER_CONTRACT_ADDRESS_421614', '')
        if arb_sepolia_verifier and arb_sepolia_verifier != '':
            addresses[421614] = arb_sepolia_verifier
        
        # Base Sepolia
        base_sepolia_verifier = os.getenv('VERIFIER_CONTRACT_ADDRESS_84532', '')
        if base_sepolia_verifier and base_sepolia_verifier != '':
            addresses[84532] = base_sepolia_verifier
        
        # Optimism Sepolia
        op_sepolia_verifier = os.getenv('VERIFIER_CONTRACT_ADDRESS_11155420', '')
        if op_sepolia_verifier and op_sepolia_verifier != '':
            addresses[11155420] = op_sepolia_verifier
        
        # Hardhat local
        hardhat_verifier = os.getenv('VERIFIER_CONTRACT_ADDRESS_31337', '')
        if hardhat_verifier and hardhat_verifier != '':
            addresses[31337] = hardhat_verifier
        
        return addresses
    
    def _initialize_web3_connections(self) -> Dict[int, Web3]:
        """Initialize Web3 connections for supported chains"""
        connections = {}
        
        # Polygon Amoy
        if 80002 in self.contract_addresses:
            amoy_rpc = os.getenv('POLYGON_AMOY_RPC', '')
            if amoy_rpc:
                connections[80002] = Web3(Web3.HTTPProvider(amoy_rpc))
                logger.info(f"  ✓ Polygon Amoy Web3 connected")
        
        # Ethereum Sepolia
        if 11155111 in self.contract_addresses:
            sepolia_rpc = os.getenv('ETHEREUM_SEPOLIA_RPC', '')
            if sepolia_rpc:
                connections[11155111] = Web3(Web3.HTTPProvider(sepolia_rpc))
                logger.info(f"  ✓ Ethereum Sepolia Web3 connected")
        
        # Arbitrum Sepolia
        if 421614 in self.contract_addresses:
            arb_rpc = os.getenv('ARBITRUM_SEPOLIA_RPC', '')
            if arb_rpc:
                connections[421614] = Web3(Web3.HTTPProvider(arb_rpc))
                logger.info(f"  ✓ Arbitrum Sepolia Web3 connected")
        
        # Base Sepolia
        if 84532 in self.contract_addresses:
            base_rpc = os.getenv('BASE_SEPOLIA_RPC', '')
            if base_rpc:
                connections[84532] = Web3(Web3.HTTPProvider(base_rpc))
                logger.info(f"  ✓ Base Sepolia Web3 connected")
        
        # Optimism Sepolia
        if 11155420 in self.contract_addresses:
            op_rpc = os.getenv('OPTIMISM_SEPOLIA_RPC', '')
            if op_rpc:
                connections[11155420] = Web3(Web3.HTTPProvider(op_rpc))
                logger.info(f"  ✓ Optimism Sepolia Web3 connected")
        
        return connections
    
    def is_chain_supported(self, chain_id: int) -> bool:
        """Check if chain is supported for on-chain verification"""
        return chain_id in self.contract_addresses and chain_id in self.web3_instances
    
    def get_supported_chains(self) -> list:
        """Get list of supported chain IDs"""
        return list(self.contract_addresses.keys())
    
    def verify_proof_on_chain(
        self,
        proof: Dict[str, Any],
        public_signals: list,
        chain_id: int = 80002  # Default to Polygon Amoy
    ) -> bool:
        """
        Verify ZK proof on-chain using deployed Verifier contract
        
        Args:
            proof: Proof data from snarkjs (pi_a, pi_b, pi_c)
            public_signals: Public signals array
            chain_id: Chain ID to verify on (default: 80002 = Polygon Amoy)
            
        Returns:
            True if proof is valid on-chain, False otherwise
            
        Raises:
            ValueError: If chain is not supported
            RuntimeError: If verification call fails
        """
        if not self.is_chain_supported(chain_id):
            raise ValueError(
                f"Chain {chain_id} not supported. "
                f"Supported chains: {self.get_supported_chains()}"
            )
        
        web3 = self.web3_instances[chain_id]
        verifier_address = self.contract_addresses[chain_id]
        
        logger.info(f"Verifying proof on-chain (Chain ID: {chain_id})")
        logger.info(f"Verifier contract: {verifier_address}")
        
        # Create contract instance
        verifier_contract = web3.eth.contract(
            address=Web3.to_checksum_address(verifier_address),
            abi=self.VERIFIER_ABI
        )
        
        # Format proof for contract call
        # Groth16 proof format: a[2], b[2][2], c[2], input[]
        try:
            # Extract proof components (remove third coordinate which is always 1)
            pi_a = [int(proof["pi_a"][0]), int(proof["pi_a"][1])]
            
            # pi_b needs to be transposed for Solidity
            pi_b = [
                [int(proof["pi_b"][0][1]), int(proof["pi_b"][0][0])],  # Swap order
                [int(proof["pi_b"][1][1]), int(proof["pi_b"][1][0])]   # Swap order
            ]
            
            pi_c = [int(proof["pi_c"][0]), int(proof["pi_c"][1])]
            
            # Convert public signals to integers
            input_signals = [int(signal) for signal in public_signals]
            
            logger.info(f"Calling verifyProof on contract...")
            logger.info(f"  pi_a: {pi_a}")
            logger.info(f"  pi_b: {pi_b}")
            logger.info(f"  pi_c: {pi_c}")
            logger.info(f"  input: {input_signals}")
            
            # Call verifyProof function
            is_valid = verifier_contract.functions.verifyProof(
                pi_a,
                pi_b,
                pi_c,
                input_signals
            ).call()
            
            if is_valid:
                logger.info(f"✓ Proof verified on-chain (Chain ID: {chain_id})")
            else:
                logger.warning(f"✗ Proof verification failed on-chain (Chain ID: {chain_id})")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"On-chain verification error: {e}")
            raise RuntimeError(f"On-chain verification failed: {str(e)}")
    
    def get_chain_info(self, chain_id: int) -> Dict[str, Any]:
        """Get information about a supported chain"""
        if not self.is_chain_supported(chain_id):
            return {
                "supported": False,
                "chain_id": chain_id
            }
        
        web3 = self.web3_instances[chain_id]
        verifier_address = self.contract_addresses[chain_id]
        
        # Get chain name
        chain_names = {
            80002: "Polygon Amoy",
            11155111: "Ethereum Sepolia",
            421614: "Arbitrum Sepolia",
            84532: "Base Sepolia",
            11155420: "Optimism Sepolia",
            31337: "Hardhat Local"
        }
        
        return {
            "supported": True,
            "chain_id": chain_id,
            "chain_name": chain_names.get(chain_id, f"Chain {chain_id}"),
            "verifier_address": verifier_address,
            "rpc_connected": web3.is_connected(),
            "latest_block": web3.eth.block_number if web3.is_connected() else None
        }


# Global service instance
try:
    zk_contract_verifier = ZKContractVerifier()
    
    if len(zk_contract_verifier.get_supported_chains()) == 0:
        logger.warning("No Verifier contracts configured. On-chain verification will not be available.")
        logger.warning("Configure VERIFIER_CONTRACT_ADDRESS_<CHAIN_ID> in .env")
    else:
        logger.info(f"✓ ZK Contract Verifier ready for {len(zk_contract_verifier.get_supported_chains())} chains")
        
except Exception as e:
    logger.error(f"Failed to initialize ZK Contract Verifier: {e}")
    zk_contract_verifier = None
