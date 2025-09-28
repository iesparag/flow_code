import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { FlowModel } from '../models/Flow.js';
import { SubmissionModel } from '../models/Submission.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { computeNextNode } from '../services/flowEngine.js';

export const runnerRouter = Router();

const StartSchema = z.object({ flowId: z.string() });

runnerRouter.post('/start', asyncHandler(async (req: Request, res: Response) => {
  const { flowId } = StartSchema.parse(req.body);
  const flow = await FlowModel.findById(flowId).lean();
  if (!flow) throw new HttpError(404, 'Flow not found');
  const sessionId = uuid();
  const sub = await SubmissionModel.create({
    flowId: flow._id.toString(),
    flowVersion: flow.version,
    sessionId,
    answers: [],
    path: [flow.startNodeId],
    completed: false,
  });
  res.json({ sessionId, flowId: flow._id, flowVersion: flow.version, currentNodeId: flow.startNodeId });
}));

const SubmitSchema = z.object({ nodeId: z.string(), formId: z.string(), values: z.record(z.any()) });

runnerRouter.post('/:sessionId/submit', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { nodeId, formId, values } = SubmitSchema.parse(req.body);

  const sub = await SubmissionModel.findOne({ sessionId });
  if (!sub) throw new HttpError(404, 'Session not found');
  const flow = await FlowModel.findOne({ _id: sub.flowId, version: sub.flowVersion }).lean();
  if (!flow) throw new HttpError(404, 'Flow not found');

  // merge state
  const state: Record<string, any> = {};
  for (const a of sub.answers) Object.assign(state, a.values);
  Object.assign(state, values);

  // append answer
  sub.answers.push({ nodeId, formId, values, submittedAt: new Date() });
  if (!sub.path.includes(nodeId)) sub.path.push(nodeId);

  const { nextNodeId, completed } = computeNextNode(flow as any, nodeId, state);
  if (completed) {
    sub.completed = true;
    if (!sub.path.includes('end')) sub.path.push('end');
  } else if (nextNodeId) {
    sub.path.push(nextNodeId);
  }
  await sub.save();

  res.json({ nextNodeId, completed: !!completed });
}));

runnerRouter.get('/:sessionId/state', asyncHandler(async (req: Request, res: Response) => {
  const sub = await SubmissionModel.findOne({ sessionId: req.params.sessionId });
  if (!sub) throw new HttpError(404, 'Session not found');
  res.json({
    flowId: sub.flowId,
    flowVersion: sub.flowVersion,
    path: sub.path,
    completed: sub.completed,
    lastAnswers: sub.answers[sub.answers.length - 1]?.values || {},
  });
}));
