// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreditScore
 * @dev Stores and manages user credit scores on the blockchain (range: 300-850)
 */
contract CreditScore is Ownable {
    // Mapping of user address to credit score
    mapping(address => uint256) public creditScores;

    // Minimum valid credit score
    uint256 public constant MIN_SCORE = 300;

    // Maximum valid credit score
    uint256 public constant MAX_SCORE = 850;

    // Event emitted when a credit score is updated
    event ScoreUpdated(address indexed user, uint256 score);

    constructor() {}

    /**
     * @dev Updates the credit score for a user
     * @param user The address of the user
     * @param score The credit score (must be between 300 and 850)
     */
    function updateScore(address user, uint256 score) external onlyOwner {
        require(user != address(0), "CreditScore: Invalid user address");
        require(score >= MIN_SCORE && score <= MAX_SCORE, "CreditScore: Score must be between 300 and 850");
        creditScores[user] = score;
        emit ScoreUpdated(user, score);
    }

    /**
     * @dev Retrieves the credit score for a user
     * @param user The address to query
     * @return uint256 The user's credit score
     */
    function getScore(address user) external view returns (uint256) {
        return creditScores[user];
    }
}


