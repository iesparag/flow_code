import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createServer } from './server.js';
import { socketService } from './services/socket.service.js';
import { serverLogger, dbLogger } from './utils/logger.js';

async function main() {
  try {
    serverLogger.info('🚀 Starting Flow Project Backend Server...');
    serverLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    serverLogger.info(`Port: ${env.PORT}`);
    serverLogger.info(`MongoDB URI: ${env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials
    
    // Connect to MongoDB with logging
    dbLogger.info('📊 Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    dbLogger.info('✅ Successfully connected to MongoDB');

    // Create and configure server
    serverLogger.info('🔧 Creating HTTP server...');
    const { app, httpServer } = createServer();
    serverLogger.info('✅ HTTP server created successfully');

    // Initialize Socket.IO
    serverLogger.info('🔌 Initializing Socket.IO service...');
    socketService.init(httpServer);
    serverLogger.info('✅ Socket.IO service initialized');

    // Start listening
    serverLogger.info(`🎧 Starting server on port ${env.PORT}...`);
    httpServer.listen(env.PORT, () => {
      serverLogger.info(`🎉 API server is running on http://localhost:${env.PORT}`);
      serverLogger.info('📋 Available endpoints:');
      serverLogger.info('  - GET  /api/health - Health check');
      serverLogger.info('  - POST /api/audiences - Create audience');
      serverLogger.info('  - POST /api/campaigns - Create campaign');
      serverLogger.info('  - POST /api/campaigns/:id/start - Start campaign');
      serverLogger.info('  - GET  /api/campaigns/:id - Get campaign details');
      serverLogger.info('🔥 Server ready to handle requests!');
    });
  } catch (err) {
    serverLogger.error(err, '❌ Failed to start server');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  serverLogger.info('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  serverLogger.info('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

main();
