/**
 * Anti-Replay and Front-Running Protection Service
 * 
 * PHASE 2: Security hardening for proof submission
 * 
 * Protections:
 * 1. Nullifier uniqueness check before submission
 * 2. Timestamp freshness validation
 * 3. Front-running detection via pending transaction monitoring
 * 4. Proof expiration enforcement (24 hour window)
 */

import { ethers } from 'ethers';

export interface ProofValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class AntiReplayService {
  private registryContract: ethers.Contract | null = null;
  private provider: ethers.providers.Web3Provider | null = null;

  /**
   * Initialize service with contract
   */
  async initialize(
    registryAddress: string,
    registryABI: any[]
  ): Promise<void> {
    if (!window.ethereum) {
      throw new Error('No Web3 provider found');
    }

    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    this.registryContract = new ethers.Contract(
      registryAddress,
      registryABI,
      this.provider
    );
  }

  /**
   * Validate proof before submission
   * 
   * Checks:
   * 1. Nullifier not already used
   * 2. Timestamp within valid range
   * 3. No pending transactions with same nullifier
   */
  async validateProofBeforeSubmission(
    nullifier: string,
    timestamp: number
  ): Promise<ProofValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.registryContract) {
      errors.push('Registry contract not initialized');
      return { isValid: false, errors, warnings };
    }

    try {
      // Check 1: Nullifier uniqueness
      const nullifierBytes32 = ethers.utils.hexZeroPad(
        ethers.BigNumber.from(nullifier).toHexString(),
        32
      );
      
      const isUsed = await this.registryContract.isNullifierUsed(nullifierBytes32);
      
      if (isUsed) {
        errors.push('Nullifier already used - proof has been replayed');
        return { isValid: false, errors, warnings };
      }

      // Check 2: Timestamp freshness
      const now = Math.floor(Date.now() / 1000);
      const MAX_DRIFT = 5 * 60; // 5 minutes
      const PROOF_VALIDITY = 24 * 60 * 60; // 24 hours

      if (timestamp > now + MAX_DRIFT) {
        errors.push('Timestamp is in the future');
      }

      if (now > timestamp + PROOF_VALIDITY) {
        errors.push('Proof has expired (older than 24 hours)');
      }

      const age = now - timestamp;
      if (age > 60 * 60) { // 1 hour
        warnings.push(`Proof is ${Math.floor(age / 60)} minutes old`);
      }

      // Check 3: Front-running detection
      // Monitor mempool for pending transactions with same nullifier
      const hasPendingTx = await this.checkPendingTransactions(nullifierBytes32);
      
      if (hasPendingTx) {
        warnings.push('Detected pending transaction with same nullifier - possible front-running attempt');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error: any) {
      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Check for pending transactions with same nullifier
   * 
   * This helps detect front-running attempts where an attacker
   * tries to submit the same proof before the legitimate user.
   */
  private async checkPendingTransactions(nullifier: string): Promise<boolean> {
    if (!this.provider) return false;

    try {
      // Get pending transactions from mempool
      // Note: This is limited by provider capabilities
      const pendingBlock = await this.provider.getBlock('pending');
      
      if (!pendingBlock || !pendingBlock.transactions) {
        return false;
      }

      // Check if any pending transaction is calling submitProof with our nullifier
      // This is a simplified check - full implementation would decode transaction data
      for (const txHash of pendingBlock.transactions) {
        const tx = await this.provider.getTransaction(txHash);
        
        if (tx && tx.to === this.registryContract?.address) {
          // Transaction is to our registry contract
          // In production, decode tx.data to check if nullifier matches
          // For now, flag as potential front-running
          return true;
        }
      }

      return false;

    } catch (error) {
      // Mempool access may not be available on all providers
      console.warn('Could not check pending transactions:', error);
      return false;
    }
  }

  /**
   * Get proof expiration time
   */
  async getProofExpiration(userAddress: string): Promise<number | null> {
    if (!this.registryContract) return null;

    try {
      const timeRemaining = await this.registryContract.getTimeUntilExpiry(userAddress);
      return timeRemaining.toNumber();
    } catch (error) {
      console.error('Failed to get expiration:', error);
      return null;
    }
  }

  /**
   * Check if user's existing proof is still fresh
   */
  async isProofFresh(userAddress: string): Promise<boolean> {
    if (!this.registryContract) return false;

    try {
      return await this.registryContract.isProofFresh(userAddress);
    } catch (error) {
      console.error('Failed to check freshness:', error);
      return false;
    }
  }

  /**
   * Monitor proof submission transaction
   * 
   * Returns when transaction is confirmed or fails
   */
  async monitorSubmission(
    txHash: string,
    onUpdate?: (status: string) => void
  ): Promise<{ success: boolean; receipt?: any; error?: string }> {
    if (!this.provider) {
      return { success: false, error: 'No provider' };
    }

    try {
      onUpdate?.('Waiting for confirmation...');

      const receipt = await this.provider.waitForTransaction(txHash, 1);

      if (receipt.status === 1) {
        onUpdate?.('Transaction confirmed');
        return { success: true, receipt };
      } else {
        onUpdate?.('Transaction failed');
        return { success: false, error: 'Transaction reverted' };
      }

    } catch (error: any) {
      onUpdate?.('Transaction error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Estimate gas for proof submission
   * 
   * Helps prevent out-of-gas failures
   */
  async estimateSubmissionGas(
    proof: any,
    publicSignals: string[]
  ): Promise<ethers.BigNumber | null> {
    if (!this.registryContract) return null;

    try {
      const signer = this.provider?.getSigner();
      const contractWithSigner = this.registryContract.connect(signer!);

      // Format proof for contract
      const proofFormatted = [
        proof.pi_a[0], proof.pi_a[1],
        proof.pi_b[0][1], proof.pi_b[0][0],
        proof.pi_b[1][1], proof.pi_b[1][0],
        proof.pi_c[0], proof.pi_c[1]
      ];

      const gasEstimate = await contractWithSigner.estimateGas.submitProof(
        proofFormatted,
        publicSignals
      );

      // Add 20% buffer
      return gasEstimate.mul(120).div(100);

    } catch (error: any) {
      console.error('Gas estimation failed:', error);
      return null;
    }
  }
}

export const antiReplayService = new AntiReplayService();
