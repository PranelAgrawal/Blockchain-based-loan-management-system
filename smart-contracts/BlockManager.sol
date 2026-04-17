// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BlockManager {
    struct Transaction {
        uint256 txId;
        address user;
        string txType; // "LoanRequest", "LoanApproval", "LoanRepayment", "LoanDefaulted"
        uint256 amount;
        uint256 timestamp;
        string description;
    }
    
    struct Block {
        uint256 blockNumber;
        bytes32 txMerkleRoot; // Hash representing all transactions
        bytes32 previousHash;
        bytes32 blockHash;
        uint256 timestamp;
        uint256 txCount;
    }

    Block[] public blocks;
    uint256 public blockCounter = 0;
    uint256 public txCounter = 0;
    uint256 public constant TXS_PER_BLOCK = 10; // Max transactions per block

    mapping(uint256 => Transaction[]) public pendingTransactions;
    uint256 public pendingTxCount = 0;

    event TransactionAdded(uint256 txId, address user, string txType, uint256 amount);
    event BlockCreated(uint256 blockNumber, bytes32 blockHash, uint256 txCount);

    /**
     * @dev Add transaction to pending pool
     */
    function addTransaction(
        address user,
        string memory txType,
        uint256 amount,
        string memory description
    ) external {
        uint256 newTxId = txCounter++;

        Transaction memory loanTransaction = Transaction({
            txId: newTxId,
            user: user,
            txType: txType,
            amount: amount,
            timestamp: block.timestamp,
            description: description
        });

        pendingTransactions[pendingTxCount].push(loanTransaction);

        emit TransactionAdded(newTxId, user, txType, amount);

        // Auto-create block when we reach TXS_PER_BLOCK
        if (pendingTransactions[pendingTxCount].length >= TXS_PER_BLOCK) {
            createBlock();
        }
    }

    /**
     * @dev Create a new block from pending transactions
     */
    function createBlock() public {
        require(pendingTransactions[pendingTxCount].length > 0, "BlockManager: No pending transactions");

        bytes32 previousHash = blockCounter == 0 ? bytes32(0) : blocks[blockCounter - 1].blockHash;

        // Calculate Merkle root from transactions
        bytes32 txMerkleRoot = calculateMerkleRoot(pendingTransactions[pendingTxCount]);

        // Calculate block hash from transactions + previous hash
        bytes32 blockHash = calculateBlockHash(
            blockCounter,
            txMerkleRoot,
            previousHash
        );

        Block memory newBlock = Block({
            blockNumber: blockCounter,
            txMerkleRoot: txMerkleRoot,
            previousHash: previousHash,
            blockHash: blockHash,
            timestamp: block.timestamp,
            txCount: pendingTransactions[pendingTxCount].length
        });

        blocks.push(newBlock);

        emit BlockCreated(blockCounter, blockHash, pendingTransactions[pendingTxCount].length);

        // Clear pending transactions
        pendingTxCount++;
        blockCounter++;
    }

    /**
     * @dev Calculate Merkle root of transactions
     */
    function calculateMerkleRoot(Transaction[] storage txs) internal view returns (bytes32) {
        require(txs.length > 0, "BlockManager: No transactions");
        
        bytes memory txData;
        for (uint256 i = 0; i < txs.length; i++) {
            txData = abi.encodePacked(
                txData,
                txs[i].user,
                txs[i].amount,
                txs[i].timestamp,
                bytes32(abi.encodePacked(txs[i].txType))
            );
        }
        
        return keccak256(txData);
    }

    /**
     * @dev Calculate block hash
     */
    function calculateBlockHash(
        uint256 blockNum,
        bytes32 txMerkleRoot,
        bytes32 prevHash
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(blockNum, txMerkleRoot, prevHash, block.timestamp));
    }

    /**
     * @dev Get block details
     */
    function getBlock(uint256 blockNum) external view returns (
        uint256 _blockNumber,
        bytes32 _previousHash,
        bytes32 _blockHash,
        uint256 _timestamp,
        uint256 _txCount
    ) {
        require(blockNum < blockCounter, "BlockManager: Block does not exist");
        Block storage block_ = blocks[blockNum];
        return (
            block_.blockNumber,
            block_.previousHash,
            block_.blockHash,
            block_.timestamp,
            block_.txCount
        );
    }

    /**
     * @dev Get transactions in a block
     */
    function getBlockTransactions(uint256 blockNum, uint256 startIdx, uint256 endIdx)
        external
        view
        returns (Transaction[] memory)
    {
        require(blockNum < blockCounter, "BlockManager: Block does not exist");
        require(endIdx <= pendingTransactions[blockNum].length, "BlockManager: Invalid index");
        require(startIdx <= endIdx, "BlockManager: Invalid range");

        uint256 length = endIdx - startIdx;
        Transaction[] memory result = new Transaction[](length);

        for (uint256 i = 0; i < length; i++) {
            result[i] = pendingTransactions[blockNum][startIdx + i];
        }

        return result;
    }

    /**
     * @dev Get pending transactions
     */
    function getPendingTransactions() external view returns (uint256 count) {
        return pendingTransactions[pendingTxCount].length;
    }

    /**
     * @dev Get total blocks
     */
    function getTotalBlocks() external view returns (uint256) {
        return blockCounter;
    }

    /**
     * @dev Verify block chain integrity
     */
    function verifyBlockchain() external view returns (bool) {
        if (blockCounter == 0) return true;

        for (uint256 i = 1; i < blockCounter; i++) {
            if (blocks[i].previousHash != blocks[i - 1].blockHash) {
                return false;
            }
        }
        return true;
    }
}
