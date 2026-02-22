/**
 * ZK Proof Generation Web Worker
 * 
 * Runs proof generation in isolated thread to prevent UI blocking.
 * This is the TRUST BOUNDARY - proof generation happens client-side.
 * 
 * Security:
 * - No backend involvement in proof generation
 * - User controls private data
 * - Circuit enforces all constraints
 */

import { groth16 } from 'snarkjs';

// Circuit files will be loaded from CDN or local
const CIRCUIT_WASM_URL = '/circuits/DeFiCreditScore.wasm';
const PROVING_KEY_URL = '/circuits/DeFiCreditScore_final.zkey';

interface ProofGenerationRequest {
  type: 'GENERATE_PROOF';
  payload: {
    publicInputs: {
      userAddress: string;
      scoreTotal: number;
      scoreRepayment: number;
      scoreCapital: number;
      scoreLongevity: number;
      scoreActivity: number;
      scoreProtocol: number;
      threshold: number;
      timestamp: number;
      nullifier: string;
      versionId: number;
    };
    privateInputs: {
      // Financial Features
      currentBalanceScaled: number;
      maxBalanceScaled: number;
      balanceVolatilityScaled: number;
      suddenDropsCount: number;
      totalValueTransferred: number;
      avgTxValue: number;
      minBalanceScaled: number;
      // Protocol Features
      borrowCount: number;
      repayCount: number;
      repayToBorrowRatio: number;
      liquidationCount: number;
      totalProtocolEvents: number;
      depositCount: number;
      withdrawCount: number;
      avgBorrowDuration: number;
      // Activity Features
      totalTransactions: number;
      activeDays: number;
      totalDays: number;
      activeDaysRatio: number;
      longestInactivityGap: number;
      transactionsPerDay: number;
      // Temporal Features
      walletAgeDays: number;
      transactionRegularity: number;
      burstActivityRatio: number;
      daysSinceLastActivity: number;
      // Risk Features
      failedTxCount: number;
      failedTxRatio: number;
      highGasSpikeCount: number;
      zeroBalancePeriods: number;
      // Anti-Replay
      nonce: number;
    };
  };
}

interface ProofGenerationResponse {
  type: 'PROOF_GENERATED' | 'PROOF_ERROR' | 'PROGRESS';
  payload: any;
}

// Worker message handler
self.onmessage = async (event: MessageEvent<ProofGenerationRequest>) => {
  const { type, payload } = event.data;

  if (type === 'GENERATE_PROOF') {
    try {
      // Step 1: Notify start
      postMessage({
        type: 'PROGRESS',
        payload: { stage: 'loading', message: 'Loading circuit files...' }
      });

      // Step 2: Prepare witness input (combine public + private)
      const witnessInput = {
        ...payload.publicInputs,
        ...payload.privateInputs
      };

      postMessage({
        type: 'PROGRESS',
        payload: { stage: 'witness', message: 'Generating witness...' }
      });

      // Step 3: Generate proof using snarkjs
      // This is the CRITICAL operation - happens entirely in browser
      const { proof, publicSignals } = await groth16.fullProve(
        witnessInput,
        CIRCUIT_WASM_URL,
        PROVING_KEY_URL
      );

      postMessage({
        type: 'PROGRESS',
        payload: { stage: 'complete', message: 'Proof generated successfully' }
      });

      // Step 4: Return proof
      postMessage({
        type: 'PROOF_GENERATED',
        payload: {
          proof: {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
            protocol: proof.protocol,
            curve: proof.curve
          },
          publicSignals
        }
      });

    } catch (error: any) {
      postMessage({
        type: 'PROOF_ERROR',
        payload: {
          error: error.message,
          stack: error.stack
        }
      });
    }
  }
};

// Export for TypeScript
export {};
