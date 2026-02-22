"""
Poseidon Hash Implementation Compatible with Circomlib
Uses Node.js circomlibjs for 100% circuit compatibility
"""
import subprocess
import os
import logging

logger = logging.getLogger(__name__)

def poseidon_hash(inputs):
    """
    Compute Poseidon hash compatible with circomlib's Poseidon(4)
    
    Uses Node.js circomlibjs library to ensure exact compatibility with circuit
    
    Args:
        inputs: List of 4 integers (field elements)
    
    Returns:
        Hash output as integer
    """
    if len(inputs) != 4:
        raise ValueError(f"Poseidon(4) requires exactly 4 inputs, got {len(inputs)}")
    
    try:
        # Get path to Node.js script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(script_dir, "poseidon_hash_node.js")
        
        # Convert inputs to strings
        input_strs = [str(int(x)) for x in inputs]
        
        # Call Node.js script
        result = subprocess.run(
            ["node", script_path] + input_strs,
            capture_output=True,
            text=True,
            check=True,
            timeout=10
        )
        
        # Parse output
        hash_str = result.stdout.strip()
        hash_int = int(hash_str)
        
        logger.info(f"Poseidon hash computed: inputs={inputs}, output={hash_int}")
        return hash_int
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Node.js Poseidon hash failed: {e.stderr}")
        raise RuntimeError(f"Poseidon hash computation failed: {e.stderr}")
    except subprocess.TimeoutExpired:
        logger.error("Poseidon hash computation timed out")
        raise RuntimeError("Poseidon hash computation timed out")
    except Exception as e:
        logger.error(f"Unexpected error in Poseidon hash: {e}")
        raise RuntimeError(f"Poseidon hash failed: {e}")

