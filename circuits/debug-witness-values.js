const { readFileSync } = require('fs');
const path = require('path');
const { WitnessCalculatorBuilder } = require('circom_runtime');

async function test() {
    console.log('\n=== Computing Witness Without Constraint Check ===\n');
    
    // Load the WASM file directly
    const wasmPath = path.join(__dirname, 'build', 'DeFiCreditScore_js', 'DeFiCreditScore.wasm');
    const wasmBuffer = readFileSync(wasmPath);
    
    const witnessCalculator = await WitnessCalculatorBuilder(wasmBuffer);
    
    const input = {
        userAddress: "123456789012345678901234567890",
        scoreTotal: 360000,
        scoreRepayment: 0,
        scoreCapital: 60000,
        scoreLongevity: 0,
        scoreActivity: 0,
        scoreProtocol: 0,
        threshold: 0,
        timestamp: Math.floor(Date.now() / 1000),
        nullifier: 0,
        versionId: 1,
        
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
    
    console.log('Computing witness...\n');
    
    try {
        const witness = await witnessCalculator.calculateWitness(input, false);
        
        console.log('✓ Witness computed successfully!\n');
        
        // Load symbols to map witness indices to signal names
        const symPath = path.join(__dirname, 'build', 'DeFiCreditScore.sym');
        const symContent = readFileSync(symPath, 'utf8');
        const lines = symContent.split('\n');
        
        // Parse symbols
        const symbols = {};
        for (const line of lines) {
            if (line.trim()) {
                const parts = line.split(',');
                if (parts.length >= 4) {
                    const idx = parseInt(parts[0]);
                    const name = parts[3];
                    symbols[idx] = name;
                }
            }
        }
        
        console.log('=== Key Signal Values ===\n');
        
        // Find and print capital-related signals
        for (let i = 0; i < witness.length; i++) {
            const name = symbols[i];
            if (name && (
                name.includes('capitalCalc.score') ||
                name.includes('capitalCalc.balanceScore') ||
                name.includes('capitalCalc.stabilityScore') ||
                name.includes('capitalCalc.maxBalanceScore') ||
                name.includes('capitalCalc.stabilityRatio') ||
                name.includes('capitalCalc.volCheck.out') ||
                name.includes('capitalCalc.volCap.out') ||
                name.includes('repaymentCalc.score') ||
                name.includes('longevityCalc.score') ||
                name.includes('activityCalc.score') ||
                name.includes('protocolCalc.score') ||
                name.includes('riskCalc.penalties') ||
                name.includes('finalScore') ||
                name.includes('rawScore') ||
                name.includes('positiveScores')
            )) {
                console.log(`[${i}] ${name} = ${witness[i]}`);
            }
        }
        
        console.log('\n=== Expected vs Actual ===\n');
        console.log('Expected scoreCapital: 60000');
        console.log('Expected scoreTotal: 360000');
        console.log('\nLook for capitalCalc.score in the output above to see what the circuit computed.');
        
    } catch (e) {
        console.log('✗ Error:', e.message);
        console.log(e.stack);
    }
}

test().catch(console.error);
