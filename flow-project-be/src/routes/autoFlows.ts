import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AutomationFlowModel } from '../models/AutomationFlow.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const autoFlowsRouter = Router();

const NextEdgeSchema = z.object({ to: z.string(), when: z.any().optional() });
const BaseNodeSchema = z.object({ id: z.string(), type: z.enum(['sendEmail','wait','conditionReply','end']), title: z.string().optional(), next: z.array(NextEdgeSchema).optional() });
const SendEmailNodeSchema = BaseNodeSchema.extend({ type: z.literal('sendEmail'), templateId: z.string().optional(), template: z.any().optional() });
const WaitNodeSchema = BaseNodeSchema.extend({ type: z.literal('wait'), delayMs: z.number().int().positive() });
const ConditionReplyNodeSchema = BaseNodeSchema.extend({ type: z.literal('conditionReply'), windowMs: z.number().int().positive().optional() });
const EndNodeSchema = BaseNodeSchema.extend({ type: z.literal('end') });
const NodeSchema = z.discriminatedUnion('type', [SendEmailNodeSchema, WaitNodeSchema, ConditionReplyNodeSchema, EndNodeSchema]);

const FlowSchema = z.object({
  name: z.string(),
  version: z.number().optional(),
  status: z.enum(['draft','published']).optional(),
  startNodeId: z.string(),
  nodes: z.array(NodeSchema),
  meta: z.any().optional(),
});

autoFlowsRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = FlowSchema.parse(req.body);
  const doc = await AutomationFlowModel.create({ ...parsed, version: parsed.version ?? 1, status: parsed.status ?? 'draft' });
  res.status(201).json(doc);
}));

autoFlowsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const doc = await AutomationFlowModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'AutomationFlow not found');
  res.json(doc);
}));

autoFlowsRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = FlowSchema.partial().parse(req.body);
  const doc = await AutomationFlowModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
  if (!doc) throw new HttpError(404, 'AutomationFlow not found');
  res.json(doc);
}));

autoFlowsRouter.post('/:id/publish', asyncHandler(async (req: Request, res: Response) => {
  const doc = await AutomationFlowModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'AutomationFlow not found');
  doc.status = 'published';
  doc.version = doc.version + 1;
  await doc.save();
  res.json(doc);
}));

autoFlowsRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const items = await AutomationFlowModel.find().sort({ updatedAt: -1 });
  res.json(items);
}));

autoFlowsRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await AutomationFlowModel.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));
