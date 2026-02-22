// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeFiScoreRegistry.sol";

/**
 * @title LenderIntegration
 * @notice Example lender contract integrating DeFi credit scores
 * @dev Demonstrates how lending protocols can use the score registry
 * 
 * Features:
 * - Per-lender threshold configuration
 * - Automatic credit score verification
 * - Borrow limit management
 * - Proof freshness enforcement
 * 
 * Integration Pattern:
 * 1. Lender sets threshold via setThreshold()
 * 2. User submits ZK proof to DeFiScoreRegistry
 * 3. User calls borrow() - automatic eligibility check
 * 4. Lender can query eligibility anytime via checkEligibility()
 */
contract LenderIntegration {
    
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================
    
    /// @notice Reference to DeFiScoreRegistry
    DeFiScoreRegistry public immutable scoreRegistry;
    
    /// @notice Minimum credit score required for borrowing (scaled x1000)
    uint256 public borrowThreshold;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Mapping of user to borrow limit (in wei)
    mapping(address => uint256) public borrowLimits;
    
    /// @notice Mapping of user to current borrowed amount
    mapping(address => uint256) public borrowed;
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event BorrowLimitSet(address indexed user, uint256 limit);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    
    // ============================================================================
    // ERRORS
    // ============================================================================
    
    error Unauthorized();
    error InsufficientCreditScore(uint256 required, uint256 actual);
    error CreditScoreExpired();
    error NoCreditScore();
    error ExceedsBorrowLimit();
    error NothingToBorrow();
    error NothingToRepay();
    
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
    
    /**
     * @param _scoreRegistry Address of DeFiScoreRegistry
     * @param _initialThreshold Initial credit score threshold
     */
    constructor(address _scoreRegistry, uint256 _initialThreshold) {
        scoreRegistry = DeFiScoreRegistry(_scoreRegistry);
        borrowThreshold = _initialThreshold;
        owner = msg.sender;
    }
    
    // ============================================================================
    // BORROWING FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Borrow funds (requires valid credit score)
     * @param amount Amount to borrow
     */
    function borrow(uint256 amount) external {
        if (amount == 0) revert NothingToBorrow();
        
        // Check credit score eligibility
        _checkCreditScore(msg.sender);
        
        // Check borrow limit
        uint256 limit = borrowLimits[msg.sender];
        uint256 currentBorrowed = borrowed[msg.sender];
        
        if (currentBorrowed + amount > limit) {
            revert ExceedsBorrowLimit();
        }
        
        // Update borrowed amount
        borrowed[msg.sender] = currentBorrowed + amount;
        
        // Transfer funds (simplified - in production, use proper lending logic)
        payable(msg.sender).transfer(amount);
        
        emit Borrowed(msg.sender, amount);
    }
    
    /**
     * @notice Repay borrowed funds
     */
    function repay() external payable {
        if (msg.value == 0) revert NothingToRepay();
        
        uint256 currentBorrowed = borrowed[msg.sender];
        
        if (currentBorrowed == 0) revert NothingToRepay();
        
        // Update borrowed amount
        if (msg.value >= currentBorrowed) {
            borrowed[msg.sender] = 0;
            
            // Refund excess
            if (msg.value > currentBorrowed) {
                payable(msg.sender).transfer(msg.value - currentBorrowed);
            }
        } else {
            borrowed[msg.sender] = currentBorrowed - msg.value;
        }
        
        emit Repaid(msg.sender, msg.value);
    }
    
    /**
     * @notice Check if user is eligible to borrow
     * @param user User address
     * @return eligible True if user meets credit requirements
     * @return score User's credit score (scaled x1000)
     * @return availableLimit Remaining borrow capacity
     */
    function checkEligibility(address user) 
        external 
        view 
        returns (
            bool eligible,
            uint256 score,
            uint256 availableLimit
        ) 
    {
        // Check if user meets this lender's threshold
        bool meetsThreshold = scoreRegistry.meetsLenderThreshold(user, address(this));
        
        if (!meetsThreshold) {
            // Get score for informational purposes
            DeFiScoreRegistry.EligibilityData memory eligData = scoreRegistry.getEligibilityData(user);
            return (false, eligData.score, 0);
        }
        
        // Get user's score
        DeFiScoreRegistry.EligibilityData memory data = scoreRegistry.getEligibilityData(user);
        
        // Calculate available limit
        uint256 limit = borrowLimits[user];
        uint256 currentBorrowed = borrowed[user];
        uint256 available = limit > currentBorrowed ? limit - currentBorrowed : 0;
        
        return (true, data.score, available);
    }
    
    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Update credit score threshold
     * @param newThreshold New minimum score (scaled x1000, 0-900000)
     */
    function setThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold <= 900000, "Invalid threshold");
        
        uint256 oldThreshold = borrowThreshold;
        borrowThreshold = newThreshold;
        
        // Also update in registry for this lender
        scoreRegistry.setThreshold(newThreshold);
        
        emit ThresholdUpdated(oldThreshold, newThreshold);
    }
    
    /**
     * @notice Set borrow limit for user
     * @param user User address
     * @param limit Borrow limit in wei
     */
    function setBorrowLimit(address user, uint256 limit) external onlyOwner {
        borrowLimits[user] = limit;
        
        emit BorrowLimitSet(user, limit);
    }
    
    /**
     * @notice Batch set borrow limits
     * @param users Array of user addresses
     * @param limits Array of borrow limits
     */
    function setBorrowLimitsBatch(
        address[] calldata users,
        uint256[] calldata limits
    ) external onlyOwner {
        require(users.length == limits.length, "Length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            borrowLimits[users[i]] = limits[i];
            emit BorrowLimitSet(users[i], limits[i]);
        }
    }
    
    /**
     * @notice Withdraw contract balance (owner only)
     */
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    /**
     * @notice Deposit funds to contract
     */
    receive() external payable {}
    
    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Internal function to check credit score
     * @param user User address
     */
    function _checkCreditScore(address user) internal view {
        // Check if user meets this lender's threshold
        bool meetsThreshold = scoreRegistry.meetsLenderThreshold(user, address(this));
        
        if (!meetsThreshold) {
            // Get detailed data for error message
            DeFiScoreRegistry.EligibilityData memory data = scoreRegistry.getEligibilityData(user);
            
            if (!data.isEligible) {
                revert NoCreditScore();
            }
            
            // Check if proof expired
            if (!scoreRegistry.isProofFresh(user)) {
                revert CreditScoreExpired();
            }
            
            // Score exists but doesn't meet threshold
            revert InsufficientCreditScore(borrowThreshold, data.score);
        }
    }
    
    /**
     * @notice Get time until user's proof expires
     * @param user User address
     * @return uint256 Seconds until expiry (0 if expired)
     */
    function getTimeUntilExpiry(address user) external view returns (uint256) {
        return scoreRegistry.getTimeUntilExpiry(user);
    }
    
    /**
     * @notice Check if user's proof is still fresh
     * @param user User address
     * @return bool Freshness status
     */
    function isProofFresh(address user) external view returns (bool) {
        return scoreRegistry.isProofFresh(user);
    }
}
