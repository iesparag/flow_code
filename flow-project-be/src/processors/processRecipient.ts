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

function renderTemplate(tpl: { subject: string; body: string }, vars: Record<string, any>) {
  const render = (s: string) => s.replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));
  return { subject: render(tpl.subject), body: render(tpl.body) };
}

export async function processRecipient(job: Job<{ campaignId: string; recipientEmail: string; nodeId: string }>) {
  const { campaignId, recipientEmail, nodeId } = job.data;

  const campaign = await CampaignModel.findById(campaignId).lean();
  if (!campaign) return;

  // If campaign is not running, defer processing a bit (acts like pause)
  if (campaign.status !== 'running') {
    await automationQueue.add('process', { campaignId, recipientEmail, nodeId }, { delay: 60_000, removeOnComplete: 1000, removeOnFail: 1000 });
    return;
  }

  const state = await RecipientStateModel.findOne({ campaignId: campaign._id, recipientEmail });
  if (!state) return;

  const flow = await AutomationFlowModel.findOne({ _id: campaign.flowId, version: campaign.flowVersion }).lean();
  if (!flow) return;

  const node = flow.nodes.find((n: any) => n.id === nodeId) as any;
  if (!node) return;

  // Helper to schedule next nodes (respecting edges and conditions)
  const scheduleNext = async (currentNode: any) => {
    const nextEdges: any[] = currentNode.next || [];
    console.log(`[FLOW] Scheduling ${nextEdges.length} next node(s) for recipient ${recipientEmail}`);
    
    for (const e of nextEdges) {
      console.log(`[FLOW] Scheduling node ${e.to} for recipient ${recipientEmail}`);
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
        console.log(`[EMAIL] Attempting to send email to ${recipientEmail} for campaign ${campaignId}`);
        console.log(`[EMAIL] Subject: ${subject}`);
        console.log(`[EMAIL] From: ${campaign.sender.fromEmail}`);
        
        // Add open tracking pixel to email body
        const trackingPixel = `<img src="${env.BASE_URL}/api/campaigns/track/open/${campaignId}/${encodeURIComponent(recipientEmail)}" width="1" height="1" style="display:none;" alt="">`;
        const bodyWithTracking = body + trackingPixel;
        
        console.log(`[EMAIL] Added tracking pixel: ${env.BASE_URL}/api/campaigns/track/open/${campaignId}/${encodeURIComponent(recipientEmail)}`);

        const { messageId } = await sendEmail({
          from: campaign.sender.fromEmail,
          to: recipientEmail,
          subject,
          html: bodyWithTracking,
          replyTo: campaign.sender.replyTo,
        });

        console.log(`[EMAIL] Email sent successfully! MessageId: ${messageId}`);

        // Track event and stats
        await EmailEventModel.create({ campaignId: campaign._id, recipientEmail, messageId, type: 'sent' });
        
        // Update campaign stats
        const updateResult = await CampaignModel.updateOne(
          { _id: campaign._id }, 
          { 
            $inc: { 
              'stats.sent': 1,
              'stats.delivered': 1  // Assume delivered when sent successfully
            } 
          }
        );
        
        console.log(`[EMAIL] ✅ Campaign stats updated. Modified count: ${updateResult.modifiedCount}`);

        state.history.push({ nodeId, event: 'sent', timestamp: new Date(), details: { messageId } });
        state.currentNodeId = nodeId;
        state.lastMessageId = messageId;
        await state.save();

        await scheduleNext(node);

        // Notify clients of the update
        socketService.emit('campaign_updated', { campaignId: campaign._id });
      } catch (err: any) {
        console.error(`[EMAIL] Failed to send email to ${recipientEmail}:`, err.message);
        console.error(`[EMAIL] Full error:`, err);
        
        await EmailEventModel.create({ campaignId: campaign._id, recipientEmail, type: 'error', payload: { message: err?.message } });
        await CampaignModel.updateOne({ _id: campaign._id }, { $inc: { 'stats.errors': 1 } });
        state.history.push({ nodeId, event: 'error', timestamp: new Date(), details: { reason: 'send_failed', error: err?.message } });
        await state.save();

        // Notify clients of the update
        socketService.emit('campaign_updated', { campaignId: campaign._id });
      }
      break;
    }
    case 'wait': {
      // Schedule the next step after delayMs
      const delay = node.delayMs ?? 0;
      const nextEdges: any[] = node.next || [];
      
      console.log(`[FLOW] Wait node: delaying ${delay}ms for recipient ${recipientEmail}`);
      console.log(`[FLOW] Will schedule ${nextEdges.length} next node(s) after delay`);
      
      for (const e of nextEdges) {
        console.log(`[FLOW] Scheduling node ${e.to} with delay ${delay}ms for recipient ${recipientEmail}`);
        await automationQueue.add(
          'process',
          { campaignId, recipientEmail, nodeId: e.to },
          { delay, removeOnComplete: 1000, removeOnFail: 1000 }
        );
      }
      state.history.push({ nodeId, event: 'wait', timestamp: new Date(), details: { delayMs: delay } });
      state.currentNodeId = nodeId;
      await state.save();
      break;
    }
    case 'conditionReply': {
      const replied = !!state.replyDetected;
      const nextEdges: any[] = node.next || [];
      
      console.log(`[FLOW] Condition node: recipient ${recipientEmail} replied=${replied}`);
      console.log(`[FLOW] Available edges: ${nextEdges.length}`);
      
      // Convention: first edge is TRUE branch, second is FALSE branch
      const chosen = replied ? nextEdges[0] : nextEdges[1];
      if (chosen) {
        console.log(`[FLOW] Taking ${replied ? 'TRUE' : 'FALSE'} branch to node ${chosen.to}`);
        await automationQueue.add('process', { campaignId, recipientEmail, nodeId: chosen.to }, { delay: 0 });
      } else {
        console.log(`[FLOW] No ${replied ? 'TRUE' : 'FALSE'} branch available, ending flow`);
      }
      
      state.history.push({ nodeId, event: replied ? 'replied' : 'skipped', timestamp: new Date() });
      state.currentNodeId = nodeId;
      await state.save();
      break;
    }
    case 'end': {
      state.history.push({ nodeId, event: 'completed', timestamp: new Date() });
      await state.save();
      break;
    }
    default:
      state.history.push({ nodeId, event: 'error', timestamp: new Date(), details: { reason: 'unknown_node_type' } });
      await state.save();
  }
}
