// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeFiScoreRegistry.sol";

/**
 * @title CircuitVersionManager
 * @notice Manages circuit version upgrades and governance
 * @dev Handles verifier rotation, version deprecation, and upgrade proposals
 * 
 * Architecture:
 * - Multi-signature governance for upgrades
 * - Gradual version deprecation (grace period)
 * - Emergency pause mechanism
 * - Backward compatibility tracking
 * 
 * Security:
 * - Requires multiple approvals for upgrades
 * - Time-locked version activation
 * - Prevents immediate version switches
 * - Maintains audit trail
 */
contract CircuitVersionManager {
    
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================
    
    /// @notice Reference to DeFiScoreRegistry
    DeFiScoreRegistry public immutable registry;
    
    /// @notice Governance addresses (multi-sig)
    address[] public governors;
    
    /// @notice Required approvals for upgrade
    uint256 public requiredApprovals;
    
    /// @notice Timelock duration for version activation (48 hours)
    uint256 public constant TIMELOCK_DURATION = 48 hours;
    
    /// @notice Grace period for deprecated versions (30 days)
    uint256 public constant DEPRECATION_GRACE_PERIOD = 30 days;
    
    /// @notice Emergency pause status
    bool public paused;
    
    // ============================================================================
    // STRUCTS
    // ============================================================================
    
    struct VersionInfo {
        uint256 versionId;
        address verifier;
        uint256 activationTime;
        uint256 deprecationTime;
        bool isActive;
        bool isDeprecated;
        string metadata; // IPFS hash or description
    }
    
    struct UpgradeProposal {
        uint256 proposalId;
        uint256 newVersion;
        address newVerifier;
        string metadata;
        uint256 proposedAt;
        uint256 activationTime;
        uint256 approvalCount;
        bool executed;
        mapping(address => bool) approvals;
    }
    
    // ============================================================================
    // STORAGE
    // ============================================================================
    
    /// @notice Version ID => Version info
    mapping(uint256 => VersionInfo) public versions;
    
    /// @notice Proposal ID => Upgrade proposal
    mapping(uint256 => UpgradeProposal) public proposals;
    
    /// @notice Next proposal ID
    uint256 public nextProposalId;
    
    /// @notice List of all version IDs
    uint256[] public versionList;
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed newVersion,
        address indexed newVerifier,
        address proposer
    );
    
    event ProposalApproved(
        uint256 indexed proposalId,
        address indexed governor,
        uint256 approvalCount
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        uint256 indexed newVersion,
        address indexed newVerifier
    );
    
    event VersionActivated(
        uint256 indexed versionId,
        address indexed verifier
    );
    
    event VersionDeprecated(
        uint256 indexed versionId,
        uint256 deprecationTime
    );
    
    event GovernorAdded(address indexed governor);
    event GovernorRemoved(address indexed governor);
    event PauseToggled(bool paused);
    
    // ============================================================================
    // ERRORS
    // ============================================================================
    
    error Unauthorized();
    error InvalidVersion();
    error InvalidVerifier();
    error ProposalNotReady();
    error ProposalAlreadyExecuted();
    error AlreadyApproved();
    error SystemPaused();
    error InvalidGovernor();
    error InsufficientApprovals();
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyGovernor() {
        bool isGov = false;
        for (uint256 i = 0; i < governors.length; i++) {
            if (governors[i] == msg.sender) {
                isGov = true;
                break;
            }
        }
        if (!isGov) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert SystemPaused();
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(
        address _registry,
        address[] memory _governors,
        uint256 _requiredApprovals
    ) {
        require(_registry != address(0), "Invalid registry");
        require(_governors.length >= _requiredApprovals, "Invalid approval count");
        require(_requiredApprovals > 0, "Must require at least 1 approval");
        
        registry = DeFiScoreRegistry(_registry);
        governors = _governors;
        requiredApprovals = _requiredApprovals;
        
        // Register initial version
        uint256 currentVersion = registry.currentVersion();
        address currentVerifier = registry.getVerifier(currentVersion);
        
        if (currentVerifier != address(0)) {
            versions[currentVersion] = VersionInfo({
                versionId: currentVersion,
                verifier: currentVerifier,
                activationTime: block.timestamp,
                deprecationTime: 0,
                isActive: true,
                isDeprecated: false,
                metadata: "Initial version"
            });
            versionList.push(currentVersion);
        }
    }
    
    // ============================================================================
    // GOVERNANCE FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Propose new circuit version
     * @param _newVersion Version ID
     * @param _newVerifier Verifier contract address
     * @param _metadata IPFS hash or description
     */
    function proposeUpgrade(
        uint256 _newVersion,
        address _newVerifier,
        string calldata _metadata
    ) external onlyGovernor whenNotPaused returns (uint256) {
        if (_newVerifier == address(0)) revert InvalidVerifier();
        if (versions[_newVersion].verifier != address(0)) revert InvalidVersion();
        
        uint256 proposalId = nextProposalId++;
        UpgradeProposal storage proposal = proposals[proposalId];
        
        proposal.proposalId = proposalId;
        proposal.newVersion = _newVersion;
        proposal.newVerifier = _newVerifier;
        proposal.metadata = _metadata;
        proposal.proposedAt = block.timestamp;
        proposal.activationTime = block.timestamp + TIMELOCK_DURATION;
        proposal.approvalCount = 1;
        proposal.executed = false;
        proposal.approvals[msg.sender] = true;
        
        emit ProposalCreated(proposalId, _newVersion, _newVerifier, msg.sender);
        emit ProposalApproved(proposalId, msg.sender, 1);
        
        return proposalId;
    }
    
    /**
     * @notice Approve upgrade proposal
     * @param _proposalId Proposal ID
     */
    function approveProposal(uint256 _proposalId) external onlyGovernor whenNotPaused {
        UpgradeProposal storage proposal = proposals[_proposalId];
        
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.approvals[msg.sender]) revert AlreadyApproved();
        
        proposal.approvals[msg.sender] = true;
        proposal.approvalCount++;
        
        emit ProposalApproved(_proposalId, msg.sender, proposal.approvalCount);
    }
    
    /**
     * @notice Execute approved proposal after timelock
     * @param _proposalId Proposal ID
     */
    function executeProposal(uint256 _proposalId) external onlyGovernor whenNotPaused {
        UpgradeProposal storage proposal = proposals[_proposalId];
        
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.approvalCount < requiredApprovals) revert InsufficientApprovals();
        if (block.timestamp < proposal.activationTime) revert ProposalNotReady();
        
        proposal.executed = true;
        
        // Add verifier to registry
        registry.addVerifier(proposal.newVersion, proposal.newVerifier);
        
        // Register version info
        versions[proposal.newVersion] = VersionInfo({
            versionId: proposal.newVersion,
            verifier: proposal.newVerifier,
            activationTime: block.timestamp,
            deprecationTime: 0,
            isActive: true,
            isDeprecated: false,
            metadata: proposal.metadata
        });
        versionList.push(proposal.newVersion);
        
        // Update current version in registry
        registry.setCurrentVersion(proposal.newVersion);
        
        emit ProposalExecuted(_proposalId, proposal.newVersion, proposal.newVerifier);
        emit VersionActivated(proposal.newVersion, proposal.newVerifier);
    }
    
    /**
     * @notice Deprecate old version (starts grace period)
     * @param _versionId Version to deprecate
     */
    function deprecateVersion(uint256 _versionId) external onlyGovernor {
        VersionInfo storage version = versions[_versionId];
        
        if (version.verifier == address(0)) revert InvalidVersion();
        if (version.isDeprecated) revert InvalidVersion();
        if (_versionId == registry.currentVersion()) revert InvalidVersion();
        
        version.isDeprecated = true;
        version.deprecationTime = block.timestamp + DEPRECATION_GRACE_PERIOD;
        
        emit VersionDeprecated(_versionId, version.deprecationTime);
    }
    
    /**
     * @notice Emergency pause system
     */
    function togglePause() external onlyGovernor {
        paused = !paused;
        emit PauseToggled(paused);
    }
    
    /**
     * @notice Add new governor
     * @param _governor Governor address
     */
    function addGovernor(address _governor) external onlyGovernor {
        if (_governor == address(0)) revert InvalidGovernor();
        
        for (uint256 i = 0; i < governors.length; i++) {
            if (governors[i] == _governor) revert InvalidGovernor();
        }
        
        governors.push(_governor);
        emit GovernorAdded(_governor);
    }
    
    /**
     * @notice Remove governor
     * @param _governor Governor address
     */
    function removeGovernor(address _governor) external onlyGovernor {
        require(governors.length > requiredApprovals, "Cannot remove governor");
        
        for (uint256 i = 0; i < governors.length; i++) {
            if (governors[i] == _governor) {
                governors[i] = governors[governors.length - 1];
                governors.pop();
                emit GovernorRemoved(_governor);
                return;
            }
        }
        
        revert InvalidGovernor();
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Get version info
     * @param _versionId Version ID
     */
    function getVersionInfo(uint256 _versionId) external view returns (VersionInfo memory) {
        return versions[_versionId];
    }
    
    /**
     * @notice Get all versions
     */
    function getAllVersions() external view returns (uint256[] memory) {
        return versionList;
    }
    
    /**
     * @notice Check if version is valid for use
     * @param _versionId Version ID
     */
    function isVersionValid(uint256 _versionId) external view returns (bool) {
        VersionInfo memory version = versions[_versionId];
        
        if (!version.isActive) return false;
        if (version.isDeprecated && block.timestamp > version.deprecationTime) return false;
        
        return true;
    }
    
    /**
     * @notice Get proposal details
     * @param _proposalId Proposal ID
     */
    function getProposal(uint256 _proposalId) external view returns (
        uint256 newVersion,
        address newVerifier,
        string memory metadata,
        uint256 proposedAt,
        uint256 activationTime,
        uint256 approvalCount,
        bool executed
    ) {
        UpgradeProposal storage proposal = proposals[_proposalId];
        return (
            proposal.newVersion,
            proposal.newVerifier,
            proposal.metadata,
            proposal.proposedAt,
            proposal.activationTime,
            proposal.approvalCount,
            proposal.executed
        );
    }
    
    /**
     * @notice Check if address is governor
     * @param _address Address to check
     */
    function isGovernor(address _address) external view returns (bool) {
        for (uint256 i = 0; i < governors.length; i++) {
            if (governors[i] == _address) return true;
        }
        return false;
    }
    
    /**
     * @notice Get all governors
     */
    function getGovernors() external view returns (address[] memory) {
        return governors;
    }
}
