#!/usr/bin/env node

/**
 * Simple Test - Minimal Witness
 * Tests with all zeros to isolate computation issues
 */

const path = require('path');
const snarkjs = require('snarkjs');

const CIRCUIT_DIR = path.join(__dirname, '..');
const BUILD_DIR = path.join(CIRCUIT_DIR, 'build');
const KEYS_DIR = path.join(CIRCUIT_DIR, 'keys');
const CIRCUIT_NAME = 'DeFiCreditScore';

const WASM_FILE = path.join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
const ZKEY_FILE = path.join(KEYS_DIR, `${CIRCUIT_NAME}_final.zkey`);

async function testMinimalWitness() {
    console.log('\n=== Testing Minimal Witness (All Zeros) ===\n');
    
    // Minimal witness - all features zero except required fields
    const witness = {
        // Public inputs
        userAddress: "123456789012345678901234567890",
        scoreTotal: 360000,  // Base (300000) + Capital stability (60000)
        scoreRepayment: 0,
        scoreCapital: 60000,  // Stability bonus when volatility = 0
        scoreLongevity: 0,
        scoreActivity: 0,
        scoreProtocol: 0,
        threshold: 0,  // Zero threshold - should always pass
        timestamp: Math.floor(Date.now() / 1000),
        nullifier: 0,
        versionId: 1,
        
        // Private inputs - all zeros
        currentBalanceScaled: 0,
        maxBalanceScaled: 0,
        balanceVolatilityScaled: 0,
        suddenDropsCount: 0,
        totalValueTransferred: 0,
        avgTxValue: 0,
        minBalanceScaled: 0,
        
        borrowCount: 0,
        repayCount: 0,
        repayToBorrowRatio: 0,
        liquidationCount: 0,
        totalProtocolEvents: 0,
        depositCount: 0,
        withdrawCount: 0,
        avgBorrowDuration: 0,
        
        totalTransactions: 0,
        activeDays: 0,
        totalDays: 0,
        activeDaysRatio: 0,
        longestInactivityGap: 0,
        transactionsPerDay: 0,
        
        walletAgeDays: 0,
        transactionRegularity: 0,
        burstActivityRatio: 0,
        daysSinceLastActivity: 0,
        
        failedTxCount: 0,
        failedTxRatio: 0,
        highGasSpikeCount: 0,
        zeroBalancePeriods: 0,
        
        nonce: 123456789
    };
    
    console.log('Witness data:');
    console.log(`  Score Total: ${witness.scoreTotal / 1000}`);
    console.log(`  Threshold: ${witness.threshold / 1000}`);
    console.log(`  All features: 0`);
    
    try {
        console.log('\nGenerating proof...');
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            witness,
            WASM_FILE,
            ZKEY_FILE
        );
        
        console.log('✓ Proof generated successfully!');
        console.log(`  Public signals: ${publicSignals.length}`);
        console.log(`  Score from circuit: ${publicSignals[1]}`);
        
        return true;
    } catch (error) {
        console.log('✗ Proof generation failed');
        console.error(error.message);
        return false;
    }
}

testMinimalWitness().then(success => {
    process.exit(success ? 0 : 1);
});
