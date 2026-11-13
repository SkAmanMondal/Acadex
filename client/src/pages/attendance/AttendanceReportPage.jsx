import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Search,
  Filter,
  TrendingUp,
  Award,
  BookOpen,
  Building,
  GraduationCap,
  User,
  Edit2,
  X,
  Check,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

export default function AttendanceReportPage() {
  const { user, isStudent, isTeacher, isHod, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);

  // Student Analytics State
  const [studentStats, setStudentStats] = useState(null);

  // Administrative / Faculty Cohort State
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Multi-Filter State
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [batchReport, setBatchReport] = useState(null);
  const [filterDefaultersOnly, setFilterDefaultersOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Attendance Override / Edit Modal State
  const [overrideModal, setOverrideModal] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState(null);
  const [overrideData, setOverrideData] = useState({
    subjectId: '',
    status: 'present',
    remarks: '',
  });
  const [overrideMsg, setOverrideMsg] = useState({ type: '', text: '' });

  const handleOpenOverride = (student) => {
    setSelectedStudentForEdit(student);
    setOverrideData({
      subjectId: subjects.length > 0 ? subjects[0]._id : '',
      status: 'present',
      remarks: '',
    });
    setOverrideMsg({ type: '', text: '' });
    setOverrideModal(true);
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/attendance/manual-record', {
        studentId: selectedStudentForEdit.studentId,
        batchId: selectedBatchId,
        subjectId: overrideData.subjectId || undefined,
        status: overrideData.status,
      });
      if (res.data?.success) {
        setOverrideMsg({ type: 'success', text: 'Attendance record updated successfully!' });
        setTimeout(() => {
          setOverrideModal(false);
          loadBatchReport(selectedBatchId);
        }, 700);
      }
    } catch (err) {
      setOverrideMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update attendance' });
    }
  };

  const loadStudentAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/student-stats');
      if (res.data?.success) {
        setStudentStats(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const [depRes, batRes, teaRes, subRes] = await Promise.allSettled([
        api.get('/academics/departments'),
        api.get('/academics/batches'),
        api.get('/users/teachers'),
        api.get('/academics/subjects'),
      ]);

      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) {
        setBatches(batRes.value.data.data);
        if (batRes.value.data.data.length > 0) {
          setSelectedBatchId(batRes.value.data.data[0]._id);
        }
      }
      if (teaRes.status === 'fulfilled' && teaRes.value.data?.success) {
        setTeachers(teaRes.value.data.data);
      }
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) {
        setSubjects(subRes.value.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadBatchReport = async (batchId) => {
    if (!batchId) return;
    try {
      setLoading(true);
      const res = await api.get(`/attendance/batch-report/${batchId}`);
      if (res.data?.success) {
        setBatchReport(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStudent) {
      loadStudentAnalytics();
    } else {
      loadMetadata();
    }
  }, [isStudent]);

  useEffect(() => {
    if (selectedBatchId && !isStudent) {
      loadBatchReport(selectedBatchId);
    }
  }, [selectedBatchId]);

  // Zero-refresh automatic live synchronization on any attendance scanning/finalization
  useRealtimeSync(['attendance_updated', 'attendance_student_scanned', 'attendance_session_ended'], () => {
    if (isStudent) {
      loadStudentAnalytics();
    } else if (selectedBatchId) {
      loadBatchReport(selectedBatchId);
    }
  });

  // Filter batches dynamically based on department selection
  const filteredBatches = useMemo(() => {
    if (selectedDepartment === 'all') return batches;
    return batches.filter(
      (b) => (b.department?._id || b.department)?.toString() === selectedDepartment
    );
  }, [batches, selectedDepartment]);

  // Auto-select first batch if current batch doesn't belong to selected department
  useEffect(() => {
    if (filteredBatches.length > 0) {
      const exists = filteredBatches.some((b) => b._id === selectedBatchId);
      if (!exists) {
        setSelectedBatchId(filteredBatches[0]._id);
      }
    }
  }, [filteredBatches]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-cyan-800 to-indigo-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-cyan-900/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
                Attendance Intelligence
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                75% Regulatory Compliance
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {isStudent ? 'My Attendance Intelligence & Session Logs' : 'Institutional Attendance Audit & Cohort Reports'}
            </h1>
            <p className="text-cyan-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Multi-dimensional ledger: filter by Department, Student Cohort, Faculty Teacher, or Subject to ensure statutory attendance compliance.
            </p>
          </div>

          {isStudent && (
            <div className="shrink-0">
              <Link
                to="/student/curriculum"
                className="px-4 py-2.5 rounded-2xl bg-white text-teal-900 text-xs font-bold shadow-lg hover:bg-slate-100 transition cursor-pointer flex items-center gap-2"
              >
                <BookOpen size={16} />
                <span>Semester Curriculum & Calendar</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ==================== STUDENT ATTENDANCE DASHBOARD ==================== */}
      {isStudent && studentStats && (
        <div className="space-y-6">
          {/* Dynamic Attendance Alert Banner */}
          {studentStats.overall?.isDefaulter && (
            <div
              className={`rounded-3xl p-5 md:p-6 border-2 transition-all shadow-sm ${
                studentStats.overall?.isCritical || studentStats.overall?.percentage < 60
                  ? 'bg-gradient-to-br from-rose-50 via-red-50/50 to-rose-100/40 border-rose-300 text-rose-950'
                  : 'bg-gradient-to-br from-amber-50 via-yellow-50/50 to-amber-100/40 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        studentStats.overall?.isCritical || studentStats.overall?.percentage < 60
                          ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                          : 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                      }`}
                    >
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>
                        {studentStats.overall?.isCritical || studentStats.overall?.percentage < 60
                          ? 'Critical Attendance Debarment Alert'
                          : 'Attendance Shortage Warning (<75%)'}
                      </span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        studentStats.overall?.isCritical || studentStats.overall?.percentage < 60
                          ? 'bg-rose-200/80 text-rose-800'
                          : 'bg-amber-200/80 text-amber-900'
                      }`}
                    >
                      Current: {studentStats.overall?.percentage}% (Min. 75% required)
                    </span>
                  </div>

                  <h3 className="text-base md:text-lg font-black tracking-tight">
                    {studentStats.overall?.isCritical || studentStats.overall?.percentage < 60
                      ? `Critical Debarment Risk: Attendance is ${studentStats.overall?.percentage}% (${studentStats.overall?.totalAttended}/${studentStats.overall?.totalConducted} classes attended)`
                      : `Attendance Below 75%: You have attended ${studentStats.overall?.totalAttended}/${studentStats.overall?.totalConducted} conducted classes (${studentStats.overall?.percentage}%)`}
                  </h3>

                  <p className="text-xs md:text-sm leading-relaxed max-w-3xl">
                    {studentStats.overall?.isCritical || studentStats.overall?.percentage < 60 ? (
                      <>
                        Your attendance has dropped below <strong>60%</strong>. University council rules prescribe automatic debarment from semester final exams if attendance remains below 75%. To clear this shortage, you must attend your next{' '}
                        <strong className="underline decoration-rose-500 decoration-2 font-black text-rose-900">
                          {studentStats.overall?.classesNeededTo75 || Math.max(1, Math.ceil(3 * studentStats.overall?.totalConducted - 4 * studentStats.overall?.totalAttended))} consecutive classes
                        </strong>{' '}
                        without any absence.
                      </>
                    ) : (
                      <>
                        You are currently short of the statutory <strong>75%</strong> attendance threshold. You must attend your next{' '}
                        <strong className="underline decoration-amber-500 decoration-2 font-black text-amber-950">
                          {studentStats.overall?.classesNeededTo75 || Math.max(1, Math.ceil(3 * studentStats.overall?.totalConducted - 4 * studentStats.overall?.totalAttended))} consecutive classes
                        </strong>{' '}
                        without missing any sessions to become eligible for semester examinations.
                      </>
                    )}
                  </p>
                </div>

                {studentStats.mentor && (
                  <div className="shrink-0">
                    <Link
                      to={`/messages?contactId=${studentStats.mentor._id}`}
                      state={{ contactId: studentStats.mentor._id }}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap ${
                        studentStats.overall?.isCritical || studentStats.overall?.percentage < 60
                          ? 'bg-rose-700 hover:bg-rose-800 text-white'
                          : 'bg-amber-700 hover:bg-amber-800 text-white'
                      }`}
                    >
                      <MessageSquare size={14} />
                      <span>Message Mentor ({studentStats.mentor.name?.split(' ')[0]})</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Overall Attendance Rate
                </span>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">
                  {studentStats.overall?.percentage}%
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  {studentStats.overall?.isDefaulter ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle size={12} />
                      Below 75% Requirement
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle size={12} />
                      Eligible for University Exams
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-lg border-4 ${
                  studentStats.overall?.isDefaulter
                    ? 'border-rose-500 text-rose-600 bg-rose-50'
                    : 'border-emerald-500 text-emerald-600 bg-emerald-50'
                }`}
              >
                {studentStats.overall?.percentage}%
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Lectures Attended
              </span>
              <p className="text-3xl font-extrabold text-indigo-900 mt-1">
                {studentStats.overall?.totalAttended}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Out of <strong>{studentStats.overall?.totalConducted}</strong> scheduled sessions conducted.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Statutory Attendance Target
              </span>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">75.0%</p>
              <p className="text-xs text-slate-500 mt-2">
                Mandatory minimum threshold prescribed by University Academic Council.
              </p>
            </div>
          </div>

          {/* Subject Breakdown Cards */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900">Subject-wise Attendance Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studentStats.subjectBreakdown?.map((sub) => {
                const isCritical = sub.percentage < 60;
                const isShortage = sub.isDefaulter;
                const consecutiveNeeded = sub.classesNeededTo75 || (isShortage ? Math.max(1, Math.ceil(3 * sub.conducted - 4 * sub.attended)) : 0);

                return (
                  <div
                    key={sub.subjectId}
                    className={`p-4 rounded-2xl border space-y-2.5 transition ${
                      isCritical
                        ? 'bg-rose-50/50 border-rose-300 shadow-xs'
                        : isShortage
                        ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                            {sub.subjectCode}
                          </span>
                          {isCritical && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-200 text-rose-800">
                              Critical (&lt;60%)
                            </span>
                          )}
                          {!isCritical && isShortage && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900">
                              Shortage (&lt;75%)
                            </span>
                          )}
                          {!isShortage && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                              Eligible (&ge;75%)
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900 mt-1">{sub.subjectName}</h4>
                      </div>
                      <span
                        className={`text-sm font-extrabold ${
                          isCritical
                            ? 'text-rose-700'
                            : isShortage
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {sub.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCritical ? 'bg-rose-500' : isShortage ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 gap-1">
                      <span>
                        Attended: <strong>{sub.attended}</strong> / {sub.conducted} sessions
                      </span>
                      {isShortage && (
                        <span className={`font-extrabold ${isCritical ? 'text-rose-700' : 'text-amber-800'}`}>
                          ⚠️ Needs {consecutiveNeeded} consecutive classes to reach 75%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chronological Session History Log */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900">Recent Attendance Audit Logs</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Date & Time</th>
                    <th className="pb-3">Subject</th>
                    <th className="pb-3">Classroom</th>
                    <th className="pb-3">Faculty Instructor</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentStats.recentLogs?.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50">
                      <td className="py-3 text-slate-600 font-mono text-[11px]">
                        {new Date(log.date).toLocaleString()}
                      </td>
                      <td className="py-3 font-bold text-slate-800">
                        {log.subject} ({log.subjectCode})
                      </td>
                      <td className="py-3 text-slate-600">{log.roomNumber}</td>
                      <td className="py-3 text-slate-600">{log.teacher}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={11} />
                          Present
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!studentStats.recentLogs || studentStats.recentLogs.length === 0) && (
                <p className="text-center text-slate-400 py-8 text-xs">No attendance sessions logged yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TEACHER / HOD / ADMIN MULTI-DIMENSIONAL AUDIT ==================== */}
      {!isStudent && (
        <div className="space-y-6">
          {/* Multi-Dimensional Filter Toolbar */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Department Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Building size={12} />
                  <span>Department</span>
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Cohort Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <GraduationCap size={12} />
                  <span>Batch Cohort</span>
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
                >
                  {filteredBatches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Teacher Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <User size={12} />
                  <span>Faculty Instructor</span>
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
                >
                  <option value="all">All Faculty Instructors</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <BookOpen size={12} />
                  <span>Curriculum Subject</span>
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
                >
                  <option value="all">All Curriculum Subjects</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-toolbar: Search & Defaulter toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFilterDefaultersOnly(!filterDefaultersOnly)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                    filterDefaultersOnly
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={13} />
                  <span>{filterDefaultersOnly ? 'Showing Defaulters (< 75%)' : 'Show All Students'}</span>
                </button>

                <span className="text-xs text-slate-400 hidden sm:inline">|</span>
                <span className="text-xs text-slate-500">
                  Target Batch: <strong className="text-slate-800">{batches.find((b) => b._id === selectedBatchId)?.name || 'Batch'}</strong>
                </span>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name or roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-64"
                />
              </div>
            </div>
          </div>

          {/* Batch Overview KPI Cards */}
          {batchReport && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled Cohort</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{batchReport.totalStudents} Students</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Sessions Conducted</span>
                <p className="text-2xl font-extrabold text-indigo-900 mt-1">{batchReport.totalSessions} Sessions</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Cohort Average</span>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                  {batchReport.report?.length > 0
                    ? Math.round(batchReport.report.reduce((acc, r) => acc + r.percentage, 0) / batchReport.report.length)
                    : 100}%
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Attendance Defaulters (&lt;75%)</span>
                <p className="text-2xl font-extrabold text-rose-600 mt-1">{batchReport.defaulterCount} At-Risk</p>
              </div>
            </div>
          )}

          {/* Defaulter Alert Callout Banner for Batch */}
          {batchReport?.defaulterCount > 0 && (
            <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Cohort Attendance Alert: {batchReport.defaulterCount} Student{batchReport.defaulterCount > 1 ? 's' : ''} Below 75% Threshold
                  </h4>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">
                    These students do not currently meet the mandatory statutory attendance minimum required for university examination eligibility.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterDefaultersOnly(!filterDefaultersOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  filterDefaultersOnly
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/60'
                }`}
              >
                {filterDefaultersOnly ? '✓ Viewing Defaulters Only' : 'Filter At-Risk Students →'}
              </button>
            </div>
          )}

          {/* Batch Student Attendance Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Student Attendance Ledger & Threshold Audit</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Click "Edit / Override" to record medical excuses or adjust attendance directly.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Roll No</th>
                    <th className="pb-3">Student Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Conducted</th>
                    <th className="pb-3">Attended</th>
                    <th className="pb-3">Attendance %</th>
                    <th className="pb-3">Status</th>
                    {(isAdmin || isHod || isTeacher) && <th className="pb-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchReport?.report
                    ?.filter((r) => {
                      if (filterDefaultersOnly && !r.isDefaulter) return false;
                      if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        if (!r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) {
                          return false;
                        }
                      }
                      return true;
                    })
                    ?.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50 transition">
                        <td className="py-3 font-mono font-bold text-slate-700">{row.rollNumber}</td>
                        <td className="py-3 font-bold text-slate-900">{row.name}</td>
                        <td className="py-3 text-slate-500">{row.email}</td>
                        <td className="py-3 text-slate-600">{row.totalConducted}</td>
                        <td className="py-3 font-semibold text-slate-800">{row.attended}</td>
                        <td className="py-3 font-extrabold">
                          <span className={row.isDefaulter ? 'text-rose-600' : 'text-emerald-700'}>
                            {row.percentage}%
                          </span>
                        </td>
                        <td className="py-3">
                          {row.isDefaulter ? (
                            row.percentage < 60 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertTriangle size={11} />
                                Critical (&lt;60%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                <AlertTriangle size={11} />
                                Shortage (&lt;75%)
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle size={11} />
                              Compliant
                            </span>
                          )}
                        </td>
                        {(isAdmin || isHod || isTeacher) && (
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleOpenOverride(row)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100/80 border border-brand-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Override or adjust attendance"
                            >
                              <Edit2 size={11} />
                              <span>Edit / Override</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>

              {(!batchReport?.report || batchReport.report.length === 0) && (
                <p className="text-center text-slate-400 py-8 text-xs">No student records found for this cohort.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Attendance Override Modal */}
      {overrideModal && selectedStudentForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-700 rounded-xl">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Attendance Adjustment</h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedStudentForEdit.name} ({selectedStudentForEdit.rollNumber})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOverrideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {overrideMsg.text && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  overrideMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {overrideMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
                <span>{overrideMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Subject</label>
                <select
                  value={overrideData.subjectId}
                  onChange={(e) => setOverrideData({ ...overrideData, subjectId: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Latest / Batch Active Subject</option>
                  {subjects.map((sub) => (
                    <option key={sub._id} value={sub._id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Attendance Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'present', label: 'Present', color: 'border-emerald-300 text-emerald-800 bg-emerald-50' },
                    { val: 'excused', label: 'Excused', color: 'border-blue-300 text-blue-800 bg-blue-50' },
                    { val: 'absent', label: 'Absent', color: 'border-rose-300 text-rose-800 bg-rose-50' },
                  ].map((st) => (
                    <button
                      type="button"
                      key={st.val}
                      onClick={() => setOverrideData({ ...overrideData, status: st.val })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                        overrideData.status === st.val
                          ? `${st.color} ring-2 ring-brand-500/30`
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Medical slip submitted, NSS Camp, Technical Fest"
                  value={overrideData.remarks}
                  onChange={(e) => setOverrideData({ ...overrideData, remarks: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
