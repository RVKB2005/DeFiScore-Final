/**
 * Circuit Testing Script
 * Tests DeFiCreditScore circuit with sample inputs
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function testCircuit() {
    console.log('=== Testing DeFi Credit Score Circuit ===\n');
    
    const wasmPath = path.join(__dirname, '..', 'DeFiCreditScore_js', 'DeFiCreditScore.wasm');
    const zkeyPath = path.join(__dirname, '..', 'DeFiCreditScore_final.zkey');
    const vkeyPath = path.join(__dirname, '..', 'verification_key.json');
    
    // Check files exist
    if (!fs.existsSync(wasmPath)) {
        console.error('❌ WASM file not found! Run: npm run compile');
        process.exit(1);
    }
    
    if (!fs.existsSync(zkeyPath)) {
        console.error('❌ Proving key not found! Run: npm run setup');
        process.exit(1);
    }
    
    // Test Case 1: Excellent Score (Above Threshold)
    console.log('Test Case 1: Excellent Score\n');
    
    const input1 = {
        // Public inputs
        userAddress: '123456789012345678901234567890123456789012345678901234567890',
        scoreTotal: '750',
        scoreRepayment: '180',
        scoreCapital: '150',
        scoreActivity: '60',
        scoreProtocol: '60',
        threshold: '700',
        timestamp: Math.floor(Date.now() / 1000).toString(),
        nullifier: '0', // Will be computed by circuit
        circuitVersionId: '1',
        
        // Private inputs - raw features
        totalBorrowed: '10000',
        totalRepaid: '10000',
        avgRepaymentTime: '30',
        latePaymentCount: '0',
        totalCollateral: '5000',
        collateralUtilization: '4000', // 40%
        liquidationCount: '0',
        activePositions: '5',
        protocolCount: '10',
        transactionCount: '100',
        accountAge: '365',
        
        // Weights (basis points)
        weightRepayment: '3500',
        weightCapital: '3000',
        weightActivity: '1000',
        weightProtocol: '1000',
        
        // Anti-replay
        nonce: '1'
    };
    
    try {
        console.log('Generating witness...');
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input1,
            wasmPath,
            zkeyPath
        );
        console.log('✓ Proof generated\n');
        
        console.log('Public Signals:');
        console.log(`  User Address: ${publicSignals[0]}`);
        console.log(`  Score Total: ${publicSignals[1]}`);
        console.log(`  Score Repayment: ${publicSignals[2]}`);
        console.log(`  Score Capital: ${publicSignals[3]}`);
        console.log(`  Score Activity: ${publicSignals[4]}`);
        console.log(`  Score Protocol: ${publicSignals[5]}`);
        console.log(`  Threshold: ${publicSignals[6]}`);
        console.log(`  Timestamp: ${publicSignals[7]}`);
        console.log(`  Nullifier: ${publicSignals[8]}`);
        console.log(`  Circuit Version: ${publicSignals[9]}\n`);
        
        console.log('Verifying proof...');
        const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        if (verified) {
            console.log('✓ Proof verified successfully!\n');
        } else {
            console.log('❌ Proof verification failed!\n');
            process.exit(1);
        }
        
        // Save proof for testing
        const proofData = {
            proof,
            publicSignals,
            input: input1
        };
        fs.writeFileSync(
            path.join(__dirname, '..', 'test_proof.json'),
            JSON.stringify(proofData, null, 2)
        );
        console.log('✓ Test proof saved to test_proof.json\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
    
    // Test Case 2: Below Threshold (Should fail)
    console.log('Test Case 2: Below Threshold (Expected to fail)\n');
    
    const input2 = {
        ...input1,
        scoreTotal: '650',
        threshold: '700',
        liquidationCount: '2' // Penalties drop score
    };
    
    try {
        await snarkjs.groth16.fullProve(input2, wasmPath, zkeyPath);
        console.log('❌ Proof should have failed but succeeded!\n');
        process.exit(1);
    } catch (error) {
        console.log('✓ Proof correctly failed (score < threshold)\n');
    }
    
    console.log('=== All Tests Passed ===');
}

testCircuit()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Testing failed:', error);
        process.exit(1);
    });
