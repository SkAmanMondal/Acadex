import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  GraduationCap,
  MessageSquare,
  Building,
  Info,
  Check,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_HEADER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentCurriculumPage() {
  const { user, isStudent } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [curriculumData, setCurriculumData] = useState(null);

  // Active semester selection
  const [selectedSemester, setSelectedSemester] = useState(1);

  // Subject filter for the calendar ('all' or subjectId)
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');

  // Calendar Month/Year state
  const today = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed

  // Day Detail Modal state
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/academics/student/curriculum');
      if (res.data?.success) {
        setCurriculumData(res.data.data);
        if (res.data.data.student?.currentSemester) {
          setSelectedSemester(res.data.data.student.currentSemester);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load curriculum details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurriculum();
  }, []);

  useRealtimeSync(['attendance_updated', 'academics_updated', 'daily_class_updated'], fetchCurriculum);

  // Current active semester data
  const activeSemesterData = useMemo(() => {
    if (!curriculumData?.semesters) return null;
    return (
      curriculumData.semesters.find((s) => s.semester === selectedSemester) ||
      curriculumData.semesters[0] ||
      null
    );
  }, [curriculumData, selectedSemester]);

  // Calendar month navigation
  const handlePrevMonth = () => {
    setCalMonth((prev) => {
      if (prev === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCalMonth((prev) => {
      if (prev === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleResetCurrentMonth = () => {
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
  };

  // Generate calendar grid dates for current calYear & calMonth
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // Day of week 0-6
    const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const days = [];
    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push({ empty: true, key: `empty-${i}` });
    }

    // Actual month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const mStr = String(calMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateKey = `${calYear}-${mStr}-${dStr}`;

      const rawDayData = curriculumData?.calendarDates?.[dateKey];

      // Filter classes if a specific subject is selected
      let filteredClasses = rawDayData?.classes || [];
      if (selectedSubjectId !== 'all') {
        filteredClasses = filteredClasses.filter(
          (c) => (c.subjectId?._id || c.subjectId)?.toString() === selectedSubjectId
        );
      }

      // Re-evaluate day status based on filtered classes
      let dayStatus = 'no_class';
      let presentCount = 0;
      let absentCount = 0;
      let pausedCount = 0;

      filteredClasses.forEach((c) => {
        if (c.status === 'present') presentCount++;
        else if (c.status === 'absent') absentCount++;
        else if (c.status === 'paused') pausedCount++;
      });

      const totalConducted = presentCount + absentCount;
      if (totalConducted > 0) {
        if (presentCount === totalConducted) dayStatus = 'all_present';
        else if (presentCount > 0) dayStatus = 'partial';
        else dayStatus = 'all_absent';
      } else if (pausedCount > 0) {
        dayStatus = 'paused';
      }

      days.push({
        empty: false,
        key: dateKey,
        dateKey,
        dayNum,
        dayStatus,
        totalClasses: filteredClasses.length,
        presentCount,
        absentCount,
        pausedCount,
        classes: filteredClasses,
        rawClassesCount: rawDayData?.classes?.length || 0,
      });
    }

    return days;
  }, [calYear, calMonth, curriculumData, selectedSubjectId]);

  // Overall degree attendance aggregation
  const overallDegreeAttendance = useMemo(() => {
    if (!curriculumData?.semesters) return { conducted: 0, attended: 0, percentage: 100 };
    let cond = 0;
    let att = 0;
    curriculumData.semesters.forEach((sem) => {
      cond += sem.overallAttendance?.conducted || 0;
      att += sem.overallAttendance?.attended || 0;
    });
    const pct = cond > 0 ? Math.round((att / cond) * 100) : 100;
    return { conducted: cond, attended: att, percentage: pct };
  }, [curriculumData]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 font-semibold">Loading Course Curriculum & Attendance Ledger...</p>
      </div>
    );
  }

  if (error || !curriculumData) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-3">
        <AlertTriangle size={32} className="text-rose-600 mx-auto" />
        <h3 className="text-base font-extrabold text-rose-900">Unable to load curriculum</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{error || 'Student record not found'}</p>
        <button
          onClick={fetchCurriculum}
          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { student, semesters } = curriculumData;
  const selectedSubjectObj =
    selectedSubjectId !== 'all'
      ? activeSemesterData?.subjects.find((s) => s._id === selectedSubjectId)
      : null;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-brand-950 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                Official Degree Curriculum
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                {student.courseCode || 'DEGREE'} • {student.totalSemesters} Semesters Program
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {student.course || 'Degree Program Curriculum'}
            </h1>

            <p className="text-xs md:text-sm text-indigo-200/90 max-w-2xl leading-relaxed">
              Enrolled: <strong>{student.name}</strong> • Roll No: <span className="font-mono text-white font-bold">{student.rollNumber}</span> • Batch: {student.batch} • Department: {student.department}
            </p>
          </div>

          {/* Overall Program Attendance Gauge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center gap-4 shrink-0">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-base border-4 ${
                overallDegreeAttendance.percentage >= 75
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-950/40'
                  : 'border-rose-400 text-rose-300 bg-rose-950/40'
              }`}
            >
              {overallDegreeAttendance.percentage}%
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Overall Program Attendance
              </span>
              <p className="text-sm font-extrabold text-white mt-0.5">
                {overallDegreeAttendance.attended} / {overallDegreeAttendance.conducted} Lectures
              </p>
              <span className="text-[10px] text-indigo-200">
                {overallDegreeAttendance.percentage >= 75 ? '✓ Exam Eligible' : '⚠️ Shortage Risk (<75%)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Semester Navigation Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Select Degree Semester</h2>
            <p className="text-[11px] text-slate-500">
              Review syllabus subjects and past/present attendance records by semester
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Current Enrolled:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Semester {student.currentSemester}
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {semesters.map((sem) => {
            const isActive = sem.semester === selectedSemester;
            const isCurrent = sem.isCurrentSemester;

            return (
              <button
                key={sem.semester}
                type="button"
                onClick={() => {
                  setSelectedSemester(sem.semester);
                  setSelectedSubjectId('all'); // Reset subject filter on semester change
                }}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span>Semester {sem.semester}</span>
                {isCurrent && (
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${
                      isActive ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    Current
                  </span>
                )}
                <span
                  className={`text-[10px] ${
                    isActive ? 'text-brand-100' : 'text-slate-400'
                  }`}
                >
                  ({sem.totalSubjects} Subjects)
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Semester Summary Bar */}
        {activeSemesterData && (
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Subjects</span>
                <span className="font-extrabold text-slate-800">{activeSemesterData.totalSubjects} Courses</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Credits</span>
                <span className="font-extrabold text-slate-800">{activeSemesterData.totalCredits} Total Credits</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Conducted</span>
                <span className="font-extrabold text-slate-800">{activeSemesterData.overallAttendance.conducted} Lectures</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Attended</span>
                <span className="font-extrabold text-emerald-700">{activeSemesterData.overallAttendance.attended} Present</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Missed / Absent</span>
                <span className="font-extrabold text-rose-700">{activeSemesterData.overallAttendance.absent} Missed</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Semester Rate:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  activeSemesterData.overallAttendance.percentage >= 75
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {activeSemesterData.overallAttendance.percentage}% Attendance
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Semester Subject Cards Grid */}
      {activeSemesterData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Semester {selectedSemester} Curriculum Subjects ({activeSemesterData.subjects.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Click "View on Calendar" to isolate any subject's attendance dates below
              </p>
            </div>

            {selectedSubjectId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedSubjectId('all')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
              >
                <X size={12} />
                <span>Show All Subjects</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSemesterData.subjects.map((sub) => {
              const isSelected = selectedSubjectId === sub._id;
              return (
                <div
                  key={sub._id}
                  className={`p-5 rounded-3xl border transition shadow-xs flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'bg-indigo-50/50 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono">
                        {sub.code}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {sub.type} • {sub.credits} Credits
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{sub.name}</h4>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-slate-900">{sub.percentage}%</span>
                        <span className="text-[11px] text-slate-500">
                          ({sub.attended}/{sub.conducted})
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'good'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'warning'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {sub.status === 'good' ? 'Eligible' : sub.status === 'warning' ? 'Shortage (<75%)' : 'Critical (<60%)'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sub.percentage >= 75
                            ? 'bg-emerald-500'
                            : sub.percentage >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>

                    {sub.isDefaulter && (
                      <p className="text-[11px] text-amber-900 font-semibold mt-1">
                        ⚠️ Must attend next <strong>{sub.classesNeededTo75}</strong> consecutive classes without absence
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId(isSelected ? 'all' : sub._id)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Calendar size={13} />
                    <span>{isSelected ? '✓ Filtered on Calendar' : 'View on Calendar'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Interactive Colored Attendance Calendar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        {/* Calendar Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-brand-600" />
              <h3 className="text-base font-extrabold text-slate-900">
                Attendance Calendar — {MONTH_NAMES[calMonth]} {calYear}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedSubjectObj ? (
                <>
                  Showing classes for: <strong className="text-brand-700">{selectedSubjectObj.name} ({selectedSubjectObj.code})</strong>
                </>
              ) : (
                'Showing overall daily class attendance across all curriculum subjects'
              )}
            </p>
          </div>

          {/* Month Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleResetCurrentMonth}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Status Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block shadow-2xs" />
            <span className="text-slate-700 font-semibold">Present (Attended)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 inline-block shadow-2xs" />
            <span className="text-slate-700 font-semibold">Partial (Attended some)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 inline-block shadow-2xs" />
            <span className="text-slate-700 font-semibold">Absent (Missed Class)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-orange-400 inline-block shadow-2xs" />
            <span className="text-slate-700 font-semibold">Class Paused / Cancelled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-200 inline-block" />
            <span className="text-slate-500">No Scheduled Sessions</span>
          </div>
        </div>

        {/* 7-Column Calendar Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Days Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAYS_HEADER.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[11px] font-bold uppercase tracking-wider py-1 ${
                    i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date Cells */}
            <div className="grid grid-cols-7 gap-2">
              {calendarGrid.map((day) => {
                if (day.empty) {
                  return <div key={day.key} className="h-20 sm:h-24 rounded-2xl bg-transparent" />;
                }

                const isToday =
                  day.dateKey ===
                  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
                    today.getDate()
                  ).padStart(2, '0')}`;

                let cellBg = 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300';
                let badgeClass = 'bg-slate-200 text-slate-600';
                let statusText = '';

                if (day.dayStatus === 'all_present') {
                  cellBg = 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400';
                  badgeClass = 'bg-emerald-600 text-white';
                  statusText = `${day.presentCount} Present`;
                } else if (day.dayStatus === 'partial') {
                  cellBg = 'bg-amber-50/70 border-amber-300 hover:border-amber-400';
                  badgeClass = 'bg-amber-500 text-white';
                  statusText = `${day.presentCount}/${day.totalClasses} Present`;
                } else if (day.dayStatus === 'all_absent') {
                  cellBg = 'bg-rose-50/70 border-rose-300 hover:border-rose-400';
                  badgeClass = 'bg-rose-600 text-white';
                  statusText = `${day.absentCount} Missed`;
                } else if (day.dayStatus === 'paused') {
                  cellBg = 'bg-orange-50/70 border-orange-300 hover:border-orange-400';
                  badgeClass = 'bg-orange-500 text-white';
                  statusText = 'Paused';
                }

                return (
                  <div
                    key={day.key}
                    onClick={() => {
                      if (day.classes.length > 0) {
                        setSelectedDayDetail(day);
                      }
                    }}
                    className={`h-20 sm:h-24 rounded-2xl border p-2 flex flex-col justify-between transition-all select-none ${cellBg} ${
                      day.classes.length > 0 ? 'cursor-pointer hover:shadow-md' : 'opacity-70'
                    } ${isToday ? 'ring-2 ring-brand-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black ${
                          isToday ? 'text-brand-600' : 'text-slate-700'
                        }`}
                      >
                        {day.dayNum}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1 rounded bg-brand-100 text-brand-700">
                          Today
                        </span>
                      )}
                    </div>

                    {day.classes.length > 0 ? (
                      <div className="space-y-1">
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md block text-center truncate ${badgeClass}`}
                        >
                          {statusText}
                        </span>
                        <span className="text-[9px] text-slate-500 block text-center truncate">
                          {day.classes.length} {day.classes.length === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-300 block text-center">No class</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Day Session Details Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-brand-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Day Class Ledger — {selectedDayDetail.dateKey}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedDayDetail.presentCount} Attended • {selectedDayDetail.absentCount} Missed • {selectedDayDetail.pausedCount} Paused
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* List of classes on this date */}
            <div className="space-y-3">
              {selectedDayDetail.classes.map((cls, idx) => (
                <div
                  key={cls.id || idx}
                  className={`p-4 rounded-2xl border space-y-2 ${
                    cls.status === 'present'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : cls.status === 'absent'
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-orange-50/60 border-orange-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-slate-700">
                        {cls.subjectCode}
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-900 mt-1">{cls.subjectName}</h4>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        cls.status === 'present'
                          ? 'bg-emerald-600 text-white'
                          : cls.status === 'absent'
                          ? 'bg-rose-600 text-white'
                          : 'bg-orange-500 text-white'
                      }`}
                    >
                      {cls.status === 'present' ? '✓ Present' : cls.status === 'absent' ? '✕ Absent' : '⏸ Paused'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <p>
                      Instructor: <strong>{cls.teacherName}</strong> • Room: {cls.roomNumber}
                    </p>
                    {cls.time && <p>Schedule: {cls.time}</p>}
                    {cls.status === 'present' && cls.scannedAt && (
                      <p className="text-emerald-700 font-medium">
                        Scanned At: {new Date(cls.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {cls.status === 'paused' && cls.pauseReason && (
                      <p className="text-orange-800 italic">Notice: {cls.pauseReason}</p>
                    )}
                  </div>

                  {cls.status === 'absent' && student.mentor && (
                    <div className="pt-1">
                      <Link
                        to="/messages"
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 transition"
                      >
                        <MessageSquare size={12} />
                        <span>Discuss missed class with Mentor ({student.mentor.name}) →</span>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
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
