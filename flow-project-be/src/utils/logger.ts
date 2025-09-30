import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});

// Specialized loggers for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Pre-configured loggers for different parts of the system
export const serverLogger = createModuleLogger('SERVER');
export const campaignLogger = createModuleLogger('CAMPAIGN');
export const audienceLogger = createModuleLogger('AUDIENCE');
export const flowLogger = createModuleLogger('FLOW');
export const emailLogger = createModuleLogger('EMAIL');
export const queueLogger = createModuleLogger('QUEUE');
export const workerLogger = createModuleLogger('WORKER');
export const dbLogger = createModuleLogger('DATABASE');
export const authLogger = createModuleLogger('AUTH');
export const apiLogger = createModuleLogger('API');
