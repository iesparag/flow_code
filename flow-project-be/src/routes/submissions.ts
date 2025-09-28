import { Router, Request, Response } from 'express';
import { SubmissionModel } from '../models/Submission.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const submissionsRouter = Router();

submissionsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { flowId, version } = req.query as any;
  const filter: any = {};
  if (flowId) filter.flowId = flowId;
  if (version) filter.flowVersion = Number(version);
  const items = await SubmissionModel.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(items);
}));

submissionsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const doc = await SubmissionModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Submission not found');
  res.json(doc);
}));
