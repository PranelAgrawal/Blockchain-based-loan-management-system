// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CreditScore is Ownable {
    mapping(address => uint256) public creditScores;

    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;

    address public loanManager;

    event ScoreUpdated(address indexed user, uint256 score);

    constructor() {}

    function setLoanManager(address _loanManager) external onlyOwner {
        require(_loanManager != address(0), "CreditScore: Invalid loan manager address");
        loanManager = _loanManager;
    }

    function updateScore(address user, uint256 score) external onlyOwner {
        require(user != address(0), "CreditScore: Invalid user address");
        require(score >= MIN_SCORE && score <= MAX_SCORE, "CreditScore: Score must be between 300 and 850");
        creditScores[user] = score;
        emit ScoreUpdated(user, score);
    }

    function getScore(address user) external view returns (uint256) {
        return creditScores[user];
    }

    function decreaseScore(address user, uint256 penalty) external {
        require(msg.sender == loanManager, "CreditScore: Only LoanManager can decrease score");
        require(user != address(0), "CreditScore: Invalid user address");
        uint256 currentScore = creditScores[user];
        uint256 newScore = currentScore > penalty ? currentScore - penalty : MIN_SCORE;
        creditScores[user] = newScore;
        emit ScoreUpdated(user, newScore);
    }

    function increaseScore(address user, uint256 reward) external {
        require(msg.sender == loanManager, "CreditScore: Only LoanManager can increase score");
        require(user != address(0), "CreditScore: Invalid user address");
        uint256 currentScore = creditScores[user];
        uint256 newScore = currentScore + reward;
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }
        creditScores[user] = newScore;
        emit ScoreUpdated(user, newScore);
    }
}

