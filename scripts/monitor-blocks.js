const { ethers } = require("hardhat");
const { getContracts, shortAddress } = require("./lib/workflow-utils");

function shortHash(hash) {
  return `${hash.slice(0, 18)}...${hash.slice(-8)}`;
}

function formatBlockTime(timestamp) {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

async function printFullBlock(blockManager, blockNumber) {
  const blockData = await blockManager.getBlock(blockNumber);
  const txs = await blockManager.getBlockTransactions(
    blockNumber,
    0,
    blockData._txCount
  );

  console.log("");
  console.log("============================================================");
  console.log(`LOAN BLOCK #${blockData._blockNumber}`);
  console.log("------------------------------------------------------------");
  console.log(`Block Hash:     ${blockData._blockHash}`);
  console.log(`Previous Hash:  ${blockData._previousHash}`);
  console.log(`Timestamp:      ${formatBlockTime(blockData._timestamp)}`);
  console.log(`TransactionCount: ${blockData._txCount}`);
  console.log("------------------------------------------------------------");
  console.log("Transactions:");

  for (const tx of txs) {
    console.log(
      `  txId=${tx.txId} | type=${tx.txType} | user=${shortAddress(tx.user)} | amount=${ethers.formatEther(tx.amount)} ETH`
    );
    console.log(
      `    timestamp=${formatBlockTime(tx.timestamp)} | description=${tx.description}`
    );
  }

  console.log("============================================================");
  console.log("");
}

async function main() {
  const [monitor] = await ethers.getSigners();
  const { blockManager } = await getContracts(monitor);

  console.log("Live loan block monitor started.");
  console.log(`BlockManager: ${await blockManager.getAddress()}`);
  console.log("Waiting for LoanRequest, LoanApproval, LoanRepayment, and BlockCreated events...");

  blockManager.on("TransactionAdded", (txId, user, txType, amount, event) => {
    console.log(
      `[loan-chain tx #${txId}] ${txType} user=${shortAddress(user)} amount=${ethers.formatEther(amount)} ETH hardhatTx=${event.log.transactionHash}`
    );
  });

  blockManager.on("BlockCreated", (blockNumber, blockHash, txCount, event) => {
    console.log(
      `[BLOCK CREATED #${blockNumber}] hash=${shortHash(blockHash)} txs=${txCount} hardhatTx=${event.log.transactionHash}`
    );
    printFullBlock(blockManager, blockNumber).catch((error) => {
      console.error(`Failed to load block ${blockNumber}:`, error.message || error);
    });
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
