// server/src/index.js
import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { connectDB } from './db/connection.js';
import { logger } from './utils/logger.js';
import { setupRoutes } from './routes/index.js';
import { SocketManager } from './network/SocketManager.js';
import { MatchManager } from './game/MatchManager.js';

const app = express();
const httpServer = createServer(app);

// Dynamic CORS configuration function
const corsOptions = {
  origin: function (origin, callback) {
    // 1. Allow requests with no origin (like mobile apps, postman, curl, or internal server-to-server calls)
    if (!origin) return callback(null, true);

    const configuredOrigin = process.env.CORS_ORIGIN;

    // 2. Allow if it matches the configured environment variable,
    //    or any Vercel domain, or local development ports
    if (
      (configuredOrigin && origin === configuredOrigin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }

    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
};

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors(corsOptions)); // Apply dynamic CORS options here
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Socket.IO setup
const io = new SocketServer(httpServer, {
  cors: {
    origin: corsOptions.origin, // Use the same dynamic origin function
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 10000,
  pingInterval: 5000,
  maxHttpBufferSize: 1e6,
});

// API routes
setupRoutes(app);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    matchCount: MatchManager.getActiveMatchCount(),
    playerCount: MatchManager.getTotalPlayerCount(),
  });
});

// Serve static client files in production
if (process.env.NODE_ENV === 'production') {
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = join(fileURLToPath(import.meta.url), '../..');
  app.use(express.static(join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

// Initialize Socket manager (handles all socket events)
const socketManager = new SocketManager(io);

// Start everything
async function bootstrap() {
  try {
    await connectDB();
    logger.info('✅ MongoDB connected');

    const PORT = parseInt(process.env.PORT) || 3000;
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Project Dropzone server running on port ${PORT}`);
      logger.info(`📡 Socket.IO ready`);
      logger.info(`🎮 Tick rate: ${process.env.TICK_RATE || 20} Hz`);
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  MatchManager.shutdown();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

bootstrap();
