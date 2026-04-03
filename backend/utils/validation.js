/**
 * Validation Utilities
 * Reusable validation helpers for API requests
 */

/**
 * Validates Ethereum address format
 * @param {string} address
 * @returns {boolean}
 */
const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Validates email format
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  return /^\S+@\S+\.\S+$/.test(email);
};

module.exports = {
  isValidAddress,
  isValidEmail,
};
