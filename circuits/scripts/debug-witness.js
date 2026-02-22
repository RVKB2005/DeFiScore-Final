#!/usr/bin/env node

/**
 * Debug Witness Calculation
 * Manually compute what the circuit should produce
 */

// Test with all zeros
const inputs = {
    currentBalanceScaled: 0,
    maxBalanceScaled: 0,
    balanceVolatilityScaled: 0,
    borrowCount: 0,
    repayCount: 0,
    repayToBorrowRatio: 0,
    liquidationCount: 0,
    totalProtocolEvents: 0,
    walletAgeDays: 0,
    activeDaysRatio: 0,
    totalTransactions: 0,
    transactionRegularity: 0,
    suddenDropsCount: 0,
    failedTxRatio: 0,
    daysSinceLastActivity: 0,
    zeroBalancePeriods: 0,
    burstActivityRatio: 0
};

console.log('\n=== Manual Circuit Computation ===\n');

// 1. Repayment Score
const hasBorrowed = inputs.borrowCount > 0 ? 0 : 1;  // IsZero output
const borrowed = 1 - hasBorrowed;  // 1 - 1 = 0
const cappedRatio = Math.min(inputs.repayToBorrowRatio, 1000);
const ratioScore = Math.floor(cappedRatio * 150 * borrowed);
const noLiquidations = inputs.liquidationCount === 0 ? 1 : 0;
const liquidationBonus = Math.floor(noLiquidations * borrowed * 60000);
const scoreRepayment = ratioScore + liquidationBonus;

console.log('Repayment Score:');
console.log(`  hasBorrowed (IsZero): ${hasBorrowed}`);
console.log(`  borrowed (1 - IsZero): ${borrowed}`);
console.log(`  ratioScore: ${ratioScore}`);
console.log(`  liquidationBonus: ${liquidationBonus}`);
console.log(`  TOTAL: ${scoreRepayment}\n`);

// 2. Capital Score
const balanceScaled = Math.min(Math.floor((inputs.currentBalanceScaled * 1000) / 10000), 1000);
const balanceScore = Math.floor(balanceScaled * 90);
const volCheck = inputs.balanceVolatilityScaled < 1000 ? 1 : 0;
const stabilityRatio = 1000 - inputs.balanceVolatilityScaled;
const stabilityScore = Math.floor(stabilityRatio * 60 * volCheck);
const maxBalScaled = Math.min(Math.floor((inputs.maxBalanceScaled * 1000) / 10000), 1000);
const maxBalanceScore = Math.floor(maxBalScaled * 30);
const scoreCapital = balanceScore + stabilityScore + maxBalanceScore;

console.log('Capital Score:');
console.log(`  balanceScaled: ${balanceScaled}`);
console.log(`  balanceScore: ${balanceScore}`);
console.log(`  volCheck: ${volCheck}`);
console.log(`  stabilityRatio: ${stabilityRatio}`);
console.log(`  stabilityScore: ${stabilityScore}`);
console.log(`  maxBalScaled: ${maxBalScaled}`);
console.log(`  maxBalanceScore: ${maxBalanceScore}`);
console.log(`  TOTAL: ${scoreCapital}\n`);

// 3. Longevity Score
const ageScaled = Math.min(Math.floor((inputs.walletAgeDays * 1000) / 730), 1000);
const ageScore = Math.floor(ageScaled * 60);
const activeScore = Math.floor(inputs.activeDaysRatio * 30);
const scoreLongevity = ageScore + activeScore;

console.log('Longevity Score:');
console.log(`  ageScaled: ${ageScaled}`);
console.log(`  ageScore: ${ageScore}`);
console.log(`  activeScore: ${activeScore}`);
console.log(`  TOTAL: ${scoreLongevity}\n`);

// 4. Activity Score
const txScaled = Math.min(Math.floor((inputs.totalTransactions * 1000) / 1000), 1000);
const txScore = Math.floor(txScaled * 30);
const regularityScore = Math.floor(inputs.transactionRegularity * 30);
const scoreActivity = txScore + regularityScore;

console.log('Activity Score:');
console.log(`  txScaled: ${txScaled}`);
console.log(`  txScore: ${txScore}`);
console.log(`  regularityScore: ${regularityScore}`);
console.log(`  TOTAL: ${scoreActivity}\n`);

// 5. Protocol Score
const protocolCapped = Math.min(inputs.totalProtocolEvents * 10, 1000);
const protocolInteractionScore = Math.floor(protocolCapped * 30);
const hasBorrowedProto = inputs.borrowCount > 0 ? 0 : 1;  // IsZero
const borrowedProto = 1 - hasBorrowedProto;
const borrowCapped = Math.min(inputs.borrowCount * 100, 1000);
const borrowExperienceScore = Math.floor(borrowCapped * 30 * borrowedProto);
const scoreProtocol = protocolInteractionScore + borrowExperienceScore;

console.log('Protocol Score:');
console.log(`  protocolCapped: ${protocolCapped}`);
console.log(`  protocolInteractionScore: ${protocolInteractionScore}`);
console.log(`  borrowedProto: ${borrowedProto}`);
console.log(`  borrowExperienceScore: ${borrowExperienceScore}`);
console.log(`  TOTAL: ${scoreProtocol}\n`);

// 6. Risk Penalties
const liquidationPenalty = Math.floor(inputs.liquidationCount * 100000);
const failedCheck = inputs.failedTxRatio > 50 ? 1 : 0;
const failedPenalty = Math.floor(failedCheck * 400 * inputs.failedTxRatio);
const volCheckPenalty = inputs.balanceVolatilityScaled >= 1000 ? 1 : 0;
const volPenalty = Math.floor(volCheckPenalty * 50000);
const dropPenalty = Math.floor(inputs.suddenDropsCount * 15000);
const dormancyCheck = inputs.daysSinceLastActivity > 180 ? 1 : 0;
const dormancyPenalty = Math.floor(dormancyCheck * 167 * inputs.daysSinceLastActivity);
const zeroCheck = inputs.zeroBalancePeriods > 5 ? 1 : 0;
const excessPeriods = inputs.zeroBalancePeriods - 5;
const zeroPenalty = Math.floor(zeroCheck * excessPeriods * 10000);
const burstCheck = inputs.burstActivityRatio > 500 ? 1 : 0;
const burstPenalty = Math.floor(burstCheck * 25000);
const penalties = liquidationPenalty + failedPenalty + volPenalty + 
                  dropPenalty + dormancyPenalty + zeroPenalty + burstPenalty;

console.log('Risk Penalties:');
console.log(`  TOTAL: ${penalties}\n`);

// 7. Total Score
const baseScore = 300000;
const positiveScores = scoreRepayment + scoreCapital + scoreLongevity + scoreActivity + scoreProtocol;
const rawScore = baseScore + positiveScores - penalties;
const finalScore = Math.max(0, Math.min(rawScore, 900000));

console.log('=== FINAL COMPUTATION ===');
console.log(`Base Score: ${baseScore}`);
console.log(`Positive Scores: ${positiveScores}`);
console.log(`  - Repayment: ${scoreRepayment}`);
console.log(`  - Capital: ${scoreCapital}`);
console.log(`  - Longevity: ${scoreLongevity}`);
console.log(`  - Activity: ${scoreActivity}`);
console.log(`  - Protocol: ${scoreProtocol}`);
console.log(`Penalties: ${penalties}`);
console.log(`Raw Score: ${rawScore}`);
console.log(`Final Score (clamped): ${finalScore}`);
console.log(`\nExpected witness values:`);
console.log(`  scoreTotal: ${finalScore}`);
console.log(`  scoreRepayment: ${scoreRepayment}`);
console.log(`  scoreCapital: ${scoreCapital}`);
console.log(`  scoreLongevity: ${scoreLongevity}`);
console.log(`  scoreActivity: ${scoreActivity}`);
console.log(`  scoreProtocol: ${scoreProtocol}`);
