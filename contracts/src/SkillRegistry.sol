// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SkillRegistry
 * @notice monAlpha — AI Research Marketplace for Monad
 * @dev Manages SKILL.md model registration, usage payments, and revenue distribution.
 *
 *  Registration fee: 10 MON → 50% owner, 50% foundation (buyback)
 *  Usage fee: creator-set price → 50% creator, 50% foundation (buyback)
 */
contract SkillRegistry {
    // ──────────────────── Types ────────────────────

    struct Skill {
        uint256 id;
        address creator;
        string name;
        string ipfsHash;        // SKILL.md content hash
        uint256 pricePerUse;    // in wei
        uint256 usageCount;
        uint256 totalRevenue;
        bool active;
        uint256 createdAt;
    }

    // ──────────────────── State ────────────────────

    address public owner;
    address public foundation;

    uint256 public registrationFee;     // default 10 MON
    uint256 public skillCount;
    bool public paused;

    mapping(uint256 => Skill) public skills;
    mapping(address => uint256[]) public creatorSkills;

    // Track usage per user per skill (for potential rate-limiting / stats)
    mapping(address => mapping(uint256 => uint256)) public userUsageCount;

    // ──────────────────── Events ────────────────────

    event SkillRegistered(
        uint256 indexed skillId,
        address indexed creator,
        string name,
        string ipfsHash,
        uint256 pricePerUse
    );

    event SkillUsed(
        uint256 indexed skillId,
        address indexed user,
        address indexed creator,
        uint256 amount
    );

    event SkillUpdated(uint256 indexed skillId, uint256 newPrice, string newIpfsHash);
    event SkillDeactivated(uint256 indexed skillId);
    event SkillReactivated(uint256 indexed skillId);
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
    event FoundationUpdated(address indexed oldFoundation, address indexed newFoundation);
    event Paused(bool isPaused);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ──────────────────── Modifiers ────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    // ──────────────────── Constructor ────────────────────

    constructor(address _owner, address _foundation, uint256 _registrationFee) {
        require(_owner != address(0), "Invalid owner");
        require(_foundation != address(0), "Invalid foundation");

        owner = _owner;
        foundation = _foundation;
        registrationFee = _registrationFee;
    }

    // ──────────────────── Registration ────────────────────

    /**
     * @notice Register a new SKILL.md model
     * @param _name Model display name
     * @param _ipfsHash IPFS hash of the SKILL.md file
     * @param _pricePerUse Price per analysis in wei (set by creator)
     */
    function registerSkill(
        string calldata _name,
        string calldata _ipfsHash,
        uint256 _pricePerUse
    ) external payable whenNotPaused {
        require(msg.value == registrationFee, "Wrong registration fee");
        require(bytes(_name).length > 0, "Empty name");
        require(bytes(_ipfsHash).length > 0, "Empty IPFS hash");

        uint256 id = skillCount;
        skillCount++;

        skills[id] = Skill({
            id: id,
            creator: msg.sender,
            name: _name,
            ipfsHash: _ipfsHash,
            pricePerUse: _pricePerUse,
            usageCount: 0,
            totalRevenue: 0,
            active: true,
            createdAt: block.timestamp
        });

        creatorSkills[msg.sender].push(id);

        // Split registration fee: 50% owner, 50% foundation
        uint256 ownerCut = msg.value / 2;
        uint256 foundationCut = msg.value - ownerCut;

        (bool s1,) = payable(owner).call{value: ownerCut}("");
        require(s1, "Owner transfer failed");

        (bool s2,) = payable(foundation).call{value: foundationCut}("");
        require(s2, "Foundation transfer failed");

        emit SkillRegistered(id, msg.sender, _name, _ipfsHash, _pricePerUse);
    }

    // ──────────────────── Usage ────────────────────

    /**
     * @notice Pay to use a model for analysis
     * @param _skillId The skill to use
     */
    function useSkill(uint256 _skillId) external payable whenNotPaused {
        Skill storage skill = skills[_skillId];
        require(skill.active, "Skill not active");
        require(msg.value == skill.pricePerUse, "Wrong payment amount");

        skill.usageCount++;
        skill.totalRevenue += msg.value;
        userUsageCount[msg.sender][_skillId]++;

        if (msg.value > 0) {
            // Split usage fee: 50% creator, 50% foundation
            uint256 creatorCut = msg.value / 2;
            uint256 foundationCut = msg.value - creatorCut;

            (bool s1,) = payable(skill.creator).call{value: creatorCut}("");
            require(s1, "Creator transfer failed");

            (bool s2,) = payable(foundation).call{value: foundationCut}("");
            require(s2, "Foundation transfer failed");
        }

        emit SkillUsed(_skillId, msg.sender, skill.creator, msg.value);
    }

    // ──────────────────── Creator Management ────────────────────

    /**
     * @notice Update skill price and/or IPFS hash (creator only)
     */
    function updateSkill(
        uint256 _skillId,
        uint256 _newPrice,
        string calldata _newIpfsHash
    ) external {
        Skill storage skill = skills[_skillId];
        require(msg.sender == skill.creator, "Not skill creator");

        if (_newPrice != skill.pricePerUse) {
            skill.pricePerUse = _newPrice;
        }
        if (bytes(_newIpfsHash).length > 0) {
            skill.ipfsHash = _newIpfsHash;
        }

        emit SkillUpdated(_skillId, skill.pricePerUse, skill.ipfsHash);
    }

    /**
     * @notice Deactivate a skill (creator or owner)
     */
    function deactivateSkill(uint256 _skillId) external {
        Skill storage skill = skills[_skillId];
        require(
            msg.sender == skill.creator || msg.sender == owner,
            "Not authorized"
        );
        skill.active = false;
        emit SkillDeactivated(_skillId);
    }

    /**
     * @notice Reactivate a skill (creator only)
     */
    function reactivateSkill(uint256 _skillId) external {
        Skill storage skill = skills[_skillId];
        require(msg.sender == skill.creator, "Not skill creator");
        skill.active = true;
        emit SkillReactivated(_skillId);
    }

    // ──────────────────── View Functions ────────────────────

    function getSkill(uint256 _skillId) external view returns (Skill memory) {
        return skills[_skillId];
    }

    function getCreatorSkillIds(address _creator) external view returns (uint256[] memory) {
        return creatorSkills[_creator];
    }

    function getSkillsByCreator(address _creator) external view returns (Skill[] memory) {
        uint256[] memory ids = creatorSkills[_creator];
        Skill[] memory result = new Skill[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = skills[ids[i]];
        }
        return result;
    }

    // ──────────────────── Owner Admin ────────────────────

    function setRegistrationFee(uint256 _newFee) external onlyOwner {
        emit RegistrationFeeUpdated(registrationFee, _newFee);
        registrationFee = _newFee;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setFoundation(address _newFoundation) external onlyOwner {
        require(_newFoundation != address(0), "Invalid address");
        emit FoundationUpdated(foundation, _newFoundation);
        foundation = _newFoundation;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit OwnerTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @notice Emergency withdraw stuck funds (e.g. from failed transfers)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance");
        (bool success,) = payable(owner).call{value: bal}("");
        require(success, "Withdraw failed");
        emit EmergencyWithdraw(owner, bal);
    }

    // Allow contract to receive MON
    receive() external payable {}
}
