import 'dotenv/config';
import mongoose from 'mongoose';
import pino from 'pino';
import { env } from './config/env.js';
import { createServer } from './server.js';
import { socketService } from './services/socket.service.js';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function main() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const { app, httpServer } = createServer();

    // Initialize Socket.IO
    socketService.init(httpServer);

    httpServer.listen(env.PORT, () => {
      logger.info(`API running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main();
