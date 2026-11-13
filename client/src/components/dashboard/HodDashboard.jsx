import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket, useRealtimeSync } from '../../context/SocketContext';
import AttendanceSessionModal from '../attendance/AttendanceSessionModal';
import LiveSessionBanner from '../attendance/LiveSessionBanner';
import {
  Building,
  Users,
  Calendar,
  AlertTriangle,
  QrCode,
  CheckCircle,
  FileText,
  BookOpen,
  Award,
  Bell,
  ChevronRight,
  TrendingUp,
  Play,
  Clock,
  Send,
} from 'lucide-react';

export default function HodDashboard({ user }) {
  const { socket } = useSocket();
  const [metrics, setMetrics] = useState(() => {
    try {
      const cached = sessionStorage.getItem(`acadex_hod_metrics_${user?._id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [riskStudents, setRiskStudents] = useState([]);
  const [deptClasses, setDeptClasses] = useState([]);
  const [todaySlots, setTodaySlots] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [loading, setLoading] = useState(!metrics);

  const loadHodData = async (isSilent = false) => {
    try {
      if (!isSilent && !metrics) setLoading(true);
      const [metRes, timeRes] = await Promise.allSettled([
        api.get('/analytics/dashboard-metrics'),
        api.get('/timetable'),
      ]);

      if (metRes.status === 'fulfilled' && metRes.value.data?.success) {
        const data = metRes.value.data.data;
        setMetrics(data);
        try {
          sessionStorage.setItem(`acadex_hod_metrics_${user?._id}`, JSON.stringify(data));
        } catch {}
        if (data.activeSession) {
          setActiveSession(data.activeSession);
        }
        if (Array.isArray(data.todayDepartmentClasses)) {
          setDeptClasses(data.todayDepartmentClasses);
        }
        if (Array.isArray(data.todaySlots) && data.todaySlots.length > 0) {
          setTodaySlots(data.todaySlots);
        }
      }

      if (timeRes.status === 'fulfilled' && timeRes.value.data?.success) {
        // Fallback filter if todaySlots not provided
        const scheduleList = Array.isArray(timeRes.value.data.data) ? timeRes.value.data.data : [];
        const mySlots = scheduleList.filter(
          (t) => t.teacher?._id === user?._id || t.teacher === user?._id
        );
        setTodaySlots((prev) => (prev && prev.length > 0 ? prev : mySlots));
      }

      // Progressive background fetch for risk indicators (does not block initial dashboard render)
      api.get('/analytics/risk-indicators')
        .then((riskRes) => {
          if (riskRes.data?.success) {
            setRiskStudents(riskRes.data.data.slice(0, 4));
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHodData(Boolean(metrics));
  }, [user]);

  // Zero-refresh automatic live synchronization on department analytics/students/attendance updates
  useRealtimeSync(['students_updated', 'attendance_updated', 'timetable_updated', 'dashboard_refresh'], () => loadHodData(true));

  // Real-time socket event listeners
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
      loadHodData();
    };

    const onSessionCancelled = () => {
      setActiveSession(null);
      loadHodData();
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
      const res = await api.post('/attendance/session/activate', { timetableId });
      if (res.data?.success) {
        setActiveSession(res.data.data);
        setShowSessionModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to activate session');
    }
  };

  const handleEndEarlyFromBanner = async () => {
    if (!activeSession?._id) return;
    try {
      await api.post(`/attendance/session/${activeSession._id}/end`);
      setActiveSession(null);
      loadHodData();
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const handleCancelFromBanner = async () => {
    if (!activeSession?._id) return;
    try {
      await api.post(`/attendance/session/${activeSession._id}/cancel`);
      setActiveSession(null);
      loadHodData();
    } catch (err) {
      console.error('Failed to cancel session:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HOD Department Command Center Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
                Departmental Leadership Portal
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                Department Head & Senior Faculty
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {user?.name}
            </h1>
            <p className="text-indigo-200 text-xs md:text-sm max-w-xl leading-relaxed">
              Command console for the <strong>{user?.department?.name || 'Department of Computer Applications'}</strong>. Manage departmental timetables, monitor academic risk indicators, and oversee faculty teaching activities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/teacher/scanner"
              className="px-4 py-2.5 rounded-2xl bg-white text-brand-800 text-xs font-bold shadow-lg hover:bg-slate-100 transition cursor-pointer flex items-center gap-2"
            >
              <QrCode size={16} />
              <span>Launch Classroom Scanner</span>
            </Link>
            <Link
              to="/timetables"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition cursor-pointer flex items-center gap-2"
            >
              <Calendar size={16} />
              <span>Manage Department Timetable</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Active / Pending Attendance Session Live Banner */}
      {activeSession && (
        <LiveSessionBanner
          session={activeSession}
          onOpenModal={() => setShowSessionModal(true)}
          onEndEarly={handleEndEarlyFromBanner}
          onCancel={handleCancelFromBanner}
        />
      )}

      {/* Department Attendance Shortage Defaulters Alert */}
      {metrics?.deptDefaultersCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50/60 to-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-amber-950">
          <div className="flex items-start md:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                  Attendance Compliance Alert
                </span>
                <span className="text-xs font-bold text-amber-900">
                  {metrics.deptDefaultersCount} Department Student{metrics.deptDefaultersCount > 1 ? 's' : ''} &lt;75%
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-amber-950 mt-1">
                Institutional Shortage Warning: {metrics.deptDefaultersCount} students in your department fall below the mandatory 75% attendance threshold.
              </h3>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Students below 75% are ineligible for End-Semester examinations. Review attendance records or instruct faculty mentors to intervene.
              </p>
            </div>
          </div>
          <Link
            to="/attendance/report"
            className="px-4 py-2.5 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap self-start md:self-center"
          >
            <span>Review Department Defaulters</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* 2. Departmental Macro KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-indigo-50/50 p-4 sm:p-5 rounded-2xl border-2 border-indigo-200/90 border-t-4 border-t-indigo-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              Enrolled Dept Students
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{metrics?.deptStudents || 0}</p>
            <Link to="/hod/students" className="text-[11px] text-brand-600 font-bold hover:underline mt-0.5 block">
              Student Registry →
            </Link>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
            <GraduationCap size={18} />
          </span>
        </div>

        <div className="bg-gradient-to-br from-white to-blue-50/50 p-4 sm:p-5 rounded-2xl border-2 border-blue-200/90 border-t-4 border-t-blue-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
              Department Faculty
            </span>
            <p className="text-2xl font-black text-blue-900 mt-1 tabular-nums">{metrics?.deptFaculty || 0}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Professors & Instructors</p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Users size={18} />
          </span>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 p-4 sm:p-5 rounded-2xl border-2 border-emerald-200/90 border-t-4 border-t-emerald-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Active Degree Batches
            </span>
            <p className="text-2xl font-black text-emerald-800 mt-1 tabular-nums">{metrics?.deptBatches || 0}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">MCA & CSE Cohorts</p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar size={18} />
          </span>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50/50 p-4 sm:p-5 rounded-2xl border-2 border-purple-200/90 border-t-4 border-t-purple-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
              Timetable Lecture Slots
            </span>
            <p className="text-2xl font-black text-purple-900 mt-1 tabular-nums">{metrics?.deptTimetableSlots || 0}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Weekly collision-free classes</p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Clock size={18} />
          </span>
        </div>
      </div>

      {/* 3. Main Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Academic Risk & Early Warning (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Department Academic Risk Center */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Academic Intelligence & Early Warning Flags
                </h3>
              </div>
              <Link to="/analytics" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                Full Risk Ledger →
              </Link>
            </div>

            <div className="space-y-3">
              {riskStudents.map((rep) => (
                <div
                  key={rep.student?._id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    rep.riskLevel === 'high'
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">{rep.student?.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">({rep.student?.rollNumber})</span>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          rep.riskLevel === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rep.riskLevel} Risk (Score: {rep.riskScore})
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug">
                      {rep.factors?.[0]?.message || 'Flagged for academic intervention.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/messages"
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                    >
                      Message Student
                    </Link>
                  </div>
                </div>
              ))}

              {riskStudents.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-xs">
                  All department students are currently maintaining satisfactory attendance and academic progress.
                </p>
              )}
            </div>
          </div>

          {/* Today's Full Department Daily Schedule & Operations (7:00 AM Active) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-brand-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Today's Department Classes & Operations
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Materialized at 7:00 AM • Active departmental roster for {deptClasses.length} class slots
                  </p>
                </div>
              </div>
              <Link
                to="/timetables"
                className="px-3.5 py-1.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold hover:bg-brand-100 transition flex items-center gap-1.5"
              >
                <span>Full Daily Console & Substitutions</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Quick Department Class Status Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Today</span>
                <p className="text-lg font-black text-slate-900 mt-0.5">{deptClasses.length}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Scheduled / Active</span>
                <p className="text-lg font-black text-emerald-700 mt-0.5">
                  {deptClasses.filter((c) => c.status === 'scheduled' || c.status === 'in_progress').length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/60 text-center">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Substituted</span>
                <p className="text-lg font-black text-amber-700 mt-0.5">
                  {deptClasses.filter((c) => c.isSubstituted).length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-300/80 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Paused Today</span>
                <p className="text-lg font-black text-slate-700 mt-0.5">
                  {deptClasses.filter((c) => c.status === 'paused').length}
                </p>
              </div>
            </div>

            {/* Department Classes List */}
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {deptClasses.map((c) => {
                const isPaused = c.status === 'paused';
                const isCompleted = c.status === 'completed';

                return (
                  <div
                    key={c._id}
                    className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isPaused
                        ? 'bg-slate-100/90 border-slate-300 opacity-85'
                        : isCompleted
                        ? 'bg-emerald-50/60 border-emerald-200/80'
                        : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center font-bold text-xs shrink-0 ${
                          isPaused
                            ? 'bg-slate-200 border-slate-300 text-slate-500'
                            : isCompleted
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        }`}
                      >
                        <Clock size={13} className="mb-0.5" />
                        <span className="text-[9px]">{c.startTime}</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                              isPaused ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {c.subject?.code}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700">
                            {c.batch?.name}
                          </span>
                          {c.isSubstituted && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                              ⭐ Substituted
                            </span>
                          )}
                          {isPaused && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-slate-300 text-slate-800 uppercase">
                              Paused Today
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <h4
                          className={`text-xs font-bold mt-0.5 ${
                            isPaused ? 'text-slate-600 line-through' : 'text-slate-900'
                          }`}
                        >
                          {c.subject?.name}
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Instructor: <strong className={c.isSubstituted ? 'text-amber-800' : 'text-slate-700'}>{c.teacher?.name}</strong>
                          {c.isSubstituted && c.originalTeacher && (
                            <span className="text-slate-400"> (Substituted for {c.originalTeacher.name})</span>
                          )}
                          {' • '}Room: {c.classroom?.roomNumber}
                        </p>
                        {isPaused && c.pauseReason && (
                          <p className="text-[10px] text-rose-600 italic font-medium mt-0.5">
                            Notice: {c.pauseReason}
                          </p>
                        )}
                        {isCompleted && c.attendanceStats && (
                          <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                            Attendance: {c.attendanceStats.presentCount || 0} Present / {c.attendanceStats.absentCount || 0} Absent
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Link
                        to="/timetables"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>Operations</span>
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}

              {deptClasses.length === 0 && (
                <p className="text-slate-400 text-center py-6 text-xs">
                  No departmental classes scheduled for today.
                </p>
              )}
            </div>
          </div>

          {/* HOD Personal Teaching Schedule (Role Inheritance) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">HOD Personal Teaching Slots</h3>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                Single Account • No Switch Required
              </span>
            </div>

            <div className="space-y-3">
              {todaySlots.map((slot) => {
                const isPaused = slot.status === 'paused';
                const timetableTargetId = slot.timetable?._id || slot.timetable || slot._id;

                return (
                  <div
                    key={slot._id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                      isPaused ? 'bg-slate-100/90 border-slate-300 opacity-80' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isPaused ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {slot.startTime}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs font-bold ${isPaused ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                            {slot.subject?.name}
                          </h4>
                          {isPaused && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {slot.batch?.name} • Room: {slot.classroom?.roomNumber}
                        </p>
                        {isPaused && slot.pauseReason && (
                          <p className="text-[10px] text-rose-600 italic">
                            {slot.pauseReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {isPaused ? (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold">
                        Paused
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivateAttendance(timetableTargetId)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Launch Attendance</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {todaySlots.length === 0 && (
                <p className="text-slate-400 text-center py-4 text-xs">No direct teaching slots for today.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Department Actions & Governance (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Department Governance */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Department Governance
            </h4>
            <div className="space-y-2">
              <Link
                to="/hod/students"
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 text-xs font-semibold flex items-center justify-between transition"
              >
                <span>Department Student Cohort</span>
                <ChevronRight size={14} />
              </Link>
              <Link
                to="/attendance/report"
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 text-xs font-semibold flex items-center justify-between transition"
              >
                <span>Cohort Attendance Audit</span>
                <ChevronRight size={14} />
              </Link>
              <Link
                to="/materials"
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 text-xs font-semibold flex items-center justify-between transition"
              >
                <span>Department Learning Materials</span>
                <ChevronRight size={14} />
              </Link>
              <Link
                to="/announcements"
                className="w-full p-3 rounded-2xl bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold flex items-center justify-between transition"
              >
                <span>+ Broadcast Department Notice</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Separation of Duties Policy Note */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Institutional Hierarchy
            </span>
            <h5 className="text-xs font-bold">HOD Scope & Authority</h5>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              HODs coordinate department timetables, monitor faculty teaching logs, and oversee mentorship. Adding new teacher accounts and publishing official semester marks are reserved for College Administration.
            </p>
          </div>
        </div>
      </div>

      {/* Real-Time Attendance Session Modal */}
      <AttendanceSessionModal
        isOpen={showSessionModal}
        session={activeSession}
        onClose={() => setShowSessionModal(false)}
        onSessionUpdated={(updated) => {
          setActiveSession(updated);
          loadHodData();
        }}
      />
    </div>
  );
}
