#!/usr/bin/env node

/**
 * Circuit Compilation Script
 * 
 * Compiles the DeFiCreditScore circuit and generates:
 * 1. Compiled circuit (.r1cs, .wasm, .sym)
 * 2. Witness calculator
 * 3. Constraint count report
 * 
 * Usage: node compile-circuit.js
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Paths
const CIRCUIT_DIR = path.join(__dirname, '..');
const CIRCUIT_FILE = path.join(CIRCUIT_DIR, 'DeFiCreditScore.circom');
const BUILD_DIR = path.join(CIRCUIT_DIR, 'build');
const OUTPUT_NAME = 'DeFiCreditScore';

// Colors for console output
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
    log(`\n[${step}] ${message}`, colors.cyan);
}

function logSuccess(message) {
    log(`✓ ${message}`, colors.green);
}

function logError(message) {
    log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
    log(`⚠ ${message}`, colors.yellow);
}

async function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logSuccess(`Created directory: ${dir}`);
    }
}

async function checkCircomInstalled() {
    try {
        const { stdout } = await execPromise('circom --version');
        logSuccess(`Circom installed: ${stdout.trim()}`);
        return true;
    } catch (error) {
        logError('Circom not found. Please install circom:');
        console.log('  npm install -g circom');
        console.log('  or visit: https://docs.circom.io/getting-started/installation/');
        return false;
    }
}

async function compileCircuit() {
    logStep('1', 'Compiling circuit...');
    
    const cmd = `circom ${CIRCUIT_FILE} --r1cs --wasm --sym --c -l node_modules -o ${BUILD_DIR}`;
    
    try {
        const { stdout, stderr } = await execPromise(cmd);
        
        if (stderr) {
            console.log(stderr);
        }
        
        if (stdout) {
            console.log(stdout);
        }
        
        logSuccess('Circuit compiled successfully');
        return true;
    } catch (error) {
        logError('Circuit compilation failed');
        console.error(error.message);
        return false;
    }
}

async function analyzeConstraints() {
    logStep('2', 'Analyzing constraints...');
    
    const r1csFile = path.join(BUILD_DIR, `${OUTPUT_NAME}.r1cs`);
    
    if (!fs.existsSync(r1csFile)) {
        logWarning('R1CS file not found, skipping constraint analysis');
        return;
    }
    
    try {
        const cmd = `npx snarkjs r1cs info ${r1csFile}`;
        const { stdout } = await execPromise(cmd);
        
        console.log(stdout);
        
        // Parse constraint count
        const match = stdout.match(/# of Constraints: (\d+)/);
        if (match) {
            const constraintCount = parseInt(match[1]);
            logSuccess(`Total constraints: ${constraintCount.toLocaleString()}`);
            
            // Check against budget
            const CONSTRAINT_BUDGET = 250000;
            const percentage = (constraintCount / CONSTRAINT_BUDGET * 100).toFixed(1);
            
            if (constraintCount <= CONSTRAINT_BUDGET) {
                logSuccess(`Within budget: ${percentage}% of ${CONSTRAINT_BUDGET.toLocaleString()}`);
            } else {
                logWarning(`Over budget: ${percentage}% of ${CONSTRAINT_BUDGET.toLocaleString()}`);
            }
        }
        
    } catch (error) {
        logWarning('Could not analyze constraints (snarkjs may not be installed)');
        console.log('Install snarkjs: npm install -g snarkjs');
    }
}

async function generateWitnessCalculator() {
    logStep('3', 'Generating witness calculator...');
    
    const wasmFile = path.join(BUILD_DIR, `${OUTPUT_NAME}_js`, `${OUTPUT_NAME}.wasm`);
    
    if (!fs.existsSync(wasmFile)) {
        logWarning('WASM file not found');
        return;
    }
    
    logSuccess(`WASM witness calculator ready: ${wasmFile}`);
}

async function generateReport() {
    logStep('4', 'Generating compilation report...');
    
    const report = {
        timestamp: new Date().toISOString(),
        circuit: OUTPUT_NAME,
        version: '1.0.0',
        files: {
            r1cs: fs.existsSync(path.join(BUILD_DIR, `${OUTPUT_NAME}.r1cs`)),
            wasm: fs.existsSync(path.join(BUILD_DIR, `${OUTPUT_NAME}_js`, `${OUTPUT_NAME}.wasm`)),
            sym: fs.existsSync(path.join(BUILD_DIR, `${OUTPUT_NAME}.sym`)),
            cpp: fs.existsSync(path.join(BUILD_DIR, `${OUTPUT_NAME}_cpp`))
        }
    };
    
    const reportPath = path.join(BUILD_DIR, 'compilation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    logSuccess(`Report saved: ${reportPath}`);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    log('COMPILATION SUMMARY', colors.bright);
    console.log('='.repeat(60));
    console.log(`Circuit:     ${report.circuit}`);
    console.log(`Version:     ${report.version}`);
    console.log(`Timestamp:   ${report.timestamp}`);
    console.log('\nGenerated Files:');
    console.log(`  R1CS:      ${report.files.r1cs ? '✓' : '✗'}`);
    console.log(`  WASM:      ${report.files.wasm ? '✓' : '✗'}`);
    console.log(`  Symbols:   ${report.files.sym ? '✓' : '✗'}`);
    console.log(`  C++:       ${report.files.cpp ? '✓' : '✗'}`);
    console.log('='.repeat(60) + '\n');
}

async function main() {
    log('\n' + '='.repeat(60), colors.bright);
    log('DeFi Credit Score Circuit Compiler', colors.bright);
    log('='.repeat(60) + '\n', colors.bright);
    
    // Check prerequisites
    const circomInstalled = await checkCircomInstalled();
    if (!circomInstalled) {
        process.exit(1);
    }
    
    // Ensure build directory exists
    await ensureDirectory(BUILD_DIR);
    
    // Compile circuit
    const compiled = await compileCircuit();
    if (!compiled) {
        process.exit(1);
    }
    
    // Analyze constraints
    await analyzeConstraints();
    
    // Generate witness calculator
    await generateWitnessCalculator();
    
    // Generate report
    await generateReport();
    
    log('\n✓ Compilation complete!', colors.green + colors.bright);
    log('\nNext steps:', colors.cyan);
    console.log('  1. Run trusted setup: node scripts/trusted-setup.js');
    console.log('  2. Test circuit: node scripts/test-circuit.js');
    console.log('  3. Generate verifier contract: node scripts/generate-verifier.js\n');
}

// Run
main().catch(error => {
    logError('Fatal error:');
    console.error(error);
    process.exit(1);
});
