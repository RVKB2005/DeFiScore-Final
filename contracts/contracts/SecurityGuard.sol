// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SecurityGuard
 * @notice Advanced security layer for ZK proof system
 * @dev Implements front-running protection, rate limiting, and anomaly detection
 * 
 * Security Features:
 * - Commit-reveal scheme for proof submission
 * - Rate limiting per address
 * - Anomaly detection for suspicious patterns
 * - Emergency circuit breaker
 * - Proof replay prevention (enhanced)
 * - Stale proof control
 * 
 * Architecture:
 * - Works alongside DeFiScoreRegistry
 * - Provides additional security checks
 * - Can be upgraded independently
 */
contract SecurityGuard {
    
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================
    
    /// @notice Owner address
    address public owner;
    
    /// @notice Emergency pause status
    bool public paused;
    
    /// @notice Rate limit: max proofs per address per day
    uint256 public maxProofsPerDay = 5;
    
    /// @notice Rate limit window (24 hours)
    uint256 public constant RATE_LIMIT_WINDOW = 24 hours;
    
    /// @notice Commit-reveal timeout (5 minutes)
    uint256 public constant COMMIT_TIMEOUT = 5 minutes;
    
    /// @notice Minimum time between proofs (1 hour)
    uint256 public constant MIN_PROOF_INTERVAL = 1 hours;
    
    // ============================================================================
    // STRUCTS
    // ============================================================================
    
    struct ProofCommit {
        bytes32 commitHash;
        uint256 timestamp;
        bool revealed;
    }
    
    struct RateLimitData {
        uint256 proofCount;
        uint256 windowStart;
        uint256 lastProofTime;
    }
    
    struct AnomalyScore {
        uint256 suspiciousAttempts;
        uint256 lastFlagTime;
        bool blacklisted;
    }
    
    // ============================================================================
    // STORAGE
    // ============================================================================
    
    /// @notice User => Commit data
    mapping(address => ProofCommit) public commits;
    
    /// @notice User => Rate limit data
    mapping(address => RateLimitData) public rateLimits;
    
    /// @notice User => Anomaly score
    mapping(address => AnomalyScore) public anomalyScores;
    
    /// @notice Nullifier => Block number (enhanced replay prevention)
    mapping(bytes32 => uint256) public nullifierBlocks;
    
    /// @notice Whitelisted addresses (bypass rate limits)
    mapping(address => bool) public whitelist;
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event ProofCommitted(address indexed user, bytes32 commitHash);
    event ProofRevealed(address indexed user, bytes32 nullifier);
    event RateLimitHit(address indexed user, uint256 attempts);
    event AnomalyDetected(address indexed user, string reason);
    event AddressBlacklisted(address indexed user);
    event AddressWhitelisted(address indexed user);
    event PauseToggled(bool paused);
    event RateLimitUpdated(uint256 newLimit);
    
    // ============================================================================
    // ERRORS
    // ============================================================================
    
    error Unauthorized();
    error SystemPaused();
    error RateLimitExceeded();
    error ProofTooFrequent();
    error InvalidCommit();
    error CommitNotFound();
    error CommitExpired();
    error AlreadyRevealed();
    error Blacklisted();
    error NullifierReused();
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert SystemPaused();
        _;
    }
    
    modifier notBlacklisted() {
        if (anomalyScores[msg.sender].blacklisted) revert Blacklisted();
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor() {
        owner = msg.sender;
    }
    
    // ============================================================================
    // COMMIT-REVEAL FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Commit to proof submission (step 1)
     * @param _commitHash Hash of (proof + publicSignals + salt)
     * 
     * Front-running protection:
     * - User commits hash first
     * - Reveals actual proof in next transaction
     * - Prevents MEV bots from copying proof
     */
    function commitProof(bytes32 _commitHash) 
        external 
        whenNotPaused 
        notBlacklisted 
    {
        // Check rate limits
        _checkRateLimit(msg.sender);
        
        // Check minimum interval
        RateLimitData storage rateData = rateLimits[msg.sender];
        if (block.timestamp < rateData.lastProofTime + MIN_PROOF_INTERVAL) {
            revert ProofTooFrequent();
        }
        
        // Store commit
        commits[msg.sender] = ProofCommit({
            commitHash: _commitHash,
            timestamp: block.timestamp,
            revealed: false
        });
        
        emit ProofCommitted(msg.sender, _commitHash);
    }
    
    /**
     * @notice Reveal proof (step 2)
     * @param _proof Proof data
     * @param _publicSignals Public signals
     * @param _salt Random salt used in commit
     * @return bool Success status
     */
    function revealProof(
        bytes memory _proof,
        uint256[] memory _publicSignals,
        bytes32 _salt
    ) external whenNotPaused notBlacklisted returns (bool) {
        ProofCommit storage commit = commits[msg.sender];
        
        // Validate commit exists
        if (commit.commitHash == bytes32(0)) revert CommitNotFound();
        if (commit.revealed) revert AlreadyRevealed();
        
        // Check timeout
        if (block.timestamp > commit.timestamp + COMMIT_TIMEOUT) {
            revert CommitExpired();
        }
        
        // Verify commit matches reveal
        bytes32 revealHash = keccak256(abi.encodePacked(_proof, _publicSignals, _salt));
        if (revealHash != commit.commitHash) revert InvalidCommit();
        
        // Extract nullifier from public signals (index 9)
        require(_publicSignals.length >= 10, "Invalid public signals");
        bytes32 nullifier = bytes32(_publicSignals[9]);
        
        // Check nullifier not reused
        if (nullifierBlocks[nullifier] != 0) revert NullifierReused();
        
        // Mark as revealed
        commit.revealed = true;
        nullifierBlocks[nullifier] = block.number;
        
        // Update rate limit
        _updateRateLimit(msg.sender);
        
        emit ProofRevealed(msg.sender, nullifier);
        
        return true;
    }
    
    // ============================================================================
    // RATE LIMITING
    // ============================================================================
    
    /**
     * @notice Check if user exceeds rate limit
     * @param _user User address
     */
    function _checkRateLimit(address _user) internal view {
        // Whitelist bypass
        if (whitelist[_user]) return;
        
        RateLimitData storage data = rateLimits[_user];
        
        // Check if in same window
        if (block.timestamp < data.windowStart + RATE_LIMIT_WINDOW) {
            if (data.proofCount >= maxProofsPerDay) {
                revert RateLimitExceeded();
            }
        }
    }
    
    /**
     * @notice Update rate limit counter
     * @param _user User address
     */
    function _updateRateLimit(address _user) internal {
        RateLimitData storage data = rateLimits[_user];
        
        // Reset window if expired
        if (block.timestamp >= data.windowStart + RATE_LIMIT_WINDOW) {
            data.windowStart = block.timestamp;
            data.proofCount = 1;
        } else {
            data.proofCount++;
        }
        
        data.lastProofTime = block.timestamp;
        
        // Anomaly detection: too many proofs
        if (data.proofCount >= maxProofsPerDay) {
            _flagAnomaly(_user, "Rate limit reached");
        }
    }
    
    // ============================================================================
    // ANOMALY DETECTION
    // ============================================================================
    
    /**
     * @notice Flag suspicious activity
     * @param _user User address
     * @param _reason Reason for flag
     */
    function _flagAnomaly(address _user, string memory _reason) internal {
        AnomalyScore storage score = anomalyScores[_user];
        
        score.suspiciousAttempts++;
        score.lastFlagTime = block.timestamp;
        
        emit AnomalyDetected(_user, _reason);
        
        // Auto-blacklist after 10 flags
        if (score.suspiciousAttempts >= 10) {
            score.blacklisted = true;
            emit AddressBlacklisted(_user);
        }
    }
    
    /**
     * @notice Check for stale proof (external call)
     * @param _timestamp Proof timestamp
     * @param _maxAge Maximum allowed age in seconds
     * @return bool Whether proof is fresh
     */
    function isProofFresh(uint256 _timestamp, uint256 _maxAge) 
        external 
        view 
        returns (bool) 
    {
        return block.timestamp <= _timestamp + _maxAge;
    }
    
    /**
     * @notice Check if nullifier was used in recent blocks
     * @param _nullifier Nullifier to check
     * @param _blockRange Number of blocks to check
     * @return bool Whether nullifier is recent
     */
    function isNullifierRecent(bytes32 _nullifier, uint256 _blockRange) 
        external 
        view 
        returns (bool) 
    {
        uint256 usedBlock = nullifierBlocks[_nullifier];
        if (usedBlock == 0) return false;
        
        return block.number <= usedBlock + _blockRange;
    }
    
    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Toggle emergency pause
     */
    function togglePause() external onlyOwner {
        paused = !paused;
        emit PauseToggled(paused);
    }
    
    /**
     * @notice Update rate limit
     * @param _newLimit New max proofs per day
     */
    function setRateLimit(uint256 _newLimit) external onlyOwner {
        require(_newLimit > 0 && _newLimit <= 100, "Invalid limit");
        maxProofsPerDay = _newLimit;
        emit RateLimitUpdated(_newLimit);
    }
    
    /**
     * @notice Whitelist address (bypass rate limits)
     * @param _user User address
     */
    function addToWhitelist(address _user) external onlyOwner {
        whitelist[_user] = true;
        emit AddressWhitelisted(_user);
    }
    
    /**
     * @notice Remove from whitelist
     * @param _user User address
     */
    function removeFromWhitelist(address _user) external onlyOwner {
        whitelist[_user] = false;
    }
    
    /**
     * @notice Blacklist address manually
     * @param _user User address
     */
    function blacklistAddress(address _user) external onlyOwner {
        anomalyScores[_user].blacklisted = true;
        emit AddressBlacklisted(_user);
    }
    
    /**
     * @notice Remove from blacklist
     * @param _user User address
     */
    function removeFromBlacklist(address _user) external onlyOwner {
        anomalyScores[_user].blacklisted = false;
        anomalyScores[_user].suspiciousAttempts = 0;
    }
    
    /**
     * @notice Transfer ownership
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Get rate limit status for user
     * @param _user User address
     */
    function getRateLimitStatus(address _user) external view returns (
        uint256 proofCount,
        uint256 windowStart,
        uint256 lastProofTime,
        uint256 remainingProofs
    ) {
        RateLimitData storage data = rateLimits[_user];
        
        uint256 remaining = 0;
        if (block.timestamp < data.windowStart + RATE_LIMIT_WINDOW) {
            if (data.proofCount < maxProofsPerDay) {
                remaining = maxProofsPerDay - data.proofCount;
            }
        } else {
            remaining = maxProofsPerDay;
        }
        
        return (
            data.proofCount,
            data.windowStart,
            data.lastProofTime,
            remaining
        );
    }
    
    /**
     * @notice Get anomaly score for user
     * @param _user User address
     */
    function getAnomalyScore(address _user) external view returns (
        uint256 suspiciousAttempts,
        uint256 lastFlagTime,
        bool blacklisted
    ) {
        AnomalyScore storage score = anomalyScores[_user];
        return (
            score.suspiciousAttempts,
            score.lastFlagTime,
            score.blacklisted
        );
    }
    
    /**
     * @notice Check if user can submit proof
     * @param _user User address
     */
    function canSubmitProof(address _user) external view returns (bool) {
        // Check blacklist
        if (anomalyScores[_user].blacklisted) return false;
        
        // Check pause
        if (paused) return false;
        
        // Check rate limit
        if (!whitelist[_user]) {
            RateLimitData storage data = rateLimits[_user];
            if (block.timestamp < data.windowStart + RATE_LIMIT_WINDOW) {
                if (data.proofCount >= maxProofsPerDay) return false;
            }
            
            // Check minimum interval
            if (block.timestamp < data.lastProofTime + MIN_PROOF_INTERVAL) {
                return false;
            }
        }
        
        return true;
    }
}
