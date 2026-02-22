pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";

template TestMinimal() {
    signal input a;
    signal input b;
    signal input threshold;
    signal output out;
    
    // Simple addition
    signal sum;
    sum <== a + b;
    
    // Test GreaterEqThan
    component check = GreaterEqThan(20);
    check.in[0] <== sum;
    check.in[1] <== threshold;
    check.out === 1;
    
    out <== sum;
}

component main {public [threshold]} = TestMinimal();
