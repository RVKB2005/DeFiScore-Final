/**
 * ZK Proof Service
 * Client-side proof generation and blockchain submission
 * 
 * Architecture:
 * - Fetches witness data from backend (public + private inputs)
 * - Generates proof in Web Worker (browser-side)
 * - Submits proof directly to DeFiScoreRegistry contract
 * - No backend involvement in proof generation
 * 
 * Security:
 * - Private inputs processed only in browser
 * - Proof generation isolated in Web Worker
 * - Direct blockchain submission (trustless)
 */

import { ethers } from 'ethers';
import { toast } from 'sonner';

// Circuit file URLs (served from public folder)
const WASM_URL = '/circuits/DeFiCreditScore.wasm';
const ZKEY_URL = '/circuits/DeFiCreditScore_final.zkey';

// Multi-network contract addresses (auto-detected from wallet)
const REGISTRY_ADDRESSES: Record<number, string> = {
  1: import.meta.env.VITE_DEFI_SCORE_REGISTRY_1 || '', // Ethereum
  137: import.meta.env.VITE_DEFI_SCORE_REGISTRY_137 || '', // Polygon
  42161: import.meta.env.VITE_DEFI_SCORE_REGISTRY_42161 || '', // Arbitrum
  10: import.meta.env.VITE_DEFI_SCORE_REGISTRY_10 || '', // Optimism
  8453: import.meta.env.VITE_DEFI_SCORE_REGISTRY_8453 || '', // Base
  56: import.meta.env.VITE_DEFI_SCORE_REGISTRY_56 || '', // BNB
  43114: import.meta.env.VITE_DEFI_SCORE_REGISTRY_43114 || '', // Avalanche
  // Testnets
  11155111: import.meta.env.VITE_DEFI_SCORE_REGISTRY_11155111 || '', // Sepolia
  80002: import.meta.env.VITE_DEFI_SCORE_REGISTRY_80002 || '', // Amoy
  421614: import.meta.env.VITE_DEFI_SCORE_REGISTRY_421614 || '', // Arbitrum Sepolia
  11155420: import.meta.env.VITE_DEFI_SCORE_REGISTRY_11155420 || '', // Optimism Sepolia
  84532: import.meta.env.VITE_DEFI_SCORE_REGISTRY_84532 || '', // Base Sepolia
  97: import.meta.env.VITE_DEFI_SCORE_REGISTRY_97 || '', // BSC Testnet
  43113: import.meta.env.VITE_DEFI_SCORE_REGISTRY_43113 || '', // Avalanche Fuji
};

// DeFiScoreRegistry ABI
const REGISTRY_ABI = [
  {
    "inputs": [
      { "internalType": "uint256[8]", "name": "_proof", "type": "uint256[8]" },
      { "internalType": "uint256[11]", "name": "_pubSignals", "type": "uint256[11]" }
    ],
    "name": "submitProof",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "isEligible",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_threshold", "type": "uint256" }
    ],
    "name": "meetsThreshold",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "getEligibilityData",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "score", "type": "uint256" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "bytes32", "name": "nullifier", "type": "bytes32" },
          { "internalType": "uint256", "name": "version", "type": "uint256" },
          { "internalType": "bool", "name": "isEligible", "type": "bool" }
        ],
        "internalType": "struct DeFiScoreRegistry.EligibilityData",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "isProofFresh",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "getTimeUntilExpiry",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "score", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "nullifier", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "version", "type": "uint256" }
    ],
    "name": "ProofSubmitted",
    "type": "event"
  }
];

export interface WitnessData {
  public_inputs: Record<string, any>;
  private_inputs: Record<string, any>;
  wallet_address: string;
  threshold: number;
  version: number;
}

export interface ProofData {
  proof: any;
  publicSignals: string[];
}

export interface EligibilityData {
  score: bigint;
  timestamp: bigint;
  nullifier: string;
  version: bigint;
  isEligible: boolean;
}

class ZKProofService {
  private worker: Worker | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private registryContract: ethers.Contract | null = null;
  private currentChainId: number | null = null;

  /**
   * Initialize service with wallet provider
   * Automatically detects network and uses correct contract
   */
  async initialize(provider: any) {
    try {
      this.provider = new ethers.BrowserProvider(provider);
      this.signer = await this.provider.getSigner();

      // Get current network
      const network = await this.provider.getNetwork();
      this.currentChainId = Number(network.chainId);

      console.log(`[ZKProofService] Connected to chain ID: ${this.currentChainId}`);

      // Get registry address for this network
      const registryAddress = REGISTRY_ADDRESSES[this.currentChainId];

      if (registryAddress) {
        this.registryContract = new ethers.Contract(
          registryAddress,
          REGISTRY_ABI,
          this.signer
        );
        console.log(`[ZKProofService] Using registry: ${registryAddress}`);
      } else {
        console.warn(`[ZKProofService] No registry configured for chain ID ${this.currentChainId}`);
        console.warn('Available networks:', Object.keys(REGISTRY_ADDRESSES).join(', '));
      }
    } catch (error) {
      console.error('Failed to initialize ZK proof service:', error);
      throw error;
    }
  }

  /**
   * Get current network info
   */
  getCurrentNetwork(): { chainId: number | null; hasRegistry: boolean } {
    return {
      chainId: this.currentChainId,
      hasRegistry: this.registryContract !== null
    };
  }

  /**
   * Generate ZK proof client-side using Web Worker
   */
  async generateProof(
    witnessData: WitnessData,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<ProofData> {
    return new Promise((resolve, reject) => {
      try {
        // Create Web Worker
        this.worker = new Worker(
          new URL('../workers/zkProofWorker.ts', import.meta.url),
          { type: 'module' }
        );

        // Handle worker messages
        this.worker.onmessage = (event) => {
          const { type, payload } = event.data;

          switch (type) {
            case 'PROGRESS':
              if (onProgress) {
                onProgress(payload.stage, payload.progress);
              }
              break;

            case 'PROOF_SUCCESS':
              this.worker?.terminate();
              this.worker = null;
              resolve(payload);
              break;

            case 'PROOF_ERROR':
              this.worker?.terminate();
              this.worker = null;
              reject(new Error(payload.error));
              break;
          }
        };

        this.worker.onerror = (error) => {
          this.worker?.terminate();
          this.worker = null;
          reject(new Error(`Worker error: ${error.message}`));
        };

        // Send proof generation request
        this.worker.postMessage({
          type: 'GENERATE_PROOF',
          payload: {
            publicInputs: witnessData.public_inputs,
            privateInputs: witnessData.private_inputs,
            wasmUrl: WASM_URL,
            zkeyUrl: ZKEY_URL
          }
        });
      } catch (error: any) {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        reject(error);
      }
    });
  }

  /**
   * Submit proof to DeFiScoreRegistry contract
   */
  async submitProofToBlockchain(
    proofData: ProofData
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.registryContract || !this.signer) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      toast.loading('Submitting proof to blockchain...', { id: 'submit-proof' });

      // Format proof for Solidity
      const proof = this.formatProofForSolidity(proofData.proof);
      const publicSignals = proofData.publicSignals.map(s => BigInt(s));

      // Submit to contract
      const tx = await this.registryContract.submitProof(proof, publicSignals);
      
      toast.loading('Waiting for confirmation...', { id: 'submit-proof' });
      
      const receipt = await tx.wait();

      toast.success('Proof verified and registered on-chain!', { id: 'submit-proof' });

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Failed to submit proof:', error);
      toast.error('Failed to submit proof to blockchain', { id: 'submit-proof' });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if user has valid eligibility proof
   */
  async isEligible(userAddress: string): Promise<boolean> {
    if (!this.registryContract) {
      throw new Error('Service not initialized');
    }

    try {
      return await this.registryContract.isEligible(userAddress);
    } catch (error) {
      console.error('Failed to check eligibility:', error);
      return false;
    }
  }

  /**
   * Check if user meets specific threshold
   */
  async meetsThreshold(userAddress: string, threshold: number): Promise<boolean> {
    if (!this.registryContract) {
      throw new Error('Service not initialized');
    }

    try {
      // Threshold is scaled x1000 in contract
      const scaledThreshold = BigInt(threshold * 1000);
      return await this.registryContract.meetsThreshold(userAddress, scaledThreshold);
    } catch (error) {
      console.error('Failed to check threshold:', error);
      return false;
    }
  }

  /**
   * Get user's eligibility data
   */
  async getEligibilityData(userAddress: string): Promise<EligibilityData | null> {
    if (!this.registryContract) {
      throw new Error('Service not initialized');
    }

    try {
      const data = await this.registryContract.getEligibilityData(userAddress);
      
      return {
        score: data.score,
        timestamp: data.timestamp,
        nullifier: data.nullifier,
        version: data.version,
        isEligible: data.isEligible
      };
    } catch (error) {
      console.error('Failed to get eligibility data:', error);
      return null;
    }
  }

  /**
   * Check if proof is still fresh (within 24 hours)
   */
  async isProofFresh(userAddress: string): Promise<boolean> {
    if (!this.registryContract) {
      throw new Error('Service not initialized');
    }

    try {
      return await this.registryContract.isProofFresh(userAddress);
    } catch (error) {
      console.error('Failed to check proof freshness:', error);
      return false;
    }
  }

  /**
   * Get time until proof expires
   */
  async getTimeUntilExpiry(userAddress: string): Promise<number> {
    if (!this.registryContract) {
      throw new Error('Service not initialized');
    }

    try {
      const seconds = await this.registryContract.getTimeUntilExpiry(userAddress);
      return Number(seconds);
    } catch (error) {
      console.error('Failed to get expiry time:', error);
      return 0;
    }
  }

  /**
   * Format proof for Solidity contract
   */
  private formatProofForSolidity(proof: any): bigint[] {
    return [
      BigInt(proof.pi_a[0]),
      BigInt(proof.pi_a[1]),
      BigInt(proof.pi_b[0][1]),
      BigInt(proof.pi_b[0][0]),
      BigInt(proof.pi_b[1][1]),
      BigInt(proof.pi_b[1][0]),
      BigInt(proof.pi_c[0]),
      BigInt(proof.pi_c[1])
    ];
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const zkProofService = new ZKProofService();
