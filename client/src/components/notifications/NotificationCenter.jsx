import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  AlertTriangle,
  Award,
  FileText,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  X,
  Eye,
} from 'lucide-react';

export default function NotificationCenter({ align = 'right', buttonClassName = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 0, bottom: 0 });

  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  // Load notifications from API
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Auto refresh every 45 seconds for live alerts
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Update button coordinates on screen
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  // Re-anchor on resize/scroll when open
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSelectedNotification(null);
      }
    };
    if (isOpen || selectedNotification) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedNotification]);

  // Mark single notification as read
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (selectedNotification && selectedNotification._id === id) {
        setSelectedNotification((prev) => ({ ...prev, isRead: true }));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Delete notification
  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      const deleted = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      if (selectedNotification && selectedNotification._id === id) {
        setSelectedNotification(null);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Handle item click
  const handleItemClick = (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }
    if (item.link) {
      setIsOpen(false);
      navigate(item.link);
    } else {
      setSelectedNotification(item);
    }
  };

  // Format relative time helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Type icon helper
  const getTypeIcon = (type) => {
    switch (type) {
      case 'attendance':
        return <AlertTriangle size={15} className="text-amber-500" />;
      case 'assignment':
        return <FileText size={15} className="text-blue-500" />;
      case 'quiz':
        return <HelpCircle size={15} className="text-purple-500" />;
      case 'grade':
        return <Award size={15} className="text-emerald-500" />;
      case 'timetable':
        return <Calendar size={15} className="text-indigo-500" />;
      case 'announcement':
        return <Bell size={15} className="text-sky-500" />;
      case 'system':
      default:
        return <ShieldCheck size={15} className="text-slate-500" />;
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    activeFilter === 'unread' ? !n.isRead : true
  );

  // Compute absolute fixed coordinates for the portal popover
  const getPopoverStyle = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popoverWidth = Math.min(384, viewportWidth - 24);

    // Sidebar alignment on desktop (md and above)
    if (align === 'sidebar' && viewportWidth >= 768) {
      const left = Math.min(coords.right + 12, viewportWidth - popoverWidth - 12);
      const top = Math.max(12, Math.min(coords.top, viewportHeight - 540));
      return {
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${Math.min(580, viewportHeight - 24)}px`,
      };
    }

    // Default / Header / Mobile alignment
    const top = Math.min(coords.bottom + 8, viewportHeight - 100);
    const right = Math.max(12, viewportWidth - coords.right);
    return {
      top: `${top}px`,
      right: `${right}px`,
      width: `${popoverWidth}px`,
      maxHeight: `${Math.min(580, viewportHeight - 24)}px`,
    };
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          updateCoords();
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-sm ring-2 ring-brand-500/20'
            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
        } ${buttonClassName}`}
        aria-label="Notification Center"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-md shadow-rose-500/40 ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-500 animate-ping opacity-30 pointer-events-none" />
          </>
        )}
      </button>

      {/* Popover Card Rendered Directly in Body via React Portal */}
      {isOpen &&
        createPortal(
          <div className="notification-center-portal">
            {/* Invisible backdrop to capture outside clicks without stacking context interference */}
            <div
              className="fixed inset-0 z-[9998] cursor-default bg-black/5 md:bg-transparent"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Notification Popover Box with solid non-transparent background */}
            <div
              ref={popoverRef}
              style={getPopoverStyle()}
              className="fixed z-[9999] bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden ring-1 ring-slate-900/10 flex flex-col animate-in fade-in zoom-in-95 duration-150 select-text"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
                    <Bell size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-200">
                          {unreadCount} unread
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Campus updates & academic alerts</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      title="Mark all as read"
                      className="px-2.5 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 rounded-lg flex items-center gap-1 transition cursor-pointer"
                    >
                      <CheckCheck size={13} />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                      activeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('unread')}
                    className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                      activeFilter === 'unread'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                <button
                  onClick={fetchNotifications}
                  className="text-[11px] font-medium text-slate-500 hover:text-brand-600 transition cursor-pointer"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 overscroll-contain">
                {filteredNotifications.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                      <Sparkles size={20} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">All caught up!</h4>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                      {activeFilter === 'unread'
                        ? 'No unread notifications at this time.'
                        : 'No notifications logged for your account.'}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((item) => {
                    const isUrgent = item.priority === 'urgent' || item.priority === 'high';
                    return (
                      <div
                        key={item._id}
                        onClick={() => handleItemClick(item)}
                        className={`p-3.5 transition group cursor-pointer relative flex gap-3 hover:bg-slate-50 ${
                          !item.isRead ? 'bg-blue-50/70' : 'bg-white'
                        }`}
                      >
                        {/* Priority Accent Indicator */}
                        <div
                          className={`w-1 self-stretch rounded-full shrink-0 ${
                            item.priority === 'urgent'
                              ? 'bg-rose-500'
                              : item.priority === 'high'
                              ? 'bg-amber-500'
                              : item.priority === 'medium'
                              ? 'bg-brand-500'
                              : 'bg-slate-200'
                          }`}
                        />

                        {/* Icon */}
                        <div className="mt-0.5 w-7 h-7 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                          {getTypeIcon(item.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-xs font-bold truncate ${
                                !item.isRead ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {item.title}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              {isUrgent && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                                  {item.priority}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-medium">
                                {formatTimeAgo(item.createdAt)}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>

                          {/* Footer info & inline actions */}
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            {item.link ? (
                              <span className="text-brand-600 font-semibold flex items-center gap-1 group-hover:underline">
                                View details <ChevronRight size={11} />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!item.isRead) handleMarkAsRead(item._id);
                                  setSelectedNotification(item);
                                }}
                                className="text-brand-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                View full alert <Eye size={11} />
                              </button>
                            )}

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              {!item.isRead && (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkAsRead(item._id, e)}
                                  title="Mark as read"
                                  className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                  <Check size={12} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDelete(item._id, e)}
                                title="Delete notification"
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/announcements');
                  }}
                  className="text-slate-600 hover:text-brand-700 font-medium flex items-center gap-1 transition cursor-pointer"
                >
                  <Bell size={12} />
                  <span>Campus Notices</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/messages');
                  }}
                  className="text-slate-600 hover:text-brand-700 font-medium flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Direct Messages →</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Full Notification Details Modal (rendered with highest priority z-[10000]) */}
      {selectedNotification &&
        createPortal(
          <div className="fixed inset-0 z-[10000] bg-slate-950/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                    {getTypeIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {selectedNotification.type} Notification
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {selectedNotification.title}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={13} className="text-slate-400" />
                  <span>
                    {new Date(selectedNotification.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </span>
                  {selectedNotification.priority && (
                    <span
                      className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        selectedNotification.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : selectedNotification.priority === 'high'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {selectedNotification.priority}
                    </span>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap select-text">
                  {selectedNotification.message}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={(e) => handleDelete(selectedNotification._id, e)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  {selectedNotification.link && (
                    <button
                      onClick={() => {
                        const link = selectedNotification.link;
                        setSelectedNotification(null);
                        setIsOpen(false);
                        navigate(link);
                      }}
                      className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Open Associated Page</span>
                      <ExternalLink size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
