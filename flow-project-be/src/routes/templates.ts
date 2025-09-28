import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EmailTemplateModel } from '../models/EmailTemplate.js';
import { asyncHandler } from '../utils/http.js';

export const templatesRouter = Router();

const AttachmentSchema = z.object({ name: z.string(), url: z.string().url().optional(), contentBase64: z.string().optional() });
const TemplateSchema = z.object({ name: z.string(), subject: z.string(), body: z.string(), attachments: z.array(AttachmentSchema).optional() });

templatesRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const data = TemplateSchema.parse(req.body);
  const doc = await EmailTemplateModel.create(data);
  res.status(201).json(doc);
}));

templatesRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const items = await EmailTemplateModel.find().sort({ updatedAt: -1 }).limit(100);
  res.json(items);
}));

templatesRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await EmailTemplateModel.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));

templatesRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const doc = await EmailTemplateModel.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Template not found' });
  res.json(doc);
}));

templatesRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = TemplateSchema.partial().parse(req.body);
  const doc = await EmailTemplateModel.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!doc) return res.status(404).json({ error: 'Template not found' });
  res.json(doc);
}));
