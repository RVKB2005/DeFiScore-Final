// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeFi Score Registry
 * @notice Registry for ZK-proven credit score eligibility
 * @dev Stores eligibility status, manages nullifiers, enforces validity periods
 * 
 * Architecture:
 * - Per-lender threshold configuration
 * - 24-hour proof validity window
 * - Replay protection via nullifier tracking
 * - Circuit version management
 * - Upgradeable verifier system
 * 
 * Security:
 * - Nullifier prevents proof reuse
 * - Timestamp enforces freshness
 * - Version control prevents cross-version attacks
 * - Owner-controlled verifier updates
 */

interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[11] calldata _pubSignals
    ) external view returns (bool);
}

contract DeFiScoreRegistry {
    
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================
    
    /// @notice Contract owner (can update verifiers)
    address public owner;
    
    /// @notice Current circuit version
    uint256 public currentVersion;
    
    /// @notice Proof validity duration (24 hours)
    uint256 public constant PROOF_VALIDITY_DURATION = 24 hours;
    
    /// @notice Maximum allowed timestamp drift (5 minutes)
    uint256 public constant MAX_TIMESTAMP_DRIFT = 5 minutes;
    
    /// @notice Mapping: version => verifier contract
    mapping(uint256 => address) public verifiers;
    
    /// @notice Mapping: nullifier => used status
    mapping(bytes32 => bool) public usedNullifiers;
    
    /// @notice Mapping: user => eligibility data
    mapping(address => EligibilityData) public eligibility;
    
    /// @notice Mapping: lender => threshold
    mapping(address => uint256) public lenderThresholds;
    
    // ============================================================================
    // STRUCTS
    // ============================================================================
    
    struct EligibilityData {
        uint256 score;              // Credit score (scaled x1000)
        uint256 timestamp;          // Proof submission time
        bytes32 nullifier;          // Proof nullifier
        uint256 version;            // Circuit version
        bool isEligible;            // Eligibility status
    }
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event ProofSubmitted(
        address indexed user,
        uint256 score,
        uint256 timestamp,
        bytes32 nullifier,
        uint256 version
    );
    
    event VerifierUpdated(
        uint256 indexed version,
        address indexed verifier
    );
    
    event ThresholdUpdated(
        address indexed lender,
        uint256 threshold
    );
    
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    // ============================================================================
    // ERRORS
    // ============================================================================
    
    error Unauthorized();
    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidTimestamp();
    error InvalidVersion();
    error InvalidVerifier();
    error InvalidThreshold();
    error ProofExpired();
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(address _initialVerifier) {
        owner = msg.sender;
        currentVersion = 1;
        verifiers[1] = _initialVerifier;
        
        emit VerifierUpdated(1, _initialVerifier);
    }
    
    // ============================================================================
    // CORE FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Submit ZK proof of credit score eligibility
     * @param _proof Groth16 proof components [pA, pB, pC]
     * @param _pubSignals Public signals (11 elements)
     * 
     * Public Signals:
     *   [0] userAddress
     *   [1] scoreTotal
     *   [2] scoreRepayment
     *   [3] scoreCapital
     *   [4] scoreLongevity
     *   [5] scoreActivity
     *   [6] scoreProtocol
     *   [7] threshold
     *   [8] timestamp
     *   [9] nullifier
     *   [10] versionId
     */
    function submitProof(
        uint[8] calldata _proof,
        uint[11] calldata _pubSignals
    ) external {
        // Extract public signals
        address user = address(uint160(_pubSignals[0]));
        uint256 score = _pubSignals[1];
        uint256 timestamp = _pubSignals[8];
        bytes32 nullifier = bytes32(_pubSignals[9]);
        uint256 version = _pubSignals[10];
        
        // Validation 1: User must match sender
        if (user != msg.sender) revert Unauthorized();
        
        // Validation 2: Check nullifier not used
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed();
        
        // Validation 3: Check timestamp validity
        if (timestamp > block.timestamp + MAX_TIMESTAMP_DRIFT) {
            revert InvalidTimestamp();
        }
        if (block.timestamp > timestamp + PROOF_VALIDITY_DURATION) {
            revert ProofExpired();
        }
        
        // Validation 4: Check version exists
        address verifier = verifiers[version];
        if (verifier == address(0)) revert InvalidVersion();
        
        // Validation 5: Verify proof
        bool isValid = IVerifier(verifier).verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            _pubSignals
        );
        
        if (!isValid) revert InvalidProof();
        
        // Mark nullifier as used
        usedNullifiers[nullifier] = true;
        
        // Store eligibility data
        eligibility[user] = EligibilityData({
            score: score,
            timestamp: timestamp,
            nullifier: nullifier,
            version: version,
            isEligible: true
        });
        
        emit ProofSubmitted(user, score, timestamp, nullifier, version);
    }
    
    /**
     * @notice Check if user is eligible (has valid proof)
     * @param _user User address to check
     * @return bool Eligibility status
     */
    function isEligible(address _user) external view returns (bool) {
        EligibilityData memory data = eligibility[_user];
        
        if (!data.isEligible) return false;
        
        // Check if proof is still valid (within 24 hours)
        if (block.timestamp > data.timestamp + PROOF_VALIDITY_DURATION) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @notice Check if user meets specific threshold
     * @param _user User address to check
     * @param _threshold Minimum score required (scaled x1000)
     * @return bool Whether user meets threshold
     */
    function meetsThreshold(address _user, uint256 _threshold) external view returns (bool) {
        EligibilityData memory data = eligibility[_user];
        
        if (!data.isEligible) return false;
        
        // Check if proof is still valid
        if (block.timestamp > data.timestamp + PROOF_VALIDITY_DURATION) {
            return false;
        }
        
        // Check if score meets threshold
        return data.score >= _threshold;
    }
    
    /**
     * @notice Get user's eligibility data
     * @param _user User address
     * @return EligibilityData struct
     */
    function getEligibilityData(address _user) external view returns (EligibilityData memory) {
        return eligibility[_user];
    }
    
    /**
     * @notice Check if proof is still fresh (within validity window)
     * @param _user User address
     * @return bool Freshness status
     */
    function isProofFresh(address _user) external view returns (bool) {
        EligibilityData memory data = eligibility[_user];
        
        if (!data.isEligible) return false;
        
        return block.timestamp <= data.timestamp + PROOF_VALIDITY_DURATION;
    }
    
    /**
     * @notice Get time remaining until proof expires
     * @param _user User address
     * @return uint256 Seconds remaining (0 if expired)
     */
    function getTimeUntilExpiry(address _user) external view returns (uint256) {
        EligibilityData memory data = eligibility[_user];
        
        if (!data.isEligible) return 0;
        
        uint256 expiryTime = data.timestamp + PROOF_VALIDITY_DURATION;
        
        if (block.timestamp >= expiryTime) return 0;
        
        return expiryTime - block.timestamp;
    }
    
    // ============================================================================
    // LENDER FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Set threshold for lender
     * @param _threshold Minimum score required (scaled x1000, 0-900000)
     */
    function setThreshold(uint256 _threshold) external {
        if (_threshold > 900000) revert InvalidThreshold();
        
        lenderThresholds[msg.sender] = _threshold;
        
        emit ThresholdUpdated(msg.sender, _threshold);
    }
    
    /**
     * @notice Check if user meets lender's threshold
     * @param _user User address
     * @param _lender Lender address
     * @return bool Whether user meets lender's threshold
     */
    function meetsLenderThreshold(address _user, address _lender) external view returns (bool) {
        uint256 threshold = lenderThresholds[_lender];
        
        if (threshold == 0) return false; // Lender hasn't set threshold
        
        EligibilityData memory data = eligibility[_user];
        
        if (!data.isEligible) return false;
        
        // Check if proof is still valid
        if (block.timestamp > data.timestamp + PROOF_VALIDITY_DURATION) {
            return false;
        }
        
        // Check if score meets threshold
        return data.score >= threshold;
    }
    
    /**
     * @notice Get lender's threshold
     * @param _lender Lender address
     * @return uint256 Threshold (0 if not set)
     */
    function getLenderThreshold(address _lender) external view returns (uint256) {
        return lenderThresholds[_lender];
    }
    
    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Add new verifier for circuit version
     * @param _version Circuit version
     * @param _verifier Verifier contract address
     */
    function addVerifier(uint256 _version, address _verifier) external onlyOwner {
        if (_verifier == address(0)) revert InvalidVerifier();
        
        verifiers[_version] = _verifier;
        
        emit VerifierUpdated(_version, _verifier);
    }
    
    /**
     * @notice Update current version
     * @param _version New current version
     */
    function setCurrentVersion(uint256 _version) external onlyOwner {
        if (verifiers[_version] == address(0)) revert InvalidVersion();
        
        currentVersion = _version;
    }
    
    /**
     * @notice Transfer ownership
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert Unauthorized();
        
        address oldOwner = owner;
        owner = _newOwner;
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Get verifier for specific version
     * @param _version Circuit version
     * @return address Verifier contract address
     */
    function getVerifier(uint256 _version) external view returns (address) {
        return verifiers[_version];
    }
    
    /**
     * @notice Check if nullifier has been used
     * @param _nullifier Nullifier hash
     * @return bool Usage status
     */
    function isNullifierUsed(bytes32 _nullifier) external view returns (bool) {
        return usedNullifiers[_nullifier];
    }
}
