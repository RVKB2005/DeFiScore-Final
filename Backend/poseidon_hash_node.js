#!/usr/bin/env node
/**
 * Poseidon Hash using circomlibjs
 * This ensures 100% compatibility with the circuit
 */

const { buildPoseidon } = require("circomlibjs");

async function computePoseidonHash(inputs) {
    try {
        const poseidon = await buildPoseidon();
        const hash = poseidon(inputs);
        const hashStr = poseidon.F.toString(hash);
        return hashStr;
    } catch (error) {
        console.error("Error computing Poseidon hash:", error);
        process.exit(1);
    }
}

// Read inputs from command line arguments
const inputs = process.argv.slice(2).map(x => BigInt(x));

if (inputs.length !== 4) {
    console.error("Error: Exactly 4 inputs required");
    console.error("Usage: node poseidon_hash_node.js <input1> <input2> <input3> <input4>");
    process.exit(1);
}

computePoseidonHash(inputs).then(hash => {
    console.log(hash);
    process.exit(0);
});
