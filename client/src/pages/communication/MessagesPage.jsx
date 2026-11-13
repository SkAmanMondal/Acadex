import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  MessageSquare,
  Send,
  User,
  Shield,
  Search,
  Check,
  CheckCheck,
  GraduationCap,
  Sparkles,
  Info,
  Circle,
  Wifi,
  WifiOff,
  ChevronLeft,
  X,
  Users,
  Pin,
  PinOff,
  MoreVertical,
  Clock,
  Filter,
  CheckCircle2,
  Mail,
  CornerDownRight,
} from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const {
    socket,
    isOnline,
    onlineCount,
    typingUsers,
    startTyping,
    stopTyping,
    markConversationRead,
    enterChat,
    leaveChat,
    lastIncomingMessage,
    lastReadReceipt,
  } = useSocket();

  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'unread', 'pinned', 'mentor', 'hod', 'faculty', 'student'
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [desktopContactsOpen, setDesktopContactsOpen] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeDropdownContactId, setActiveDropdownContactId] = useState(null);

  // In-chat search within active conversation
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearch, setInChatSearch] = useState('');

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const targetContactId = location.state?.contactId || searchParams.get('contactId');

  const chatFeedRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatFeedRef.current) {
      const scrollTarget = chatFeedRef.current.scrollHeight;
      if (smooth) {
        chatFeedRef.current.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      } else {
        chatFeedRef.current.scrollTop = scrollTarget;
      }
    }
  }, []);

  const handleInputFocus = useCallback(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, []);

  // Time formatter helper
  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Sort contacts helper:
  // 1. Pinned contacts stay locked at the top
  // 2. Contacts with recent messages sorted by latest activity
  // 3. Mentors first, then HOD, then alphabetical name
  const sortContacts = useCallback((list) => {
    return [...list].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (timeA !== timeB && (timeA > 0 || timeB > 0)) {
        return timeB - timeA;
      }
      if (a.isMentor && !b.isMentor) return -1;
      if (!a.isMentor && b.isMentor) return 1;
      if (a.isHod && !b.isHod) return -1;
      if (!a.isHod && b.isHod) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, []);

  // Load contacts from backend with local pin-cache merge
  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await api.get('/communication/contacts');
      if (res.data?.success && res.data.data.length > 0) {
        let rawContacts = res.data.data;

        // Merge with local storage pin cache if available
        try {
          const localPins = JSON.parse(
            localStorage.getItem('acadex_pinned_contacts') || localStorage.getItem('campus360_pinned_contacts') || '[]'
          );
          if (Array.isArray(localPins) && localPins.length > 0) {
            const pinSet = new Set(localPins);
            rawContacts = rawContacts.map((c) => ({
              ...c,
              isPinned: c.isPinned || pinSet.has(c._id),
            }));
          }
        } catch {
          // ignore localStorage parsing errors
        }

        const sorted = sortContacts(rawContacts);
        setContacts(sorted);

        // Pre-selection priority:
        // 1. Contact explicitly requested via URL param or navigation state
        // 2. Pinned contact
        // 3. If student: Mentor contact
        // 4. First contact in the list
        let initialContact = null;
        if (targetContactId) {
          initialContact = sorted.find((c) => String(c._id) === String(targetContactId));
        }
        if (!initialContact && user?.role === 'student') {
          initialContact = sorted.find(
            (c) => c.isMentor || c.role === 'mentor' || c.relationship?.includes('Mentor')
          );
        }
        if (!initialContact && sorted.length > 0) {
          initialContact = sorted[0];
        }

        if (initialContact) {
          setSelectedContact(initialContact);
          // Auto-open chat pane on desktop, but keep contacts visible on mobile unless a specific contact was explicitly targeted
          if (targetContactId || window.innerWidth >= 640) {
            setMobileChatOpen(true);
          } else {
            setMobileChatOpen(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Load conversation with selected contact
  const loadConversation = async (contactId) => {
    if (!contactId) return;
    const contactIdStr = String(contactId);
    try {
      setLoadingMessages(true);
      const res = await api.get(`/communication/messages/${contactIdStr}`);
      if (res.data?.success) {
        setMessages(res.data.data);
        setTimeout(() => scrollToBottom(false), 50);
        markConversationRead(contactIdStr);

        // Clear unread count for this contact in state
        setContacts((prev) =>
          prev.map((c) => (String(c._id) === contactIdStr ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // Active chat room presence: notify backend when entering or leaving a conversation
  useEffect(() => {
    if (selectedContact?._id) {
      enterChat(selectedContact._id);
    }
    return () => {
      leaveChat();
    };
  }, [selectedContact?._id, enterChat, leaveChat]);

  useEffect(() => {
    if (targetContactId && contacts.length > 0) {
      const match = contacts.find((c) => String(c._id) === String(targetContactId));
      if (match && String(selectedContact?._id) !== String(match._id)) {
        setSelectedContact(match);
        setMobileChatOpen(true);
      }
    }
  }, [targetContactId, contacts]);

  useEffect(() => {
    if (selectedContact) {
      loadConversation(selectedContact._id);
      setShowInChatSearch(false);
      setInChatSearch('');
    }
  }, [selectedContact?._id]);

  // Click outside to dismiss contact actions dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.contact-menu-container')) {
        setActiveDropdownContactId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Real-time incoming message reaction
  useEffect(() => {
    if (!lastIncomingMessage) return;

    const senderId = (lastIncomingMessage.sender?._id || lastIncomingMessage.sender)?.toString();
    const recipientId = (lastIncomingMessage.recipient?._id || lastIncomingMessage.recipient)?.toString();
    const currentUserId = user?._id?.toString();
    const activeContactId = selectedContact?._id?.toString();

    const isFromActiveChat =
      activeContactId &&
      (senderId === activeContactId || (senderId === currentUserId && recipientId === activeContactId));

    if (isFromActiveChat) {
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(lastIncomingMessage._id))) return prev;
        const msgToAppend = senderId === activeContactId
          ? { ...lastIncomingMessage, read: true }
          : lastIncomingMessage;
        return [...prev, msgToAppend];
      });

      if (senderId === activeContactId) {
        markConversationRead(activeContactId);
        api.patch(`/communication/messages/${activeContactId}/read`).catch(() => {});
      }
      setTimeout(() => scrollToBottom(true), 50);
    }

    // Update contacts list lastMessage snippet and unreadCount
    setContacts((prev) => {
      const otherId = senderId === currentUserId ? recipientId : senderId;
      const updated = prev.map((c) => {
        if (String(c._id) === otherId) {
          const isSelected = activeContactId === otherId;
          const isIncoming = senderId !== currentUserId;
          return {
            ...c,
            unreadCount: isSelected || !isIncoming ? 0 : (c.unreadCount || 0) + 1,
            lastMessage: {
              content: lastIncomingMessage.content,
              createdAt: lastIncomingMessage.createdAt || new Date().toISOString(),
              sender: senderId,
              isMine: senderId === currentUserId,
              read: isSelected ? true : Boolean(lastIncomingMessage.read),
            },
          };
        }
        return c;
      });
      return sortContacts(updated);
    });
  }, [lastIncomingMessage, selectedContact?._id, user?._id, scrollToBottom, markConversationRead, sortContacts]);

  // Real-time read receipt reaction: when active contact reads messages sent by me
  useEffect(() => {
    if (!lastReadReceipt) return;

    const readerIdStr = String(lastReadReceipt.readerId);
    const activeContactIdStr = selectedContact?._id ? String(selectedContact._id) : null;

    if (activeContactIdStr && readerIdStr === activeContactIdStr) {
      setMessages((prev) =>
        prev.map((m) => {
          const isMine = (m.sender?._id || m.sender)?.toString() === user?._id?.toString();
          if (isMine && !m.read) {
            return { ...m, read: true };
          }
          return m;
        })
      );
    }

    setContacts((prev) =>
      prev.map((c) => {
        if (String(c._id) === readerIdStr && c.lastMessage?.isMine) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, read: true },
          };
        }
        return c;
      })
    );
  }, [lastReadReceipt, selectedContact?._id, user?._id]);

  // Real-time typing emission on input change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (!selectedContact) return;

    startTyping(selectedContact._id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(selectedContact._id);
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedContact) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping(selectedContact._id);

    const messageContent = inputText.trim();
    setInputText('');

    try {
      setSending(true);
      const res = await api.post('/communication/messages', {
        recipientId: selectedContact._id,
        content: messageContent,
      });

      if (res.data?.success) {
        const sentMsg = res.data.data;
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(sentMsg._id))) return prev;
          return [...prev, sentMsg];
        });

        // Update lastMessage on contact in contacts list
        const isRead = Boolean(sentMsg.read);
        setContacts((prev) => {
          const updated = prev.map((c) => {
            if (String(c._id) === String(selectedContact._id)) {
              return {
                ...c,
                lastMessage: {
                  content: sentMsg.content,
                  createdAt: sentMsg.createdAt,
                  sender: user._id,
                  isMine: true,
                  read: isRead,
                },
              };
            }
            return c;
          });
          return sortContacts(updated);
        });

        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deliver message');
    } finally {
      setSending(false);
    }
  };

  // Toggle Pin / Unpin Contact
  const handleTogglePin = async (contactId, e) => {
    if (e) e.stopPropagation();
    if (!contactId) return;
    const cIdStr = String(contactId);

    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (String(c._id) === cIdStr) {
          return { ...c, isPinned: !c.isPinned };
        }
        return c;
      });

      // Update localStorage cache
      const pinnedIds = updated.filter((c) => c.isPinned).map((c) => String(c._id));
      localStorage.setItem('acadex_pinned_contacts', JSON.stringify(pinnedIds));
      localStorage.setItem('campus360_pinned_contacts', JSON.stringify(pinnedIds));

      return sortContacts(updated);
    });

    if (selectedContact && String(selectedContact._id) === cIdStr) {
      setSelectedContact((prev) => (prev ? { ...prev, isPinned: !prev.isPinned } : prev));
    }

    setActiveDropdownContactId(null);

    try {
      await api.post(`/communication/contacts/${cIdStr}/pin`);
    } catch (err) {
      console.error('Failed to persist pin status:', err);
    }
  };

  // Mark conversation as read
  const handleMarkAsRead = async (contactId, e) => {
    if (e) e.stopPropagation();
    if (!contactId) return;
    const cIdStr = String(contactId);

    setContacts((prev) =>
      prev.map((c) => (String(c._id) === cIdStr ? { ...c, unreadCount: 0 } : c))
    );

    markConversationRead(cIdStr);
    setActiveDropdownContactId(null);

    try {
      await api.patch(`/communication/messages/${cIdStr}/read`);
    } catch (err) {
      console.error('Failed to mark conversation read:', err);
    }
  };

  // Mark conversation as unread
  const handleMarkAsUnread = async (contactId, e) => {
    if (e) e.stopPropagation();
    if (!contactId) return;
    const cIdStr = String(contactId);

    setContacts((prev) =>
      prev.map((c) =>
        String(c._id) === cIdStr
          ? { ...c, unreadCount: Math.max(1, (c.unreadCount || 0) + 1) }
          : c
      )
    );

    setActiveDropdownContactId(null);

    try {
      await api.patch(`/communication/messages/${cIdStr}/unread`);
    } catch (err) {
      console.error('Failed to mark conversation unread:', err);
    }
  };

  // Contact Selection
  const handleSelectContact = (contact) => {
    if (!contact) return;
    const cIdStr = String(contact._id);
    setSelectedContact(contact);
    setMobileChatOpen(true);
    setShowInChatSearch(false);
    setInChatSearch('');

    // Clear unread count immediately in state so badges and Unread filter update with zero latency
    setContacts((prev) =>
      prev.map((c) => (String(c._id) === cIdStr ? { ...c, unreadCount: 0 } : c))
    );

    markConversationRead(cIdStr);
    api.patch(`/communication/messages/${cIdStr}/read`).catch(() => {});
    loadConversation(cIdStr);
  };

  // Filtered contacts based on search query and active filter
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.relationship?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.lastMessage?.content?.toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (roleFilter === 'unread') {
        return (c.unreadCount || 0) > 0;
      }
      if (roleFilter === 'pinned') {
        return Boolean(c.isPinned);
      }
      if (roleFilter === 'mentor') {
        return c.role === 'mentor' || c.isMentor || c.relationship?.toLowerCase().includes('mentor');
      }
      if (roleFilter === 'mentees') {
        return Boolean(c.isMentee || c.relationship?.toLowerCase().includes('mentee'));
      }
      if (roleFilter === 'hod') {
        return c.role === 'hod' || c.isHod || c.relationship?.toLowerCase().includes('head');
      }
      if (roleFilter === 'faculty') {
        return (c.role === 'teacher' || c.role === 'hod' || c.isHod) && !c.isMentor && !c.relationship?.toLowerCase().includes('mentor');
      }
      if (roleFilter === 'student') {
        return c.role === 'student';
      }
      return true;
    });
  }, [contacts, searchQuery, roleFilter]);

  // Aggregate stats for filter chips
  const totalUnreadCount = useMemo(() => {
    return contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [contacts]);

  const totalPinnedCount = useMemo(() => {
    return contacts.filter((c) => c.isPinned).length;
  }, [contacts]);

  // In-chat filtered messages
  const displayedMessages = useMemo(() => {
    if (!inChatSearch.trim()) return messages;
    const term = inChatSearch.toLowerCase().trim();
    return messages.filter((m) => m.content?.toLowerCase().includes(term));
  }, [messages, inChatSearch]);

  const isContactOnline = selectedContact ? isOnline(selectedContact._id) : false;
  const isContactTyping = selectedContact ? Boolean(typingUsers[String(selectedContact._id)]) : false;

  return (
    <div id="acadex-chat-workspace" className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* 1. Header Bar (Shown only when no active contact is open, to maximize chat real estate) */}
      {!selectedContact && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-brand-700 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-white shadow-md shadow-indigo-500/10 flex items-center justify-between gap-3 shrink-0 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-extrabold tracking-tight truncate">
                  Direct Academic Messaging
                </h1>
                {totalUnreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-xs animate-pulse flex items-center gap-1">
                    <span>{totalUnreadCount} Unread</span>
                  </span>
                )}
                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Sync</span>
                </span>
              </div>
              <p className="text-blue-100 text-[10px] truncate hidden sm:block">
                Institutional academic communications, mentorship channels & verified faculty inquiry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-bold text-white">{onlineCount}</span>
              <span className="text-[10px] text-indigo-100 hidden sm:inline">Online</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Chat Workspace Card (Full Height, Left Scrollable, Right Fixed) */}
      <div className="flex-1 min-h-0 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-row">
        {/* Left: Scrollable Contacts List Panel (Full-width on mobile when no contact selected, side-by-side on desktop) */}
        <div
          className={`${
            selectedContact ? 'hidden sm:flex' : 'flex'
          } ${
            desktopContactsOpen ? 'sm:flex' : 'sm:hidden'
          } w-full sm:w-64 md:w-72 lg:w-80 shrink-0 border-r border-slate-200/80 flex-col bg-slate-50/50 min-h-0 overflow-hidden transition-all duration-150`}
        >
          {/* Contacts Header: Status & Online Counter */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare size={15} className="text-brand-600 shrink-0" />
              <span className="text-xs font-black text-slate-800 tracking-tight">Chats</span>
              {totalUnreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white">
                  {totalUnreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{onlineCount} Online</span>
            </div>
          </div>

          {/* Top Search Bar & Multi-Factor Filters (Shrink-0) */}
          <div className="p-2.5 sm:p-3 border-b border-slate-200/80 space-y-2 shrink-0 bg-white">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mentors, faculty, messages..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filter Chips: All, Unread, Pinned, Roles */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] no-scrollbar">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-2 py-1 rounded-lg font-bold capitalize transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  roleFilter === 'all'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>All</span>
                <span className={`text-[9px] px-1 py-0.2 rounded-full ${roleFilter === 'all' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {contacts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter('unread')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  roleFilter === 'unread'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : totalUnreadCount > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Unread</span>
                {totalUnreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white">
                    {totalUnreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter('pinned')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  roleFilter === 'pinned'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Pin size={10} className={roleFilter === 'pinned' ? 'fill-white' : 'fill-amber-500 text-amber-500'} />
                <span>Pinned</span>
                {totalPinnedCount > 0 && (
                  <span className={`text-[9px] px-1 py-0.2 rounded-full ${roleFilter === 'pinned' ? 'bg-white/20' : 'bg-slate-200'}`}>
                    {totalPinnedCount}
                  </span>
                )}
              </button>

              {(user?.role === 'student'
                ? ['mentor', 'hod', 'faculty']
                : ['mentees', 'student', 'faculty', 'hod']
              ).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-1 rounded-lg font-bold capitalize transition cursor-pointer shrink-0 ${
                    roleFilter === r
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r === 'mentees'
                    ? '⭐ Mentees'
                    : r === 'mentor'
                    ? '⭐ Mentors'
                    : r === 'hod'
                    ? 'HOD'
                    : r === 'faculty'
                    ? 'Faculty'
                    : 'Students'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Contacts List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {filteredContacts.map((contact) => {
              const isSelected = selectedContact && String(selectedContact._id) === String(contact._id);
              const contactOnline = isOnline(contact._id);
              const contactTyping = Boolean(typingUsers[String(contact._id)]);
              const isMentor = contact.isMentor || contact.relationship?.includes('Mentor');
              const isMentee = contact.isMentee || contact.relationship?.includes('Mentee');
              const isHod = contact.isHod || contact.role === 'hod' || contact.relationship?.includes('Head of Department');
              const isStudent = contact.role === 'student';
              const isPinned = Boolean(contact.isPinned);
              const hasUnread = (contact.unreadCount || 0) > 0;
              const isMenuOpen = activeDropdownContactId && String(activeDropdownContactId) === String(contact._id);

              return (
                <div
                  key={contact._id}
                  onClick={() => handleSelectContact(contact)}
                  className={`group w-full text-left p-2.5 rounded-2xl transition cursor-pointer flex items-center gap-2.5 relative ${
                    isSelected
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20'
                      : 'hover:bg-white text-slate-700 bg-white/40'
                  }`}
                >
                  {/* Avatar with Online Glow Indicator */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isMentor || isMentee
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : isHod
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-brand-50 text-brand-700 border border-brand-200'
                      }`}
                    >
                      {contact.name.charAt(0)}
                    </div>
                    {contactOnline && (
                      <span
                        title="Online Now"
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-400"
                      />
                    )}
                  </div>

                  {/* Contact Info, Last Message Snippet, Timestamp */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isPinned && (
                          <span title="Pinned conversation">
                            <Pin
                              size={11}
                              className={`shrink-0 ${
                                isSelected ? 'text-amber-200 fill-amber-200' : 'text-amber-500 fill-amber-500'
                              }`}
                            />
                          </span>
                        )}
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {contact.name}
                        </p>
                      </div>

                      {/* Time / Unread Badge */}
                      <div className="flex items-center gap-1 shrink-0">
                        {contact.lastMessage?.createdAt && (
                          <span
                            className={`text-[9px] ${
                              isSelected
                                ? 'text-indigo-200'
                                : hasUnread
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatMessageTime(contact.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subtitle / Last Message Snippet */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="flex-1 min-w-0">
                        {contactTyping ? (
                          <p className={`text-[10px] font-bold italic truncate animate-pulse ${isSelected ? 'text-amber-200' : 'text-brand-600'}`}>
                            typing...
                          </p>
                        ) : contact.lastMessage ? (
                          <p
                            className={`text-[10px] truncate ${
                              isSelected
                                ? 'text-indigo-100'
                                : hasUnread
                                ? 'font-bold text-slate-900'
                                : 'text-slate-500'
                            }`}
                          >
                            {contact.lastMessage.isMine && (
                              <span className={isSelected ? 'text-indigo-200' : 'text-slate-400'}>You: </span>
                            )}
                            {contact.lastMessage.content}
                          </p>
                        ) : (
                          <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {contact.relationship || contact.email}
                          </p>
                        )}
                      </div>

                      {/* Unread Counter Badge & Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {hasUnread && (
                          <span
                            className={`px-1.5 py-0.2 min-w-[18px] text-center text-[9px] font-black rounded-full shadow-xs ${
                              isSelected
                                ? 'bg-white text-brand-700'
                                : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white animate-pulse'
                            }`}
                          >
                            {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                          </span>
                        )}

                        {/* Quick Pin Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(contact._id, e)}
                          title={isPinned ? 'Unpin contact' : 'Pin contact to top'}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            isPinned
                              ? isSelected
                                ? 'text-amber-200 hover:bg-white/10'
                                : 'text-amber-500 hover:bg-amber-50'
                              : isSelected
                              ? 'text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100'
                              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Pin size={12} className={isPinned ? (isSelected ? 'fill-amber-200' : 'fill-amber-500') : ''} />
                        </button>

                        {/* 3-Dots Dropdown Menu */}
                        <div className="relative contact-menu-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownContactId(isMenuOpen ? null : contact._id);
                            }}
                            title="Chat Options"
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              isSelected
                                ? 'text-white/60 hover:text-white hover:bg-white/10'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <MoreVertical size={12} />
                          </button>

                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-30 text-slate-700 animate-in fade-in-50 zoom-in-95 text-xs font-medium"
                            >
                              <button
                                type="button"
                                onClick={(e) => handleTogglePin(contact._id, e)}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Pin size={13} className={isPinned ? 'fill-amber-500 text-amber-500' : 'text-slate-400'} />
                                <span>{isPinned ? 'Unpin Conversation' : 'Pin to Top'}</span>
                              </button>

                              {hasUnread ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkAsRead(contact._id, e)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-brand-600"
                                >
                                  <CheckCheck size={13} />
                                  <span>Mark as Read</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkAsUnread(contact._id, e)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-amber-700"
                                >
                                  <Clock size={13} />
                                  <span>Mark as Unread</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty State for Filters */}
            {filteredContacts.length === 0 && !loadingContacts && (
              <div className="text-center py-10 px-4 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  {roleFilter === 'unread' ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : roleFilter === 'pinned' ? (
                    <Pin size={20} className="text-amber-500" />
                  ) : (
                    <Users size={20} />
                  )}
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {roleFilter === 'unread'
                    ? "You're all caught up!"
                    : roleFilter === 'pinned'
                    ? 'No pinned conversations'
                    : 'No matching contacts found'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {roleFilter === 'unread'
                    ? 'There are no pending unread messages in your inbox.'
                    : roleFilter === 'pinned'
                    ? 'Click the 📌 pin icon on any contact to keep priority chats at the top.'
                    : 'Try checking your search terms or select the "All" filter.'}
                </p>
                {roleFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setRoleFilter('all')}
                    className="mt-2 text-xs font-bold text-brand-600 hover:text-brand-700 underline cursor-pointer"
                  >
                    View All Contacts
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Institutional Compliance Notice (Shrink-0) */}
          <div className="p-2.5 bg-amber-50/70 border-t border-amber-200/60 text-[10px] text-amber-900 flex items-center gap-2 shrink-0">
            <Info size={13} className="shrink-0 text-amber-700" />
            <span className="truncate">
              Direct messaging channels are reserved for academic inquiries.
            </span>
          </div>
        </div>

        {/* Right: Fixed Chat Panel (Full-width on mobile when active) */}
        <div
          className={`${
            selectedContact ? 'flex' : 'hidden sm:flex'
          } flex-1 min-w-0 flex-col bg-white overflow-hidden relative`}
        >
          {selectedContact ? (
            <>
              {/* Fixed Chat Header (Pinned at top of chat area) */}
              <div className="px-3 sm:px-4 py-2 border-b border-slate-200/80 flex items-center justify-between bg-white shadow-2xs shrink-0 z-10">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  {/* Mobile Back Button: Return to Contacts List */}
                  <button
                    type="button"
                    onClick={() => setSelectedContact(null)}
                    className="sm:hidden inline-flex items-center gap-1 p-1.5 -ml-1 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition cursor-pointer shrink-0"
                    title="Back to Contact List"
                  >
                    <ChevronLeft size={20} className="shrink-0 text-brand-600" />
                    <span className="text-xs font-bold text-brand-700">Chats</span>
                  </button>

                  {/* Desktop Contacts Panel Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setDesktopContactsOpen((prev) => !prev)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shrink-0 shadow-2xs"
                    title={desktopContactsOpen ? 'Collapse Contacts Panel' : 'Expand Contacts Panel'}
                  >
                    <Users size={14} className={desktopContactsOpen ? 'text-brand-600' : 'text-slate-400'} />
                    <span className="text-[11px] font-semibold">{desktopContactsOpen ? 'Hide Contacts' : 'Show Contacts'}</span>
                    {!desktopContactsOpen && totalUnreadCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black">
                        {totalUnreadCount}
                      </span>
                    )}
                  </button>

                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                      {selectedContact.name.charAt(0)}
                    </div>
                    {isContactOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {selectedContact.name}
                      </h3>
                      {selectedContact.isPinned && (
                        <span title="Pinned conversation">
                          <Pin size={12} className="text-amber-500 fill-amber-500 shrink-0" />
                        </span>
                      )}
                      {isContactOnline ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-slate-100 text-slate-500">
                          Offline
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {selectedContact.relationship || selectedContact.role} • {selectedContact.email}
                    </p>
                  </div>
                </div>

                {/* Header Action Tools: In-Chat Search, Pin Toggle, Mark Unread */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInChatSearch((prev) => !prev);
                      if (showInChatSearch) setInChatSearch('');
                    }}
                    title={showInChatSearch ? 'Close search' : 'Search in this conversation'}
                    className={`p-1.5 rounded-xl border transition cursor-pointer ${
                      showInChatSearch
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <Search size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleTogglePin(selectedContact._id, e)}
                    title={selectedContact.isPinned ? 'Unpin conversation' : 'Pin conversation to top'}
                    className={`p-1.5 rounded-xl border transition cursor-pointer ${
                      selectedContact.isPinned
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <Pin size={14} className={selectedContact.isPinned ? 'fill-amber-500 text-amber-500' : ''} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleMarkAsUnread(selectedContact._id, e)}
                    title="Mark conversation as unread"
                    className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer hidden sm:inline-flex"
                  >
                    <Clock size={14} />
                  </button>
                </div>
              </div>

              {/* In-Chat Message Search Input Bar */}
              {showInChatSearch && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0 animate-in fade-in-50">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={inChatSearch}
                    onChange={(e) => setInChatSearch(e.target.value)}
                    placeholder="Search keywords, doubts, links in this conversation..."
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-brand-500 outline-none"
                    autoFocus
                  />
                  {inChatSearch && (
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">
                      {displayedMessages.length} matches
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setInChatSearch('');
                      setShowInChatSearch(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Chat Messages Feed (Scrollable in middle, header and footer remain fixed) */}
              <div
                ref={chatFeedRef}
                className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-50/40"
              >
                {displayedMessages.map((msg) => {
                  const isMine =
                    (msg.sender?._id || msg.sender)?.toString() === user?._id?.toString();

                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl px-3.5 py-2 text-xs sm:text-[13px] leading-relaxed shadow-xs transition-all ${
                          isMine
                            ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-xs shadow-brand-500/10'
                            : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>

                      {/* Message Status & Timestamp */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 px-1">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {isMine && (
                          <span
                            className="flex items-center gap-0.5"
                            title={msg.read ? 'Read by recipient' : 'Delivered to server'}
                          >
                            {msg.read ? (
                              <>
                                <CheckCheck size={13} className="text-sky-500 font-bold" />
                                <span className="text-sky-600 font-bold text-[9px]">Read</span>
                              </>
                            ) : (
                              <>
                                <Check size={13} className="text-slate-400" />
                                <span className="text-slate-400 text-[9px]">Delivered</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Animated Typing Indicator */}
                {isContactTyping && (
                  <div className="flex items-center gap-2 text-slate-600 text-xs italic bg-white/95 border border-slate-200/80 px-3 py-1.5 rounded-2xl w-fit shadow-xs animate-fade-in">
                    <span className="font-bold text-slate-800">{selectedContact.name}</span>
                    <span className="text-slate-500">is typing</span>
                    <span className="flex items-center gap-1 ml-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                )}

                {/* Search Filter No Matches */}
                {inChatSearch && displayedMessages.length === 0 && (
                  <div className="py-8 text-center text-slate-400 space-y-1">
                    <p className="text-xs font-bold text-slate-600">No messages match "{inChatSearch}"</p>
                    <button
                      type="button"
                      onClick={() => setInChatSearch('')}
                      className="text-xs text-brand-600 hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {/* Empty Conversation History */}
                {messages.length === 0 && !loadingMessages && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 p-6">
                    <MessageSquare size={32} className="text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">No message history yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Send an academic inquiry, doubt clarification, or project update to {selectedContact.name}.
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Fixed Chat Input Footer (Pinned at bottom of chat area) */}
              <form
                onSubmit={handleSendMessage}
                className="p-2 sm:p-2.5 border-t border-slate-200/80 bg-white flex items-center gap-2 shrink-0 z-10"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  placeholder={`Write your message to ${selectedContact.name}...`}
                  className="flex-1 px-3.5 py-2 text-xs sm:text-[13px] border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50/70 focus:bg-white transition"
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  <Send size={13} className="shrink-0" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-8 text-center space-y-2">
              <MessageSquare size={36} className="text-slate-300" />
              <p className="font-semibold text-slate-600">Select a Contact</p>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Choose an authorized mentor, faculty member, or student from the left panel to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
