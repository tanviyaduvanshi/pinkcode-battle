const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb+srv://tanvithakur:tanvi@4028@wanderlust.byawpfb.mongodb.net/codebattle?retryWrites=true&w=majority");

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error connection to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;