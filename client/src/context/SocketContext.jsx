import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: { senderName, timestamp } }
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [lastIncomingMessage, setLastIncomingMessage] = useState(null);
  const [lastReadReceipt, setLastReadReceipt] = useState(null);

  const socketRef = useRef(null);
  const typingTimersRef = useRef({});

  useEffect(() => {
    // Only connect if user is logged in
    if (!user?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setOnlineUsers(new Set());
        setTypingUsers({});
      }
      return;
    }

    const newSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      // Register current user
      newSocket.emit('register_user', user._id);
    });

    // Listen for online users updates
    newSocket.on('online_users_update', (userIds) => {
      setOnlineUsers(new Set(userIds.map((id) => id.toString())));
    });

    newSocket.on('user_status_change', ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(userId.toString());
        } else {
          next.delete(userId.toString());
        }
        return next;
      });
    });

    // Listen for typing events
    newSocket.on('user_typing', ({ userId, senderName }) => {
      if (!userId) return;
      const uId = userId.toString();

      // Clear any existing reset timer for this user
      if (typingTimersRef.current[uId]) {
        clearTimeout(typingTimersRef.current[uId]);
      }

      setTypingUsers((prev) => ({
        ...prev,
        [uId]: { senderName: senderName || 'User', timestamp: Date.now() },
      }));

      // Auto clear typing state after 3 seconds of inactivity
      typingTimersRef.current[uId] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[uId];
          return next;
        });
        delete typingTimersRef.current[uId];
      }, 3000);
    });

    newSocket.on('user_stop_typing', ({ userId }) => {
      if (!userId) return;
      const uId = userId.toString();
      if (typingTimersRef.current[uId]) {
        clearTimeout(typingTimersRef.current[uId]);
        delete typingTimersRef.current[uId];
      }
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[uId];
        return next;
      });
    });

    // Listen for incoming messages
    newSocket.on('receive_message', (msg) => {
      setLastIncomingMessage(msg);
      // If message is from someone else and not already read, increment unread counter
      const senderId = (msg.sender?._id || msg.sender)?.toString();
      const currentUserId = user?._id?.toString();
      if (!msg.read && senderId && senderId !== currentUserId) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    // Listen for conversation read receipts
    newSocket.on('conversation_read', ({ readerId }) => {
      if (readerId) {
        setLastReadReceipt({ readerId: readerId.toString(), timestamp: Date.now() });
      }
    });

    return () => {
      // Cleanup typing timers
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
      newSocket.disconnect();
    };
  }, [user?._id]);

  // Helper: check if a user is online
  const isOnline = useCallback(
    (targetUserId) => {
      if (!targetUserId) return false;
      return onlineUsers.has(targetUserId.toString());
    },
    [onlineUsers]
  );

  // Helper: emit typing start
  const startTyping = useCallback(
    (recipientId) => {
      if (!socketRef.current || !recipientId || !user?._id) return;
      socketRef.current.emit('typing_start', {
        recipientId: recipientId.toString(),
        senderName: user.name,
      });
    },
    [user?.name, user?._id]
  );

  // Helper: emit typing stop
  const stopTyping = useCallback(
    (recipientId) => {
      if (!socketRef.current || !recipientId || !user?._id) return;
      socketRef.current.emit('typing_stop', {
        recipientId: recipientId.toString(),
      });
    },
    [user?._id]
  );

  // Helper: mark conversation read
  const markConversationRead = useCallback(
    (otherUserId) => {
      if (!socketRef.current || !otherUserId) return;
      socketRef.current.emit('mark_read', { otherUserId: otherUserId.toString() });
      setUnreadChatCount(0);
    },
    []
  );

  // Helper: enter active chat room with contact
  const enterChat = useCallback(
    (contactId) => {
      if (!socketRef.current || !contactId) return;
      socketRef.current.emit('enter_chat', { contactId: contactId.toString() });
      setUnreadChatCount(0);
    },
    []
  );

  // Helper: leave active chat room
  const leaveChat = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('leave_chat');
  }, []);

  const value = {
    socket,
    onlineUsers,
    isOnline,
    onlineCount: onlineUsers.size,
    typingUsers,
    startTyping,
    stopTyping,
    markConversationRead,
    enterChat,
    leaveChat,
    unreadChatCount,
    setUnreadChatCount,
    lastIncomingMessage,
    lastReadReceipt,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

/**
 * Hook to automatically synchronize and re-fetch page data in real-time
 * whenever relevant backend entities change, eliminating manual page reloads.
 *
 * @param {string|string[]} events - Socket event name or array of event names
 * @param {Function} onSync - Callback function to re-fetch or update component state
 * @param {Object} [options] - Optional debounce config { debounceMs: number }
 */
export function useRealtimeSync(events, onSync, options = {}) {
  const { socket } = useSocket();
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const eventList = Array.isArray(events) ? events : [events];
  const eventKey = eventList.sort().join(',');

  useEffect(() => {
    if (!socket) return;

    let debounceTimer = null;
    const handler = (payload) => {
      const delay = options.debounceMs ?? 150; // default 150ms gentle debounce to coalesce rapid bulk events
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (onSyncRef.current) {
          onSyncRef.current(payload);
        }
      }, delay);
    };

    eventList.forEach((ev) => socket.on(ev, handler));

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      eventList.forEach((ev) => socket.off(ev, handler));
    };
  }, [socket, eventKey]);
}
