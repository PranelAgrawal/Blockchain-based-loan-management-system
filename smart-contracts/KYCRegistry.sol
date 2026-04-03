// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KYCRegistry
 * @dev Stores and manages KYC verification status and document hashes for users on the blockchain
 */
contract KYCRegistry {
    // Mapping of user address to verification status
    mapping(address => bool) public verifiedUsers;

    // Mapping of user address to off-chain document hash (e.g., keccak256 of KYC documents)
    mapping(address => bytes32) public kycDocumentHashes;

    // Admin address with verification privileges
    address public admin;

    // Event emitted when a user is verified
    event UserVerified(address indexed user, bytes32 documentHash);

    // Modifier to restrict functions to admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "KYCRegistry: Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Verifies a user's KYC status and stores a document hash for off-chain verification
     * @param user The address of the user to verify
     * @param documentHash The hash of the user's KYC documents (stored instead of raw data)
     */
    function verifyUser(address user, bytes32 documentHash) external onlyAdmin {
        require(user != address(0), "KYCRegistry: Invalid user address");
        verifiedUsers[user] = true;
        kycDocumentHashes[user] = documentHash;
        emit UserVerified(user, documentHash);
    }

    /**
     * @dev Checks if a user is KYC verified
     * @param user The address to check
     * @return bool True if user is verified
     */
    function isVerified(address user) external view returns (bool) {
        return verifiedUsers[user];
    }
}
