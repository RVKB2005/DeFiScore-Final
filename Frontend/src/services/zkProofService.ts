/**
 * ZK Proof Service - Client-Side Proof Generation
 * 
 * This service manages browser-based proof generation.
 * NO BACKEND INVOLVEMENT - this is the trust boundary.
 * 
 * Architecture:
 * 1. User provides signed data
 * 2. Browser computes witness
 * 3. Browser generates proof (Web Worker)
 * 4. Proof submitted directly to blockchain
 */

import { buildPoseidon } from 'circomlibjs';

export interface FeatureData {
  // Financial
  currentBalance: number;
  maxBalance: number;
  balanceVolatility: number;
  suddenDropsCount: number;
  totalValueTransferred: number;
  avgTxValue: number;
  minBalance: number;
  // Protocol
  borrowCount: number;
  repayCount: number;
  liquidationCount: number;
  totalProtocolEvents: number;
  depositCount: number;
  withdrawCount: number;
  avgBorrowDuration: number;
  // Activity
  totalTransactions: number;
  activeDays: number;
  totalDays: number;
  longestInactivityGap: number;
  transactionsPerDay: number;
  // Temporal
  walletAgeDays: number;
  transactionRegularity: number;
  burstActivityRatio: number;
  daysSinceLastActivity: number;
  // Risk
  failedTxCount: number;
  failedTxRatio: number;
  highGasSpikeCount: number;
  zeroBalancePeriods: number;
}

export interface ProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

class ZKProofService {
  private worker: Worker | null = null;
  private poseidon: any = null;

  /**
   * Initialize the proof service
   */
  async initialize(): Promise<void> {
    // Initialize Poseidon hash for nullifier generation
    if (!this.poseidon) {
      this.poseidon = await buildPoseidon();
    }
  }

  /**
   * Compute credit score components using circuit-compatible logic
   * This MUST match the circuit's score computation EXACTLY
   * 
   * CRITICAL: Uses EXACT integer arithmetic (scaled x1000) matching circuit
   */
  private computeScores(features: FeatureData): {
    scoreTotal: number;
    scoreRepayment: number;
    scoreCapital: number;
    scoreLongevity: number;
    scoreActivity: number;
    scoreProtocol: number;
  } {
    const SCALE = 1000;

    // Helper: Logarithmic scaling (matches circuit EXACTLY)
    // CRITICAL: Uses INTEGER DIVISION matching Circom's \ operator
    const logScale = (value: number, base: number): number => {
      if (value === 0) return 0;

      let logValue: number;
      if (value <= 10) {
        // Integer division: (value * 693) \ 1000
        logValue = Math.floor((value * 693) / 1000);
      } else if (value <= 100) {
        // Integer division: 2398 + ((value - 10) * 223) \ 10000
        logValue = 2398 + Math.floor(((value - 10) * 223) / 10000);
      } else if (value <= 1000) {
        // Integer division: 4615 + ((value - 100) * 246) \ 100000
        logValue = 4615 + Math.floor(((value - 100) * 246) / 100000);
      } else {
        // Integer division: 6908 + ((value - 1000) * 231) \ 1000000
        logValue = 6908 + Math.floor(((value - 1000) * 231) / 1000000);
      }

      // Precomputed log(base) values
      const logBase = base === 11 ? 2398 : base === 731 ? 6594 : 6909;
      
      // Integer division: (logValue * 1000) \ logBase
      const ratio = Math.floor((logValue * 1000) / logBase);
      
      return Math.min(ratio, 1000);
    };

    // Helper: Min/Max
    const min = (a: number, b: number) => a < b ? a : b;
    const max = (a: number, b: number) => a > b ? a : b;

    // 1. Repayment Score (35% = 210 points max)
    const hasBorrowed = features.borrowCount > 0 ? 1 : 0;
    const repayRatio = features.borrowCount > 0 
      ? Math.floor((features.repayCount * SCALE) / features.borrowCount)
      : 0;
    const repayRatioCapped = min(repayRatio, SCALE);
    const ratioScore = repayRatioCapped * 150;
    // CRITICAL: Circuit gates ratioScore by borrowed flag
    const ratioScoreGated = ratioScore * hasBorrowed;
    const noLiquidations = features.liquidationCount === 0 ? 1 : 0;
    const liquidationBonus = noLiquidations * hasBorrowed * 60000;
    const scoreRepayment = ratioScoreGated + liquidationBonus;
    
    console.log('[zkProofService] Repayment Score Details:', {
      borrowCount: features.borrowCount,
      repayCount: features.repayCount,
      liquidationCount: features.liquidationCount,
      hasBorrowed,
      repayRatio,
      repayRatioCapped,
      ratioScore,
      ratioScoreGated,
      noLiquidations,
      liquidationBonus,
      scoreRepayment
    });

    // 2. Capital Score (30% = 180 points max)
    // CRITICAL: Use INTEGER part of balance (not scaled)
    const currentBalanceInt = Math.floor(features.currentBalance);
    const maxBalanceInt = Math.floor(features.maxBalance);
    const volScaled = Math.floor(features.balanceVolatility * SCALE);
    
    const balanceLog = logScale(currentBalanceInt, 11);
    const balanceScore = balanceLog * 90;
    
    const volCheck = volScaled < SCALE ? 1 : 0;
    const volCapped = min(volScaled, SCALE);
    const stabilityRatio = SCALE - volCapped;
    const stabilityScore = stabilityRatio * 60 * volCheck;
    
    const maxBalanceLog = logScale(maxBalanceInt, 11);
    const maxBalanceScore = maxBalanceLog * 30;
    
    const scoreCapital = balanceScore + stabilityScore + maxBalanceScore;
    
    console.log('[zkProofService] Capital Score Details:', {
      currentBalance: features.currentBalance,
      currentBalanceInt,
      maxBalance: features.maxBalance,
      maxBalanceInt,
      balanceVolatility: features.balanceVolatility,
      volScaled,
      balanceLog,
      balanceScore,
      volCheck,
      volCapped,
      stabilityRatio,
      stabilityScore,
      maxBalanceLog,
      maxBalanceScore,
      scoreCapital
    });

    // 3. Longevity Score (15% = 90 points max)
    const ageLog = logScale(features.walletAgeDays, 731);
    const ageScore = ageLog * 60;
    const activeDaysRatio = features.totalDays > 0
      ? Math.floor((features.activeDays * SCALE) / features.totalDays)
      : 0;
    const consistencyScore = activeDaysRatio * 30;
    const scoreLongevity = ageScore + consistencyScore;

    // 4. Activity Score (10% = 60 points max)
    const txLog = logScale(features.totalTransactions, 1001);
    const txScore = txLog * 30;
    const regularityScaled = Math.floor(features.transactionRegularity * SCALE);
    const regularityScore = regularityScaled * 30;
    const scoreActivity = txScore + regularityScore;

    // 5. Protocol Score (10% = 60 points max)
    // CRITICAL: Match circuit's EXACT computation order
    // Circuit: min(totalProtocolEvents * 10, 1000) * 30
    const protocolCapped = min(features.totalProtocolEvents * 10, SCALE);
    const protocolScore = protocolCapped * 30;
    
    // Circuit: min(borrowCount * 100, 1000) * 30
    // NOTE: Circuit does NOT multiply by borrowed flag!
    const borrowCapped = min(features.borrowCount * 100, SCALE);
    const borrowScore = borrowCapped * 30;
    
    const scoreProtocol = protocolScore + borrowScore;
    
    console.log('[zkProofService] Protocol Score Details:', {
      totalProtocolEvents: features.totalProtocolEvents,
      borrowCount: features.borrowCount,
      protocolCapped,
      protocolScore,
      borrowCapped,
      borrowScore,
      scoreProtocol
    });

    // 6. Risk Penalties
    // CRITICAL: Match circuit's integer division using Math.floor
    const liquidationPenalty = features.liquidationCount * 100000;
    const failedRatioScaled = Math.floor(features.failedTxRatio * SCALE);
    const failedCheck = failedRatioScaled > 50 ? 1 : 0;
    // Circuit: failedCheck * ((failedRatioScaled * 20000) \ 50)
    const failedPenalty = failedCheck * Math.floor((failedRatioScaled * 20000) / 50);
    const volCheckPenalty = volScaled >= SCALE ? 1 : 0;
    const volPenalty = volCheckPenalty * 50000;
    const dropPenalty = features.suddenDropsCount * 15000;
    const dormancyCheck = features.daysSinceLastActivity > 180 ? 1 : 0;
    // Circuit: dormancyCheck * ((daysSinceLastActivity * 30000) \ 180)
    const dormancyPenalty = dormancyCheck * Math.floor((features.daysSinceLastActivity * 30000) / 180);
    const zeroCheck = features.zeroBalancePeriods > 5 ? 1 : 0;
    const zeroPenalty = zeroCheck * (features.zeroBalancePeriods - 5) * 10000;
    const burstRatioScaled = Math.floor(features.burstActivityRatio * SCALE);
    const burstCheck = burstRatioScaled > 500 ? 1 : 0;
    const burstPenalty = burstCheck * 25000;
    const penalties = liquidationPenalty + failedPenalty + volPenalty + 
                      dropPenalty + dormancyPenalty + zeroPenalty + burstPenalty;

    // 7. Total Score
    const baseScore = 300000;
    const positiveScores = scoreRepayment + scoreCapital + scoreLongevity + 
                           scoreActivity + scoreProtocol;
    const rawScore = baseScore + positiveScores - penalties;
    const scoreTotal = max(0, min(rawScore, 900000));

    return {
      scoreTotal: Math.floor(scoreTotal),
      scoreRepayment: Math.floor(scoreRepayment),
      scoreCapital: Math.floor(scoreCapital),
      scoreLongevity: Math.floor(scoreLongevity),
      scoreActivity: Math.floor(scoreActivity),
      scoreProtocol: Math.floor(scoreProtocol)
    };
  }

  /**
   * Generate nullifier using Poseidon hash
   * PHASE 2: Now enforced in circuit - must match exactly
   * 
   * CRITICAL: The circuit expects userAddress as a field element
   * We need to ensure the conversion matches the circuit's expectation
   */
  private async generateNullifier(
    userAddress: string,
    nonce: number,
    timestamp: number,
    versionId: number
  ): Promise<string> {
    if (!this.poseidon) {
      await this.initialize();
    }

    const F = this.poseidon.F;
    
    // Convert address to field element
    // The circuit receives userAddress as a public input (already a field element)
    // We need to use the SAME value that's in publicInputs
    const addressHex = userAddress.toLowerCase().replace('0x', '');
    const userAddressNum = BigInt('0x' + addressHex);
    
    console.log('[zkProofService] Nullifier inputs:', {
      userAddress: userAddressNum.toString(),
      nonce,
      timestamp,
      versionId
    });
    
    // Compute Poseidon hash: H(userAddress, nonce, timestamp, versionId)
    // This MUST match the circuit's computation exactly
    const hash = this.poseidon([
      userAddressNum,  // Don't wrap in F.e() - pass BigInt directly
      nonce,
      timestamp,
      versionId
    ]);

    const nullifierStr = F.toString(hash);
    console.log('[zkProofService] Computed nullifier:', nullifierStr);
    
    return nullifierStr;
  }

  /**
   * Generate ZK proof in browser (TRUSTLESS)
   * 
   * This is the main entry point for client-side proof generation.
   * NO backend involvement - user controls all private data.
   * 
   * CRITICAL: Scores must be computed by backend using circuit_score_engine.py
   * to ensure EXACT match with circuit computation.
   */
  async generateProof(
    userAddress: string,
    features: FeatureData,
    threshold: number
  ): Promise<ProofResult> {
    console.log('[zkProofService] Starting proof generation...');
    console.log('[zkProofService] User address:', userAddress);
    console.log('[zkProofService] Threshold:', threshold);
    
    try {
      await this.initialize();

      // Step 1: Compute scores CLIENT-SIDE (trustless)
      console.log('[zkProofService] Computing scores client-side (trustless)...');
      console.log('[zkProofService] Input features:', {
        currentBalance: features.currentBalance,
        maxBalance: features.maxBalance,
        balanceVolatility: features.balanceVolatility,
        borrowCount: features.borrowCount,
        repayCount: features.repayCount,
        liquidationCount: features.liquidationCount,
        totalProtocolEvents: features.totalProtocolEvents,
        totalTransactions: features.totalTransactions,
        walletAgeDays: features.walletAgeDays,
        activeDays: features.activeDays,
        totalDays: features.totalDays,
        transactionRegularity: features.transactionRegularity
      });
      
      const scores = this.computeScores(features);
      console.log('[zkProofService] Scores computed:', scores);
      console.log('[zkProofService] Scores breakdown:', {
        scoreTotal: `${scores.scoreTotal} (${scores.scoreTotal / 1000})`,
        scoreRepayment: `${scores.scoreRepayment} (${scores.scoreRepayment / 1000})`,
        scoreCapital: `${scores.scoreCapital} (${scores.scoreCapital / 1000})`,
        scoreLongevity: `${scores.scoreLongevity} (${scores.scoreLongevity / 1000})`,
        scoreActivity: `${scores.scoreActivity} (${scores.scoreActivity / 1000})`,
        scoreProtocol: `${scores.scoreProtocol} (${scores.scoreProtocol / 1000})`
      });

      // Step 2: Generate nonce and timestamp
      const nonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      const timestamp = Math.floor(Date.now() / 1000);
      const versionId = 1;
      
      console.log('[zkProofService] Nonce:', nonce);
      console.log('[zkProofService] Timestamp:', timestamp);

      // Step 3: Generate nullifier (will be recomputed and verified in circuit)
      // We compute it here just to show in the UI, but circuit enforces correctness
      console.log('[zkProofService] Generating nullifier for display...');
      const nullifier = await this.generateNullifier(
        userAddress,
        nonce,
        timestamp,
        versionId
      );
      console.log('[zkProofService] Nullifier generated (for display):', nullifier);

      // Step 4: Prepare inputs
      const SCALE = 1000;
      
      // Convert address to BigInt properly (remove 0x and convert hex to BigInt)
      const addressHex = userAddress.toLowerCase().replace('0x', '');
      const userAddressBigInt = BigInt('0x' + addressHex);
      
      console.log('[zkProofService] Address hex:', addressHex);
      console.log('[zkProofService] Address BigInt:', userAddressBigInt.toString());
      
      // PUBLIC INPUTS: These are revealed on-chain
      const publicInputs = {
        userAddress: userAddressBigInt.toString(),
        scoreTotal: scores.scoreTotal,
        scoreRepayment: scores.scoreRepayment,
        scoreCapital: scores.scoreCapital,
        scoreLongevity: scores.scoreLongevity,
        scoreActivity: scores.scoreActivity,
        scoreProtocol: scores.scoreProtocol,
        threshold: threshold * SCALE,
        timestamp,
        nullifier, // Circuit will verify this matches Poseidon(userAddress, nonce, timestamp, versionId)
        versionId
      };
      
      console.log('[zkProofService] Public inputs prepared:', publicInputs);

      // PRIVATE INPUTS: These stay in browser, never revealed
      const privateInputs = {
        currentBalanceScaled: Math.floor(features.currentBalance),
        maxBalanceScaled: Math.floor(features.maxBalance),
        balanceVolatilityScaled: Math.floor(features.balanceVolatility * SCALE),
        suddenDropsCount: features.suddenDropsCount,
        totalValueTransferred: Math.floor(features.totalValueTransferred),
        avgTxValue: Math.floor(features.avgTxValue),
        minBalanceScaled: Math.floor(features.minBalance),
        borrowCount: features.borrowCount,
        repayCount: features.repayCount,
        repayToBorrowRatio: features.borrowCount > 0 
          ? Math.floor((features.repayCount * SCALE) / features.borrowCount)
          : 0,
        liquidationCount: features.liquidationCount,
        totalProtocolEvents: features.totalProtocolEvents,
        depositCount: features.depositCount,
        withdrawCount: features.withdrawCount,
        avgBorrowDuration: Math.floor(features.avgBorrowDuration),
        totalTransactions: features.totalTransactions,
        activeDays: features.activeDays,
        totalDays: features.totalDays,
        activeDaysRatio: features.totalDays > 0
          ? Math.floor((features.activeDays * SCALE) / features.totalDays)
          : 0,
        longestInactivityGap: features.longestInactivityGap,
        transactionsPerDay: Math.floor(features.transactionsPerDay * SCALE),
        walletAgeDays: features.walletAgeDays,
        transactionRegularity: Math.floor(features.transactionRegularity * SCALE),
        burstActivityRatio: Math.floor(features.burstActivityRatio * SCALE),
        daysSinceLastActivity: features.daysSinceLastActivity,
        failedTxCount: features.failedTxCount,
        failedTxRatio: Math.floor(features.failedTxRatio * SCALE),
        highGasSpikeCount: features.highGasSpikeCount,
        zeroBalancePeriods: features.zeroBalancePeriods,
        nonce
      };
      
      console.log('[zkProofService] Private inputs prepared:', privateInputs);

    // Step 5: Generate proof in Web Worker
    return new Promise((resolve, reject) => {
      // Timeout after 2 minutes
      const timeout = setTimeout(() => {
        console.error('[zkProofService] Proof generation timeout');
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        reject(new Error('Proof generation timeout (2 minutes)'));
      }, 120000);

      // Create worker
      try {
        this.worker = new Worker(
          new URL('../workers/zkProver.worker.ts', import.meta.url),
          { type: 'module' }
        );
        console.log('[zkProofService] Worker created');
      } catch (workerError: any) {
        clearTimeout(timeout);
        console.error('[zkProofService] Failed to create worker:', workerError);
        reject(new Error(`Failed to create worker: ${workerError.message}`));
        return;
      }

      // Handle messages
      this.worker.onmessage = (event) => {
        const { type, payload } = event.data;
        console.log('[zkProofService] Worker message:', type);

        if (type === 'PROOF_GENERATED') {
          clearTimeout(timeout);
          this.worker?.terminate();
          this.worker = null;
          console.log('[zkProofService] Proof generated successfully');
          resolve(payload);
        } else if (type === 'PROOF_ERROR') {
          clearTimeout(timeout);
          this.worker?.terminate();
          this.worker = null;
          console.error('[zkProofService] Proof generation error:', payload.error);
          reject(new Error(payload.error));
        } else if (type === 'PROGRESS') {
          console.log(`[zkProofService] ${payload.stage}: ${payload.message}`);
        }
      };

      this.worker.onerror = (error) => {
        clearTimeout(timeout);
        this.worker?.terminate();
        this.worker = null;
        console.error('[zkProofService] Worker error:', error);
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send generation request
      console.log('[zkProofService] Sending generation request to worker...');
      try {
        this.worker.postMessage({
          type: 'GENERATE_PROOF',
          payload: { publicInputs, privateInputs }
        });
      } catch (postError: any) {
        clearTimeout(timeout);
        console.error('[zkProofService] Failed to post message to worker:', postError);
        reject(new Error(`Failed to send data to worker: ${postError.message}`));
      }
    });
    } catch (error: any) {
      console.error('[zkProofService] Error in generateProof:', error);
      throw error;
    }
  }

  /**
   * Terminate worker if running
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const zkProofService = new ZKProofService();
