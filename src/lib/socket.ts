import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private connectionPromise: Promise<Socket> | null = null;
  private messageQueue: Array<{ event: string; data: any; timestamp: number }> = [];
  private processingQueue = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private currentRoom: string | null = null; // Track current room

  connect() {
    // If already connected, return existing socket
    if (this.socket && this.isConnected && this.socket.connected) {
      console.log('✅ Socket already connected, returning existing connection');
      return this.socket;
    }

    // If there's an ongoing connection attempt, return the promise
    if (this.connectionPromise) {
      console.log('⏳ Connection already in progress, returning existing promise');
      return this.socket!;
    }

    console.log('🔌 Creating new socket connection to http://localhost:3001');
    
    this.socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      timeout: 5000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      maxReconnectionAttempts: this.maxReconnectAttempts,
    });

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 3000);

      this.socket!.on('connect', () => {
        clearTimeout(timeout);
        console.log('✅ Connected to Socket.IO server with ID:', this.socket?.id);
        this.isConnected = true;
        this.connectionPromise = null;
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        this.processMessageQueue(); // Process any queued messages
        resolve(this.socket!);
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('🔴 Socket.IO connection error:', error);
        this.isConnected = false;
        this.connectionPromise = null;
        reject(error);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO server. Reason:', reason);
      this.isConnected = false;
      this.connectionPromise = null;
      this.currentRoom = null; // Reset current room on disconnect
      
      // Auto-reconnect on disconnect (except for intentional disconnects)
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('🔴 Socket.IO error:', error);
    });

    return this.socket;
  }

  // Schedule automatic reconnection
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }

    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // Exponential backoff, max 10s
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectInterval = setTimeout(() => {
      console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  // Force reconnection (useful for hot-reload scenarios)
  forceReconnect() {
    console.log('🔄 Force reconnecting socket...');
    this.disconnect();
    this.reconnectAttempts = 0;
    return this.connect();
  }

  // Process queued messages when connection is established
  private async processMessageQueue() {
    if (this.processingQueue || this.messageQueue.length === 0) return;
    
    this.processingQueue = true;
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.socket && this.isSocketConnected()) {
        try {
          this.socket.emit(message.event, message.data);
          console.log(`📤 Sent queued message: ${message.event}`);
        } catch (error) {
          console.error('Error sending queued message:', error);
        }
      }
    }
    
    this.processingQueue = false;
  }

  // Queue a message if not connected
  private queueMessage(event: string, data: any) {
    this.messageQueue.push({
      event,
      data,
      timestamp: Date.now()
    });
    console.log(`📋 Queued message: ${event}`);
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    if (this.socket) {
      console.log('🔌 Disconnecting from Socket.IO server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionPromise = null;
      this.messageQueue = []; // Clear queue on disconnect
      this.reconnectAttempts = 0;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Join a group chat room
  joinGroupChat(userId: number, posterId: number) {
    if (this.socket && this.isSocketConnected()) {
      // If we're already in a room, leave it first
      if (this.currentRoom) {
        console.log(`🚪 Leaving current room: ${this.currentRoom}`);
        this.socket.emit('leave-room');
        this.currentRoom = null;
      }
      
      console.log(`🔗 Joining group chat room for user ${userId} and poster ${posterId}`);
      this.socket.emit('join-group-chat', { userId, posterId });
      
      // Track that we're attempting to join a room
      this.currentRoom = `pending-${userId}-${posterId}`;
    } else {
      console.warn('⚠️ Cannot join group chat: socket not connected');
      this.queueMessage('join-group-chat', { userId, posterId });
    }
  }

  // Leave current room (call this when switching users or leaving chat)
  leaveCurrentRoom() {
    if (this.socket && this.isSocketConnected()) {
      console.log('🚪 Leaving current room');
      this.socket.emit('leave-room');
      this.currentRoom = null;
    } else {
      this.queueMessage('leave-room', {});
    }
  }

  // Get current room info
  getCurrentRoom(): string | null {
    return this.currentRoom;
  }

  // Send a message with performance monitoring
  sendMessage(messageContent: string, userId: number, posterId: number, groupChatId?: number) {
    const startTime = performance.now();
    
    if (this.socket && this.isSocketConnected()) {
      console.log(`📤 Sending message via socket for user ${userId} to poster ${posterId}`);
      this.socket.emit('send-message', { messageContent, userId, posterId, groupChatId });
      
      const endTime = performance.now();
      console.log(`⚡ Message sent in ${(endTime - startTime).toFixed(2)}ms`);
    } else {
      console.warn('⚠️ Cannot send message via socket: socket not connected, queuing message');
      this.queueMessage('send-message', { messageContent, userId, posterId, groupChatId });
    }
  }

  // Send typing indicator
  sendTyping(userId: number, posterId: number, isTyping: boolean, groupChatId?: number) {
    if (this.socket && this.isSocketConnected()) {
      this.socket.emit('typing', { userId, posterId, isTyping, groupChatId });
    } else {
      this.queueMessage('typing', { userId, posterId, isTyping, groupChatId });
    }
  }

  // Listen for new messages
  onNewMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('new-message', (message) => {
        console.log('📨 Received new message via socket:', message);
        callback(message);
      });
    }
  }

  // Listen for typing indicators
  onTyping(callback: (data: { userId: number, isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user-typing', (data) => {
        console.log('⌨️ Received typing indicator:', data);
        callback(data);
      });
    }
  }

  // Listen for chat list updates
  onChatListUpdate(callback: (update: { 
    groupChatId: number, 
    lastMessage: string, 
    lastMessageTime: string, 
    senderId: number, 
    senderName: string 
  }) => void) {
    if (this.socket) {
      this.socket.on('chat-list-update', (update) => {
        console.log('📋 Received chat list update via socket:', update);
        callback(update);
      });
    }
  }

  // Listen for connection status changes
  onConnect(callback: () => void) {
    if (this.socket) {
      this.socket.on('connect', callback);
    }
  }

  onDisconnect(callback: (reason: string) => void) {
    if (this.socket) {
      this.socket.on('disconnect', callback);
    }
  }

  onError(callback: (error: any) => void) {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }

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

  offChatListUpdate() {
    if (this.socket) {
      this.socket.off('chat-list-update');
    }
  }

  offConnect() {
    if (this.socket) {
      this.socket.off('connect');
    }
  }

  offDisconnect() {
    if (this.socket) {
      this.socket.off('disconnect');
    }
  }

  offError() {
    if (this.socket) {
      this.socket.off('error');
    }
  }

  offAll() {
    if (this.socket) {
      this.socket.off();
    }
  }

  // Listen for room join confirmation
  onRoomJoined(callback: (data: { roomName: string, groupChatId: number }) => void) {
    if (this.socket) {
      this.socket.on('room-joined', (data) => {
        console.log('✅ Room joined successfully:', data);
        this.currentRoom = data.roomName; // Update current room with actual room name
        callback(data);
      });
    }
  }

  // Listen for room join errors
  onRoomJoinError(callback: (error: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('room-join-error', (error) => {
        console.error('❌ Room join error:', error);
        this.currentRoom = null; // Reset current room on error
        callback(error);
      });
    }
  }

  offRoomJoined() {
    if (this.socket) {
      this.socket.off('room-joined');
    }
  }

  offRoomJoinError() {
    if (this.socket) {
      this.socket.off('room-join-error');
    }
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService; 