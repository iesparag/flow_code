import 'dotenv/config';
import { Worker, QueueEvents } from 'bullmq';
import { env } from '../config/env.js';
import mongoose from 'mongoose';
import { processRecipient } from '../processors/processRecipient.js';
import { QUEUE_NAME, connection } from '../queues/automation.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);

  const worker = new Worker(QUEUE_NAME, processRecipient as any, {
    connection,
  });

  const events = new QueueEvents(QUEUE_NAME, { connection });
  events.on('completed', ({ jobId }) => {
    console.log(`[worker] job ${jobId} completed`);
  });
  events.on('failed', ({ jobId, failedReason }) => {
    console.error(`[worker] job ${jobId} failed: ${failedReason}`);
  });

  worker.on('error', (err) => console.error('[worker] error', err));

  console.log('[worker] started.');
}

main().catch((e) => {
  console.error('[worker] fatal', e);
  process.exit(1);
});
