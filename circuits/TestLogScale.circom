pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";

template IsZero() {
    signal input in;
    signal output out;
    
    signal inv;
    inv <-- in != 0 ? 1 / in : 0;
    out <== -in * inv + 1;
    in * out === 0;
}

template TestLogScale() {
    signal input in;
    signal output scaled;
    signal output result;
    
    // Test the hint directly
    signal s;
    s <-- (in * 1000) \ 10000;
    scaled <== s;
    
    // Also test with conditional
    component isZ = IsZero();
    isZ.in <== in;
    
    signal r;
    r <-- isZ.out == 1 ? 999 : s;
    result <== r;
}

component main = TestLogScale();
