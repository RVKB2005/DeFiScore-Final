/**
 * Trusted Setup Script
 * Performs Phase 2 ceremony for DeFiCreditScore circuit
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('=== DeFi Credit Score ZK Setup ===\n');
    
    const circuitName = 'DeFiCreditScore';
    const ptauPath = path.join(__dirname, '..', 'powersOfTau28_hez_final_20.ptau');
    const r1csPath = path.join(__dirname, '..', `${circuitName}.r1cs`);
    const zkeyPath = path.join(__dirname, '..', `${circuitName}_final.zkey`);
    const vkeyPath = path.join(__dirname, '..', 'verification_key.json');
    const verifierPath = path.join(__dirname, '..', '..', 'contracts', 'Verifier.sol');
    
    // Check if Powers of Tau exists
    if (!fs.existsSync(ptauPath)) {
        console.error('❌ Powers of Tau file not found!');
        console.log('\nDownload it with:');
        console.log('wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau');
        process.exit(1);
    }
    
    // Check if R1CS exists
    if (!fs.existsSync(r1csPath)) {
        console.error('❌ R1CS file not found! Run: npm run compile');
        process.exit(1);
    }
    
    console.log('Step 1: Generating zkey (Phase 2 - Initial)...');
    await snarkjs.zKey.newZKey(r1csPath, ptauPath, `${circuitName}_0000.zkey`);
    console.log('✓ Initial zkey generated\n');
    
    console.log('Step 2: Contributing to Phase 2...');
    await snarkjs.zKey.contribute(
        `${circuitName}_0000.zkey`,
        `${circuitName}_0001.zkey`,
        'Contribution 1',
        Buffer.from(Math.random().toString()).toString('hex')
    );
    console.log('✓ Contribution 1 complete\n');
    
    // Additional contributions (for production, run ceremony with multiple participants)
    console.log('Step 3: Additional contribution...');
    await snarkjs.zKey.contribute(
        `${circuitName}_0001.zkey`,
        zkeyPath,
        'Contribution 2',
        Buffer.from(Math.random().toString()).toString('hex')
    );
    console.log('✓ Contribution 2 complete\n');
    
    console.log('Step 4: Exporting verification key...');
    const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));
    console.log(`✓ Verification key exported to ${vkeyPath}\n`);
    
    console.log('Step 5: Generating Solidity verifier...');
    const verifierCode = await snarkjs.zKey.exportSolidityVerifier(zkeyPath);
    fs.writeFileSync(verifierPath, verifierCode);
    console.log(`✓ Verifier contract generated at ${verifierPath}\n`);
    
    // Cleanup intermediate files
    console.log('Step 6: Cleaning up...');
    fs.unlinkSync(`${circuitName}_0000.zkey`);
    fs.unlinkSync(`${circuitName}_0001.zkey`);
    console.log('✓ Cleanup complete\n');
    
    // Print circuit info
    console.log('=== Setup Complete ===');
    console.log(`Circuit: ${circuitName}`);
    console.log(`Proving key: ${zkeyPath}`);
    console.log(`Verification key: ${vkeyPath}`);
    console.log(`Verifier contract: ${verifierPath}`);
    
    // Print verification key hash for on-chain registration
    const vkeyHash = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(vKey))
        .digest('hex');
    console.log(`\nVerification Key Hash: 0x${vkeyHash}`);
    console.log('\n⚠️  PRODUCTION NOTE: Run multi-party ceremony with 3+ participants');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    });
