/**
 * Database Configuration
 * MongoDB connection setup
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blockchain-loan';
    
    if (!mongoURI.includes('blockchainLoan') && process.env.NODE_ENV !== 'test') {
      console.warn('⚠️  Warning: MONGODB_URI does not explicitly include "blockchainLoan". It may default to "test".');
    }

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`\n✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
