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
import { serverLogger, apiLogger } from './utils/logger.js';

import { createServer as createHttpServer } from 'http';

export function createServer() {
  serverLogger.info('🔧 Initializing Express application...');
  const app = express();
  const httpServer = createHttpServer(app);
  
  serverLogger.info('🌐 Configuring CORS settings...');
  const allowedOrigins = (env.CORS_ORIGIN || 'https://flow-project-fjwy0b2qz-iesparagjaingmailcoms-projects.vercel.app' || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  
  serverLogger.info(`🔒 CORS allowed origins: ${allowedOrigins.join(', ')}`);

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

  serverLogger.info('🛡️ Setting up security middleware...');
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  
  // Custom morgan logger that uses our logger
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        apiLogger.info(message.trim());
      }
    }
  }));

  serverLogger.info('❤️ Setting up health check endpoint...');
  app.get('/api/health', (_req, res) => {
    apiLogger.info('Health check requested');
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // API Routes
  serverLogger.info('🛣️ Setting up API routes...');
  app.use('/api/forms', formsRouter);
  app.use('/api/flows', flowsRouter);
  app.use('/api/runner', runnerRouter);
  app.use('/api/submissions', submissionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/audiences', audiencesRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/auto-flows', autoFlowsRouter);
  serverLogger.info('✅ All API routes configured successfully');

  // 404 handler
  app.use((_req, _res, next) => {
    apiLogger.warn(`404 - Route not found: ${_req.method} ${_req.path}`);
    next(new HttpError(404, 'Not Found'));
  });

  // Error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    const errorId = Math.random().toString(36).substring(7);
    apiLogger.error({
      errorId,
      method: req.method,
      url: req.url,
      status: err.status || 500,
      message: err.message,
      stack: err.stack
    }, `❌ Error ${errorId}: ${err.message}`);
    
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      errorId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  serverLogger.info('✅ Express server configuration completed');
  return { app, httpServer };
}
