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

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
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
    origin: process.env.CORS_ORIGIN || '*',
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
