import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import IORedis from 'ioredis';
import { queueLogger } from '../utils/logger.js';

queueLogger.info('🔗 Initializing Redis connection...');
export const connection = new (IORedis as any)(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000); // Exponential backoff up to 3 seconds
    queueLogger.warn(`🔄 Redis retrying connection: attempt ${times}, delay ${delay}ms`);
    return delay;
  },
});

connection.on('connect', () => {
  queueLogger.info('✅ Redis connected successfully');
});

connection.on('error', (err: any) => {
  queueLogger.error(`❌ Redis connection error: ${err.message}`);
});

connection.on('ready', () => {
  queueLogger.info('🎉 Redis connection ready');
});

export type RecipientJobData = {
  campaignId: string;
  recipientEmail: string;
  nodeId: string;
};

export const QUEUE_NAME = 'automation-process-recipient';

queueLogger.info(`🏗️ Creating automation queue: ${QUEUE_NAME}`);
export const automationQueue = new Queue<RecipientJobData>(QUEUE_NAME, {
  connection,
});

queueLogger.info('✅ Automation queue created successfully');
