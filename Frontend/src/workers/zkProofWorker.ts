/**
 * ZK Proof Web Worker
 * Generates Groth16 proofs in isolated thread to prevent UI blocking
 * 
 * Architecture:
 * - Runs in separate thread (no DOM access)
 * - Loads WASM circuit and proving key
 * - Generates witness from inputs
 * - Creates Groth16 proof
 * - Returns proof + public signals
 * 
 * Security:
 * - Private inputs never leave browser
 * - Memory isolated from main thread
 * - No network calls during proof generation
 */

import { groth16 } from 'snarkjs';

// Worker message types
interface GenerateProofMessage {
  type: 'GENERATE_PROOF';
  payload: {
    publicInputs: Record<string, any>;
    privateInputs: Record<string, any>;
    wasmUrl: string;
    zkeyUrl: string;
  };
}

interface ProofResult {
  type: 'PROOF_SUCCESS';
  payload: {
    proof: any;
    publicSignals: string[];
  };
}

interface ProofError {
  type: 'PROOF_ERROR';
  payload: {
    error: string;
  };
}

interface ProgressUpdate {
  type: 'PROGRESS';
  payload: {
    stage: string;
    progress: number;
  };
}

type WorkerMessage = GenerateProofMessage;
type WorkerResponse = ProofResult | ProofError | ProgressUpdate;

/**
 * Generate ZK proof from witness data
 */
async function generateProof(
  publicInputs: Record<string, any>,
  privateInputs: Record<string, any>,
  wasmUrl: string,
  zkeyUrl: string
): Promise<{ proof: any; publicSignals: string[] }> {
  try {
    // Stage 1: Load circuit files
    postMessage({
      type: 'PROGRESS',
      payload: { stage: 'Loading circuit files', progress: 10 }
    } as ProgressUpdate);

    // Combine inputs for circuit
    const circuitInputs = {
      ...publicInputs,
      ...privateInputs
    };

    console.log('[Worker] Circuit inputs prepared:', Object.keys(circuitInputs));

    // Stage 2: Generate witness
    postMessage({
      type: 'PROGRESS',
      payload: { stage: 'Generating witness', progress: 30 }
    } as ProgressUpdate);

    // Stage 3: Generate proof
    postMessage({
      type: 'PROGRESS',
      payload: { stage: 'Generating proof (this may take 10-30 seconds)', progress: 50 }
    } as ProgressUpdate);

    const { proof, publicSignals } = await groth16.fullProve(
      circuitInputs,
      wasmUrl,
      zkeyUrl
    );

    postMessage({
      type: 'PROGRESS',
      payload: { stage: 'Proof generated successfully', progress: 100 }
    } as ProgressUpdate);

    console.log('[Worker] Proof generated successfully');
    console.log('[Worker] Public signals:', publicSignals);

    return { proof, publicSignals };
  } catch (error: any) {
    console.error('[Worker] Proof generation failed:', error);
    throw new Error(`Proof generation failed: ${error.message}`);
  }
}

/**
 * Worker message handler
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'GENERATE_PROOF') {
    try {
      const { publicInputs, privateInputs, wasmUrl, zkeyUrl } = payload;

      const result = await generateProof(
        publicInputs,
        privateInputs,
        wasmUrl,
        zkeyUrl
      );

      postMessage({
        type: 'PROOF_SUCCESS',
        payload: result
      } as ProofResult);
    } catch (error: any) {
      postMessage({
        type: 'PROOF_ERROR',
        payload: { error: error.message }
      } as ProofError);
    }
  }
};

// Export for TypeScript
export {};
