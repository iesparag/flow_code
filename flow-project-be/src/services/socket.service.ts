import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

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
      console.log(`[Socket] ✅ New client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`[Socket] ❌ Client disconnected: ${socket.id}`);
      });
    });
    
    console.log('[Socket] ✅ Service initialized successfully.');
  }

  public emit(event: string, data: any) {
    if (this.io) {
      console.log(`[Socket] 📡 Emitting event '${event}' to ${this.io.engine.clientsCount} client(s)`);
      console.log(`[Socket] 📡 Event data:`, data);
      this.io.emit(event, data);
    } else {
      console.error('[Socket] ❌ Socket.IO not initialized.');
    }
  }

  public getConnectedClientsCount(): number {
    return this.io ? this.io.engine.clientsCount : 0;
  }
}

export const socketService = new SocketService();
