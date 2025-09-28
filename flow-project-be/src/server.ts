import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { formsRouter } from './routes/forms.js';
import { flowsRouter } from './routes/flows.js';
import { runnerRouter } from './routes/runner.js';
import { submissionsRouter } from './routes/submissions.js';
import { HttpError } from './utils/http.js';
import { analyticsRouter } from './routes/analytics.js';
import { audiencesRouter } from './routes/audiences.js';
import { templatesRouter } from './routes/templates.js';
import { campaignsRouter } from './routes/campaigns.js';
import { autoFlowsRouter } from './routes/autoFlows.js';
import { env } from './config/env.js';

import { createServer as createHttpServer } from 'http';

export function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const allowedOrigins = (env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

    const corsOptions: cors.CorsOptions = {
      origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*' ? true : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Cache-Control', 
        'Pragma', 
        'Expires'
      ],
      optionsSuccessStatus: 204,
      exposedHeaders: ['Content-Range', 'X-Total-Count'] // Add this if you need these headers
    };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // API Routes
  app.use('/api/forms', formsRouter);
  app.use('/api/flows', flowsRouter);
  app.use('/api/runner', runnerRouter);
  app.use('/api/submissions', submissionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/audiences', audiencesRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/auto-flows', autoFlowsRouter);

  // 404 handler
  app.use((_req, _res, next) => {
    next(new HttpError(404, 'Not Found'));
  });

  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return { app, httpServer };
}
