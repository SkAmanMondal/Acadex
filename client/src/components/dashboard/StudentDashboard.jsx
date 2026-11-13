import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  QrCode,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Award,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  User,
  UserCheck,
  Send,
  Bell,
  Sparkles,
} from 'lucide-react';

export default function StudentDashboard({ user }) {
  const [metrics, setMetrics] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStudentData = useCallback(async () => {
    try {
      setLoading(true);
      const [metRes, annRes] = await Promise.allSettled([
        api.get('/analytics/dashboard-metrics'),
        api.get('/communication/announcements'),
      ]);

      if (metRes.status === 'fulfilled' && metRes.value.data?.success) {
        setMetrics(metRes.value.data.data);
      }
      if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
        setAnnouncements(annRes.value.data.data.slice(0, 3));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // Zero-refresh automatic live synchronization for student dashboard
  useRealtimeSync(
    ['attendance_updated', 'timetable_updated', 'new_announcement', 'dashboard_refresh', 'marks_updated', 'assignments_updated'],
    loadStudentData
  );

  const attendance = metrics?.attendance || { attended: 0, conducted: 0, percentage: 100, isDefaulter: false };
  const todaySlots = metrics?.todaySlots || [];
  const quizzes = metrics?.availableQuizzes || [];
  const assignments = metrics?.pendingAssignments || [];
  const profile = metrics?.profile || {};

  return (
    <div className="space-y-6">
      {/* 1. Student Identity Hero Banner */}
      <div className="bg-gradient-to-r from-brand-700 via-indigo-700 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
                Student Academic Workspace
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                {profile.courseName || 'Degree Program'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Hello, {user?.name}
            </h1>
            <p className="text-indigo-100 text-xs md:text-sm max-w-xl leading-relaxed">
              University Roll No: <strong className="text-white font-mono">{profile.rollNumber || '24MCA001'}</strong> • {profile.batchName || 'Batch 2024-2026'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/student/qr"
              className="px-4 py-2.5 rounded-2xl bg-white text-brand-700 text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer flex items-center gap-2"
            >
              <QrCode size={16} />
              <span>Show My QR Pass</span>
            </Link>
            <Link
              to="/attendance/report"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition cursor-pointer flex items-center gap-2"
            >
              <TrendingUp size={16} />
              <span>Attendance Stats</span>
            </Link>
            <Link
              to="/student/curriculum"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition cursor-pointer flex items-center gap-2"
            >
              <BookOpen size={16} />
              <span>Curriculum & Calendar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Dynamic High-Priority Attendance Alert Banner */}
      {attendance.isDefaulter && (
        <div
          className={`rounded-3xl p-5 md:p-6 border-2 transition-all shadow-sm ${
            attendance.isCritical || attendance.percentage < 60
              ? 'bg-gradient-to-br from-rose-50 via-red-50/60 to-rose-100/40 border-rose-300 text-rose-950'
              : 'bg-gradient-to-br from-amber-50 via-yellow-50/60 to-amber-100/40 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    attendance.isCritical || attendance.percentage < 60
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                      : 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  }`}
                >
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>
                    {attendance.isCritical || attendance.percentage < 60
                      ? 'Critical Debarment Risk (<60%)'
                      : 'Attendance Shortage Warning (<75%)'}
                  </span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    attendance.isCritical || attendance.percentage < 60
                      ? 'bg-rose-200/80 text-rose-800'
                      : 'bg-amber-200/80 text-amber-900'
                  }`}
                >
                  Current: {attendance.percentage}% (Min. 75% required)
                </span>
              </div>

              <h3 className="text-base md:text-lg font-black tracking-tight">
                {attendance.isCritical || attendance.percentage < 60
                  ? `Immediate Intervention Required: Attendance is at ${attendance.percentage}% (${attendance.attended}/${attendance.conducted} lectures)`
                  : `Regulatory Shortage Notice: Attendance is at ${attendance.percentage}% (${attendance.attended}/${attendance.conducted} lectures)`}
              </h3>

              <p className="text-xs md:text-sm leading-relaxed max-w-3xl">
                {attendance.isCritical || attendance.percentage < 60 ? (
                  <>
                    Your attendance has fallen below the critical <strong>60%</strong> cutoff. You are at high risk of being debarred from semester examinations. To restore the mandatory <strong>75%</strong> threshold, you must attend your next{' '}
                    <strong className="underline decoration-rose-500 decoration-2 font-black text-rose-900">
                      {attendance.classesNeededTo75 || Math.max(1, Math.ceil(3 * attendance.conducted - 4 * attendance.attended))} consecutive classes
                    </strong>{' '}
                    without any absence.
                  </>
                ) : (
                  <>
                    You are currently below the mandatory <strong>75%</strong> university attendance threshold. To regain examination eligibility, you must attend your next{' '}
                    <strong className="underline decoration-amber-500 decoration-2 font-black text-amber-950">
                      {attendance.classesNeededTo75 || Math.max(1, Math.ceil(3 * attendance.conducted - 4 * attendance.attended))} consecutive classes
                    </strong>{' '}
                    without missing any lectures.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <Link
                to={profile.mentor?._id ? `/messages?contactId=${profile.mentor._id}` : '/messages'}
                state={{ contactId: profile.mentor?._id }}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap ${
                  attendance.isCritical || attendance.percentage < 60
                    ? 'bg-rose-700 hover:bg-rose-800 text-white'
                    : 'bg-amber-700 hover:bg-amber-800 text-white'
                }`}
              >
                <MessageSquare size={14} />
                <span>Message Mentor {profile.mentor?.name ? `(${profile.mentor.name.split(' ')[0]})` : ''}</span>
              </Link>
              <Link
                to="/attendance/report"
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border whitespace-nowrap ${
                  attendance.isCritical || attendance.percentage < 60
                    ? 'bg-white hover:bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                <TrendingUp size={14} />
                <span>Attendance Audit</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Metric Cards: Attendance Compliance & Academic Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Attendance Compliance Gauge */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Attendance Compliance
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{attendance.percentage}%</span>
              <span className="text-xs text-slate-500 font-medium">
                ({attendance.attended}/{attendance.conducted} lectures)
              </span>
            </div>
            <div className="mt-2">
              {attendance.isDefaulter ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    attendance.isCritical || attendance.percentage < 60
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <AlertTriangle size={11} />
                  {attendance.isCritical || attendance.percentage < 60 ? 'Critical Debarred (<60%)' : 'Shortage Warning (<75%)'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle size={11} />
                  Exam Eligible (&ge;75%)
                </span>
              )}
            </div>
          </div>

          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-base border-4 ${
              attendance.isDefaulter
                ? attendance.isCritical || attendance.percentage < 60
                  ? 'border-rose-500 text-rose-600 bg-rose-50'
                  : 'border-amber-500 text-amber-600 bg-amber-50'
                : 'border-emerald-500 text-emerald-600 bg-emerald-50'
            }`}
          >
            {attendance.percentage}%
          </div>
        </div>

        {/* Assigned Academic Mentor Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Assigned Academic Mentor
            </span>
            <div className="flex items-center gap-2.5 mt-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-sm flex items-center justify-center">
                {profile.mentor?.name?.charAt(0) || 'M'}
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900">
                  {profile.mentor?.name || 'Prof. Faculty Mentor'}
                </h4>
                <p className="text-[10px] text-slate-500">{profile.mentor?.email || 'mentor@campus360.edu'}</p>
              </div>
            </div>
          </div>

          <Link
            to={profile.mentor?._id ? `/messages?contactId=${profile.mentor._id}` : '/messages'}
            state={{ contactId: profile.mentor?._id }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
          >
            <MessageSquare size={13} />
            <span>Ask Academic Doubt / Message</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {/* Official Grade Card Quick Link */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Semester Academic Status
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <Award size={22} className="text-amber-500" />
              <div>
                <p className="text-sm font-extrabold text-slate-900">Transcript & Marksheet</p>
                <p className="text-[11px] text-slate-500">Official Consolidated SGPA</p>
              </div>
            </div>
          </div>

          <Link
            to="/student/results"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 transition"
          >
            <span>View University Grade Card</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* 3. Main Grid: Today's Schedule & Pending Work */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Today's Schedule & Pending Work */}
        <div className="lg:col-span-8 space-y-6">
          {/* Today's Timetable Schedule */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-brand-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Today's Class Schedule</h3>
              </div>
              <Link to="/timetables" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                Full Weekly Timetable →
              </Link>
            </div>

            <div className="space-y-3">
              {todaySlots.map((slot) => {
                const isPaused = slot.status === 'paused';
                const isCompleted = slot.status === 'completed';

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
                          {slot.isSubstituted && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                              ⭐ Substitute Faculty
                            </span>
                          )}
                          {isPaused && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-slate-300 text-slate-800 uppercase tracking-wider">
                              Class Paused Today
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ Conducted
                            </span>
                          )}
                        </div>
                        <h4
                          className={`text-xs font-extrabold mt-0.5 ${
                            isPaused ? 'text-slate-600 line-through' : 'text-slate-900'
                          }`}
                        >
                          {slot.subject?.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Room: <strong className="text-slate-700">{slot.classroom?.roomNumber}</strong> • Instructor:{' '}
                          <span className={slot.isSubstituted ? 'font-bold text-amber-800' : ''}>
                            {slot.teacher?.name}
                          </span>
                          {slot.isSubstituted && slot.originalTeacher && (
                            <span className="text-[10px] text-slate-400"> (Covering for {slot.originalTeacher.name})</span>
                          )}
                        </p>
                        {isPaused && slot.pauseReason && (
                          <p className="text-[11px] text-rose-600 italic font-medium mt-0.5">
                            Notice: {slot.pauseReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {isPaused ? (
                      <span className="text-[10px] font-extrabold text-slate-600 px-3 py-1 rounded-full bg-slate-200 border border-slate-300 self-start sm:self-auto uppercase">
                        Paused Today
                      </span>
                    ) : isCompleted ? (
                      <span className="text-[10px] font-bold text-emerald-700 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 self-start sm:self-auto">
                        Conducted
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 self-start sm:self-auto">
                        Scheduled
                      </span>
                    )}
                  </div>
                );
              })}

              {todaySlots.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No classes scheduled for today. Check your full timetable for upcoming lectures.
                </div>
              )}
            </div>
          </div>

          {/* Pending Coursework & Active Assessments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Active Quizzes */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <HelpCircle size={16} className="text-indigo-600" />
                  <span>Interactive Quizzes</span>
                </div>
                <Link to="/quizzes" className="text-[11px] font-bold text-indigo-600">
                  All Quizzes →
                </Link>
              </div>

              <div className="space-y-2">
                {quizzes.map((q) => (
                  <div key={q._id} className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      {q.subject?.code}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 line-clamp-1">{q.title}</h5>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">{q.durationMinutes} mins</span>
                      <Link
                        to="/quizzes"
                        className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900"
                      >
                        Start Quiz →
                      </Link>
                    </div>
                  </div>
                ))}

                {quizzes.length === 0 && (
                  <p className="text-slate-400 text-center py-4 text-xs">No active quizzes due.</p>
                )}
              </div>
            </div>

            {/* Pending Coursework Assignments */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <FileText size={16} className="text-brand-600" />
                  <span>Assignments Due</span>
                </div>
                <Link to="/assignments" className="text-[11px] font-bold text-brand-600">
                  Submit Work →
                </Link>
              </div>

              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a._id} className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      {a.subject?.code}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 line-clamp-1">{a.title}</h5>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-amber-800 font-semibold">Max {a.maxMarks || 100} pts</span>
                      <Link
                        to="/assignments"
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950"
                      >
                        Upload Submission →
                      </Link>
                    </div>
                  </div>
                ))}

                {assignments.length === 0 && (
                  <p className="text-slate-400 text-center py-4 text-xs">All assignments submitted on time!</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Institutional Notices & Quick Links */}
        <div className="lg:col-span-4 space-y-6">
          {/* Announcements Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                <Bell size={16} className="text-brand-600" />
                <span>Announcements</span>
              </div>
              <Link to="/announcements" className="text-[11px] font-bold text-brand-600">
                View All →
              </Link>
            </div>

            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann._id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                    {ann.scope}
                  </span>
                  <h5 className="text-xs font-bold text-slate-900">{ann.title}</h5>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Faculty Mentor Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                <UserCheck size={16} className="text-amber-600" />
                <span>Assigned Faculty Mentor</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Active 1-on-1
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">
                {profile.mentor?.name ? profile.mentor.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'AS'}
              </div>
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-slate-900">{profile.mentor?.name || 'Dr. Arvind Swaminathan'}</h5>
                <p className="text-[11px] text-slate-500 font-medium">Chief Faculty Mentor & Academic Counselor</p>
                <p className="text-[10px] text-slate-400 font-mono">{profile.mentor?.email || 'mentor@campus360.edu'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <Link
                to="/mentorship"
                className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-xl transition text-center flex items-center justify-center gap-1"
              >
                <MessageSquare size={12} />
                <span>Mentorship Portal</span>
              </Link>
              <Link
                to="/messages"
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition text-center flex items-center justify-center gap-1"
              >
                <Send size={12} />
                <span>Direct Chat</span>
              </Link>
            </div>
          </div>

          {/* Learning Resources Quick Jump */}
          <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-400" />
              <h4 className="text-xs font-extrabold">Study Material Repository</h4>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Access lecture slide decks, syllabus PDFs, and lab manuals uploaded by your faculty instructors.
            </p>
            <Link
              to="/materials"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white transition pt-1"
            >
              <span>Browse Course Materials</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
