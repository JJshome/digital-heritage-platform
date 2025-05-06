// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Digital Asset Inheritance Contract
 * @author Ucaretron Inc.
 * @notice This contract manages the inheritance of digital assets
 * @dev This technical content is based on patented technology filed by Ucaretron Inc.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @dev Interface for the Digital Asset Registry
 */
interface IDigitalAssetRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function getAssetType(uint256 tokenId) external view returns (uint256);
}

/**
 * @dev Interface for the Death Verification Oracle
 */
interface IDeathVerificationOracle {
    function isDeceased(address user) external view returns (bool);
    function deathDate(address user) external view returns (uint256);
    function deathCertificateURI(address user) external view returns (string memory);
    function verificationStatus(address user) external view returns (uint8);
}

/**
 * @title Digital Asset Inheritance
 * @notice This contract handles the inheritance of tokenized digital assets
 */
contract DigitalAssetInheritance is AccessControl, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // Inheritance status enum
    enum InheritanceStatus {
        NotConfigured,
        Configured,
        InCooldown,
        InProcess,
        Completed,
        Disputed,
        Cancelled
    }

    // Asset access conditions
    enum AccessCondition {
        Immediate,
        Delayed,
        Conditional,
        Staged
    }

    // Inheritance plan struct
    struct InheritancePlan {
        address owner;
        uint256 creationTime;
        uint256 lastUpdateTime;
        uint256 cooldownPeriod;
        bytes32 assetMerkleRoot;
        address[] guardians;
        uint256 requiredGuardianApprovals;
        InheritanceStatus status;
        mapping(address => bool) guardianApprovals;
        uint256 approvalCount;
        bytes32 documentHash;
        string metadataURI;
    }

    // Beneficiary struct
    struct Beneficiary {
        address beneficiaryAddress;
        bytes32 assetsMerkleRoot;
        AccessCondition accessCondition;
        uint256 delayPeriod;
        bytes32 conditionHash;
        bool isActive;
    }

    // Asset transfer struct
    struct AssetTransfer {
        uint256 assetId;
        address registry;
        address beneficiary;
        uint256 unlockTime;
        bool transferred;
    }

    // State variables
    IDeathVerificationOracle public deathOracle;
    
    // User's inheritance plan
    mapping(address => InheritancePlan) private inheritancePlans;
    
    // User's beneficiaries
    mapping(address => mapping(address => Beneficiary)) private beneficiaries;
    mapping(address => address[]) private beneficiaryList;
    
    // Pending asset transfers
    mapping(address => AssetTransfer[]) private pendingTransfers;
    
    // Execution history
    mapping(address => uint256) public executionTimestamp;
    mapping(address => string) public executionProofURI;

    // Events
    event InheritancePlanCreated(address indexed owner, bytes32 documentHash);
    event InheritancePlanUpdated(address indexed owner, bytes32 documentHash);
    event BeneficiaryAdded(address indexed owner, address indexed beneficiary);
    event BeneficiaryUpdated(address indexed owner, address indexed beneficiary);
    event BeneficiaryRemoved(address indexed owner, address indexed beneficiary);
    event InheritanceInitiated(address indexed owner, address indexed initiator);
    event GuardianApproved(address indexed owner, address indexed guardian);
    event AssetTransferred(address indexed owner, address indexed beneficiary, address registry, uint256 assetId);
    event InheritanceCompleted(address indexed owner, uint256 timestamp);
    event InheritanceDisputed(address indexed owner, address indexed disputer, string reason);
    event InheritanceCancelled(address indexed owner, address indexed canceller);

    /**
     * @notice Constructor to initialize the contract
     * @param _deathOracle Address of the death verification oracle
     */
    constructor(address _deathOracle) {
        require(_deathOracle != address(0), "Invalid oracle address");
        deathOracle = IDeathVerificationOracle(_deathOracle);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Set the death verification oracle
     * @param _newOracle Address of the new oracle
     */
    function setDeathOracle(address _newOracle) external onlyRole(ADMIN_ROLE) {
        require(_newOracle != address(0), "Invalid oracle address");
        deathOracle = IDeathVerificationOracle(_newOracle);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Create an inheritance plan
     * @param _cooldownPeriod Period to wait before executing inheritance
     * @param _assetMerkleRoot Merkle root of the digital assets
     * @param _guardians Array of guardian addresses
     * @param _requiredGuardianApprovals Number of guardian approvals required
     * @param _documentHash Hash of the inheritance document
     * @param _metadataURI URI pointing to the inheritance plan metadata
     */
    function createInheritancePlan(
        uint256 _cooldownPeriod,
        bytes32 _assetMerkleRoot,
        address[] calldata _guardians,
        uint256 _requiredGuardianApprovals,
        bytes32 _documentHash,
        string calldata _metadataURI
    ) external whenNotPaused {
        require(inheritancePlans[msg.sender].status == InheritanceStatus.NotConfigured, "Plan already exists");
        require(_cooldownPeriod > 0, "Invalid cooldown period");
        require(_guardians.length > 0, "Must specify at least one guardian");
        require(_requiredGuardianApprovals > 0 && _requiredGuardianApprovals <= _guardians.length, "Invalid guardian approvals");
        
        InheritancePlan storage plan = inheritancePlans[msg.sender];
        plan.owner = msg.sender;
        plan.creationTime = block.timestamp;
        plan.lastUpdateTime = block.timestamp;
        plan.cooldownPeriod = _cooldownPeriod;
        plan.assetMerkleRoot = _assetMerkleRoot;
        plan.guardians = _guardians;
        plan.requiredGuardianApprovals = _requiredGuardianApprovals;
        plan.status = InheritanceStatus.Configured;
        plan.documentHash = _documentHash;
        plan.metadataURI = _metadataURI;
        
        // Grant guardian roles
        for (uint256 i = 0; i < _guardians.length; i++) {
            _grantRole(GUARDIAN_ROLE, _guardians[i]);
        }
        
        emit InheritancePlanCreated(msg.sender, _documentHash);
    }

    /**
     * @notice Update an existing inheritance plan
     * @param _cooldownPeriod Period to wait before executing inheritance
     * @param _assetMerkleRoot Merkle root of the digital assets
     * @param _guardians Array of guardian addresses
     * @param _requiredGuardianApprovals Number of guardian approvals required
     * @param _documentHash Hash of the inheritance document
     * @param _metadataURI URI pointing to the inheritance plan metadata
     */
    function updateInheritancePlan(
        uint256 _cooldownPeriod,
        bytes32 _assetMerkleRoot,
        address[] calldata _guardians,
        uint256 _requiredGuardianApprovals,
        bytes32 _documentHash,
        string calldata _metadataURI
    ) external whenNotPaused {
        InheritancePlan storage plan = inheritancePlans[msg.sender];
        require(plan.status == InheritanceStatus.Configured, "No active plan or plan in process");
        require(_cooldownPeriod > 0, "Invalid cooldown period");
        require(_guardians.length > 0, "Must specify at least one guardian");
        require(_requiredGuardianApprovals > 0 && _requiredGuardianApprovals <= _guardians.length, "Invalid guardian approvals");
        
        // Revoke guardian roles from old guardians
        for (uint256 i = 0; i < plan.guardians.length; i++) {
            _revokeRole(GUARDIAN_ROLE, plan.guardians[i]);
        }
        
        // Update plan details
        plan.lastUpdateTime = block.timestamp;
        plan.cooldownPeriod = _cooldownPeriod;
        plan.assetMerkleRoot = _assetMerkleRoot;
        plan.guardians = _guardians;
        plan.requiredGuardianApprovals = _requiredGuardianApprovals;
        plan.documentHash = _documentHash;
        plan.metadataURI = _metadataURI;
        
        // Reset approvals
        plan.approvalCount = 0;
        
        // Grant guardian roles to new guardians
        for (uint256 i = 0; i < _guardians.length; i++) {
            _grantRole(GUARDIAN_ROLE, _guardians[i]);
        }
        
        emit InheritancePlanUpdated(msg.sender, _documentHash);
    }

    /**
     * @notice Add a beneficiary to the inheritance plan
     * @param _beneficiary Address of the beneficiary
     * @param _assetsMerkleRoot Merkle root of assets allocated to this beneficiary
     * @param _accessCondition Access condition for the beneficiary
     * @param _delayPeriod Delay period for delayed access condition
     * @param _conditionHash Hash of condition document for conditional access
     */
    function addBeneficiary(
        address _beneficiary,
        bytes32 _assetsMerkleRoot,
        AccessCondition _accessCondition,
        uint256 _delayPeriod,
        bytes32 _conditionHash
    ) external whenNotPaused {
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(inheritancePlans[msg.sender].status == InheritanceStatus.Configured, "No active plan");
        require(beneficiaries[msg.sender][_beneficiary].beneficiaryAddress == address(0), "Beneficiary already exists");
        
        Beneficiary storage beneficiary = beneficiaries[msg.sender][_beneficiary];
        beneficiary.beneficiaryAddress = _beneficiary;
        beneficiary.assetsMerkleRoot = _assetsMerkleRoot;
        beneficiary.accessCondition = _accessCondition;
        beneficiary.delayPeriod = _delayPeriod;
        beneficiary.conditionHash = _conditionHash;
        beneficiary.isActive = true;
        
        beneficiaryList[msg.sender].push(_beneficiary);
        
        emit BeneficiaryAdded(msg.sender, _beneficiary);
    }

    /**
     * @notice Update an existing beneficiary
     * @param _beneficiary Address of the beneficiary
     * @param _assetsMerkleRoot Merkle root of assets allocated to this beneficiary
     * @param _accessCondition Access condition for the beneficiary
     * @param _delayPeriod Delay period for delayed access condition
     * @param _conditionHash Hash of condition document for conditional access
     */
    function updateBeneficiary(
        address _beneficiary,
        bytes32 _assetsMerkleRoot,
        AccessCondition _accessCondition,
        uint256 _delayPeriod,
        bytes32 _conditionHash
    ) external whenNotPaused {
        require(inheritancePlans[msg.sender].status == InheritanceStatus.Configured, "No active plan");
        require(beneficiaries[msg.sender][_beneficiary].beneficiaryAddress == _beneficiary, "Beneficiary not found");
        require(beneficiaries[msg.sender][_beneficiary].isActive, "Beneficiary not active");
        
        Beneficiary storage beneficiary = beneficiaries[msg.sender][_beneficiary];
        beneficiary.assetsMerkleRoot = _assetsMerkleRoot;
        beneficiary.accessCondition = _accessCondition;
        beneficiary.delayPeriod = _delayPeriod;
        beneficiary.conditionHash = _conditionHash;
        
        emit BeneficiaryUpdated(msg.sender, _beneficiary);
    }

    /**
     * @notice Remove a beneficiary from the inheritance plan
     * @param _beneficiary Address of the beneficiary to remove
     */
    function removeBeneficiary(address _beneficiary) external whenNotPaused {
        require(inheritancePlans[msg.sender].status == InheritanceStatus.Configured, "No active plan");
        require(beneficiaries[msg.sender][_beneficiary].beneficiaryAddress == _beneficiary, "Beneficiary not found");
        require(beneficiaries[msg.sender][_beneficiary].isActive, "Beneficiary already inactive");
        
        beneficiaries[msg.sender][_beneficiary].isActive = false;
        
        emit BeneficiaryRemoved(msg.sender, _beneficiary);
    }

    /**
     * @notice Initiate the inheritance process
     * @param _owner Address of the deceased owner
     */
    function initiateInheritance(address _owner) external whenNotPaused {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.Configured, "No active inheritance plan");
        
        // If the initiator is not an admin or executor, verify death through oracle
        if (!hasRole(ADMIN_ROLE, msg.sender) && !hasRole(EXECUTOR_ROLE, msg.sender)) {
            require(deathOracle.isDeceased(_owner), "Owner not verified as deceased");
        }
        
        // Initialize the cooldown period
        plan.status = InheritanceStatus.InCooldown;
        plan.approvalCount = 0;
        
        // Reset guardian approvals
        for (uint i = 0; i < plan.guardians.length; i++) {
            plan.guardianApprovals[plan.guardians[i]] = false;
        }
        
        emit InheritanceInitiated(_owner, msg.sender);
    }

    /**
     * @notice Guardian approval for inheritance execution
     * @param _owner Address of the deceased owner
     */
    function approveInheritance(address _owner) external whenNotPaused onlyRole(GUARDIAN_ROLE) {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.InCooldown || plan.status == InheritanceStatus.InProcess, 
                "Inheritance not in cooldown or process");
        
        // Check if the guardian is valid for this plan
        bool isValidGuardian = false;
        for (uint i = 0; i < plan.guardians.length; i++) {
            if (plan.guardians[i] == msg.sender) {
                isValidGuardian = true;
                break;
            }
        }
        require(isValidGuardian, "Not a valid guardian for this plan");
        
        // Check if guardian has already approved
        require(!plan.guardianApprovals[msg.sender], "Already approved");
        
        // Record approval
        plan.guardianApprovals[msg.sender] = true;
        plan.approvalCount++;
        
        emit GuardianApproved(_owner, msg.sender);
        
        // If we've reached the required approvals and cooldown period has passed, move to in process
        if (plan.approvalCount >= plan.requiredGuardianApprovals && 
            plan.status == InheritanceStatus.InCooldown && 
            block.timestamp >= deathOracle.deathDate(_owner) + plan.cooldownPeriod) {
            plan.status = InheritanceStatus.InProcess;
            _processInheritance(_owner);
        }
    }

    /**
     * @notice Process inheritance execution after cooldown and approvals
     * @param _owner Address of the deceased owner
     */
    function _processInheritance(address _owner) internal {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.InProcess, "Inheritance not in process");
        
        // Process each beneficiary
        address[] memory activeBeneficiaries = getBeneficiaries(_owner);
        uint256 deathTimestamp = deathOracle.deathDate(_owner);
        
        for (uint i = 0; i < activeBeneficiaries.length; i++) {
            address beneficiaryAddr = activeBeneficiaries[i];
            Beneficiary storage beneficiary = beneficiaries[_owner][beneficiaryAddr];
            
            if (beneficiary.isActive) {
                // Schedule asset transfers based on access conditions
                uint256 unlockTime;
                
                if (beneficiary.accessCondition == AccessCondition.Immediate) {
                    unlockTime = block.timestamp; // Immediate access
                } else if (beneficiary.accessCondition == AccessCondition.Delayed) {
                    unlockTime = deathTimestamp + beneficiary.delayPeriod; // Delayed access
                } else if (beneficiary.accessCondition == AccessCondition.Conditional) {
                    // For conditional access, we need external verification (handled separately)
                    unlockTime = 0;
                } else if (beneficiary.accessCondition == AccessCondition.Staged) {
                    // For staged access, additional logic would be implemented
                    unlockTime = 0;
                }
                
                // For immediate and delayed access, we can schedule transfers
                if (unlockTime > 0) {
                    // Assets would be scheduled for transfer based on the Merkle tree
                    // This would be expanded in a production implementation
                }
            }
        }
        
        // Record execution timestamp and proof
        executionTimestamp[_owner] = block.timestamp;
        executionProofURI[_owner] = deathOracle.deathCertificateURI(_owner);
        
        // Set status to completed if all transfers are scheduled
        plan.status = InheritanceStatus.Completed;
        
        emit InheritanceCompleted(_owner, block.timestamp);
    }

    /**
     * @notice Execute pending asset transfers when unlock time is reached
     * @param _owner Address of the deceased owner
     * @param _assetRegistry Address of the asset registry contract
     * @param _assetId ID of the asset to transfer
     * @param _beneficiary Address of the beneficiary
     * @param _merkleProof Merkle proof verifying the asset belongs to the beneficiary
     */
    function executeAssetTransfer(
        address _owner,
        address _assetRegistry,
        uint256 _assetId,
        address _beneficiary,
        bytes32[] calldata _merkleProof
    ) external whenNotPaused nonReentrant {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.Completed, "Inheritance not completed");
        
        Beneficiary storage beneficiary = beneficiaries[_owner][_beneficiary];
        require(beneficiary.isActive, "Beneficiary not active");
        
        // Verify asset ownership
        IDigitalAssetRegistry registry = IDigitalAssetRegistry(_assetRegistry);
        require(registry.ownerOf(_assetId) == _owner, "Asset not owned by deceased");
        
        // Verify the merkle proof that this asset belongs to this beneficiary
        bytes32 leaf = keccak256(abi.encodePacked(_assetId, _assetRegistry, _beneficiary));
        require(MerkleProof.verify(_merkleProof, beneficiary.assetsMerkleRoot, leaf), "Invalid merkle proof");
        
        // Check for pending transfer or create a new one
        bool transferExists = false;
        uint256 transferIndex = 0;
        
        AssetTransfer[] storage transfers = pendingTransfers[_owner];
        for (uint i = 0; i < transfers.length; i++) {
            if (transfers[i].assetId == _assetId && 
                transfers[i].registry == _assetRegistry &&
                transfers[i].beneficiary == _beneficiary) {
                transferExists = true;
                transferIndex = i;
                break;
            }
        }
        
        if (!transferExists) {
            // Create new transfer record
            uint256 unlockTime;
            
            if (beneficiary.accessCondition == AccessCondition.Immediate) {
                unlockTime = block.timestamp;
            } else if (beneficiary.accessCondition == AccessCondition.Delayed) {
                unlockTime = deathOracle.deathDate(_owner) + beneficiary.delayPeriod;
            } else {
                revert("Unsupported access condition");
            }
            
            transfers.push(AssetTransfer({
                assetId: _assetId,
                registry: _assetRegistry,
                beneficiary: _beneficiary,
                unlockTime: unlockTime,
                transferred: false
            }));
            
            transferIndex = transfers.length - 1;
        }
        
        // Execute transfer if unlock time has been reached
        AssetTransfer storage transfer = transfers[transferIndex];
        require(!transfer.transferred, "Asset already transferred");
        require(block.timestamp >= transfer.unlockTime, "Unlock time not reached");
        
        // Transfer the asset
        try registry.transferFrom(_owner, _beneficiary, _assetId) {
            transfer.transferred = true;
            emit AssetTransferred(_owner, _beneficiary, _assetRegistry, _assetId);
        } catch {
            // If transfer fails, try safeTransferFrom
            try registry.safeTransferFrom(_owner, _beneficiary, _assetId) {
                transfer.transferred = true;
                emit AssetTransferred(_owner, _beneficiary, _assetRegistry, _assetId);
            } catch Error(string memory reason) {
                revert(string(abi.encodePacked("Transfer failed: ", reason)));
            }
        }
    }

    /**
     * @notice Dispute an inheritance process
     * @param _owner Address of the deceased owner
     * @param _reason Reason for the dispute
     */
    function disputeInheritance(address _owner, string calldata _reason) external whenNotPaused {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.InCooldown || 
                plan.status == InheritanceStatus.InProcess, 
                "Inheritance not in cooldown or process");
        
        // Check if the disputer is a guardian, admin, or executor
        require(hasRole(GUARDIAN_ROLE, msg.sender) || 
                hasRole(ADMIN_ROLE, msg.sender) || 
                hasRole(EXECUTOR_ROLE, msg.sender), 
                "Not authorized to dispute");
        
        // For guardians, check if they are valid for this plan
        if (hasRole(GUARDIAN_ROLE, msg.sender) && !hasRole(ADMIN_ROLE, msg.sender) && !hasRole(EXECUTOR_ROLE, msg.sender)) {
            bool isValidGuardian = false;
            for (uint i = 0; i < plan.guardians.length; i++) {
                if (plan.guardians[i] == msg.sender) {
                    isValidGuardian = true;
                    break;
                }
            }
            require(isValidGuardian, "Not a valid guardian for this plan");
        }
        
        // Set status to disputed
        plan.status = InheritanceStatus.Disputed;
        
        emit InheritanceDisputed(_owner, msg.sender, _reason);
    }

    /**
     * @notice Cancel an inheritance process
     * @param _owner Address of the deceased owner
     */
    function cancelInheritance(address _owner) external whenNotPaused onlyRole(ADMIN_ROLE) {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.InCooldown || 
                plan.status == InheritanceStatus.InProcess || 
                plan.status == InheritanceStatus.Disputed, 
                "Inheritance not in valid state for cancellation");
        
        // Set status to cancelled
        plan.status = InheritanceStatus.Cancelled;
        
        emit InheritanceCancelled(_owner, msg.sender);
    }

    /**
     * @notice Reactivate a cancelled or disputed inheritance plan
     * @param _owner Address of the plan owner
     */
    function reactivateInheritancePlan(address _owner) external whenNotPaused onlyRole(ADMIN_ROLE) {
        InheritancePlan storage plan = inheritancePlans[_owner];
        require(plan.status == InheritanceStatus.Cancelled || 
                plan.status == InheritanceStatus.Disputed, 
                "Plan not in cancelled or disputed state");
        
        // Set status back to configured
        plan.status = InheritanceStatus.Configured;
    }

    /**
     * @notice Get all beneficiaries for an owner
     * @param _owner Address of the owner
     * @return array of beneficiary addresses
     */
    function getBeneficiaries(address _owner) public view returns (address[] memory) {
        address[] memory allBeneficiaries = beneficiaryList[_owner];
        
        // Count active beneficiaries
        uint256 activeCount = 0;
        for (uint i = 0; i < allBeneficiaries.length; i++) {
            if (beneficiaries[_owner][allBeneficiaries[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active beneficiaries
        address[] memory activeBeneficiaries = new address[](activeCount);
        uint256 index = 0;
        
        for (uint i = 0; i < allBeneficiaries.length; i++) {
            if (beneficiaries[_owner][allBeneficiaries[i]].isActive) {
                activeBeneficiaries[index] = allBeneficiaries[i];
                index++;
            }
        }
        
        return activeBeneficiaries;
    }

    /**
     * @notice Get beneficiary details
     * @param _owner Address of the owner
     * @param _beneficiary Address of the beneficiary
     * @return beneficiaryAddress, accessCondition, delayPeriod, isActive
     */
    function getBeneficiaryDetails(address _owner, address _beneficiary) external view returns (
        address beneficiaryAddress,
        AccessCondition accessCondition,
        uint256 delayPeriod,
        bool isActive
    ) {
        Beneficiary storage beneficiary = beneficiaries[_owner][_beneficiary];
        return (
            beneficiary.beneficiaryAddress,
            beneficiary.accessCondition,
            beneficiary.delayPeriod,
            beneficiary.isActive
        );
    }

    /**
     * @notice Get inheritance plan status
     * @param _owner Address of the owner
     * @return status of the inheritance plan
     */
    function getInheritancePlanStatus(address _owner) external view returns (InheritanceStatus) {
        return inheritancePlans[_owner].status;
    }

    /**
     * @notice Get inheritance plan details
     * @param _owner Address of the owner
     * @return creationTime, lastUpdateTime, cooldownPeriod, guardians, requiredApprovals, approvalCount, status
     */
    function getInheritancePlanDetails(address _owner) external view returns (
        uint256 creationTime,
        uint256 lastUpdateTime,
        uint256 cooldownPeriod,
        address[] memory guardians,
        uint256 requiredApprovals,
        uint256 approvalCount,
        InheritanceStatus status,
        string memory metadataURI
    ) {
        InheritancePlan storage plan = inheritancePlans[_owner];
        return (
            plan.creationTime,
            plan.lastUpdateTime,
            plan.cooldownPeriod,
            plan.guardians,
            plan.requiredGuardianApprovals,
            plan.approvalCount,
            plan.status,
            plan.metadataURI
        );
    }

    /**
     * @notice Check if guardian has approved inheritance
     * @param _owner Address of the owner
     * @param _guardian Address of the guardian
     * @return true if approved
     */
    function hasGuardianApproved(address _owner, address _guardian) external view returns (bool) {
        return inheritancePlans[_owner].guardianApprovals[_guardian];
    }
}
