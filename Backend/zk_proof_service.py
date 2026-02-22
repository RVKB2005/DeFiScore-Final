"""
ZK Proof Service
Handles Groth16 ZK-SNARK proof generation and verification using snarkjs
Updated: 2026-02-22 - Fixed nullifier constraint issue
"""
import subprocess
import json
import os
import tempfile
import logging
from typing import Dict, Any, Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ZKProofService:
    """
    Service for generating and verifying Groth16 ZK-SNARK proofs
    
    Uses snarkjs CLI to:
    1. Generate proofs from witness data
    2. Verify proofs against verification key
    3. Format proofs for smart contract verification
    """
    
    def __init__(self):
        self.version = "1.0.0"
        self.circuit_name = "DeFiCreditScore"
        
        # Determine paths
        backend_dir = Path(__file__).parent
        project_root = backend_dir.parent
        circuits_dir = project_root / "circuits"
        
        self.build_dir = circuits_dir / "build"
        self.keys_dir = circuits_dir / "keys"
        
        # Circuit files
        self.wasm_file = self.build_dir / f"{self.circuit_name}_js" / f"{self.circuit_name}.wasm"
        self.zkey_file = self.keys_dir / f"{self.circuit_name}_final.zkey"
        self.vkey_file = self.keys_dir / f"{self.circuit_name}_verification_key.json"
        
        # Check if files exist
        self.files_exist = self._check_files()
        
        if not all(self.files_exist.values()):
            logger.warning("ZK circuit files not found. Proof generation will not be available.")
            logger.warning(f"WASM: {self.files_exist['wasm']}, ZKEY: {self.files_exist['zkey']}, VKEY: {self.files_exist['vkey']}")
        else:
            logger.info(f"✓ ZK Proof Service initialized")
            logger.info(f"  Circuit: {self.circuit_name}")
            logger.info(f"  WASM: {self.wasm_file}")
            logger.info(f"  ZKEY: {self.zkey_file}")
            logger.info(f"  VKEY: {self.vkey_file}")
    
    def _check_files(self) -> Dict[str, bool]:
        """Check if all required circuit files exist"""
        return {
            "wasm": self.wasm_file.exists(),
            "zkey": self.zkey_file.exists(),
            "vkey": self.vkey_file.exists()
        }
    
    def get_circuit_info(self) -> Dict[str, Any]:
        """Get circuit information"""
        return {
            "circuit_name": self.circuit_name,
            "version": self.version,
            "files_exist": self.files_exist,
            "wasm_path": str(self.wasm_file),
            "zkey_path": str(self.zkey_file),
            "vkey_path": str(self.vkey_file)
        }
    
    def generate_proof(
        self,
        witness_data: Dict[str, Any],
        timeout: int = 120
    ) -> Tuple[Dict[str, Any], list]:
        """
        Generate Groth16 ZK-SNARK proof using snarkjs
        
        Args:
            witness_data: Witness data with public_inputs and private_inputs
            timeout: Timeout in seconds (default: 120)
            
        Returns:
            Tuple of (proof, public_signals)
            
        Raises:
            RuntimeError: If proof generation fails
            FileNotFoundError: If circuit files are missing
        """
        if not all(self.files_exist.values()):
            raise FileNotFoundError(
                f"Circuit files missing. WASM: {self.files_exist['wasm']}, "
                f"ZKEY: {self.files_exist['zkey']}, VKEY: {self.files_exist['vkey']}"
            )
        
        # Create temporary directory for witness and proof files
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Prepare input for snarkjs (combine public and private inputs)
            circuit_input = {
                **witness_data["public_inputs"],
                **witness_data["private_inputs"]
            }
            
            logger.info(f"Circuit input prepared:")
            logger.info(f"  nullifier: {circuit_input.get('nullifier', 'NOT FOUND')}")
            logger.info(f"  nullifier type: {type(circuit_input.get('nullifier', 'NOT FOUND'))}")
            
            input_file = temp_path / "input.json"
            witness_file = temp_path / "witness.wtns"
            proof_file = temp_path / "proof.json"
            public_file = temp_path / "public.json"
            
            # Write input file
            with open(input_file, 'w') as f:
                json.dump(circuit_input, f, indent=2)
            
            # Log the input file for debugging
            logger.info(f"Circuit input file written to: {input_file}")
            logger.info(f"Input file contents:")
            with open(input_file, 'r') as f:
                logger.info(f.read())
            
            logger.info(f"Generating witness from input...")
            
            # Step 1: Generate witness using snarkjs wtns calculate
            try:
                result = subprocess.run(
                    [
                        "snarkjs", "wtns", "calculate",
                        str(self.wasm_file),
                        str(input_file),
                        str(witness_file)
                    ],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    shell=True  # Use shell on Windows to find snarkjs in PATH
                )
                
                if result.returncode != 0:
                    error_msg = result.stderr or result.stdout or "Unknown error"
                    logger.error(f"Witness generation failed (exit code {result.returncode}): {error_msg}")
                    logger.error(f"STDOUT: {result.stdout}")
                    logger.error(f"STDERR: {result.stderr}")
                    raise RuntimeError(f"Witness generation failed: {error_msg}")
                
                logger.info(f"✓ Witness generated")
                logger.debug(f"Witness output: {result.stdout}")
                
            except subprocess.TimeoutExpired:
                raise RuntimeError(f"Witness generation timed out after {timeout} seconds")
            except FileNotFoundError:
                raise RuntimeError("snarkjs not found. Please install snarkjs: npm install -g snarkjs")
            
            # Step 2: Generate proof using snarkjs
            logger.info(f"Generating proof...")
            
            try:
                result = subprocess.run(
                    [
                        "snarkjs", "groth16", "prove",
                        str(self.zkey_file),
                        str(witness_file),
                        str(proof_file),
                        str(public_file)
                    ],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    shell=True  # Use shell on Windows to find snarkjs in PATH
                )
                
                if result.returncode != 0:
                    logger.error(f"Proof generation failed: {result.stderr}")
                    raise RuntimeError(f"Proof generation failed: {result.stderr}")
                
                logger.info(f"✓ Proof generated")
                
            except subprocess.TimeoutExpired:
                raise RuntimeError(f"Proof generation timed out after {timeout} seconds")
            except FileNotFoundError:
                raise RuntimeError("snarkjs not found. Please install snarkjs: npm install -g snarkjs")
            
            # Read proof and public signals
            with open(proof_file, 'r') as f:
                proof = json.load(f)
            
            with open(public_file, 'r') as f:
                public_signals = json.load(f)
            
            return proof, public_signals
    
    def verify_proof(
        self,
        proof: Dict[str, Any],
        public_signals: list,
        timeout: int = 30
    ) -> bool:
        """
        Verify Groth16 ZK-SNARK proof using snarkjs
        
        Args:
            proof: Proof data
            public_signals: Public signals
            timeout: Timeout in seconds (default: 30)
            
        Returns:
            True if proof is valid, False otherwise
            
        Raises:
            RuntimeError: If verification fails
            FileNotFoundError: If verification key is missing
        """
        if not self.files_exist["vkey"]:
            raise FileNotFoundError(f"Verification key not found: {self.vkey_file}")
        
        # Create temporary directory for proof files
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            proof_file = temp_path / "proof.json"
            public_file = temp_path / "public.json"
            
            # Write proof and public signals
            with open(proof_file, 'w') as f:
                json.dump(proof, f)
            
            with open(public_file, 'w') as f:
                json.dump(public_signals, f)
            
            logger.info(f"Verifying proof...")
            
            try:
                result = subprocess.run(
                    [
                        "snarkjs", "groth16", "verify",
                        str(self.vkey_file),
                        str(public_file),
                        str(proof_file)
                    ],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    shell=True  # Use shell on Windows to find snarkjs in PATH
                )
                
                if result.returncode != 0:
                    logger.error(f"Proof verification failed: {result.stderr}")
                    return False
                
                # Check if output contains "OK"
                is_valid = "OK" in result.stdout
                
                if is_valid:
                    logger.info(f"✓ Proof verified successfully")
                else:
                    logger.warning(f"✗ Proof verification failed")
                
                return is_valid
                
            except subprocess.TimeoutExpired:
                raise RuntimeError(f"Proof verification timed out after {timeout} seconds")
            except FileNotFoundError:
                raise RuntimeError("snarkjs not found. Please install snarkjs: npm install -g snarkjs")
    
    def format_proof_for_contract(
        self,
        proof: Dict[str, Any],
        public_signals: list
    ) -> Dict[str, Any]:
        """
        Format proof for Solidity smart contract verification
        
        Converts proof to format expected by Groth16 verifier contract:
        - proof.pi_a: [x, y]
        - proof.pi_b: [[x1, x2], [y1, y2]]
        - proof.pi_c: [x, y]
        - publicSignals: [signal1, signal2, ...]
        
        Args:
            proof: Proof data from snarkjs
            public_signals: Public signals
            
        Returns:
            Formatted proof for contract
        """
        return {
            "pi_a": proof["pi_a"][:2],  # Remove third coordinate (always 1)
            "pi_b": [
                proof["pi_b"][0][:2],  # First point
                proof["pi_b"][1][:2]   # Second point
            ],
            "pi_c": proof["pi_c"][:2],  # Remove third coordinate
            "protocol": proof.get("protocol", "groth16"),
            "curve": proof.get("curve", "bn128"),
            "publicSignals": public_signals
        }


# Global service instance
try:
    zk_proof_service = ZKProofService()
    
    # Check if service is usable
    if not all(zk_proof_service.files_exist.values()):
        logger.warning("ZK Proof Service initialized but circuit files are missing")
        logger.warning("Proof generation will not be available until circuit files are present")
        zk_proof_service = None
    else:
        logger.info("✓ ZK Proof Service ready")
        
except Exception as e:
    logger.error(f"Failed to initialize ZK Proof Service: {e}")
    zk_proof_service = None
