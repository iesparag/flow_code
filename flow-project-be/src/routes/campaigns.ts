import { Router, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { CampaignModel } from '../models/Campaign.js';
import { AudienceModel } from '../models/Audience.js';
import { AutomationFlowModel } from '../models/AutomationFlow.js';
import { RecipientStateModel } from '../models/RecipientState.js';
import { EmailEventModel } from '../models/EmailEvent.js';
import { socketService } from '../services/socket.service.js';
import { automationQueue } from '../queues/automation.js';
import { HttpError } from '../utils/http.js';
import { campaignLogger, flowLogger, queueLogger } from '../utils/logger.js';

export const campaignsRouter = Router();

const CreateCampaignSchema = z.object({
  name: z.string(),
  flowId: z.string(),
  flowVersion: z.number().optional(),
  audienceId: z.string(),
  sender: z.object({
    fromEmail: z.string().email(),
    replyTo: z.string().email().optional(),
  }),
  templateOverrides: z.record(z.string(), z.string()).optional(),
});

// Update a campaign
const UpdateCampaignSchema = CreateCampaignSchema.partial();

campaignsRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  campaignLogger.info('🚀 Creating new campaign...');
  campaignLogger.info(`Request data: ${JSON.stringify(req.body, null, 2)}`);
  
  const data = CreateCampaignSchema.parse(req.body);
  campaignLogger.info(`✅ Campaign validation passed: ${data.name}`);
  
  campaignLogger.info(`🔍 Looking up flow with ID: ${data.flowId}`);
  const flow = await AutomationFlowModel.findById(data.flowId);
  if (!flow) {
    campaignLogger.error(`❌ AutomationFlow not found with ID: ${data.flowId}`);
    throw new HttpError(404, 'AutomationFlow not found');
  }
  campaignLogger.info(`✅ Flow found: ${flow.name} (version ${flow.version})`);
  
  campaignLogger.info(`🔍 Looking up audience with ID: ${data.audienceId}`);
  const audience = await AudienceModel.findById(data.audienceId);
  if (!audience) {
    campaignLogger.error(`❌ Audience not found with ID: ${data.audienceId}`);
    throw new HttpError(404, 'Audience not found');
  }
  campaignLogger.info(`✅ Audience found: ${audience.name} (${audience.recipients.length} recipients)`);

  const campaignData = {
    name: data.name,
    flowId: flow._id,
    flowVersion: data.flowVersion ?? flow.version,
    audienceId: audience._id,
    status: 'draft' as const,
    sender: data.sender,
    templateOverrides: data.templateOverrides,
    stats: { 
      total: audience.recipients.length, 
      sent: 0, 
      replied: 0, 
      errors: 0,
      delivered: 0,
      opened: 0,
      bounced: 0,
      openRate: 0,
      responseRate: 0
    },
  };
  
  campaignLogger.info(`💾 Creating campaign in database...`);
  const doc = await CampaignModel.create(campaignData);
  campaignLogger.info(`🎉 Campaign created successfully with ID: ${doc._id}`);
  campaignLogger.info(`📊 Campaign stats initialized - Total recipients: ${doc.stats?.total}`);
  
  res.status(201).json(doc);
}));

// Start a campaign: create RecipientState docs and enqueue first jobs
campaignsRouter.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  campaignLogger.info(`🎬 Starting campaign with ID: ${req.params.id}`);
  
  const camp = await CampaignModel.findById(req.params.id);
  if (!camp) {
    campaignLogger.error(`❌ Campaign not found with ID: ${req.params.id}`);
    throw new HttpError(404, 'Campaign not found');
  }
  
  campaignLogger.info(`📋 Campaign found: ${camp.name} (Status: ${camp.status})`);
  
  if (camp.status === 'running') {
    campaignLogger.warn(`⚠️ Campaign ${camp.name} is already running`);
    res.json(camp);
    return;
  }

  flowLogger.info(`🔍 Looking up flow: ${camp.flowId} (version ${camp.flowVersion})`);
  const flow = await AutomationFlowModel.findOne({ _id: camp.flowId, version: camp.flowVersion }).lean();
  if (!flow) {
    flowLogger.error(`❌ AutomationFlow not found: ${camp.flowId} version ${camp.flowVersion}`);
    throw new HttpError(404, 'AutomationFlow (version) not found');
  }
  flowLogger.info(`✅ Flow found: ${flow.name} (Start node: ${flow.startNodeId})`);

  campaignLogger.info(`👥 Looking up audience: ${camp.audienceId}`);
  const audience = await AudienceModel.findById(camp.audienceId).lean();
  if (!audience) {
    campaignLogger.error(`❌ Audience not found: ${camp.audienceId}`);
    throw new HttpError(404, 'Audience not found');
  }
  campaignLogger.info(`✅ Audience found: ${audience.name} (${audience.recipients.length} recipients)`);

  // Upsert recipient states
  campaignLogger.info(`📝 Creating recipient states for ${audience.recipients.length} recipients...`);
  let recipientCount = 0;
  
  for (const r of audience.recipients) {
    recipientCount++;
    campaignLogger.info(`📧 Processing recipient ${recipientCount}/${audience.recipients.length}: ${r.email}`);
    
    await RecipientStateModel.updateOne(
      { campaignId: camp._id, recipientEmail: r.email },
      {
        $setOnInsert: {
          campaignId: camp._id,
          recipientEmail: r.email,
          currentNodeId: flow.startNodeId,
          replyDetected: false,
          history: [],
        },
      },
      { upsert: true }
    );
    
    queueLogger.info(`⏰ Queuing job for ${r.email} at node ${flow.startNodeId}`);
    await automationQueue.add(
      'process',
      { campaignId: camp._id.toString(), recipientEmail: r.email, nodeId: flow.startNodeId },
      { delay: 0, removeOnComplete: 1000, removeOnFail: 1000 }
    );
  }

  campaignLogger.info(`✅ All ${audience.recipients.length} recipients processed and queued`);
  
  camp.status = 'running';
  camp.startedAt = new Date();
  await camp.save();
  
  campaignLogger.info(`🚀 Campaign ${camp.name} started successfully at ${camp.startedAt}`);
  campaignLogger.info(`📊 Campaign will process ${audience.recipients.length} recipients through flow ${flow.name}`);
  
  res.json(camp);
}));

// Stop a campaign (pause)
campaignsRouter.post('/:id/stop', asyncHandler(async (req: Request, res: Response) => {
  const camp = await CampaignModel.findById(req.params.id);
  if (!camp) throw new HttpError(404, 'Campaign not found');
  camp.status = 'paused';
  await camp.save();
  res.json(camp);
}));

// Resume a paused campaign
campaignsRouter.post('/:id/resume', asyncHandler(async (req: Request, res: Response) => {
  const camp = await CampaignModel.findById(req.params.id);
  if (!camp) throw new HttpError(404, 'Campaign not found');
  camp.status = 'running';
  await camp.save();
  res.json(camp);
}));

// Delete a campaign
campaignsRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await CampaignModel.findByIdAndDelete(req.params.id);
  await RecipientStateModel.deleteMany({ campaignId: req.params.id });
  await EmailEventModel.deleteMany({ campaignId: req.params.id });
  res.status(204).end();
}));

// Recent email events for a campaign
campaignsRouter.get('/:id/events', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const items = await EmailEventModel.find({ campaignId: req.params.id }).sort({ createdAt: -1 }).limit(limit);
  res.json(items);
}));

campaignsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const camp = await CampaignModel.findById(req.params.id);
  if (!camp) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  
  // Ensure campaign has complete stats object
  if (camp.stats && (!camp.stats.delivered && camp.stats.delivered !== 0)) {
    camp.stats.delivered = 0;
    camp.stats.opened = 0;
    camp.stats.bounced = 0;
    camp.stats.openRate = 0;
    camp.stats.responseRate = 0;
  }
  
  // Populate recipients from RecipientState
  const recipientStates = await RecipientStateModel.find({ campaignId: camp._id });
  const recipients = recipientStates.map(state => {
    const sentEvent = state.history.find(h => h.event === 'sent');
    const repliedEvent = state.history.find(h => h.event === 'replied');
    
    // Check if email was opened by looking at EmailEvents
    const status = state.replyDetected ? 'replied' : 
                  sentEvent ? 'sent' : 'pending';
    
    return {
      email: state.recipientEmail,
      status,
      sentAt: sentEvent?.timestamp,
      deliveredAt: sentEvent?.timestamp, // For now, assume delivered when sent
      openedAt: null, // Will be populated by checking EmailEvents if needed
      repliedAt: repliedEvent?.timestamp,
      error: state.history.find(h => h.event === 'error')?.details?.error,
      messageId: state.lastMessageId
    };
  });
  
  res.json({ ...camp.toObject(), recipients });
}));

// Open tracking endpoint
campaignsRouter.get('/track/open/:campaignId/:recipientEmail', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, recipientEmail } = req.params;
  const decodedEmail = decodeURIComponent(recipientEmail);
  
  campaignLogger.info(`👁️ Open tracking hit: ${decodedEmail} for campaign ${campaignId}`);
  
  try {
    // Check if already opened to avoid duplicate counts
    const existingOpen = await EmailEventModel.findOne({
      campaignId,
      recipientEmail: decodedEmail,
      type: 'opened'
    });

    if (!existingOpen) {
      // Record open event
      await EmailEventModel.create({ 
        campaignId, 
        recipientEmail: decodedEmail, 
        type: 'opened' 
      });
      
      // Update campaign stats
      const updateResult = await CampaignModel.updateOne(
        { _id: campaignId }, 
        { 
          $inc: { 'stats.opened': 1 },
          $set: { 'stats.openRate': await calculateOpenRate(campaignId) }
        }
      );
      
      console.log(`[TRACKING] ✅ Email opened recorded: ${decodedEmail} for campaign ${campaignId}`);
      console.log(`[TRACKING] ✅ Stats updated. Modified count: ${updateResult.modifiedCount}`);

      // Notify clients of the update
      socketService.emit('campaign_updated', { campaignId });
    } else {
      console.log(`[TRACKING] ⚠️ Email already marked as opened: ${decodedEmail}`);
    }
  } catch (error) {
    console.error('[TRACKING] ❌ Error tracking email open:', error);
  }
  
  // Return 1x1 transparent pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(pixel);
}));

// Manual test endpoint to trigger open tracking
campaignsRouter.post('/test/open/:campaignId/:recipientEmail', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, recipientEmail } = req.params;
  const decodedEmail = decodeURIComponent(recipientEmail);
  
  console.log(`[TEST] 📧 Manually triggering open for ${decodedEmail} in campaign ${campaignId}`);
  
  try {
    // Record open event
    await EmailEventModel.create({ 
      campaignId, 
      recipientEmail: decodedEmail, 
      type: 'opened' 
    });
    
    // Update campaign stats
    const updateResult = await CampaignModel.updateOne(
      { _id: campaignId }, 
      { 
        $inc: { 'stats.opened': 1 },
        $set: { 'stats.openRate': await calculateOpenRate(campaignId) }
      }
    );
    
    console.log(`[TEST] ✅ Open manually triggered: ${decodedEmail} for campaign ${campaignId}`);
    
    // Notify clients of the update
    socketService.emit('campaign_updated', { campaignId });
    
    res.json({ success: true, message: 'Open triggered successfully', modifiedCount: updateResult.modifiedCount });
  } catch (error) {
    console.error('[TEST] ❌ Error triggering open:', error);
    res.status(500).json({ error: 'Failed to trigger open' });
  }
}));

// Manual reply trigger endpoint (for testing)
campaignsRouter.post('/test/reply/:campaignId/:recipientEmail', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, recipientEmail } = req.params;
  const decodedEmail = decodeURIComponent(recipientEmail);
  
  console.log(`[TEST] Manually triggering reply for ${decodedEmail} in campaign ${campaignId}`);
  
  try {
    // Update recipient state to mark reply detected
    await RecipientStateModel.updateOne(
      { campaignId, recipientEmail: decodedEmail },
      { 
        replyDetected: true,
        $push: { 
          history: { 
            nodeId: 'reply', 
            event: 'replied', 
            timestamp: new Date(),
            details: { source: 'manual_test' }
          }
        }
      }
    );
    
    // Record reply event
    await EmailEventModel.create({ 
      campaignId, 
      recipientEmail: decodedEmail, 
      type: 'replied' 
    });
    
    // Update campaign stats
    await CampaignModel.updateOne(
      { _id: campaignId }, 
      { 
        $inc: { 'stats.replied': 1 },
        $set: { 'stats.responseRate': await calculateResponseRate(campaignId) }
      }
    );
    
    console.log(`[TEST] Reply manually triggered: ${decodedEmail} for campaign ${campaignId}`);
    
    // Notify clients of the update
    socketService.emit('campaign_updated', { campaignId });
    
    res.json({ success: true, message: 'Reply triggered successfully' });
  } catch (error) {
    console.error('[TEST] Error triggering reply:', error);
    res.status(500).json({ error: 'Failed to trigger reply' });
  }
}));

// Reply tracking webhook endpoint (for manual testing or future webhook integration)
campaignsRouter.post('/track/reply/:campaignId/:recipientEmail', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, recipientEmail } = req.params;
  const decodedEmail = decodeURIComponent(recipientEmail);
  
  campaignLogger.info(`📧 Reply webhook triggered for ${decodedEmail} in campaign ${campaignId}`);
  
  try {
    // Update recipient state to mark reply detected
    const updateResult = await RecipientStateModel.updateOne(
      { campaignId, recipientEmail: decodedEmail },
      { 
        replyDetected: true,
        $push: { 
          history: { 
            nodeId: 'reply', 
            event: 'replied', 
            timestamp: new Date(),
            details: { source: 'webhook', body: req.body }
          }
        }
      }
    );
    
    campaignLogger.info(`✅ Recipient state updated for reply. Modified count: ${updateResult.modifiedCount}`);
    
    // Record reply event
    await EmailEventModel.create({ 
      campaignId, 
      recipientEmail: decodedEmail, 
      type: 'replied',
      payload: req.body
    });
    
    campaignLogger.info(`📊 Reply event recorded in database`);
    
    // Update campaign stats
    const statsUpdate = await CampaignModel.updateOne(
      { _id: campaignId }, 
      { 
        $inc: { 'stats.replied': 1 },
        $set: { 'stats.responseRate': await calculateResponseRate(campaignId) }
      }
    );
    
    campaignLogger.info(`📈 Campaign stats updated for reply. Modified count: ${statsUpdate.modifiedCount}`);
    campaignLogger.info(`🎉 Reply successfully processed: ${decodedEmail} for campaign ${campaignId}`);
    
    // Notify clients of the update
    socketService.emit('campaign_updated', { campaignId });
    
    res.json({ success: true, message: 'Reply tracked successfully' });
  } catch (error: any) {
    campaignLogger.error(`❌ Error tracking reply for ${decodedEmail}: ${error.message}`);
    res.status(500).json({ error: 'Failed to track reply' });
  }
}));

// Internal endpoint to trigger Socket.IO events (called from worker)
campaignsRouter.post('/internal/notify/:campaignId', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId } = req.params;
  
  campaignLogger.info(`🔔 Internal notification request for campaign ${campaignId}`);
  
  try {
    // Emit Socket.IO event
    socketService.emit('campaign_updated', { campaignId });
    campaignLogger.info(`✅ Socket.IO event emitted for campaign ${campaignId}`);
    
    res.json({ success: true, message: 'Notification sent' });
  } catch (error: any) {
    campaignLogger.error(`❌ Error sending notification: ${error.message}`);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}));

// Helper function to calculate open rate
async function calculateOpenRate(campaignId: string): Promise<number> {
  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign || !campaign.stats || !campaign.stats.sent) return 0;
  return (campaign.stats.opened || 0) / campaign.stats.sent;
}

// Helper function to calculate response rate
async function calculateResponseRate(campaignId: string): Promise<number> {
  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign || !campaign.stats || !campaign.stats.sent) return 0;
  return (campaign.stats.replied || 0) / campaign.stats.sent;
}

campaignsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  
  const total = await CampaignModel.countDocuments();
  const items = await CampaignModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
  
  // Ensure all campaigns have complete stats objects
  const updatedItems = items.map(item => {
    if (item.stats && (!item.stats.delivered && item.stats.delivered !== 0)) {
      item.stats.delivered = 0;
      item.stats.opened = 0;
      item.stats.bounced = 0;
      item.stats.openRate = 0;
      item.stats.responseRate = 0;
    }
    return item;
  });
  
  res.json({
    items: updatedItems,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}));
