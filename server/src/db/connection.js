// server/src/db/connection.js
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const RETRY_DELAY = 5000;
const MAX_RETRIES = 10;

export async function connectDB(retries = 0) {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/project-dropzone';
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnect...');
      setTimeout(() => connectDB(), RETRY_DELAY);
    });

    return mongoose.connection;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      logger.warn(`MongoDB connection failed. Retry ${retries + 1}/${MAX_RETRIES} in ${RETRY_DELAY}ms`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectDB(retries + 1);
    }
    throw error;
  }
}
