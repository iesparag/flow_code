import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AudienceModel } from '../models/Audience.js';
import { asyncHandler } from '../utils/http.js';
import { audienceLogger } from '../utils/logger.js';

export const audiencesRouter = Router();

const RecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const AudienceSchema = z.object({
  name: z.string(),
  source: z.enum(['csv', 'db']).default('csv'),
  recipients: z.array(RecipientSchema).default([]),
});

audiencesRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  audienceLogger.info('📝 Creating new audience...');
  audienceLogger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
  
  const data = AudienceSchema.parse(req.body);
  audienceLogger.info(`✅ Validation passed for audience: ${data.name}`);
  audienceLogger.info(`📊 Recipients count: ${data.recipients.length}`);
  
  const doc = await AudienceModel.create(data);
  audienceLogger.info(`🎉 Audience created successfully with ID: ${doc._id}`);
  
  res.status(201).json(doc);
}));

audiencesRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  audienceLogger.info(`🔍 Fetching audience with ID: ${req.params.id}`);
  
  const doc = await AudienceModel.findById(req.params.id);
  if (!doc) {
    audienceLogger.warn(`❌ Audience not found with ID: ${req.params.id}`);
    return res.status(404).json({ error: 'Audience not found' });
  }
  
  audienceLogger.info(`✅ Audience found: ${doc.name} (${doc.recipients.length} recipients)`);
  res.json(doc);
}));

audiencesRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  audienceLogger.info('📋 Fetching all audiences...');
  
  const items = await AudienceModel.find().sort({ createdAt: -1 }).limit(100);
  audienceLogger.info(`✅ Found ${items.length} audiences`);
  
  res.json(items);
}));

audiencesRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  audienceLogger.info(`✏️ Updating audience with ID: ${req.params.id}`);
  audienceLogger.info(`Update data: ${JSON.stringify(req.body, null, 2)}`);
  
  const patch = AudienceSchema.partial().parse(req.body);
  const updated = await AudienceModel.findByIdAndUpdate(req.params.id, patch, { new: true });
  
  if (!updated) {
    audienceLogger.warn(`❌ Audience not found for update with ID: ${req.params.id}`);
    return res.status(404).json({ error: 'Audience not found' });
  }
  
  audienceLogger.info(`✅ Audience updated successfully: ${updated.name}`);
  res.json(updated);
}));

audiencesRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  audienceLogger.info(`🗑️ Deleting audience with ID: ${req.params.id}`);
  
  const deleted = await AudienceModel.findByIdAndDelete(req.params.id);
  if (deleted) {
    audienceLogger.info(`✅ Audience deleted successfully: ${deleted.name}`);
  } else {
    audienceLogger.warn(`❌ Audience not found for deletion with ID: ${req.params.id}`);
  }
  
  res.status(204).end();
}));
