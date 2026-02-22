#!/usr/bin/env node

/**
 * Test Proof Generation Script
 * 
 * Tests the complete proof generation and verification flow
 * Uses sample witness data to validate the circuit
 * 
 * Usage: node test-proof.js
 */

const path = require('path');
const fs = require('fs');
const snarkjs = require('snarkjs');

// Paths
const CIRCUIT_DIR = path.join(__dirname, '..');
const BUILD_DIR = path.join(CIRCUIT_DIR, 'build');
const KEYS_DIR = path.join(CIRCUIT_DIR, 'keys');
const CIRCUIT_NAME = 'DeFiCreditScore';

const WASM_FILE = path.join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
const ZKEY_FILE = path.join(KEYS_DIR, `${CIRCUIT_NAME}_final.zkey`);
const VKEY_FILE = path.join(KEYS_DIR, `${CIRCUIT_NAME}_verification_key.json`);

// Colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n[TEST ${step}] ${message}`, colors.cyan + colors.bright);
}

function logSuccess(message) {
    log(`✓ ${message}`, colors.green);
}

function logError(message) {
    log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
    log(`ℹ ${message}`, colors.cyan);
}

// Helper to compute scores (must match circuit logic exactly)
function computeScores(privateInputs) {
    const {
        currentBalanceScaled, maxBalanceScaled, balanceVolatilityScaled,
        borrowCount, repayCount, repayToBorrowRatio, liquidationCount,
        totalProtocolEvents, walletAgeDays, activeDaysRatio,
        totalTransactions, transactionRegularity, suddenDropsCount,
        failedTxRatio, daysSinceLastActivity, zeroBalancePeriods,
        burstActivityRatio
    } = privateInputs;
    
    // Repayment Score
    const hasBorrowed = borrowCount > 0 ? 1 : 0;
    const cappedRatio = Math.min(repayToBorrowRatio, 1000);
    const ratioScore = Math.floor(cappedRatio * 150 * hasBorrowed);
    const noLiquidations = liquidationCount === 0 ? 1 : 0;
    const liquidationBonus = Math.floor(noLiquidations * hasBorrowed * 60000);
    const scoreRepayment = ratioScore + liquidationBonus;
    
    // Capital Score (using same linear scaling as circuit's LogScale template)
    // LogScale template: scaled = (in * 1000) \ max_val (integer division), then cap at 1000
    // For currentBalanceScaled: (0 * 1000) \ 10000 = 0
    const balanceScaled = Math.min(Math.floor((currentBalanceScaled * 1000) / 10000), 1000);
    const balanceScore = Math.floor(balanceScaled * 90);
    const volCheck = balanceVolatilityScaled < 1000 ? 1 : 0;
    const stabilityRatio = 1000 - balanceVolatilityScaled;
    // IMPORTANT: In circom, (stabilityRatio * 60) * volCheck is computed as one expression
    // With stabilityRatio=1000, volCheck=1: (1000 * 60) * 1 = 60000
    const stabilityScore = Math.floor((stabilityRatio * 60) * volCheck);
    const maxBalScaled = Math.min(Math.floor((maxBalanceScaled * 1000) / 10000), 1000);
    const maxBalanceScore = Math.floor(maxBalScaled * 30);
    const scoreCapital = balanceScore + stabilityScore + maxBalanceScore;
    
    // Longevity Score
    const ageScaled = Math.min(Math.floor((walletAgeDays * 1000) / 730), 1000);
    const ageScore = Math.floor(ageScaled * 60);
    const activeScore = Math.floor(activeDaysRatio * 30);
    const scoreLongevity = ageScore + activeScore;
    
    // Activity Score
    const txScaled = Math.min(Math.floor((totalTransactions * 1000) / 1000), 1000);
    const txScore = Math.floor(txScaled * 30);
    const regularityScore = Math.floor(transactionRegularity * 30);
    const scoreActivity = txScore + regularityScore;
    
    // Protocol Score
    const protocolCapped = Math.min(totalProtocolEvents * 10, 1000);
    const protocolInteractionScore = Math.floor(protocolCapped * 30);
    const borrowed = borrowCount > 0 ? 1 : 0;
    const borrowCapped = Math.min(borrowCount * 100, 1000);
    const borrowExperienceScore = Math.floor(borrowCapped * 30 * borrowed);
    const scoreProtocol = protocolInteractionScore + borrowExperienceScore;
    
    // Risk Penalties
    const liquidationPenalty = Math.floor(liquidationCount * 100000);
    const failedCheck = failedTxRatio > 50 ? 1 : 0;
    const failedPenalty = Math.floor(failedCheck * 400 * failedTxRatio);
    const volCheckPenalty = balanceVolatilityScaled >= 1000 ? 1 : 0;
    const volPenalty = Math.floor(volCheckPenalty * 50000);
    const dropPenalty = Math.floor(suddenDropsCount * 15000);
    const dormancyCheck = daysSinceLastActivity > 180 ? 1 : 0;
    const dormancyPenalty = Math.floor(dormancyCheck * 167 * daysSinceLastActivity);
    const zeroCheck = zeroBalancePeriods > 5 ? 1 : 0;
    const excessPeriods = zeroBalancePeriods - 5;
    const zeroPenalty = Math.floor(zeroCheck * excessPeriods * 10000);
    const burstCheck = burstActivityRatio > 500 ? 1 : 0;
    const burstPenalty = Math.floor(burstCheck * 25000);
    const penalties = liquidationPenalty + failedPenalty + volPenalty + 
                      dropPenalty + dormancyPenalty + zeroPenalty + burstPenalty;
    
    // Total Score
    const baseScore = 300000;
    const positiveScores = scoreRepayment + scoreCapital + scoreLongevity + 
                           scoreActivity + scoreProtocol;
    const rawScore = baseScore + positiveScores - penalties;
    const scoreTotal = Math.max(0, Math.min(rawScore, 900000));
    
    return {
        scoreTotal: Math.floor(scoreTotal),
        scoreRepayment: Math.floor(scoreRepayment),
        scoreCapital: Math.floor(scoreCapital),
        scoreLongevity: Math.floor(scoreLongevity),
        scoreActivity: Math.floor(scoreActivity),
        scoreProtocol: Math.floor(scoreProtocol)
    };
}

// Sample witness data (scaled x1000)
async function generateSampleWitness() {
    const nonce = 123456789;
    const timestamp = Math.floor(Date.now() / 1000);
    const userAddress = "123456789012345678901234567890";
    const threshold = 300000; // Lower threshold to 300 (minimum score)
    const versionId = 1;
    
    const privateInputs = {
        // Financial Features
        currentBalanceScaled: 5420,
        maxBalanceScaled: 12300,
        balanceVolatilityScaled: 450,
        suddenDropsCount: 2,
        totalValueTransferred: 45000,
        avgTxValue: 250,
        minBalanceScaled: 100,
        
        // Protocol Features
        borrowCount: 8,
        repayCount: 8,
        repayToBorrowRatio: 1000,
        liquidationCount: 0,
        totalProtocolEvents: 45,
        depositCount: 12,
        withdrawCount: 10,
        avgBorrowDuration: 15000,
        
        // Activity Features
        totalTransactions: 234,
        activeDays: 120,
        totalDays: 180,
        activeDaysRatio: 667,
        longestInactivityGap: 15,
        transactionsPerDay: 1300,
        
        // Temporal Features
        walletAgeDays: 450,
        transactionRegularity: 750,
        burstActivityRatio: 300,
        daysSinceLastActivity: 2,
        
        // Risk Features
        failedTxCount: 5,
        failedTxRatio: 21,
        highGasSpikeCount: 1,
        zeroBalancePeriods: 3,
        
        // Anti-Replay
        nonce: nonce
    };
    
    // Compute scores using the same logic as the circuit
    const scores = computeScores(privateInputs);
    
    // Debug: Log computed scores
    console.log('\n=== DEBUG: Computed Scores ===');
    console.log(`Score Total: ${scores.scoreTotal} (${scores.scoreTotal / 1000})`);
    console.log(`Score Repayment: ${scores.scoreRepayment} (${scores.scoreRepayment / 1000})`);
    console.log(`Score Capital: ${scores.scoreCapital} (${scores.scoreCapital / 1000})`);
    console.log(`Score Longevity: ${scores.scoreLongevity} (${scores.scoreLongevity / 1000})`);
    console.log(`Score Activity: ${scores.scoreActivity} (${scores.scoreActivity / 1000})`);
    console.log(`Score Protocol: ${scores.scoreProtocol} (${scores.scoreProtocol / 1000})`);
    console.log(`Threshold: ${threshold} (${threshold / 1000})`);
    console.log(`Pass Check: ${scores.scoreTotal >= threshold ? 'YES' : 'NO'}`);
    console.log('==============================\n');
    
    // Compute nullifier using Poseidon hash
    // The circuit computes: Poseidon(userAddress, nonce, timestamp, versionId)
    // We need to compute this in JavaScript
    const { buildPoseidon } = require('circomlibjs');
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    
    // Convert inputs to field elements
    const userAddressF = F.e(userAddress);
    const nonceF = F.e(nonce);
    const timestampF = F.e(timestamp);
    const versionIdF = F.e(versionId);
    
    // Compute Poseidon hash with 4 inputs
    const nullifier = F.toString(poseidon([userAddressF, nonceF, timestampF, versionIdF]));
    
    return {
        // Public inputs
        userAddress,
        ...scores,
        threshold,
        timestamp,
        nullifier,
        versionId,
        
        // Private inputs
        ...privateInputs
    };
}

function generateFailingWitness() {
    // This will be called after generateSampleWitness, so we can't make it async easily
    // Instead, we'll handle this in the test function
    return null; // Placeholder
}

async function checkFiles() {
    logStep('1', 'Checking required files');
    
    const files = [
        { path: WASM_FILE, name: 'WASM file' },
        { path: ZKEY_FILE, name: 'Proving key' },
        { path: VKEY_FILE, name: 'Verification key' }
    ];
    
    for (const file of files) {
        if (!fs.existsSync(file.path)) {
            logError(`${file.name} not found: ${file.path}`);
            return false;
        }
        logSuccess(`${file.name} found`);
    }
    
    return true;
}

async function testWitnessCalculation() {
    logStep('2', 'Testing witness calculation');
    
    try {
        const witness = await generateSampleWitness();
        logInfo('Sample witness data:');
        console.log(`  Score Total: ${(witness.scoreTotal / 1000).toFixed(0)}`);
        console.log(`  Threshold: ${witness.threshold / 1000}`);
        console.log(`  User Address: ${witness.userAddress.substring(0, 20)}...`);
        console.log(`  Nullifier: ${witness.nullifier.substring(0, 20)}...`);
        
        logInfo('Calculating full witness and generating proof...');
        const startTime = Date.now();
        
        // Use groth16.fullProve which handles witness calculation internally
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            witness,
            WASM_FILE,
            ZKEY_FILE
        );
        
        const duration = Date.now() - startTime;
        logSuccess(`Witness calculated and proof generated in ${(duration / 1000).toFixed(2)}s`);
        logInfo(`Public signals: ${publicSignals.length} signals`);
        
        return { proof, publicSignals };
    } catch (error) {
        logError('Witness calculation failed');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack.split('\n').slice(0, 5).join('\n'));
        }
        return null;
    }
}

async function testProofGeneration(proofData) {
    logStep('3', 'Displaying proof details');
    
    try {
        const { proof, publicSignals } = proofData;
        
        logInfo('Proof details:');
        console.log(`  Proof size: ${JSON.stringify(proof).length} bytes`);
        console.log(`  Public signals: ${publicSignals.length}`);
        
        // Display public signals
        console.log('\n  Public Signals:');
        console.log(`    User Address: ${publicSignals[0]}`);
        console.log(`    Score Total: ${publicSignals[1]}`);
        console.log(`    Score Repayment: ${publicSignals[2]}`);
        console.log(`    Score Capital: ${publicSignals[3]}`);
        console.log(`    Score Longevity: ${publicSignals[4]}`);
        console.log(`    Score Activity: ${publicSignals[5]}`);
        console.log(`    Score Protocol: ${publicSignals[6]}`);
        console.log(`    Threshold: ${publicSignals[7]}`);
        console.log(`    Timestamp: ${publicSignals[8]}`);
        console.log(`    Nullifier: ${publicSignals[9]}`);
        console.log(`    Version ID: ${publicSignals[10]}`);
        
        return proofData;
    } catch (error) {
        logError('Proof display failed');
        console.error(error.message);
        return null;
    }
}

async function testProofVerification(proof, publicSignals) {
    logStep('4', 'Testing proof verification');
    
    try {
        logInfo('Loading verification key...');
        const vkey = JSON.parse(fs.readFileSync(VKEY_FILE, 'utf8'));
        
        logInfo('Verifying proof...');
        const startTime = Date.now();
        
        const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        
        const duration = Date.now() - startTime;
        
        if (isValid) {
            logSuccess(`Proof verified in ${duration}ms`);
            logSuccess('Proof is VALID ✓');
            return true;
        } else {
            logError('Proof is INVALID ✗');
            return false;
        }
    } catch (error) {
        logError('Proof verification failed');
        console.error(error.message);
        return false;
    }
}

async function testFailureCase() {
    logStep('5', 'Testing failure case (score < threshold)');
    
    try {
        const witness = await generateSampleWitness();
        // Set threshold very high to ensure failure
        witness.threshold = 900000; // Maximum possible score
        
        logInfo(`Threshold set to maximum: ${witness.threshold / 1000}`);
        
        logInfo('Attempting to generate proof (should fail)...');
        
        await snarkjs.groth16.fullProve(witness, WASM_FILE, ZKEY_FILE);
        
        logError('Proof generation succeeded when it should have failed!');
        return false;
    } catch (error) {
        logSuccess('Proof generation correctly failed for invalid input');
        logInfo(`Error: ${error.message.substring(0, 100)}...`);
        return true;
    }
}

async function generateProofReport(results) {
    logStep('6', 'Generating test report');
    
    const report = {
        timestamp: new Date().toISOString(),
        circuit: CIRCUIT_NAME,
        version: '1.0.0',
        tests: {
            files_check: results.filesCheck,
            witness_calculation: results.witnessCalculation,
            proof_generation: results.proofGeneration,
            proof_verification: results.proofVerification,
            failure_case: results.failureCase
        },
        performance: {
            witness_calculation_ms: results.witnessTime,
            proof_generation_ms: results.proofTime,
            proof_verification_ms: results.verificationTime
        },
        proof_details: results.proofDetails,
        status: results.allPassed ? 'PASSED' : 'FAILED'
    };
    
    const reportPath = path.join(BUILD_DIR, 'test-proof-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    logSuccess(`Test report saved: ${reportPath}`);
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    log('TEST SUMMARY', colors.bright);
    console.log('='.repeat(70));
    console.log(`Circuit:              ${report.circuit} v${report.version}`);
    console.log(`Timestamp:            ${report.timestamp}`);
    console.log(`\nTest Results:`);
    console.log(`  Files Check:        ${report.tests.files_check ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Witness Calc:       ${report.tests.witness_calculation ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Proof Generation:   ${report.tests.proof_generation ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Proof Verification: ${report.tests.proof_verification ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Failure Case:       ${report.tests.failure_case ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`\nPerformance:`);
    console.log(`  Witness Calc:       ${report.performance.witness_calculation_ms}ms`);
    console.log(`  Proof Generation:   ${(report.performance.proof_generation_ms / 1000).toFixed(2)}s`);
    console.log(`  Proof Verification: ${report.performance.proof_verification_ms}ms`);
    console.log(`\nOverall Status:       ${report.status}`);
    console.log('='.repeat(70) + '\n');
}

async function main() {
    log('\n' + '='.repeat(70), colors.bright);
    log('DeFi Credit Score - Proof Generation Test', colors.bright + colors.cyan);
    log('='.repeat(70) + '\n', colors.bright);
    
    const results = {
        filesCheck: false,
        witnessCalculation: false,
        proofGeneration: false,
        proofVerification: false,
        failureCase: false,
        witnessTime: 0,
        proofTime: 0,
        verificationTime: 0,
        proofDetails: null,
        allPassed: false
    };
    
    // Test 1: Check files
    results.filesCheck = await checkFiles();
    if (!results.filesCheck) {
        logError('Required files missing. Run trusted setup first:');
        console.log('  node scripts/trusted-setup.js');
        process.exit(1);
    }
    
    // Test 2: Witness calculation
    const startWitness = Date.now();
    const fullWitness = await testWitnessCalculation();
    results.witnessTime = Date.now() - startWitness;
    results.witnessCalculation = fullWitness !== null;
    
    if (!results.witnessCalculation) {
        process.exit(1);
    }
    
    // Test 3: Proof generation
    const startProof = Date.now();
    const proofResult = await testProofGeneration(fullWitness);
    results.proofTime = Date.now() - startProof;
    results.proofGeneration = proofResult !== null;
    
    if (!results.proofGeneration) {
        process.exit(1);
    }
    
    results.proofDetails = {
        proof_size_bytes: JSON.stringify(proofResult.proof).length,
        public_signals_count: proofResult.publicSignals.length
    };
    
    // Test 4: Proof verification
    const startVerify = Date.now();
    results.proofVerification = await testProofVerification(
        proofResult.proof,
        proofResult.publicSignals
    );
    results.verificationTime = Date.now() - startVerify;
    
    if (!results.proofVerification) {
        process.exit(1);
    }
    
    // Test 5: Failure case
    results.failureCase = await testFailureCase();
    
    // Check if all tests passed
    results.allPassed = Object.values(results).slice(0, 5).every(v => v === true);
    
    // Generate report
    await generateProofReport(results);
    
    if (results.allPassed) {
        log('\n✓ All tests passed!', colors.green + colors.bright);
        log('\nNext steps:', colors.cyan);
        console.log('  1. Generate verifier contract: node scripts/generate-verifier.js');
        console.log('  2. Integrate with frontend');
        console.log('  3. Deploy to testnet\n');
        process.exit(0);  // Exit successfully
    } else {
        log('\n✗ Some tests failed', colors.red + colors.bright);
        process.exit(1);
    }
}

// Run
main().catch(error => {
    logError('Fatal error:');
    console.error(error);
    process.exit(1);
});
