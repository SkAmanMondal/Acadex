import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, ChevronRight } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export default function FloatingChatButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { onlineCount, unreadChatCount, lastIncomingMessage, setUnreadChatCount } = useSocket();
  const [showPopup, setShowPopup] = useState(false);

  // Position state for desktop dragging
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('acadex_chat_btn_pos'));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        return saved;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, moved: false });

  // Initialize position and clamp on window resize
  useEffect(() => {
    const updatePosition = () => {
      setPosition((prev) => {
        const maxX = Math.max(16, window.innerWidth - 76);
        const maxY = Math.max(16, window.innerHeight - 76);
        if (!prev) {
          return { x: maxX - 16, y: maxY - 16 };
        }
        return {
          x: Math.max(16, Math.min(maxX, prev.x)),
          y: Math.max(16, Math.min(maxY, prev.y)),
        };
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  // Hide on phones, login page, kiosk, and messages page
  if (
    !user ||
    location.pathname === '/messages' ||
    location.pathname === '/login' ||
    location.pathname === '/kiosk'
  ) {
    return null;
  }

  const handleOpenMessenger = () => {
    setUnreadChatCount(0);
    setShowPopup(false);
    navigate('/messages');
  };

  const handleMouseDown = (e) => {
    // Only primary button
    if (e.button !== 0) return;
    e.preventDefault();

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position?.x ?? (window.innerWidth - 80),
      posY: position?.y ?? (window.innerHeight - 90),
      moved: false,
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        dragStartRef.current.moved = true;
        setIsDragging(true);
      }

      const maxX = Math.max(16, window.innerWidth - 76);
      const maxY = Math.max(16, window.innerHeight - 76);
      const nextX = Math.max(16, Math.min(maxX, dragStartRef.current.posX + deltaX));
      const nextY = Math.max(16, Math.min(maxY, dragStartRef.current.posY + deltaY));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setTimeout(() => {
        setIsDragging(false);
      }, 50);

      setPosition((cur) => {
        if (cur) {
          try {
            localStorage.setItem('acadex_chat_btn_pos', JSON.stringify(cur));
          } catch {
            // ignore
          }
        }
        return cur;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClick = (e) => {
    if (dragStartRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleOpenMessenger();
  };

  // Determine popup placement relative to button position
  const isTopHalf = position ? position.y < window.innerHeight / 2 : false;
  const isLeftHalf = position ? position.x < window.innerWidth / 2 : false;

  return (
    // Hidden on phone (< sm), visible only on desktop / tablet
    <div
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              position: 'fixed',
            }
          : {
              right: '1.5rem',
              bottom: '1.5rem',
              position: 'fixed',
            }
      }
      className="hidden sm:flex z-40 select-none flex-col items-end"
    >
      {/* Mini Quick Preview Toast / Popover */}
      {showPopup && (
        <div
          style={{
            position: 'absolute',
            [isTopHalf ? 'top' : 'bottom']: '4rem',
            [isLeftHalf ? 'left' : 'right']: 0,
          }}
          className="w-80 bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-150 z-50"
        >
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

      {/* Main Floating Draggable Trigger Button */}
      <div className="relative group">
        {/* Tooltip on hover */}
        {!isDragging && (
          <div
            className={`absolute ${
              isLeftHalf ? 'left-full ml-3' : 'right-full mr-3'
            } top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl pointer-events-none whitespace-nowrap transition`}
          >
            <span>Campus Messenger</span>
            <span className="text-[10px] text-slate-400 font-normal">
              (Drag to move)
            </span>
            <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount} Online
            </span>
          </div>
        )}

        <button
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowPopup((prev) => !prev);
          }}
          title="Drag to move • Click to open Messenger"
          className={`w-14 h-14 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-xl shadow-brand-500/35 hover:shadow-2xl hover:shadow-brand-500/50 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center ring-4 ring-white ${
            isDragging ? 'cursor-grabbing scale-105 ring-brand-400' : 'cursor-grab'
          }`}
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
