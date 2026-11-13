import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Clock,
  Users,
  Square,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function LiveSessionBanner({
  session,
  onOpenModal,
  onEndEarly,
  onCancel,
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(600);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'active' && session.expiresAt) {
      const secs = Math.max(0, Math.floor((new Date(session.expiresAt) - new Date()) / 1000));
      setRemainingSeconds(secs);
    } else {
      setRemainingSeconds((session.durationMinutes || 10) * 60);
    }
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.status]);

  if (!session || (session.status !== 'pending' && session.status !== 'active')) {
    return null;
  }

  const isPending = session.status === 'pending';
  const isActive = session.status === 'active';

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className={`rounded-3xl p-5 shadow-lg border transition-all ${
        isActive
          ? 'bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 text-white border-emerald-600/30 shadow-emerald-900/20'
          : 'bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-indigo-800/40 shadow-indigo-950/20'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Info Section */}
        <div className="flex items-center gap-3.5">
          <span
            data-nav-icon="true"
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isActive
                ? 'bg-white/15 text-emerald-200 border border-white/20'
                : 'bg-white/15 text-indigo-200 border border-white/20'
            }`}
          >
            <QrCode size={22} className="shrink-0 text-current" />
          </span>

          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isActive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isActive ? 'bg-emerald-300' : 'bg-amber-300'
                  }`}
                />
              </span>
              <h4 className="text-sm font-extrabold tracking-tight">
                {isActive ? 'Scan is LIVE on Podium' : 'Attendance Session Pending'}
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono font-black tracking-widest text-white">
                CODE: {session.sessionCode}
              </span>
            </div>

            <p className="text-xs text-white/80 mt-0.5">
              {session.subject?.name || 'Classroom Lecture'} •{' '}
              {session.classroom?.roomNumber ? `Hall ${session.classroom.roomNumber}` : 'Classroom'}
            </p>
          </div>
        </div>

        {/* Right Stats & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isActive && (
            <div className="flex items-center gap-3 bg-black/20 rounded-2xl px-3.5 py-1.5 border border-white/10 text-xs">
              <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-200">
                <Clock size={13} />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
              <div className="w-px h-3.5 bg-white/20" />
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Users size={13} />
                <span>{session.totalScanned || 0} Present</span>
              </div>
            </div>
          )}

          <button
            onClick={onOpenModal}
            className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          >
            <span>{isPending ? 'View Code & Controls' : 'Live Monitor'}</span>
            <ChevronRight size={14} />
          </button>

          {isActive && (
            <button
              onClick={onEndEarly}
              className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 border border-rose-500/50"
            >
              <Square size={12} fill="currentColor" />
              <span>End Early</span>
            </button>
          )}

          {isPending && (
            <button
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-rose-600 hover:text-white text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 border border-white/10"
            >
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}