import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Join a group chat room
  joinGroupChat(userId: number, posterId: number) {
    if (this.socket) {
      this.socket.emit('join-group-chat', { userId, posterId });
    }
  }

  // Send a message
  sendMessage(messageContent: string, userId: number, posterId: number, groupChatId?: number) {
    if (this.socket) {
      this.socket.emit('send-message', { messageContent, userId, posterId, groupChatId });
    }
  }

  // Send typing indicator
  sendTyping(userId: number, posterId: number, isTyping: boolean, groupChatId?: number) {
    if (this.socket) {
      this.socket.emit('typing', { userId, posterId, isTyping, groupChatId });
    }
  }

  // Listen for new messages
  onNewMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  // Listen for typing indicators
  onTyping(callback: (data: { userId: number, isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user-typing', callback);
    }
  }

  // Listen for errors
  onError(callback: (error: any) => void) {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }

  // Remove listeners
  offNewMessage() {
    if (this.socket) {
      this.socket.off('new-message');
    }
  }

  offTyping() {
    if (this.socket) {
      this.socket.off('user-typing');
    }
  }

  offError() {
    if (this.socket) {
      this.socket.off('error');
    }
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService; 