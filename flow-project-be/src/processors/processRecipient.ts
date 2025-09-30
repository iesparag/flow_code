import { Job } from 'bullmq';
import { CampaignModel } from '../models/Campaign.js';
import { AutomationFlowModel } from '../models/AutomationFlow.js';
import { RecipientStateModel } from '../models/RecipientState.js';
import { EmailTemplateModel } from '../models/EmailTemplate.js';
import { sendEmail } from '../services/email.js';
import { automationQueue } from '../queues/automation.js';
import { EmailEventModel } from '../models/EmailEvent.js';
import { env } from '../config/env.js';
import { socketService } from '../services/socket.service.js';
import { flowLogger, emailLogger, campaignLogger, queueLogger } from '../utils/logger.js';

function renderTemplate(tpl: { subject: string; body: string }, vars: Record<string, any>) {
  const render = (s: string) => s.replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));
  return { subject: render(tpl.subject), body: render(tpl.body) };
}

export async function processRecipient(job: Job<{ campaignId: string; recipientEmail: string; nodeId: string }>) {
  const { campaignId, recipientEmail, nodeId } = job.data;
  
  flowLogger.info(`🔄 Processing recipient: ${recipientEmail} at node: ${nodeId} (Campaign: ${campaignId})`);

  const campaign = await CampaignModel.findById(campaignId).lean();
  if (!campaign) {
    flowLogger.error(`❌ Campaign not found: ${campaignId}`);
    return;
  }
  
  flowLogger.info(`📋 Campaign found: ${campaign.name} (Status: ${campaign.status})`);

  // If campaign is not running, defer processing a bit (acts like pause)
  if (campaign.status !== 'running') {
    flowLogger.warn(`⏸️ Campaign ${campaign.name} is not running (Status: ${campaign.status}), deferring job for 60s`);
    await automationQueue.add('process', { campaignId, recipientEmail, nodeId }, { delay: 60_000, removeOnComplete: 1000, removeOnFail: 1000 });
    return;
  }

  flowLogger.info(`🔍 Looking up recipient state for ${recipientEmail}`);
  const state = await RecipientStateModel.findOne({ campaignId: campaign._id, recipientEmail });
  if (!state) {
    flowLogger.error(`❌ Recipient state not found for ${recipientEmail} in campaign ${campaignId}`);
    return;
  }
  
  flowLogger.info(`✅ Recipient state found - Current node: ${state.currentNodeId}, Reply detected: ${state.replyDetected}`);

  flowLogger.info(`🔍 Looking up flow: ${campaign.flowId} version ${campaign.flowVersion}`);
  const flow = await AutomationFlowModel.findOne({ _id: campaign.flowId, version: campaign.flowVersion }).lean();
  if (!flow) {
    flowLogger.error(`❌ Flow not found: ${campaign.flowId} version ${campaign.flowVersion}`);
    return;
  }
  
  flowLogger.info(`✅ Flow found: ${flow.name} with ${flow.nodes.length} nodes`);

  const node = flow.nodes.find((n: any) => n.id === nodeId) as any;
  if (!node) {
    flowLogger.error(`❌ Node not found in flow: ${nodeId}`);
    return;
  }
  
  flowLogger.info(`🎯 Processing node: ${node.id} (Type: ${node.type}, Title: ${node.title || 'No title'})`);

  // Helper to schedule next nodes (respecting edges and conditions)
  const scheduleNext = async (currentNode: any) => {
    const nextEdges: any[] = currentNode.next || [];
    flowLogger.info(`⏭️ Scheduling ${nextEdges.length} next node(s) for recipient ${recipientEmail}`);
    
    for (const e of nextEdges) {
      flowLogger.info(`📅 Scheduling node ${e.to} for recipient ${recipientEmail}`);
      queueLogger.info(`⏰ Adding job to queue: Campaign ${campaignId}, Recipient ${recipientEmail}, Node ${e.to}`);
      await automationQueue.add(
        'process',
        { campaignId, recipientEmail, nodeId: e.to },
        { delay: 0, removeOnComplete: 1000, removeOnFail: 1000 }
      );
    }
  };

  switch (node.type) {
    case 'sendEmail': {
      // resolve template
      let subject = '';
      let body = '';
      // campaign-level override takes priority
      const overrideTplId = (campaign as any).templateOverrides?.[node.id];
      const effectiveTemplateId = overrideTplId || node.templateId;
      if (effectiveTemplateId) {
        const tpl = await EmailTemplateModel.findById(effectiveTemplateId).lean();
        if (tpl) ({ subject, body } = renderTemplate({ subject: tpl.subject, body: tpl.body }, { email: recipientEmail }));
      } else if (node.template) {
        ({ subject, body } = renderTemplate({ subject: node.template.subject, body: node.template.body }, { email: recipientEmail }));
      }

      try {
        emailLogger.info(`📧 Attempting to send email to ${recipientEmail} for campaign ${campaignId}`);
        emailLogger.info(`📝 Subject: ${subject}`);
        emailLogger.info(`👤 From: ${campaign.sender.fromEmail}`);
        
        // Add open tracking pixel to email body
        const trackingPixel = `<img src="${env.BASE_URL}/api/campaigns/track/open/${campaignId}/${encodeURIComponent(recipientEmail)}" width="1" height="1" style="display:none;" alt="">`;
        const bodyWithTracking = body + trackingPixel;
        
        emailLogger.info(`🔍 Added tracking pixel: ${env.BASE_URL}/api/campaigns/track/open/${campaignId}/${encodeURIComponent(recipientEmail)}`);

        const { messageId } = await sendEmail({
          from: campaign.sender.fromEmail,
          to: recipientEmail,
          subject,
          html: bodyWithTracking,
          replyTo: campaign.sender.replyTo,
        });

        emailLogger.info(`✅ Email sent successfully! MessageId: ${messageId}`);

        // Track event and stats
        emailLogger.info(`📊 Creating email event record...`);
        await EmailEventModel.create({ campaignId: campaign._id, recipientEmail, messageId, type: 'sent' });
        
        // Update campaign stats
        campaignLogger.info(`📈 Updating campaign stats...`);
        const updateResult = await CampaignModel.updateOne(
          { _id: campaign._id }, 
          { 
            $inc: { 
              'stats.sent': 1,
              'stats.delivered': 1  // Assume delivered when sent successfully
            } 
          }
        );
        
        campaignLogger.info(`✅ Campaign stats updated. Modified count: ${updateResult.modifiedCount}`);

        flowLogger.info(`📝 Updating recipient state history...`);
        state.history.push({ nodeId, event: 'sent', timestamp: new Date(), details: { messageId } });
        state.currentNodeId = nodeId;
        state.lastMessageId = messageId;
        await state.save();

        await scheduleNext(node);

        // Notify clients of the update via API call (since Socket.IO not available in worker)
        flowLogger.info(`🔔 Notifying clients of campaign update via API`);
        try {
          const response = await fetch(`http://localhost:${process.env.PORT || 4000}/api/campaigns/internal/notify/${campaign._id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (response.ok) {
            flowLogger.info(`✅ Socket.IO notification sent successfully`);
          } else {
            flowLogger.warn(`⚠️ Socket.IO notification failed: ${response.status}`);
          }
        } catch (error: any) {
          flowLogger.warn(`⚠️ Could not send Socket.IO notification: ${error.message}`);
        }
      } catch (err: any) {
        emailLogger.error(`❌ Failed to send email to ${recipientEmail}: ${err.message}`);
        emailLogger.error(`💥 Full error details:`, err);
        
        await EmailEventModel.create({ campaignId: campaign._id, recipientEmail, type: 'error', payload: { message: err?.message } });
        await CampaignModel.updateOne({ _id: campaign._id }, { $inc: { 'stats.errors': 1 } });
        state.history.push({ nodeId, event: 'error', timestamp: new Date(), details: { reason: 'send_failed', error: err?.message } });
        await state.save();

        // Note: Socket.IO notification handled by API server, not worker
      }
      break;
    }
    case 'wait': {
      // Schedule the next step after delayMs
      const delay = node.delayMs ?? 0;
      const nextEdges: any[] = node.next || [];
      
      flowLogger.info(`⏰ Wait node: delaying ${delay}ms (${delay/1000}s) for recipient ${recipientEmail}`);
      flowLogger.info(`📅 Will schedule ${nextEdges.length} next node(s) after delay`);
      
      for (const e of nextEdges) {
        flowLogger.info(`⏳ Scheduling node ${e.to} with delay ${delay}ms for recipient ${recipientEmail}`);
        queueLogger.info(`📋 Adding delayed job: ${recipientEmail} -> ${e.to} (delay: ${delay}ms)`);
        await automationQueue.add(
          'process',
          { campaignId, recipientEmail, nodeId: e.to },
          { delay, removeOnComplete: 1000, removeOnFail: 1000 }
        );
      }
      
      flowLogger.info(`📝 Recording wait event in recipient history`);
      state.history.push({ nodeId, event: 'wait', timestamp: new Date(), details: { delayMs: delay } });
      state.currentNodeId = nodeId;
      await state.save();
      break;
    }
    case 'conditionReply': {
      const replied = !!state.replyDetected;
      const nextEdges: any[] = node.next || [];
      
      flowLogger.info(`🤔 Condition node: recipient ${recipientEmail} replied=${replied}`);
      flowLogger.info(`🔀 Available edges: ${nextEdges.length}`);
      
      // Convention: first edge is TRUE branch, second is FALSE branch
      const chosen = replied ? nextEdges[0] : nextEdges[1];
      if (chosen) {
        flowLogger.info(`✅ Taking ${replied ? 'TRUE' : 'FALSE'} branch to node ${chosen.to}`);
        queueLogger.info(`📋 Adding conditional job: ${recipientEmail} -> ${chosen.to} (replied: ${replied})`);
        await automationQueue.add('process', { campaignId, recipientEmail, nodeId: chosen.to }, { delay: 0 });
      } else {
        flowLogger.warn(`⚠️ No ${replied ? 'TRUE' : 'FALSE'} branch available, ending flow for ${recipientEmail}`);
      }
      
      flowLogger.info(`📝 Recording condition result in recipient history`);
      state.history.push({ nodeId, event: replied ? 'replied' : 'skipped', timestamp: new Date() });
      state.currentNodeId = nodeId;
      await state.save();
      break;
    }
    case 'end': {
      flowLogger.info(`🏁 End node reached for recipient ${recipientEmail} - Flow completed`);
      state.history.push({ nodeId, event: 'completed', timestamp: new Date() });
      await state.save();
      campaignLogger.info(`✅ Recipient ${recipientEmail} completed the flow successfully`);
      break;
    }
    default:
      flowLogger.error(`❌ Unknown node type: ${node.type} for recipient ${recipientEmail}`);
      state.history.push({ nodeId, event: 'error', timestamp: new Date(), details: { reason: 'unknown_node_type', nodeType: node.type } });
      await state.save();
  }
}
