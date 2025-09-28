import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket;

  constructor() {
    console.log('[WebSocket] Attempting to connect to:', environment.apiBase);
    
    this.socket = io(environment.apiBase, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] ✅ Connected to server successfully!');
      console.log('[WebSocket] Socket ID:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] ❌ Disconnected from server. Reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] ❌ Connection error:', error);
    });

    // Listen for any events for debugging
    this.socket.onAny((eventName, ...args) => {
      console.log('[WebSocket] 📨 Received any event:', eventName, args);
    });
  }

  listen<T>(eventName: string): Observable<T> {
    return new Observable((subscriber) => {
      this.socket.on(eventName, (data: T) => {
        console.log(`[WebSocket] Received event '${eventName}':`, data);
        subscriber.next(data);
      });

      // Return a teardown logic to unsubscribe from the event
      return () => {
        this.socket.off(eventName);
      };
    });
  }
}
