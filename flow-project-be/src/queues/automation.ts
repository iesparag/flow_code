import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import IORedis from 'ioredis';

export const connection = new (IORedis as any)(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000); // Exponential backoff up to 3 seconds
    console.log(`[Redis] Retrying connection: attempt ${times}, delay ${delay}ms`);
    return delay;
  },
});

export type RecipientJobData = {
  campaignId: string;
  recipientEmail: string;
  nodeId: string;
};

export const QUEUE_NAME = 'automation-process-recipient';

export const automationQueue = new Queue<RecipientJobData>(QUEUE_NAME, {
  connection,
});
