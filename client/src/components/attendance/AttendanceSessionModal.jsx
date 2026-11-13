import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import {
  QrCode,
  Camera,
  X,
  XCircle,
  Copy,
  Check,
  Clock,
  Users,
  Play,
  Square,
  AlertTriangle,
  Radio,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function AttendanceSessionModal({
  isOpen,
  session,
  onClose,
  onSessionUpdated,
}) {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [currentSession, setCurrentSession] = useState(session);
  const [copied, setCopied] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [recentScans, setRecentScans] = useState([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmEndModal, setConfirmEndModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalSummary, setFinalSummary] = useState(null);

  // Sync session prop changes
  useEffect(() => {
    if (session) {
      setCurrentSession(session);
      setTotalScanned(session.totalScanned || 0);

      if (session.status === 'active' && session.expiresAt) {
        const secs = Math.max(0, Math.floor((new Date(session.expiresAt) - new Date()) / 1000));
        setRemainingSeconds(secs);
      } else {
        setRemainingSeconds((session.durationMinutes || 10) * 60);
      }
    }
  }, [session]);

  // Live countdown timer when active
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'active') return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession?.status]);

  // Real-time socket listeners for live updates from podium and student scans
  useEffect(() => {
    if (!socket || !currentSession) return;

    // 1. Session went LIVE on podium or phone
    const handleSessionLive = (liveData) => {
      if (liveData.sessionId === currentSession._id || liveData.sessionCode === currentSession.sessionCode) {
        setCurrentSession((prev) => ({
          ...prev,
          status: 'active',
          activatedAt: liveData.activatedAt,
          expiresAt: liveData.expiresAt,
        }));
        if (liveData.remainingSeconds) {
          setRemainingSeconds(liveData.remainingSeconds);
        }
        if (onSessionUpdated) {
          onSessionUpdated({ ...currentSession, status: 'active', ...liveData });
        }
      }
    };

    // 2. Real-time student scanned at podium
    const handleStudentScanned = (scanData) => {
      if (scanData.sessionId === currentSession._id || scanData.sessionCode === currentSession.sessionCode) {
        setTotalScanned(scanData.totalScanned);
        setRecentScans((prev) => [
          {
            ...scanData.student,
            scannedAt: scanData.scannedAt || new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
        if (onSessionUpdated) {
          onSessionUpdated((prev) => (prev ? { ...prev, totalScanned: scanData.totalScanned } : prev));
        }
      }
    };

    // 3. Session concluded
    const handleSessionEnded = (endData) => {
      if (endData.sessionId === currentSession._id || endData.sessionCode === currentSession.sessionCode) {
        setCurrentSession((prev) => ({ ...prev, status: 'finalized' }));
        setFinalSummary(endData);
        if (onSessionUpdated) {
          onSessionUpdated(null);
        }
      }
    };

    // 4. Session cancelled
    const handleSessionCancelled = (cancelData) => {
      if (cancelData.sessionId === currentSession._id || cancelData.sessionCode === currentSession.sessionCode) {
        setCurrentSession(null);
        if (onSessionUpdated) {
          onSessionUpdated(null);
        }
        onClose();
      }
    };

    socket.on('attendance_session_live', handleSessionLive);
    socket.on('attendance_student_scanned', handleStudentScanned);
    socket.on('attendance_session_ended', handleSessionEnded);
    socket.on('attendance_session_cancelled', handleSessionCancelled);

    return () => {
      socket.off('attendance_session_live', handleSessionLive);
      socket.off('attendance_student_scanned', handleStudentScanned);
      socket.off('attendance_session_ended', handleSessionEnded);
      socket.off('attendance_session_cancelled', handleSessionCancelled);
    };
  }, [socket, currentSession, onSessionUpdated, onClose]);

  if (!isOpen || !currentSession) return null;

  const isPending = currentSession.status === 'pending';
  const isActive = currentSession.status === 'active';
  const isFinalized = currentSession.status === 'finalized' || Boolean(finalSummary);

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyCode = () => {
    if (!currentSession?.sessionCode) return;
    navigator.clipboard.writeText(currentSession.sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Open Scanner on phone directly
  const handleOpenDirectScanner = async () => {
    try {
      if (isPending) {
        await api.post(`/attendance/session/${currentSession._id}/start-direct`);
      }
      onClose();
      navigate('/teacher/scanner');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to start phone scanner');
    }
  };

  // 2. Cancel session before podium entry
  const handleCancelSession = async () => {
    try {
      setIsCancelling(true);
      await api.post(`/attendance/session/${currentSession._id}/cancel`);
      if (onSessionUpdated) onSessionUpdated(null);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to cancel session');
    } finally {
      setIsCancelling(false);
    }
  };

  // 3. End session early from teacher's phone
  const handleEndSessionEarly = async () => {
    try {
      setIsEnding(true);
      setErrorMsg('');
      const res = await api.post(`/attendance/session/${currentSession._id}/end`);
      if (res.data?.success) {
        setFinalSummary(res.data.data);
        setCurrentSession((prev) => ({ ...prev, status: 'finalized' }));
        setConfirmEndModal(false);
        if (onSessionUpdated) onSessionUpdated(null);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to terminate session');
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header Bar */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span
              data-nav-icon="true"
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              }`}
            >
              <QrCode size={18} strokeWidth={2.3} className="shrink-0 text-current" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                {isPending
                  ? 'Classroom Attendance Launch'
                  : isActive
                  ? 'Podium Live Attendance'
                  : 'Attendance Session Summary'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {currentSession.subject?.name || 'Scheduled Lecture'} •{' '}
                {currentSession.classroom?.roomNumber ? `Hall ${currentSession.classroom.roomNumber}` : 'Classroom'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            title="Minimize window"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* ==================== STATE A: PENDING (Waiting for podium) ==================== */}
          {isPending && !finalSummary && (
            <div className="space-y-6">
              {/* Status beacon */}
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold w-fit mx-auto">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-amber-500 -ml-3" />
                <span>Waiting for Podium Input...</span>
              </div>

              {/* Big Session Code Display */}
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white text-center shadow-xl shadow-indigo-950/20 border border-indigo-800/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />

                <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-300">
                  Podium Terminal Code
                </span>

                <div className="my-3 text-4xl sm:text-5xl font-black font-mono tracking-[0.25em] text-white select-all drop-shadow-md">
                  {currentSession.sessionCode}
                </div>

                <p className="text-xs text-indigo-200/90 max-w-xs mx-auto leading-relaxed">
                  Enter this 6-character code into the Classroom Podium terminal to activate the webcam scanner.
                </p>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm border border-white/10 active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-emerald-300">Code Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Helpful Explanation */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Radio size={14} className="text-indigo-600" />
                  <span>How it works:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  1. The 10-minute timer will <strong className="text-slate-800">only start ticking</strong> once you enter this code on the podium.
                  <br />
                  2. As students scan, your phone will update in real-time.
                  <br />
                  3. You can <strong className="text-slate-800">end the session early anytime</strong> right from your phone.
                </p>
              </div>

              {/* Action Buttons: Open Scanner vs Cancel */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleOpenDirectScanner}
                  className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Camera size={15} />
                  <span>Open Scanner on Phone</span>
                </button>

                <button
                  onClick={handleCancelSession}
                  disabled={isCancelling}
                  className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 active:scale-98 border border-slate-200"
                >
                  <XCircle size={15} />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== STATE B: ACTIVE & LIVE ("Scan is live in teacher phone") ==================== */}
          {isActive && !finalSummary && (
            <div className="space-y-6">
              {/* Live Active Beacon */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg shadow-emerald-600/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    <span className="text-xs font-extrabold tracking-wider uppercase">
                      Scan is LIVE on Podium
                    </span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold tracking-widest">
                    CODE: {currentSession.sessionCode}
                  </span>
                </div>

                {/* Clock & Attendance KPIs */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/15">
                    <div className="flex items-center gap-1.5 text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                      <Clock size={12} />
                      <span>Clock Remaining</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-white mt-1">
                      {formatTimer(remainingSeconds)}
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/15">
                    <div className="flex items-center gap-1.5 text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                      <Users size={12} />
                      <span>Present Count</span>
                    </div>
                    <div className="text-2xl font-black text-white mt-1">
                      {totalScanned}{' '}
                      <span className="text-xs font-normal text-emerald-200">students</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Attendee Stream */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Live Attendee Stream</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {recentScans.length} recent
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 max-h-48 overflow-y-auto space-y-2">
                  {recentScans.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-medium">
                      Awaiting students to scan their QR tokens at the podium...
                    </div>
                  ) : (
                    recentScans.map((student, idx) => (
                      <div
                        key={student._id || idx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs flex items-center justify-between text-xs animate-fade-in"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <div>
                            <p className="font-bold text-slate-800">{student.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Roll: {student.rollNumber || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Just now
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* End Attendance Early Button (Teacher's Phone Only) */}
              <div className="pt-2">
                {!confirmEndModal ? (
                  <button
                    onClick={() => setConfirmEndModal(true)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-lg shadow-rose-600/25 transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Square size={14} fill="currentColor" />
                    <span>End Attendance Session Early</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                      <AlertTriangle size={15} />
                      <span>Confirm Early Termination</span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      This will immediately turn off the podium scanner and lock today's attendance records.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleEndSessionEarly}
                        disabled={isEnding}
                        className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isEnding ? 'Stopping...' : 'Yes, End Session Now'}
                      </button>
                      <button
                        onClick={() => setConfirmEndModal(false)}
                        className="px-4 py-2.5 rounded-xl bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold border border-slate-200 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== STATE C: FINALIZED SUMMARY ==================== */}
          {isFinalized && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-900">
                  Attendance Concluded Successfully
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  The classroom scanner session has closed.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 max-w-xs mx-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Students Recorded
                </span>
                <p className="text-3xl font-black text-slate-900 mt-0.5">
                  {totalScanned || finalSummary?.totalScanned || 0}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/attendance/report');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>View Attendance Ledger</span>
                  <ExternalLink size={13} />
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}