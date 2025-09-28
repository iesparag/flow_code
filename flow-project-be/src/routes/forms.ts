import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { FormModel } from '../models/Form.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const formsRouter = Router();

const FieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  validators: z.array(z.object({ name: z.string(), args: z.any().optional() })).optional(),
  visibleIf: z.any().optional(),
  options: z.array(z.object({ label: z.string(), value: z.any() })).optional(),
  default: z.any().optional(),
});

const FormSchema = z.object({
  name: z.string(),
  version: z.number().optional(),
  status: z.enum(['draft', 'published']).optional(),
  fields: z.array(FieldSchema),
  meta: z.any().optional(),
});

formsRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = FormSchema.parse(req.body);
  const doc = await FormModel.create({ ...parsed, version: parsed.version ?? 1, status: parsed.status ?? 'draft' });
  res.status(201).json(doc);
}));

formsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const doc = await FormModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Form not found');
  res.json(doc);
}));

formsRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = FormSchema.partial().parse(req.body);
  const doc = await FormModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
  if (!doc) throw new HttpError(404, 'Form not found');
  res.json(doc);
}));

formsRouter.post('/:id/publish', asyncHandler(async (req: Request, res: Response) => {
  const doc = await FormModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Form not found');
  doc.status = 'published';
  doc.version = doc.version + 1; // simple bump, in real world copy-on-write
  await doc.save();
  res.json(doc);
}));

formsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const filter = status ? { status } : {};
  const items = await FormModel.find(filter).sort({ updatedAt: -1 });
  res.json(items);
}));
