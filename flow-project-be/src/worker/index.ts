import 'dotenv/config';
import { Worker, QueueEvents } from 'bullmq';
import { env } from '../config/env.js';
import mongoose from 'mongoose';
import { processRecipient } from '../processors/processRecipient.js';
import { QUEUE_NAME, connection } from '../queues/automation.js';
import { workerLogger, dbLogger, queueLogger } from '../utils/logger.js';

async function main() {
  workerLogger.info('🔧 Starting automation worker...');
  workerLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  workerLogger.info(`Queue name: ${QUEUE_NAME}`);
  
  dbLogger.info('📊 Connecting to MongoDB from worker...');
  await mongoose.connect(env.MONGODB_URI);
  dbLogger.info('✅ Worker connected to MongoDB');

  workerLogger.info('👷 Creating BullMQ worker...');
  const worker = new Worker(QUEUE_NAME, processRecipient as any, {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  });
  workerLogger.info('✅ Worker created successfully');

  workerLogger.info('📡 Setting up queue event listeners...');
  const events = new QueueEvents(QUEUE_NAME, { connection });
  
  events.on('completed', ({ jobId, returnvalue }) => {
    queueLogger.info(`✅ Job ${jobId} completed successfully`);
    if (returnvalue) {
      queueLogger.info(`Return value: ${JSON.stringify(returnvalue)}`);
    }
  });
  
  events.on('failed', ({ jobId, failedReason }) => {
    queueLogger.error(`❌ Job ${jobId} failed: ${failedReason}`);
  });
  
  events.on('progress', ({ jobId, data }) => {
    queueLogger.info(`🔄 Job ${jobId} progress: ${JSON.stringify(data)}`);
  });

  worker.on('error', (err) => {
    workerLogger.error(`❌ Worker error: ${err.message}`);
    workerLogger.error(err);
  });
  
  worker.on('ready', () => {
    workerLogger.info('🎉 Worker is ready to process jobs');
  });
  
  worker.on('active', (job) => {
    workerLogger.info(`🔄 Processing job ${job.id} for recipient: ${job.data.recipientEmail}`);
  });

  workerLogger.info('🚀 Automation worker started successfully!');
  workerLogger.info('⏳ Waiting for jobs to process...');
}

main().catch((e) => {
  workerLogger.error('💀 Fatal worker error:', e);
  process.exit(1);
});
