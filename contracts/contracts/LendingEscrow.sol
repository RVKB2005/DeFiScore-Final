// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IDeFiScoreRegistry {
    function isEligible(address _user) external view returns (bool);
    function meetsThreshold(address _user, uint256 _threshold) external view returns (bool);
    function isProofFresh(address _user) external view returns (bool);
}

/**
 * @title LendingEscrow
 * @notice Manages collateral locking and loan lifecycle for DeFiScore lending
 * @dev Handles collateral deposits, loan funding, repayments, and liquidations
 * 
 * INTEGRATION WITH ZK PROOF SYSTEM:
 * - Enforces credit score verification before loan creation
 * - Checks proof freshness (24-hour validity)
 * - Validates borrower meets lender's threshold
 * - Prevents loans without valid ZK proof
 */
contract LendingEscrow {
    
    // Owner
    address public owner;
    
    // DeFiScoreRegistry reference
    IDeFiScoreRegistry public scoreRegistry;
    
    // Minimum credit score threshold (scaled x1000, 0-900000)
    uint256 public defaultThreshold = 500000; // 500 score default
    
    // Reentrancy guard
    uint256 private locked = 1;
    
    modifier nonReentrant() {
        require(locked == 1, "Reentrant call");
        locked = 2;
        _;
        locked = 1;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    enum LoanStatus {
        PENDING,        // Loan created, awaiting collateral
        COLLATERALIZED, // Collateral locked, awaiting funding
        ACTIVE,         // Loan funded and active
        REPAID,         // Loan fully repaid
        DEFAULTED,      // Loan defaulted, collateral claimable
        LIQUIDATED      // Collateral claimed by lender
    }
    
    struct Loan {
        bytes32 loanId;
        address borrower;
        address lender;
        address loanToken;          // Token being borrowed (e.g., USDC)
        address collateralToken;    // Token used as collateral (e.g., ETH)
        uint256 loanAmount;
        uint256 collateralAmount;
        uint256 interestRate;       // Basis points (e.g., 500 = 5%)
        uint256 durationDays;
        uint256 startTime;
        uint256 dueDate;
        uint256 totalRepayment;     // Principal + interest
        uint256 amountRepaid;
        LoanStatus status;
    }
    
    // Loan ID => Loan details
    mapping(bytes32 => Loan) public loans;
    
    // User => Loan IDs
    mapping(address => bytes32[]) public borrowerLoans;
    mapping(address => bytes32[]) public lenderLoans;
    
    // Events
    event LoanCreated(bytes32 indexed loanId, address indexed borrower, address indexed lender, uint256 loanAmount);
    event CollateralDeposited(bytes32 indexed loanId, address indexed borrower, uint256 collateralAmount);
    event LoanFunded(bytes32 indexed loanId, address indexed lender, uint256 loanAmount);
    event RepaymentMade(bytes32 indexed loanId, address indexed borrower, uint256 amount, uint256 remaining);
    event LoanRepaid(bytes32 indexed loanId, address indexed borrower);
    event CollateralReturned(bytes32 indexed loanId, address indexed borrower, uint256 collateralAmount);
    event LoanDefaulted(bytes32 indexed loanId, address indexed borrower);
    event CollateralLiquidated(bytes32 indexed loanId, address indexed lender, uint256 collateralAmount);
    event ScoreRegistryUpdated(address indexed newRegistry);
    event DefaultThresholdUpdated(uint256 newThreshold);
    
    // Errors
    error InsufficientCreditScore();
    error CreditScoreExpired();
    error NoCreditScoreProof();
    error ScoreRegistryNotSet();
    
    /**
     * @notice Create a new loan agreement
     * @param _loanId Unique loan identifier from backend
     * @param _borrower Borrower address
     * @param _lender Lender address
     * @param _loanToken Token to be borrowed
     * @param _collateralToken Token used as collateral
     * @param _loanAmount Amount to borrow
     * @param _collateralAmount Required collateral amount
     * @param _interestRate Interest rate in basis points
     * @param _durationDays Loan duration in days
     * 
     * SECURITY: Enforces credit score verification via ZK proof
     */
    function createLoan(
        bytes32 _loanId,
        address _borrower,
        address _lender,
        address _loanToken,
        address _collateralToken,
        uint256 _loanAmount,
        uint256 _collateralAmount,
        uint256 _interestRate,
        uint256 _durationDays
    ) external onlyOwner {
        require(loans[_loanId].loanId == bytes32(0), "Loan already exists");
        require(_borrower != address(0) && _lender != address(0), "Invalid addresses");
        require(_loanAmount > 0 && _collateralAmount > 0, "Invalid amounts");
        
        // CREDIT SCORE VERIFICATION
        _verifyCreditScore(_borrower);
        
        // Calculate total repayment (principal + interest)
        uint256 interest = (_loanAmount * _interestRate * _durationDays) / (10000 * 365);
        uint256 totalRepayment = _loanAmount + interest;
        
        Loan memory newLoan = Loan({
            loanId: _loanId,
            borrower: _borrower,
            lender: _lender,
            loanToken: _loanToken,
            collateralToken: _collateralToken,
            loanAmount: _loanAmount,
            collateralAmount: _collateralAmount,
            interestRate: _interestRate,
            durationDays: _durationDays,
            startTime: 0,
            dueDate: 0,
            totalRepayment: totalRepayment,
            amountRepaid: 0,
            status: LoanStatus.PENDING
        });
        
        loans[_loanId] = newLoan;
        borrowerLoans[_borrower].push(_loanId);
        lenderLoans[_lender].push(_loanId);
        
        emit LoanCreated(_loanId, _borrower, _lender, _loanAmount);
    }
    
    /**
     * @notice Borrower deposits collateral to secure the loan
     * @param _loanId Loan identifier
     */
    function depositCollateral(bytes32 _loanId) external nonReentrant {
        Loan storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(msg.sender == loan.borrower, "Only borrower can deposit collateral");
        require(loan.status == LoanStatus.PENDING, "Invalid loan status");
        
        // Transfer collateral from borrower to contract
        IERC20(loan.collateralToken).transferFrom(
            msg.sender,
            address(this),
            loan.collateralAmount
        );
        
        loan.status = LoanStatus.COLLATERALIZED;
        
        emit CollateralDeposited(_loanId, msg.sender, loan.collateralAmount);
    }
    
    /**
     * @notice Lender funds the loan after collateral is deposited
     * @param _loanId Loan identifier
     */
    function fundLoan(bytes32 _loanId) external nonReentrant {
        Loan storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(msg.sender == loan.lender, "Only lender can fund loan");
        require(loan.status == LoanStatus.COLLATERALIZED, "Collateral not deposited");
        
        // Transfer loan amount from lender to borrower
        IERC20(loan.loanToken).transferFrom(
            msg.sender,
            loan.borrower,
            loan.loanAmount
        );
        
        // Set loan as active
        loan.status = LoanStatus.ACTIVE;
        loan.startTime = block.timestamp;
        loan.dueDate = block.timestamp + (loan.durationDays * 1 days);
        
        emit LoanFunded(_loanId, msg.sender, loan.loanAmount);
    }
    
    /**
     * @notice Borrower makes a repayment (partial or full)
     * @param _loanId Loan identifier
     * @param _amount Amount to repay
     */
    function makeRepayment(bytes32 _loanId, uint256 _amount) external nonReentrant {
        Loan storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(msg.sender == loan.borrower, "Only borrower can repay");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 remaining = loan.totalRepayment - loan.amountRepaid;
        require(_amount <= remaining, "Amount exceeds remaining balance");
        
        // Transfer repayment from borrower to lender
        IERC20(loan.loanToken).transferFrom(
            msg.sender,
            loan.lender,
            _amount
        );
        
        loan.amountRepaid += _amount;
        
        emit RepaymentMade(_loanId, msg.sender, _amount, remaining - _amount);
        
        // If fully repaid, return collateral
        if (loan.amountRepaid >= loan.totalRepayment) {
            loan.status = LoanStatus.REPAID;
            
            // Return collateral to borrower
            IERC20(loan.collateralToken).transfer(
                loan.borrower,
                loan.collateralAmount
            );
            
            emit LoanRepaid(_loanId, msg.sender);
            emit CollateralReturned(_loanId, msg.sender, loan.collateralAmount);
        }
    }
    
    /**
     * @notice Mark loan as defaulted if past due date
     * @param _loanId Loan identifier
     */
    function markAsDefaulted(bytes32 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(block.timestamp > loan.dueDate, "Loan not past due");
        require(loan.amountRepaid < loan.totalRepayment, "Loan already repaid");
        
        loan.status = LoanStatus.DEFAULTED;
        
        emit LoanDefaulted(_loanId, loan.borrower);
    }
    
    /**
     * @notice Lender claims collateral after default
     * @param _loanId Loan identifier
     */
    function liquidateCollateral(bytes32 _loanId) external nonReentrant {
        Loan storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(msg.sender == loan.lender, "Only lender can liquidate");
        require(loan.status == LoanStatus.DEFAULTED, "Loan not defaulted");
        
        loan.status = LoanStatus.LIQUIDATED;
        
        // Transfer collateral to lender
        IERC20(loan.collateralToken).transfer(
            loan.lender,
            loan.collateralAmount
        );
        
        emit CollateralLiquidated(_loanId, msg.sender, loan.collateralAmount);
    }
    
    /**
     * @notice Get loan details
     * @param _loanId Loan identifier
     */
    function getLoan(bytes32 _loanId) external view returns (Loan memory) {
        return loans[_loanId];
    }
    
    /**
     * @notice Get all loans for a borrower
     * @param _borrower Borrower address
     */
    function getBorrowerLoans(address _borrower) external view returns (bytes32[] memory) {
        return borrowerLoans[_borrower];
    }
    
    /**
     * @notice Get all loans for a lender
     * @param _lender Lender address
     */
    function getLenderLoans(address _lender) external view returns (bytes32[] memory) {
        return lenderLoans[_lender];
    }
    
    /**
     * @notice Check if loan is past due
     * @param _loanId Loan identifier
     */
    function isLoanOverdue(bytes32 _loanId) external view returns (bool) {
        Loan memory loan = loans[_loanId];
        return loan.status == LoanStatus.ACTIVE && 
               block.timestamp > loan.dueDate &&
               loan.amountRepaid < loan.totalRepayment;
    }
    
    // ============================================================================
    // CREDIT SCORE INTEGRATION
    // ============================================================================
    
    /**
     * @notice Set DeFiScoreRegistry address
     * @param _registry Registry contract address
     */
    function setScoreRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "Invalid registry address");
        scoreRegistry = IDeFiScoreRegistry(_registry);
        emit ScoreRegistryUpdated(_registry);
    }
    
    /**
     * @notice Set default credit score threshold
     * @param _threshold New threshold (scaled x1000, 0-900000)
     */
    function setDefaultThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold <= 900000, "Invalid threshold");
        defaultThreshold = _threshold;
        emit DefaultThresholdUpdated(_threshold);
    }
    
    /**
     * @notice Verify borrower has valid credit score proof
     * @param _borrower Borrower address
     */
    function _verifyCreditScore(address _borrower) internal view {
        if (address(scoreRegistry) == address(0)) {
            revert ScoreRegistryNotSet();
        }
        
        // Check if borrower has valid proof
        if (!scoreRegistry.isEligible(_borrower)) {
            revert NoCreditScoreProof();
        }
        
        // Check if proof is still fresh (within 24 hours)
        if (!scoreRegistry.isProofFresh(_borrower)) {
            revert CreditScoreExpired();
        }
        
        // Check if borrower meets threshold
        if (!scoreRegistry.meetsThreshold(_borrower, defaultThreshold)) {
            revert InsufficientCreditScore();
        }
    }
    
    /**
     * @notice Check if borrower is eligible for loan
     * @param _borrower Borrower address
     * @return bool Eligibility status
     */
    function isBorrowerEligible(address _borrower) external view returns (bool) {
        if (address(scoreRegistry) == address(0)) {
            return false;
        }
        
        return scoreRegistry.isEligible(_borrower) &&
               scoreRegistry.isProofFresh(_borrower) &&
               scoreRegistry.meetsThreshold(_borrower, defaultThreshold);
    }
}
