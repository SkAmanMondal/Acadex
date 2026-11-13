import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket, useRealtimeSync } from '../../context/SocketContext';
import AttendanceSessionModal from '../attendance/AttendanceSessionModal';
import LiveSessionBanner from '../attendance/LiveSessionBanner';
import {
  QrCode,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Award,
  Users,
  CheckCircle,
  Play,
  AlertTriangle,
  Plus,
  Send,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export default function TeacherDashboard({ user }) {
  const { socket } = useSocket();
  const [metrics, setMetrics] = useState(() => {
    try {
      const cached = sessionStorage.getItem(`acadex_teacher_metrics_${user?._id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [activeSession, setActiveSession] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activatingSlotId, setActivatingSlotId] = useState('');
  const [activationMsg, setActivationMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(!metrics);

  const loadTeacherData = async (isSilent = false) => {
    try {
      if (!isSilent && !metrics) setLoading(true);
      const res = await api.get('/analytics/dashboard-metrics');
      if (res.data?.success) {
        const data = res.data.data;
        setMetrics(data);
        try {
          sessionStorage.setItem(`acadex_teacher_metrics_${user?._id}`, JSON.stringify(data));
        } catch {}
        if (data.activeSession) {
          setActiveSession(data.activeSession);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherData(Boolean(metrics));
  }, []);

  // Zero-refresh automatic live synchronization on classes, attendance & academic updates
  useRealtimeSync(['attendance_updated', 'timetable_updated', 'dashboard_refresh', 'mentorship_updated'], () => loadTeacherData(true));

  // Real-time socket event listeners for teacher
  useEffect(() => {
    if (!socket) return;

    const onSessionLive = (liveData) => {
      setActiveSession((prev) => ({
        ...(prev || {}),
        status: 'active',
        ...liveData,
      }));
    };

    const onStudentScanned = (scanData) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalScanned: scanData.totalScanned,
        };
      });
    };

    const onSessionEnded = () => {
      setActiveSession(null);
      loadTeacherData();
    };

    const onSessionCancelled = () => {
      setActiveSession(null);
      loadTeacherData();
    };

    socket.on('attendance_session_live', onSessionLive);
    socket.on('attendance_student_scanned', onStudentScanned);
    socket.on('attendance_session_ended', onSessionEnded);
    socket.on('attendance_session_cancelled', onSessionCancelled);

    return () => {
      socket.off('attendance_session_live', onSessionLive);
      socket.off('attendance_student_scanned', onStudentScanned);
      socket.off('attendance_session_ended', onSessionEnded);
      socket.off('attendance_session_cancelled', onSessionCancelled);
    };
  }, [socket]);

  const handleActivateAttendance = async (timetableId) => {
    try {
      setActivatingSlotId(timetableId);
      setActivationMsg({ type: '', text: '' });
      const res = await api.post('/attendance/session/activate', { timetableId });
      if (res.data?.success) {
        setActiveSession(res.data.data);
        setShowSessionModal(true); // Open modal with code, open scanner button, and cancel button!
        loadTeacherData();
      }
    } catch (err) {
      setActivationMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to activate session',
      });
    } finally {
      setActivatingSlotId('');
    }
  };

  const handleEndEarlyFromBanner = async () => {
    if (!activeSession?._id) return;
    try {
      await api.post(`/attendance/session/${activeSession._id}/end`);
      setActiveSession(null);
      loadTeacherData();
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const handleCancelFromBanner = async () => {
    if (!activeSession?._id) return;
    try {
      await api.post(`/attendance/session/${activeSession._id}/cancel`);
      setActiveSession(null);
      loadTeacherData();
    } catch (err) {
      console.error('Failed to cancel session:', err);
    }
  };

  const todaySlots = metrics?.todaySlots || [];

  return (
    <div className="space-y-6">
      {/* 1. Faculty Command Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-brand-700 to-purple-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
                Faculty Academic Workspace
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                Department of {user?.department?.name || 'Computer Applications'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome, {user?.name}
            </h1>
            <p className="text-indigo-100 text-xs md:text-sm max-w-xl leading-relaxed">
              Manage classroom lecture sessions, launch webcam QR scanners, author subject quizzes, and evaluate student submissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/teacher/scanner"
              className="px-4 py-2.5 rounded-2xl bg-white text-brand-700 text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer flex items-center gap-2"
            >
              <QrCode size={16} />
              <span>Open Classroom Scanner</span>
            </Link>
            <Link
              to="/kiosk"
              target="_blank"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition cursor-pointer flex items-center gap-2"
            >
              <span>Podium PC Kiosk Mode</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {activationMsg.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
            activationMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <span>{activationMsg.text}</span>
          <button onClick={() => setActivationMsg({ type: '', text: '' })} className="cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 2. Active / Pending Attendance Session Live Banner */}
      {activeSession && (
        <LiveSessionBanner
          session={activeSession}
          onOpenModal={() => setShowSessionModal(true)}
          onEndEarly={handleEndEarlyFromBanner}
          onCancel={handleCancelFromBanner}
        />
      )}

      {/* Mentee Attendance Shortage Defaulters Alert */}
      {metrics?.menteeDefaultersCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50/60 to-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-amber-950">
          <div className="flex items-start md:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                  Mentee Attendance Alert
                </span>
                <span className="text-xs font-bold text-amber-900">
                  {metrics.menteeDefaultersCount} Mentee{metrics.menteeDefaultersCount > 1 ? 's' : ''} &lt;75% Attendance
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-amber-950 mt-1">
                Attendance Shortage: {metrics.menteeDefaultersCount} of your assigned mentees have attendance below the mandatory 75% threshold.
              </h3>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Reach out to your mentees via direct chat or review attendance audit logs to initiate remedial academic intervention.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/messages"
              className="px-3.5 py-2 rounded-2xl bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100/60 transition"
            >
              Direct Chat
            </Link>
            <Link
              to="/attendance/report"
              className="px-3.5 py-2 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
            >
              <span>View Audit</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* 3. Operational KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-indigo-50/50 p-4 sm:p-5 rounded-2xl border-2 border-indigo-200/90 border-t-4 border-t-indigo-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              Assigned Slots
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{metrics?.totalSlots || 0}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Weekly lectures & labs</p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar size={18} />
          </span>
        </div>

        <div className="bg-gradient-to-br from-white to-amber-50/50 p-4 sm:p-5 rounded-2xl border-2 border-amber-200/90 border-t-4 border-t-amber-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Pending Submissions
            </span>
            <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums">{metrics?.pendingGrades || 0}</p>
            <Link to="/assignments" className="text-[11px] text-amber-800 font-bold hover:underline mt-0.5 block">
              Evaluate Work →
            </Link>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
            <FileText size={18} />
          </span>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50/50 p-4 sm:p-5 rounded-2xl border-2 border-purple-200/90 border-t-4 border-t-purple-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
              Active Quizzes
            </span>
            <p className="text-2xl font-black text-purple-900 mt-1 tabular-nums">{metrics?.totalQuizzes || 0}</p>
            <Link to="/quizzes" className="text-[11px] text-purple-700 font-bold hover:underline mt-0.5 block">
              + Author Quiz →
            </Link>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Award size={18} />
          </span>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 p-4 sm:p-5 rounded-2xl border-2 border-emerald-200/90 border-t-4 border-t-emerald-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Assigned Mentees
            </span>
            <p className="text-2xl font-black text-emerald-800 mt-1 tabular-nums">{metrics?.totalMentees || 0}</p>
            <Link to="/mentorship" className="text-[11px] text-emerald-700 font-bold hover:underline mt-0.5 block">
              Mentee Support →
            </Link>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Users size={18} />
          </span>
        </div>
      </div>

      {/* 4. Main Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Today's Lectures & Quick Launch Attendance */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl border-2 border-slate-200/90 border-t-4 border-t-brand-500 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Calendar size={18} />
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">Today's Teaching Schedule</h3>
              </div>
              <Link to="/timetables" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                View Weekly Schedule →
              </Link>
            </div>

            <div className="space-y-3">
              {todaySlots.map((slot) => {
                const isPaused = slot.status === 'paused';
                const isCompleted = slot.status === 'completed';
                const timetableTargetId = slot.timetable?._id || slot.timetable || slot._id;

                return (
                  <div
                    key={slot._id}
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isPaused
                        ? 'bg-slate-100/90 border-slate-300 opacity-85'
                        : isCompleted
                        ? 'bg-emerald-50/60 border-emerald-200/80'
                        : 'bg-slate-50 border-slate-200/80 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center font-bold text-xs shrink-0 ${
                          isPaused
                            ? 'bg-slate-200 border-slate-300 text-slate-500'
                            : isCompleted
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-brand-50 border-brand-200 text-brand-700'
                        }`}
                      >
                        <Clock size={14} className="mb-0.5" />
                        <span className="text-[10px]">{slot.startTime}</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isPaused ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {slot.subject?.code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                            {slot.batch?.name}
                          </span>
                          {slot.isSubstituted && (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                              ⭐ Substitute Assigned
                            </span>
                          )}
                          {isPaused && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-slate-300 text-slate-800 uppercase">
                              Class Paused Today
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ Completed Today
                            </span>
                          )}
                        </div>
                        <h4
                          className={`text-xs font-extrabold mt-1 ${
                            isPaused ? 'text-slate-600 line-through' : 'text-slate-900'
                          }`}
                        >
                          {slot.subject?.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Room: <strong className="text-slate-700">{slot.classroom?.roomNumber}</strong>
                          {slot.isSubstituted && slot.originalTeacher && (
                            <span className="text-amber-700 font-semibold ml-1">
                              • Covered for {slot.originalTeacher.name}
                            </span>
                          )}
                        </p>
                        {isPaused && slot.pauseReason && (
                          <p className="text-[11px] text-rose-600 font-medium italic mt-0.5">
                            Reason: {slot.pauseReason}
                          </p>
                        )}
                        {isCompleted && slot.attendanceStats && (
                          <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                            📊 Attendance: {slot.attendanceStats.presentCount || 0} Present • {slot.attendanceStats.absentCount || 0} Absent
                          </p>
                        )}
                      </div>
                    </div>

                    {isPaused ? (
                      <span className="px-3.5 py-1.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold border border-slate-300 self-start sm:self-auto cursor-not-allowed">
                        Class Paused
                      </span>
                    ) : isCompleted ? (
                      <Link
                        to="/timetables"
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs hover:bg-emerald-50 transition self-start sm:self-auto flex items-center gap-1.5"
                      >
                        <CheckCircle size={13} className="text-emerald-600" />
                        <span>View Roster</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleActivateAttendance(timetableTargetId)}
                        disabled={activatingSlotId === timetableTargetId}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-sm hover:shadow transition cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Launch Attendance</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {todaySlots.length === 0 && (
                <p className="text-slate-400 text-center py-6 text-xs">No teaching slots scheduled for today.</p>
              )}
            </div>
          </div>

          {/* Quick Academic Management Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Upload Materials Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-brand-600 font-extrabold text-xs">
                <BookOpen size={16} />
                <span>Curriculum Study Resources</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload lecture slide decks, syllabus outlines, or previous question papers for your enrolled batches.
              </p>
              <Link
                to="/materials"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 pt-2"
              >
                <span>+ Upload Learning Material</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* CIA Internal Marks Entry */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs">
                <Award size={16} />
                <span>Continuous Internal Assessments (CIA)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Record mid-term continuous evaluation marks (out of 50) directly into student academic profiles.
              </p>
              <Link
                to="/examinations/internals"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 pt-2"
              >
                <span>Record Internal Marks</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Academic Doubts & Direct Messaging */}
        <div className="lg:col-span-4 space-y-6">
          {/* Faculty Mentor Special Hub */}
          {Boolean(user?.isMentor || user?.profile?.isMentor) && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 rounded-3xl border border-amber-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                  <UserCheck size={16} className="text-amber-700" />
                  <span>Chief Faculty Mentorship Hub</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900">
                  {metrics?.totalMentees || 5} Mentees Assigned
                </span>
              </div>

              <p className="text-xs text-amber-900/80 leading-relaxed">
                Monitor live attendance %, CIA scores, and attendance risk alerts for your assigned student cohort.
              </p>

              <div className="space-y-2 pt-1">
                <Link
                  to="/mentorship"
                  className="w-full py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Users size={14} />
                  <span>Manage Mentee Roster & Risk Alerts</span>
                </Link>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                <MessageSquare size={16} className="text-brand-600" />
                <span>Student Academic Inquiries</span>
              </div>
              <Link to="/messages" className="text-[11px] font-bold text-brand-600">
                Open Chat →
              </Link>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Enrolled students and assigned mentees can message you directly for doubt clarification and project guidance.
            </p>

            <Link
              to="/messages"
              className="w-full py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Send size={14} />
              <span>Open Direct Messaging</span>
            </Link>
          </div>

          {/* Attendance Audit Quick Link */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              Compliance Oversight
            </span>
            <h4 className="text-sm font-extrabold">Batch Attendance Ledger</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Review attendance rates for your batches and identify students falling below the mandatory 75% minimum.
            </p>
            <Link
              to="/attendance/report"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white transition"
            >
              <span>View Batch Attendance Audit</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Real-Time Attendance Session Modal (Phone Controls + Podium Code) */}
      <AttendanceSessionModal
        isOpen={showSessionModal}
        session={activeSession}
        onClose={() => setShowSessionModal(false)}
        onSessionUpdated={(updated) => {
          setActiveSession(updated);
          loadTeacherData();
        }}
      />
    </div>
  );
}
