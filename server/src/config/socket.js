import { Server } from 'socket.io';
import Message from '../modules/communication/message.model.js';

let io = null;

// Track online users: Map<userIdString, Set<socketIdString>>
const onlineUsers = new Map();

// Track which user is currently viewing which contact's chat: Map<userIdString, contactIdString>
const userActiveChats = new Map();

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((u) => u.trim()) : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  io.on('connection', (socket) => {
    let currentUserId = null;

    // 1. Client registers authenticated user
    socket.on('register_user', (userId) => {
      if (!userId) return;
      currentUserId = userId.toString();

      if (!onlineUsers.has(currentUserId)) {
        onlineUsers.set(currentUserId, new Set());
      }
      onlineUsers.get(currentUserId).add(socket.id);

      // Join a private room for this user for targeted multicasting
      socket.join(`user:${currentUserId}`);

      // Broadcast updated online users list to all clients
      const activeIds = Array.from(onlineUsers.keys());
      io.emit('online_users_update', activeIds);
      io.emit('user_status_change', { userId: currentUserId, isOnline: true });
    });

    // 2. Request current online users list
    socket.on('get_online_users', () => {
      socket.emit('online_users_update', Array.from(onlineUsers.keys()));
    });

    // 3. Real-Time Typing events
    socket.on('typing_start', ({ recipientId, senderName }) => {
      if (!recipientId || !currentUserId) return;
      io.to(`user:${recipientId}`).emit('user_typing', {
        userId: currentUserId,
        senderName: senderName || 'User',
      });
    });

    socket.on('typing_stop', ({ recipientId }) => {
      if (!recipientId || !currentUserId) return;
      io.to(`user:${recipientId}`).emit('user_stop_typing', {
        userId: currentUserId,
      });
    });

    // 4. Read receipts & Active Chat tracking
    socket.on('enter_chat', async ({ contactId }) => {
      if (!currentUserId || !contactId) return;
      const cIdStr = contactId.toString();
      userActiveChats.set(currentUserId, cIdStr);

      try {
        await Message.updateMany(
          { sender: cIdStr, recipient: currentUserId, read: false },
          { $set: { read: true } }
        );
      } catch (err) {
        console.error('Socket enter_chat mark_read error:', err.message);
      }

      io.to(`user:${cIdStr}`).emit('conversation_read', {
        readerId: currentUserId,
      });
    });

    socket.on('leave_chat', () => {
      if (!currentUserId) return;
      userActiveChats.delete(currentUserId);
    });

    socket.on('mark_read', async ({ otherUserId }) => {
      if (!otherUserId || !currentUserId) return;
      try {
        await Message.updateMany(
          { sender: otherUserId, recipient: currentUserId, read: false },
          { $set: { read: true } }
        );
      } catch (err) {
        console.error('Socket mark_read error:', err.message);
      }
      io.to(`user:${otherUserId}`).emit('conversation_read', {
        readerId: currentUserId,
      });
    });

    // 5. Attendance Session Room Management (Podium Kiosk & Teacher Device)
    socket.on('join_attendance_session', (sessionCode) => {
      if (!sessionCode) return;
      const room = `session:${sessionCode.toUpperCase().trim()}`;
      socket.join(room);
    });

    socket.on('leave_attendance_session', (sessionCode) => {
      if (!sessionCode) return;
      const room = `session:${sessionCode.toUpperCase().trim()}`;
      socket.leave(room);
    });

    // 6. Disconnect handling
    socket.on('disconnect', () => {
      if (currentUserId && onlineUsers.has(currentUserId)) {
        const userSockets = onlineUsers.get(currentUserId);
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(currentUserId);
          userActiveChats.delete(currentUserId);
          // Broadcast offline event
          const activeIds = Array.from(onlineUsers.keys());
          io.emit('online_users_update', activeIds);
          io.emit('user_status_change', { userId: currentUserId, isOnline: false });
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

export const isUserOnline = (userId) => {
  if (!userId) return false;
  return onlineUsers.has(userId.toString());
};

export const isUserInChatWith = (userId, targetUserId) => {
  if (!userId || !targetUserId) return false;
  return userActiveChats.get(userId.toString()) === targetUserId.toString();
};

export const getOnlineUserIds = () => {
  return Array.from(onlineUsers.keys());
};

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId.toString()}`).emit(event, payload);
};

export const emitToSession = (sessionCode, event, payload) => {
  if (!io || !sessionCode) return;
  io.to(`session:${sessionCode.toUpperCase().trim()}`).emit(event, payload);
};

export const broadcastEvent = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};
