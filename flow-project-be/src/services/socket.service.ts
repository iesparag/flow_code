import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { serverLogger } from '../utils/logger.js';

class SocketService {
  private io: Server | null = null;

  public init(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', (socket: Socket) => {
      serverLogger.info(`🔌 New client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        serverLogger.info(`🔌 Client disconnected: ${socket.id}`);
      });
    });
    
    serverLogger.info('🔌 Socket.IO service initialized successfully.');
  }

  public emit(event: string, data: any) {
    if (this.io) {
      serverLogger.info(`📡 Emitting event '${event}' to ${this.io.engine.clientsCount} client(s)`);
      serverLogger.info(`📡 Event data: ${JSON.stringify(data)}`);
      this.io.emit(event, data);
    } else {
      serverLogger.warn('⚠️ Socket.IO not initialized - skipping event emission');
      serverLogger.warn('💡 This is normal if running in worker process');
    }
  }

  public getConnectedClientsCount(): number {
    return this.io ? this.io.engine.clientsCount : 0;
  }
}

export const socketService = new SocketService();
