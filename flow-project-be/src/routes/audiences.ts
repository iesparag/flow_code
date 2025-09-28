import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AudienceModel } from '../models/Audience.js';
import { asyncHandler } from '../utils/http.js';

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
  const data = AudienceSchema.parse(req.body);
  const doc = await AudienceModel.create(data);
  res.status(201).json(doc);
}));

audiencesRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const doc = await AudienceModel.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Audience not found' });
  res.json(doc);
}));

audiencesRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const items = await AudienceModel.find().sort({ createdAt: -1 }).limit(100);
  res.json(items);
}));

audiencesRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const patch = AudienceSchema.partial().parse(req.body);
  const updated = await AudienceModel.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!updated) return res.status(404).json({ error: 'Audience not found' });
  res.json(updated);
}));

audiencesRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await AudienceModel.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));
