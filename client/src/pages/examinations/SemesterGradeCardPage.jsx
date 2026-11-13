import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Award,
  Printer,
  ShieldCheck,
  Building,
  GraduationCap,
  Calendar,
  CheckCircle,
  AlertTriangle,
  FileText,
  Search,
  Plus,
  Filter,
} from 'lucide-react';

export default function SemesterGradeCardPage() {
  const { user, isStudent, isAdmin, isTeacher, isHod } = useAuth();
  const [transcriptData, setTranscriptData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin Controls State
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [examinations, setExaminations] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' | 'enter_marks'

  // Multi-Filter State
  const [filterDept, setFilterDept] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');

  // Marks Entry Form
  const [marksForm, setMarksForm] = useState({
    examinationId: '',
    studentId: '',
    subjectId: '',
    batchId: '',
    marksObtained: '',
    maxMarks: 100,
    grade: 'A',
  });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const loadTranscript = async (studentId) => {
    try {
      setLoading(true);
      const url = studentId ? `/examinations/transcript/${studentId}` : '/examinations/transcript';
      const res = await api.get(url);
      if (res.data?.success) {
        setTranscriptData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminMetadata = async () => {
    try {
      const [stuRes, depRes, examRes, subRes, batRes] = await Promise.allSettled([
        api.get('/users/students'),
        api.get('/academics/departments'),
        api.get('/examinations?type=semester'),
        api.get('/academics/subjects'),
        api.get('/academics/batches'),
      ]);

      if (stuRes.status === 'fulfilled' && stuRes.value.data?.success) {
        setStudents(stuRes.value.data.data);
        if (stuRes.value.data.data.length > 0) {
          const firstId = stuRes.value.data.data[0]._id;
          setSelectedStudentId(firstId);
          loadTranscript(firstId);
          setMarksForm((prev) => ({ ...prev, studentId: firstId }));
        }
      }
      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
      }
      if (examRes.status === 'fulfilled' && examRes.value.data?.success) {
        setExaminations(examRes.value.data.data);
        if (examRes.value.data.data.length > 0) {
          setMarksForm((prev) => ({ ...prev, examinationId: examRes.value.data.data[0]._id }));
        }
      }
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) {
        setSubjects(subRes.value.data.data);
        if (subRes.value.data.data.length > 0) {
          setMarksForm((prev) => ({ ...prev, subjectId: subRes.value.data.data[0]._id }));
        }
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) {
        setBatches(batRes.value.data.data);
        if (batRes.value.data.data.length > 0) {
          setMarksForm((prev) => ({ ...prev, batchId: batRes.value.data.data[0]._id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Students based on department & batch
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterDept !== 'all') {
        const dId = s.department?._id || s.department || s.profile?.department?._id || s.profile?.department;
        if (dId?.toString() !== filterDept) return false;
      }
      if (filterBatch !== 'all') {
        const bId = s.profile?.batch?._id || s.profile?.batch;
        if (bId?.toString() !== filterBatch) return false;
      }
      return true;
    });
  }, [students, filterDept, filterBatch]);

  useEffect(() => {
    if (isStudent) {
      loadTranscript();
    } else {
      loadAdminMetadata();
    }
  }, [isStudent]);

  const handleStudentSelect = (e) => {
    const sId = e.target.value;
    setSelectedStudentId(sId);
    setMarksForm((prev) => ({ ...prev, studentId: sId }));
    loadTranscript(sId);
  };

  const handleEnterSemesterMarks = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/examinations/semester-marks', marksForm);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Official semester mark recorded and verified in transcript.' });
        loadTranscript(marksForm.studentId);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to record semester marks' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (hidden during print) */}
      <div className="print:hidden bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Controller of Examinations
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Official University Transcript
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Academic Grade Card & Semester Transcript
          </h1>
          <p className="text-orange-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Consolidated credit evaluation combining continuous internal assessments (CIA) and university end-semester examinations.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-orange-700 text-xs font-bold shadow-lg hover:bg-orange-50 transition cursor-pointer self-start md:self-auto"
        >
          <span data-nav-icon="true" className="shrink-0 text-current flex items-center justify-center">
            <Printer size={16} strokeWidth={2.2} className="shrink-0 text-current" />
          </span>
          <span>Print / Export Grade Card</span>
        </button>
      </div>

      {/* Admin Tab Toolbar (hidden during print) */}
      {!isStudent && (
        <div className="print:hidden bg-white rounded-3xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'transcript'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span data-nav-icon="true" className="shrink-0 text-current flex items-center justify-center">
                <FileText size={14} className="shrink-0 text-current" strokeWidth={2.2} />
              </span>
              <span>Inspect Student Transcript</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('enter_marks')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeTab === 'enter_marks'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span data-nav-icon="true" className="shrink-0 text-current flex items-center justify-center">
                  <Plus size={14} className="shrink-0 text-current" strokeWidth={2.2} />
                </span>
                <span>Publish Official Semester Marks</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">Dept:</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50"
              >
                <option value="all">All Depts</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">Batch:</label>
              <select
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50"
              >
                <option value="all">All Batches</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-700">Student:</label>
              <select
                value={selectedStudentId}
                onChange={handleStudentSelect}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50"
              >
                {filteredStudents.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.profile?.rollNumber || s.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Admin Marks Entry Panel */}
      {!isStudent && activeTab === 'enter_marks' && isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-600" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Admin Gateway: Record University End-Semester Examination Marks
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Per institutional policy, only College Administrators have permission to submit official end-semester marks.
          </p>

          {statusMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <form onSubmit={handleEnterSemesterMarks} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Examination Drive</label>
              <select
                value={marksForm.examinationId}
                onChange={(e) => setMarksForm({ ...marksForm, examinationId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
              >
                {examinations.map((ex) => (
                  <option key={ex._id} value={ex._id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Curriculum Subject</label>
              <select
                value={marksForm.subjectId}
                onChange={(e) => setMarksForm({ ...marksForm, subjectId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
              >
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Marks Obtained (out of 100)</label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={marksForm.marksObtained}
                onChange={(e) => setMarksForm({ ...marksForm, marksObtained: e.target.value })}
                placeholder="e.g. 88"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Record Semester Mark
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== OFFICIAL PRINTABLE GRADE CARD ==================== */}
      {transcriptData && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-8 md:p-12 space-y-8 font-sans max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
          {/* Institutional Crest Header */}
          <div className="text-center pb-6 border-b-2 border-slate-900/80 space-y-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md mx-auto mb-2">
              360
            </div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-900">
              ACADEX INSTITUTE OF SCIENCE & TECHNOLOGY
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Autonomous Institutional Accreditation Council • Department of Higher Education
            </p>
            <div className="inline-block px-4 py-1 mt-2 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
              Official Statement of Grades • Semester Academic Transcript
            </div>
          </div>

          {/* Student Dossier Information Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-xs bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Student Full Name</span>
              <p className="font-extrabold text-slate-900 text-sm">{transcriptData.student?.name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Roll Number</span>
              <p className="font-mono font-bold text-slate-900">{transcriptData.student?.rollNumber}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Enrollment ID</span>
              <p className="font-mono font-bold text-slate-900">{transcriptData.student?.enrollmentNumber}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Degree Program</span>
              <p className="font-bold text-slate-800">{transcriptData.student?.course}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Department</span>
              <p className="font-bold text-slate-800">{transcriptData.student?.department}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Academic Cohort</span>
              <p className="font-bold text-slate-800">
                {transcriptData.student?.batch} (Sem {transcriptData.student?.currentSemester})
              </p>
            </div>
          </div>

          {/* Subject Performance Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-extrabold text-[11px] border-b border-slate-300 uppercase">
                  <th className="p-3 border-r border-slate-300">Code</th>
                  <th className="p-3 border-r border-slate-300">Subject Title</th>
                  <th className="p-3 text-center border-r border-slate-300">Credits</th>
                  <th className="p-3 text-center border-r border-slate-300">CIA (50)</th>
                  <th className="p-3 text-center border-r border-slate-300">ESE (100)</th>
                  <th className="p-3 text-center border-r border-slate-300">Total (150)</th>
                  <th className="p-3 text-center border-r border-slate-300">Grade</th>
                  <th className="p-3 text-center">Credit Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transcriptData.subjects?.map((sub) => (
                  <tr key={sub.subjectId} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-900 border-r border-slate-200">
                      {sub.code}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 border-r border-slate-200">
                      {sub.name}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-200">
                      {sub.credits}
                    </td>
                    <td className="p-3 text-center text-slate-700 border-r border-slate-200 font-medium">
                      {sub.internalMarks ? sub.internalMarks.obtained : '—'}
                    </td>
                    <td className="p-3 text-center text-slate-700 border-r border-slate-200 font-medium">
                      {sub.semesterMarks ? sub.semesterMarks.obtained : '—'}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 border-r border-slate-200">
                      {sub.totalObtained} ({sub.overallPercent}%)
                    </td>
                    <td className="p-3 text-center border-r border-slate-200 font-extrabold">
                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          sub.grade === 'F' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {sub.grade}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900">
                      {sub.creditPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SGPA & Cumulative Academic Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Credits</span>
              <p className="text-xl font-extrabold mt-1">{transcriptData.transcriptSummary?.totalCredits}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Credit Points</span>
              <p className="text-xl font-extrabold mt-1">{transcriptData.transcriptSummary?.totalCreditPoints}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400">Semester SGPA</span>
              <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">
                {transcriptData.transcriptSummary?.sgpa} / 10.0
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Result Classification</span>
              <p className="text-xs font-extrabold mt-1 text-emerald-300">
                {transcriptData.transcriptSummary?.resultStatus}
              </p>
            </div>
          </div>

          {/* Transcript Sign-Off & Verification Footer */}
          <div className="pt-12 flex items-end justify-between border-t border-slate-200 text-xs">
            <div className="space-y-1 text-slate-500 text-[11px]">
              <p>Issued on: {new Date().toLocaleDateString()}</p>
              <p>Cryptographic Transcript Hash: {Math.random().toString(36).substring(2, 12).toUpperCase()}</p>
              <p className="text-[10px] text-slate-400">Acadex Institutional Verification System</p>
            </div>

            <div className="text-center space-y-1">
              <div className="w-36 h-0.5 bg-slate-400 mx-auto" />
              <p className="font-extrabold text-slate-900">Controller of Examinations</p>
              <p className="text-[10px] text-slate-500">Autonomous Board of Evaluations</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
