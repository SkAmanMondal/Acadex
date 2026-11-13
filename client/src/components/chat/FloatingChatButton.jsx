import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Sparkles, X, ChevronRight, Users, ArrowUpRight } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export default function FloatingChatButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { onlineCount, unreadChatCount, lastIncomingMessage, setUnreadChatCount } = useSocket();
  const [showPopup, setShowPopup] = useState(false);

  // If user is not logged in or is currently already on the messages page, hide the floating button
  if (!user || location.pathname === '/messages' || location.pathname === '/login' || location.pathname === '/kiosk') {
    return null;
  }

  const handleOpenMessenger = () => {
    setUnreadChatCount(0);
    setShowPopup(false);
    navigate('/messages');
  };

  return (
    <div className="fixed bottom-20 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-[calc(1.5rem+env(safe-area-inset-right,0px))] z-40 flex flex-col items-end">
      {/* Mini Quick Preview Toast / Popover */}
      {showPopup && (
        <div className="mb-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                <MessageSquare size={16} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Campus Chat</h4>
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} Peers & Faculty Online
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="py-3">
            {lastIncomingMessage ? (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-brand-700">
                    {lastIncomingMessage.sender?.name || 'Academic Contact'}
                  </span>
                  <span className="text-[9px] text-slate-400">Just now</span>
                </div>
                <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                  {lastIncomingMessage.content}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-2">
                Real-time doubts & instant mentoring with your assigned faculty.
              </p>
            )}
          </div>

          <button
            onClick={handleOpenMessenger}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Open Messenger</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <div className="relative group">
        {/* Tooltip on hover */}
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center gap-2 bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl pointer-events-none whitespace-nowrap transition">
          <span>Campus Messenger</span>
          <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {onlineCount} Online
          </span>
        </div>

        <button
          onClick={handleOpenMessenger}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowPopup((prev) => !prev);
          }}
          title="Open Campus Direct Messages"
          className="w-14 h-14 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-xl shadow-brand-500/35 hover:shadow-2xl hover:shadow-brand-500/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer ring-4 ring-white"
        >
          <div className="nav-icon-badge">
            <MessageSquare size={22} className="shrink-0 strokeWidth={2.2}" />
          </div>

          {/* Unread Message Counter Badge */}
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 text-white font-black text-[11px] flex items-center justify-center border-2 border-white shadow-md animate-bounce">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}

          {/* Online Presence Beacon */}
          {onlineCount > 0 && unreadChatCount === 0 && (
            <span
              title={`${onlineCount} peers online`}
              className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-400/40"
            />
          )}
        </button>
      </div>
    </div>
  );
}
