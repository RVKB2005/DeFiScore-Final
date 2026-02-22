/**
 * Blockchain Proof Submission Service
 * 
 * Handles on-chain proof submission to DeFiScoreRegistry contract
 * This is the final step in the trustless ZK proof flow
 */

import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';

// Check if window.ethereum exists
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Contract addresses on Polygon Amoy (Chain ID: 80002)
// DEPLOYED: 2026-02-22 23:55 UTC - PRODUCTION READY
// - Score verification ENABLED (circuit enforces exact match)
// - Nullifier constraint temporarily disabled (will re-enable after fixing Poseidon)
// - Verifier regenerated after circuit updates
const CONTRACTS = {
  VERIFIER: '0xca41eDe3B2C33eC2d1a86E417A78AB44FCA26fDe',
  REGISTRY: '0x408e9998c6c73125b66804feFe51D4D0d755d9Cf',
  VERSION_MANAGER: '0x3173A2683F285dCbCB49682Cff1102692be17B9f',
  SECURITY_GUARD: '0x448FD7c901e0E4539f7aD8cD7566B512D0A75440',
};

// DeFiScoreRegistry ABI (only the functions we need)
const REGISTRY_ABI = [
  'function submitProof(uint256[8] proof, uint256[11] publicSignals) external',
  'function isEligible(address user) external view returns (bool)',
  'function getTimeUntilExpiry(address user) external view returns (uint256)',
  'function isProofFresh(address user) external view returns (bool)',
  'function isNullifierUsed(bytes32 nullifier) external view returns (bool)',
  'event ProofSubmitted(address indexed user, uint256 scoreTotal, uint256 threshold, bool isEligible, uint256 timestamp)',
];

export interface ProofSubmissionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

/**
 * Get the correct Ethereum provider (prioritize MetaMask if multiple wallets installed)
 */
function getEthereumProvider(): any {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }

  // If MetaMask is installed, use it specifically
  if (window.ethereum.providers) {
    // Multiple wallets installed - find MetaMask
    const metamask = window.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metamask) {
      return metamask;
    }
  }

  // Single wallet or MetaMask is the default
  if (window.ethereum.isMetaMask) {
    return window.ethereum;
  }

  // Fallback to whatever is available
  return window.ethereum;
}

export class BlockchainProofService {
  private provider: BrowserProvider | null = null;
  private registryContract: Contract | null = null;
  private ethereumProvider: any = null;

  /**
   * Initialize service with Web3 provider
   */
  async initialize(): Promise<void> {
    this.ethereumProvider = getEthereumProvider();
    
    if (!this.ethereumProvider) {
      throw new Error('MetaMask not installed. Please install MetaMask to submit proofs on-chain.');
    }

    this.provider = new BrowserProvider(this.ethereumProvider);
    
    // Check if we're on Polygon Amoy (Chain ID: 80002)
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== 80002) {
      // Try to switch network automatically
      try {
        await this.switchToPolygonAmoy();
        // Re-initialize provider after switch
        this.provider = new BrowserProvider(this.ethereumProvider);
      } catch (switchError: any) {
        throw new Error(`Wrong network. Please switch to Polygon Amoy (Chain ID: 80002). Current: ${network.chainId}`);
      }
    }

    // Initialize registry contract
    const signer = await this.provider.getSigner();
    this.registryContract = new Contract(
      CONTRACTS.REGISTRY,
      REGISTRY_ABI,
      signer
    );
  }

  /**
   * Switch MetaMask to Polygon Amoy network
   */
  private async switchToPolygonAmoy(): Promise<void> {
    if (!this.ethereumProvider) {
      throw new Error('Ethereum provider not available');
    }

    try {
      // Try to switch to Polygon Amoy
      await this.ethereumProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // 80002 in hex
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          // Add Polygon Amoy network
          await this.ethereumProvider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x13882', // 80002 in hex
                chainName: 'Polygon Amoy Testnet',
                nativeCurrency: {
                  name: 'MATIC',
                  symbol: 'MATIC',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc-amoy.polygon.technology/'],
                blockExplorerUrls: ['https://amoy.polygonscan.com/'],
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add Polygon Amoy network to MetaMask');
        }
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Format proof for smart contract
   * 
   * Groth16 proof has structure from snarkjs:
   * - pi_a: [x, y, 1] (we use first 2)
   * - pi_b: [[[x1, x2], [y1, y2]], [1, 0]] (we use first array, swapped)
   * - pi_c: [x, y, 1] (we use first 2)
   * 
   * Contract expects: uint256[8] = [pi_a[0], pi_a[1], pi_b[0][1], pi_b[0][0], pi_b[1][1], pi_b[1][0], pi_c[0], pi_c[1]]
   */
  private formatProofForContract(proof: any): string[] {
    console.log('[BlockchainProofService] Raw proof from snarkjs:', JSON.stringify(proof, null, 2));
    
    // snarkjs returns pi_a and pi_c with 3 elements [x, y, 1]
    // We only need the first 2
    const pi_a = proof.pi_a.slice(0, 2);
    const pi_c = proof.pi_c.slice(0, 2);
    
    // pi_b is [[x1, x2], [y1, y2]] - we need to swap the order for the contract
    const pi_b = proof.pi_b[0]; // Get first array (ignore [1, 0])
    
    const formatted = [
      pi_a[0],
      pi_a[1],
      pi_b[1], // Swapped
      pi_b[0], // Swapped
      proof.pi_b[1][1], // Second array
      proof.pi_b[1][0], // Second array
      pi_c[0],
      pi_c[1],
    ];
    
    console.log('[BlockchainProofService] Formatted proof for contract:', formatted);
    return formatted;
  }

  /**
   * Submit proof to blockchain
   * 
   * This is the FINAL step in the trustless flow:
   * 1. Proof generated in browser (trustless)
   * 2. Proof submitted to blockchain (this function)
   * 3. Smart contract verifies proof on-chain
   * 4. Eligibility stored on-chain (immutable)
   */
  async submitProof(
    proof: any,
    publicSignals: string[],
    onProgress?: (status: string) => void
  ): Promise<ProofSubmissionResult> {
    try {
      await this.initialize();

      if (!this.registryContract) {
        throw new Error('Registry contract not initialized');
      }

      // Format proof for contract
      const proofFormatted = this.formatProofForContract(proof);

      onProgress?.('Checking nullifier...');

      // Check if nullifier is already used (prevent replay)
      const nullifier = publicSignals[9]; // Nullifier at index 9
      const nullifierBigInt = BigInt(nullifier);
      const nullifierBytes32 = '0x' + nullifierBigInt.toString(16).padStart(64, '0');
      
      const isUsed = await this.registryContract.isNullifierUsed(nullifierBytes32);
      if (isUsed) {
        throw new Error('Proof already submitted (nullifier used)');
      }

      onProgress?.('Estimating gas...');

      // Estimate gas
      const gasEstimate = await this.registryContract.submitProof.estimateGas(
        proofFormatted,
        publicSignals
      );

      // Add 20% buffer
      const gasLimit = (gasEstimate * 120n) / 100n;

      onProgress?.('Submitting proof to blockchain...');

      // Use legacy gas pricing for Polygon Amoy (doesn't support EIP-1559)
      // Minimum required: 25 gwei, we'll use 35 gwei to be safe
      const gasPrice = parseUnits('35', 'gwei');

      // Submit proof transaction with legacy gas pricing
      const tx = await this.registryContract.submitProof(
        proofFormatted,
        publicSignals,
        { 
          gasLimit,
          gasPrice
        }
      );

      onProgress?.('Waiting for confirmation...');

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      onProgress?.('Proof verified on-chain!');

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };

    } catch (error: any) {
      console.error('[BlockchainProofService] Submission failed:', error);
      
      let errorMessage = error.message;
      
      // Parse common errors
      if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient MATIC for gas fees';
      } else if (error.message.includes('Wrong network')) {
        errorMessage = error.message;
      } else if (error.message.includes('nullifier used')) {
        errorMessage = 'Proof already submitted (replay protection)';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if user is eligible (on-chain)
   */
  async isEligible(userAddress: string): Promise<boolean> {
    try {
      await this.initialize();

      if (!this.registryContract) {
        throw new Error('Registry contract not initialized');
      }

      return await this.registryContract.isEligible(userAddress);
    } catch (error) {
      console.error('[BlockchainProofService] Failed to check eligibility:', error);
      return false;
    }
  }

  /**
   * Check if proof is still fresh (< 24 hours)
   */
  async isProofFresh(userAddress: string): Promise<boolean> {
    try {
      await this.initialize();

      if (!this.registryContract) {
        throw new Error('Registry contract not initialized');
      }

      return await this.registryContract.isProofFresh(userAddress);
    } catch (error) {
      console.error('[BlockchainProofService] Failed to check freshness:', error);
      return false;
    }
  }

  /**
   * Get time until proof expires
   */
  async getTimeUntilExpiry(userAddress: string): Promise<number> {
    try {
      await this.initialize();

      if (!this.registryContract) {
        throw new Error('Registry contract not initialized');
      }

      const timeRemaining = await this.registryContract.getTimeUntilExpiry(userAddress);
      return Number(timeRemaining);
    } catch (error) {
      console.error('[BlockchainProofService] Failed to get expiry:', error);
      return 0;
    }
  }

  /**
   * Get contract addresses
   */
  getContractAddresses() {
    return CONTRACTS;
  }
}

export const blockchainProofService = new BlockchainProofService();
