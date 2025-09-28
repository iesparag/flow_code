import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { FlowModel } from '../models/Flow.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const flowsRouter = Router();

const EdgeSchema = z.object({ to: z.string(), when: z.any().optional() });
const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(['form', 'end']),
  formId: z.string().optional(),
  title: z.string().optional(),
  next: z.array(EdgeSchema).optional(),
});

const FlowSchema = z.object({
  name: z.string(),
  version: z.number().optional(),
  status: z.enum(['draft', 'published']).optional(),
  startNodeId: z.string(),
  nodes: z.array(NodeSchema),
  meta: z.any().optional(),
});

flowsRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = FlowSchema.parse(req.body);
  const doc = await FlowModel.create({ ...parsed, version: parsed.version ?? 1, status: parsed.status ?? 'draft' });
  res.status(201).json(doc);
}));

flowsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const doc = await FlowModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Flow not found');
  res.json(doc);
}));

flowsRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = FlowSchema.partial().parse(req.body);
  const doc = await FlowModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
  if (!doc) throw new HttpError(404, 'Flow not found');
  res.json(doc);
}));

flowsRouter.post('/:id/publish', asyncHandler(async (req: Request, res: Response) => {
  const doc = await FlowModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Flow not found');
  doc.status = 'published';
  doc.version = doc.version + 1;
  await doc.save();
  res.json(doc);
}));

flowsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const filter = status ? { status } : {};
  const items = await FlowModel.find(filter).sort({ updatedAt: -1 });
  res.json(items);
}));
