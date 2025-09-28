import { Router, Request, Response } from 'express';
import { AnalyticsModel } from '../models/Analytics.js';
import { SubmissionModel } from '../models/Submission.js';
import { asyncHandler } from '../utils/http.js';

export const analyticsRouter = Router();

analyticsRouter.get('/flows/:flowId', asyncHandler(async (req: Request, res: Response) => {
  const flowId = req.params.flowId;
  const versionQ = req.query.version as string | undefined;
  const version = versionQ && versionQ !== 'latest' ? Number(versionQ) : undefined;

  const filter: any = { flowId };
  if (version) filter.flowVersion = version;

  const total = await SubmissionModel.countDocuments(filter);
  const completed = await SubmissionModel.countDocuments({ ...filter, completed: true });

  res.json({
    metrics: {
      responses: total,
      completionRate: total ? completed / total : 0,
    }
  });
}));
