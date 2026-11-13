import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  CheckCircle,
  AlertTriangle,
  Building,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  PauseCircle,
  PlayCircle,
  UserCheck,
  QrCode,
  Eye,
  X,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
  FileText,
  AlertCircle,
} from 'lucide-react';

const formatDateToYMD = (d = new Date()) => {
  const dateObj = new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DailyScheduleView({ departments = [], batches = [], teachers = [] }) {
  const { user, isTeacher, isHod, isAdmin, isStudent } = useAuth();
  const navigate = useNavigate();

  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [dailyClasses, setDailyClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterDept, setFilterDept] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [pauseModalClass, setPauseModalClass] = useState(null);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseSubmitting, setPauseSubmitting] = useState(false);

  const [substituteModalClass, setSubstituteModalClass] = useState(null);
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [substitutionReason, setSubstitutionReason] = useState('');
  const [substituteSubmitting, setSubstituteSubmitting] = useState(false);

  const [absenteesModalClass, setAbsenteesModalClass] = useState(null);
  const [absenteesData, setAbsenteesData] = useState(null);
  const [absenteesLoading, setAbsenteesLoading] = useState(false);

  const [showMyMissedClasses, setShowMyMissedClasses] = useState(false);
  const [myMissedData, setMyMissedData] = useState(null);
  const [myMissedLoading, setMyMissedLoading] = useState(false);

  // Load daily classes from API
  const loadDailyClasses = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ date: selectedDate });
      if (filterDept !== 'all') params.append('department', filterDept);
      if (filterBatch !== 'all') params.append('batch', filterBatch);
      if (filterTeacher !== 'all') params.append('teacher', filterTeacher);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const res = await api.get(`/timetable/daily-classes?${params.toString()}`);
      if (res.data?.success) {
        setDailyClasses(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load daily class schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailyClasses();
  }, [selectedDate, filterDept, filterBatch, filterTeacher, filterStatus]);

  // Real-time synchronization
  useRealtimeSync(
    ['daily_class_updated', 'daily_schedule_published', 'timetable_updated', 'attendance_updated'],
    loadDailyClasses
  );

  // Date navigation helpers
  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`);
    current.setDate(current.getDate() - 1);
    setSelectedDate(formatDateToYMD(current));
  };

  const handleNextDay = () => {
    if (selectedDate >= todayStr) return;
    const current = new Date(`${selectedDate}T12:00:00Z`);
    current.setDate(current.getDate() + 1);
    const nextFormatted = formatDateToYMD(current);
    if (nextFormatted <= todayStr) {
      setSelectedDate(nextFormatted);
    }
  };

  const handleResetToday = () => {
    setSelectedDate(todayStr);
  };

  // Human-readable date string
  const formattedDateTitle = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00Z`);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  const isSelectedDateToday = selectedDate === todayStr;
  const isSelectedDatePast = selectedDate < todayStr;
  const isSelectedDateFuture = selectedDate > todayStr;

  // Filtered class list
  const filteredClasses = useMemo(() => {
    return dailyClasses.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSub = c.subject?.name?.toLowerCase().includes(q) || c.subject?.code?.toLowerCase().includes(q);
        const matchTeacher =
          c.teacher?.name?.toLowerCase().includes(q) || c.originalTeacher?.name?.toLowerCase().includes(q);
        const matchBatch = c.batch?.name?.toLowerCase().includes(q);
        const matchRoom = c.classroom?.roomNumber?.toLowerCase().includes(q);
        if (!matchSub && !matchTeacher && !matchBatch && !matchRoom) return false;
      }
      return true;
    });
  }, [dailyClasses, searchQuery]);

  // Class statistics for this day
  const stats = useMemo(() => {
    const total = dailyClasses.length;
    const scheduled = dailyClasses.filter((c) => c.status === 'scheduled').length;
    const paused = dailyClasses.filter((c) => c.status === 'paused').length;
    const substituted = dailyClasses.filter((c) => c.isSubstituted).length;
    const completed = dailyClasses.filter((c) => c.status === 'completed').length;
    return { total, scheduled, paused, substituted, completed };
  }, [dailyClasses]);

  // Handle Pause / Resume Class
  const handleConfirmPause = async (e) => {
    e.preventDefault();
    if (!pauseModalClass) return;

    try {
      setPauseSubmitting(true);
      const isCurrentlyPaused = pauseModalClass.status === 'paused';
      const res = await api.patch(`/timetable/daily-classes/${pauseModalClass._id}/pause`, {
        isPaused: !isCurrentlyPaused,
        reason: pauseReason || 'Class paused by administration for today',
      });

      if (res.data?.success) {
        setSuccess(res.data.message);
        setPauseModalClass(null);
        setPauseReason('');
        loadDailyClasses();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update class pause status');
    } finally {
      setPauseSubmitting(false);
    }
  };

  // Handle Substitute Faculty
  const handleConfirmSubstitute = async (e) => {
    e.preventDefault();
    if (!substituteModalClass || !substituteTeacherId) return;

    try {
      setSubstituteSubmitting(true);
      const res = await api.patch(`/timetable/daily-classes/${substituteModalClass._id}/substitute`, {
        substituteTeacherId,
        reason: substitutionReason || 'Faculty substitute assigned',
      });

      if (res.data?.success) {
        setSuccess(res.data.message);
        setSubstituteModalClass(null);
        setSubstituteTeacherId('');
        setSubstitutionReason('');
        loadDailyClasses();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign substitute faculty');
    } finally {
      setSubstituteSubmitting(false);
    }
  };

  // Open Absentees breakdown for a class (Faculty / HOD / Admin only)
  const handleOpenAbsentees = async (c) => {
    if (isStudent) return;
    setAbsenteesModalClass(c);
    setAbsenteesLoading(true);
    try {
      const res = await api.get(`/timetable/daily-classes/${c._id}/absentees`);
      if (res.data?.success) {
        setAbsenteesData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load absentees:', err);
    } finally {
      setAbsenteesLoading(false);
    }
  };

  // Open Student Missed Classes Ledger
  const handleOpenMyMissed = async () => {
    setShowMyMissedClasses(true);
    setMyMissedLoading(true);
    try {
      const res = await api.get(`/timetable/daily-classes/missed-classes`);
      if (res.data?.success) {
        setMyMissedData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load missed classes:', err);
    } finally {
      setMyMissedLoading(false);
    }
  };

  // Launch QR attendance session directly from card
  const handleLaunchAttendance = async (timetableId) => {
    try {
      const res = await api.post('/attendance/session/activate', { timetableId });
      if (res.data?.success) {
        navigate('/teacher/scanner');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to launch attendance session');
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Alert Notices */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Date Navigation & Control Header */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Date Browser Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Prev Day</span>
            </button>

            <button
              type="button"
              onClick={handleResetToday}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                isSelectedDateToday
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Clock size={14} />
              <span>Today</span>
            </button>

            <button
              type="button"
              onClick={handleNextDay}
              disabled={selectedDate >= todayStr}
              className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-semibold ${
                selectedDate >= todayStr
                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
              }`}
              title={selectedDate >= todayStr ? "Tomorrow's daily classes lock at 7:00 AM on that day" : 'Next Day'}
            >
              <span className="hidden sm:inline">Next Day</span>
              <ChevronRight size={16} />
            </button>

            {/* Native Date Picker clamped to past/today */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= todayStr) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-800 cursor-pointer focus:ring-2 focus:ring-brand-500"
                title="Select today or past archived class date"
              />
            </div>
          </div>

          {/* Quick Actions (e.g. Student Missed Classes) */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {isStudent && (
              <button
                type="button"
                onClick={handleOpenMyMissed}
                className="px-3.5 py-2 bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle size={14} className="text-amber-600" />
                <span>My Missed Classes History</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadDailyClasses}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer text-xs font-semibold"
              title="Refresh schedule"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* 7:00 AM Dispatch Banner */}
        <div
          className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            isSelectedDateToday
              ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border-blue-200 text-blue-900'
              : isSelectedDatePast
              ? 'bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                isSelectedDateToday
                  ? 'bg-blue-600 text-white'
                  : isSelectedDatePast
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-amber-600 text-white'
              }`}
            >
              <Calendar size={16} />
            </div>
            <div>
              <div className="font-extrabold text-sm">{formattedDateTitle}</div>
              <p className="text-[11px] opacity-80">
                {isSelectedDateToday
                  ? '🗓️ Daily class roster initialized and locked at 07:00 AM • Live Institutional Feed'
                  : isSelectedDatePast
                  ? '📜 Historical Class Records • Audit Mode • Showing past classes, substitutions, and absentees'
                  : '🔮 Advance Planning Mode • Pre-schedule substitutions or planned pauses'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-2xs">
              {stats.total} Total Classes
            </span>
            {stats.paused > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 border border-slate-300">
                {stats.paused} Paused (Grey)
              </span>
            )}
            {stats.substituted > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                {stats.substituted} Substituted
              </span>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-slate-50/80 border border-slate-200/70 rounded-2xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search subject, faculty, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
              />
            </div>

            {/* Department Filter (Admin only) */}
            {isAdmin && (
              <div>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-700"
                >
                  <option value="all">All Departments ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Batch Filter */}
            {(isAdmin || isHod) && (
              <div>
                <select
                  value={filterBatch}
                  onChange={(e) => setFilterBatch(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-700"
                >
                  <option value="all">All Student Batches</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.department?.code || 'Dept'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-700"
              >
                <option value="all">All Statuses (Active & Paused)</option>
                <option value="scheduled">Scheduled / Active Only</option>
                <option value="paused">Paused Only (Grey Cards)</option>
                <option value="in_progress">Live QR In Progress</option>
                <option value="completed">Completed / Finalized</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Class Schedule Timeline Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200 p-8">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Synchronizing class schedule for {selectedDate}...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Classes Scheduled for This Day</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No active timetable entries match the selected date ({selectedDate}) and filter settings.
          </p>
          <button
            type="button"
            onClick={handleResetToday}
            className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition cursor-pointer"
          >
            Jump to Today
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((item) => {
            const isPaused = item.status === 'paused';
            const isCompleted = item.status === 'completed';
            const isInProgress = item.status === 'in_progress';
            const hasSub = item.isSubstituted;

            return (
              <div
                key={item._id}
                className={`rounded-3xl border p-5 transition-all flex flex-col justify-between space-y-4 ${
                  isPaused
                    ? 'bg-slate-100/90 border-slate-300 shadow-none opacity-85 select-none'
                    : isInProgress
                    ? 'bg-white border-emerald-400 ring-2 ring-emerald-500/20 shadow-md'
                    : isCompleted
                    ? 'bg-white border-slate-200 shadow-sm'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                }`}
              >
                {/* Header: Time slot & Status Pill */}
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Clock size={14} className={isPaused ? 'text-slate-400' : 'text-brand-600'} />
                      <span className={isPaused ? 'line-through text-slate-400' : ''}>
                        {item.startTime} - {item.endTime}
                      </span>
                    </div>

                    {/* Status Pill */}
                    {isPaused ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                        <PauseCircle size={11} className="text-slate-500" />
                        <span>Paused Today</span>
                      </span>
                    ) : isInProgress ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>Live Attendance</span>
                      </span>
                    ) : isCompleted ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Check size={11} />
                        <span>Conducted</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    )}
                  </div>

                  {/* Subject Title & Code */}
                  <div className="mb-2">
                    <h3
                      className={`text-sm font-black truncate leading-tight ${
                        isPaused ? 'text-slate-500 line-through' : 'text-slate-900'
                      }`}
                      title={item.subject?.name}
                    >
                      {item.subject?.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {item.subject?.code} • {item.subject?.type === 'practical' ? 'Lab Work' : 'Lecture'} (Sem {item.semester})
                    </p>
                  </div>

                  {/* Paused Reason Banner (Visible if paused) */}
                  {isPaused && (
                    <div className="p-2.5 bg-slate-200/80 border border-slate-300 rounded-xl text-[11px] text-slate-700 mb-3 space-y-0.5">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 block">
                        Reason for Pause:
                      </span>
                      <p className="italic">"{item.pauseReason || 'Class suspended by administration for today'}"</p>
                    </div>
                  )}

                  {/* Substitution Banner (Visible if substitute assigned) */}
                  {hasSub && !isPaused && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 mb-3 space-y-0.5">
                      <div className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider text-amber-800">
                        <UserCheck size={12} className="text-amber-600" />
                        <span>Faculty Substituted</span>
                      </div>
                      <p>
                        Substitute Instructor: <strong className="font-extrabold">Prof. {item.teacher?.name}</strong>
                      </p>
                      {item.originalTeacher && (
                        <p className="text-[10px] text-amber-700">
                          Original: Prof. {item.originalTeacher.name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Metadata: Batch, Classroom, Faculty */}
                  <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={13} className="text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{item.batch?.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 shrink-0">
                        {item.department?.code || 'Dept'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        Room <strong>{item.classroom?.roomNumber}</strong> ({item.classroom?.block || 'Campus'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {hasSub ? (
                          <span>
                            Substitute: <strong className="text-amber-800">{item.teacher?.name}</strong>
                          </span>
                        ) : (
                          <span>
                            Faculty: <strong className="text-slate-800">{item.teacher?.name}</strong>
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Attendance Performance Metrics (If finalized) - Only visible to Faculty / HOD / Admin, NEVER Students */}
                  {!isStudent && isCompleted && item.attendanceStats?.totalStudents > 0 && (
                    <div className="mt-3 p-2 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between text-[11px]">
                      <span className="text-blue-900 font-semibold">
                        {item.attendanceStats.presentCount}/{item.attendanceStats.totalStudents} Present
                      </span>
                      <span className="font-extrabold text-blue-700">
                        {item.attendanceStats.presentPercentage}% Attendance
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Action Controls (Role-Sensitive) */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {/* Left Action: View Absentees or Session Info (Role Protected) */}
                  {!isStudent && isCompleted ? (
                    <button
                      type="button"
                      onClick={() => handleOpenAbsentees(item)}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View Absent Students</span>
                    </button>
                  ) : isStudent && isCompleted ? (
                    <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                      <CheckCircle size={12} className="text-emerald-500" />
                      <span>Class Completed</span>
                    </span>
                  ) : isInProgress ? (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <QrCode size={12} />
                      <span>Code: {item.attendanceSession?.sessionCode}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Class Scheduled</span>
                  )}

                  {/* Right Actions: Admin & HOD Powers */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Launch Attendance Button (Teacher / HOD) */}
                    {(isTeacher || isHod || isAdmin) && !isPaused && !isCompleted && !isInProgress && isSelectedDateToday && (
                      <button
                        type="button"
                        onClick={() => handleLaunchAttendance(item.timetable?._id || item.timetable)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Launch 10-Minute QR Attendance Session"
                      >
                        <QrCode size={12} />
                        <span>Take Attendance</span>
                      </button>
                    )}

                    {/* Admin / HOD Control: Substitute Faculty */}
                    {(isAdmin || isHod) && !isCompleted && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubstituteModalClass(item);
                          setSubstituteTeacherId(item.teacher?._id || '');
                          setSubstitutionReason('');
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        title="Change / Assign Substitute Faculty"
                      >
                        <UserCheck size={13} />
                      </button>
                    )}

                    {/* Admin / HOD Control: Pause or Resume Class */}
                    {(isAdmin || isHod) && !isCompleted && (
                      <button
                        type="button"
                        onClick={() => {
                          setPauseModalClass(item);
                          setPauseReason(item.pauseReason || '');
                        }}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isPaused
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                            : 'bg-slate-200/80 hover:bg-slate-300 text-slate-700'
                        }`}
                        title={isPaused ? 'Resume Class' : 'Pause Class for Today (Show as Grey)'}
                      >
                        {isPaused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL 1: PAUSE / RESUME CLASS MODAL                                    */}
      {/* ====================================================================== */}
      {pauseModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    pauseModalClass.status === 'paused'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {pauseModalClass.status === 'paused' ? <PlayCircle size={18} /> : <PauseCircle size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {pauseModalClass.status === 'paused' ? 'Resume Class Schedule' : 'Pause Class for Today'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {pauseModalClass.subject?.name} • {pauseModalClass.batch?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPauseModalClass(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmPause} className="space-y-4 text-xs">
              {pauseModalClass.status === 'paused' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-1">
                  <p className="font-bold">Are you sure you want to resume this class?</p>
                  <p className="text-[11px] opacity-80">
                    It will return to active status and will no longer appear as greyed out. Students will be notified.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">
                      Visual Pause Mode
                    </span>
                    <p className="text-[11px]">
                      Pausing this class will mark it as <strong>not held today</strong> and display it in a muted grey state for students and teachers.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Reason for Pause (Displayed to Students & Faculty)
                    </label>
                    <textarea
                      rows={3}
                      value={pauseReason}
                      onChange={(e) => setPauseReason(e.target.value)}
                      placeholder="e.g. Instructor on leave, Department meeting, Tech symposium, Holiday..."
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPauseModalClass(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pauseSubmitting}
                  className={`px-4 py-2 rounded-xl text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
                    pauseModalClass.status === 'paused'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {pauseSubmitting
                    ? 'Updating...'
                    : pauseModalClass.status === 'paused'
                    ? 'Confirm Resume'
                    : 'Confirm Pause (Turn Grey)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL 2: SUBSTITUTE FACULTY MODAL                                      */}
      {/* ====================================================================== */}
      {substituteModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Assign Substitute Faculty</h3>
                  <p className="text-xs text-slate-500">
                    {substituteModalClass.subject?.name} ({substituteModalClass.startTime})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubstituteModalClass(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmSubstitute} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 space-y-1">
                <p>
                  Original Assigned Teacher:{' '}
                  <strong>Prof. {substituteModalClass.originalTeacher?.name || substituteModalClass.teacher?.name}</strong>
                </p>
                <p className="text-[10px] text-amber-700">
                  The designated substitute will gain authorization to take attendance and manage this class for {substituteModalClass.date}.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Select Substitute Faculty Member</label>
                <select
                  value={substituteTeacherId}
                  onChange={(e) => setSubstituteTeacherId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                >
                  <option value="">-- Choose Faculty Member --</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.department?.code || 'Faculty'}) • {t.role === 'hod' ? 'HOD' : 'Teacher'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Reason for Substitution</label>
                <input
                  type="text"
                  value={substitutionReason}
                  onChange={(e) => setSubstitutionReason(e.target.value)}
                  placeholder="e.g. Instructor on sick leave, Official duty, Dept meeting..."
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubstituteModalClass(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={substituteSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {substituteSubmitting ? 'Assigning...' : 'Confirm Substitution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL 3: CLASS ATTENDANCE & ABSENTEES BREAKDOWN MODAL                   */}
      {/* (Accessible strictly to Faculty / HOD / Admin, NEVER Students)         */}
      {/* ====================================================================== */}
      {absenteesModalClass && !isStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Class Attendance & Absentee Roster</h3>
                <p className="text-xs text-slate-500">
                  {absenteesModalClass.subject?.name} • {absenteesModalClass.batch?.name} • {absenteesModalClass.date} ({absenteesModalClass.startTime})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbsenteesModalClass(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {absenteesLoading ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Loading attendance records...</p>
              </div>
            ) : !absenteesData ? (
              <p className="text-xs text-slate-400 text-center py-10">No attendance data recorded for this class session.</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Enrolled</span>
                    <span className="text-lg font-black text-slate-800">{absenteesData.totalEnrolled}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Present</span>
                    <span className="text-lg font-black text-emerald-700">{absenteesData.presentCount}</span>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Missed / Absent</span>
                    <span className="text-lg font-black text-rose-700">{absenteesData.absentCount}</span>
                  </div>
                </div>

                {/* Absentees List (Who Missed This Class) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-rose-600" />
                      <span>Students Who Missed This Class ({absenteesData.absentStudents?.length || 0})</span>
                    </h4>
                  </div>

                  {absenteesData.absentStudents?.length === 0 ? (
                    <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs text-center font-bold">
                      🎉 100% Full Attendance! No students missed this class.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-rose-100 rounded-2xl overflow-hidden bg-rose-50/20">
                      {absenteesData.absentStudents?.map((st) => (
                        <div key={st._id} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{st.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Roll: {st.rollNumber || 'N/A'} • {st.email}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            Absent
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Present Students List */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-emerald-600" />
                    <span>Present Students ({absenteesData.presentStudents?.length || 0})</span>
                  </h4>
                  <div className="divide-y divide-slate-100 border border-emerald-100 rounded-2xl overflow-hidden bg-emerald-50/20 max-h-48 overflow-y-auto">
                    {absenteesData.presentStudents?.map((st) => (
                      <div key={st._id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800 block">{st.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Roll: {st.rollNumber || 'N/A'}</span>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                          Scanned Present
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setAbsenteesModalClass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL 4: STUDENT MISSED CLASSES LEDGER MODAL                           */}
      {/* ====================================================================== */}
      {showMyMissedClasses && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">My Missed Classes History</h3>
                  <p className="text-xs text-slate-500">Chronological ledger of classes you were marked absent for</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMyMissedClasses(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {myMissedLoading ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Loading your missed classes history...</p>
              </div>
            ) : !myMissedData ? (
              <p className="text-xs text-slate-400 text-center py-10">No missed class history found.</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {/* Attendance Summary */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">Overall Attendance Standing</span>
                    <span className="text-[11px] text-slate-500">
                      {myMissedData.attended} attended out of {myMissedData.totalConducted} conducted classes
                    </span>
                  </div>
                  <span
                    className={`text-sm font-black px-2.5 py-1 rounded-xl border ${
                      myMissedData.attendancePercentage < 75
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {myMissedData.attendancePercentage}%
                  </span>
                </div>

                {myMissedData.missedClasses?.length === 0 ? (
                  <div className="py-10 text-center space-y-2 bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6">
                    <CheckCircle size={28} className="text-emerald-600 mx-auto" />
                    <h4 className="text-sm font-bold text-emerald-900">Zero Missed Classes!</h4>
                    <p className="text-xs text-emerald-700">You have attended 100% of all conducted sessions so far.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      List of Missed Classes ({myMissedData.missedCount})
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      {myMissedData.missedClasses.map((item, idx) => (
                        <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/60">
                          <div>
                            <div className="font-bold text-slate-900">{item.subject}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Faculty: <strong>{item.teacher}</strong> • Room: {item.classroom}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              Date: <strong>{item.date}</strong> • Code: {item.sessionCode}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                            Missed Class
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowMyMissedClasses(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
