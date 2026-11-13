import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Award, Plus, CheckCircle, AlertCircle, Search, Filter, BookOpen, Edit2, Trash2 } from 'lucide-react';

export default function InternalMarksPage() {
  const { user, isTeacher, isHod, isAdmin, isStudent } = useAuth();
  const [examinations, setExaminations] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Filters
  const [filterExam, setFilterExam] = useState('all');
  const [filterSub, setFilterSub] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Marks entry state
  const [formData, setFormData] = useState({
    examinationId: '',
    studentId: '',
    subjectId: '',
    batchId: '',
    marksObtained: '',
    maxMarks: 50,
    grade: 'A',
  });

  // New exam state
  const [examForm, setExamForm] = useState({
    title: '',
    type: 'internal',
    academicYear: '2025-2026',
    semester: 1,
    department: '',
  });

  // Edit marks state
  const [editingResult, setEditingResult] = useState(null);
  const [editResultData, setEditResultData] = useState({
    marksObtained: '',
    maxMarks: 50,
    grade: 'A',
  });

  const handleOpenEditResult = (r) => {
    setEditingResult(r);
    setEditResultData({
      marksObtained: r.marksObtained,
      maxMarks: r.maxMarks,
      grade: r.grade || 'A',
    });
  };

  const handleUpdateResult = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/examinations/results/${editingResult._id}`, editResultData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Marks updated successfully' });
        setEditingResult(null);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update marks' });
    }
  };

  const handleDeleteResult = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recorded score?')) return;
    try {
      const res = await api.delete(`/examinations/results/${id}`);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Exam record removed' });
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete record' });
    }
  };

  const loadData = async () => {
    try {
      const [examRes, resRes, stuRes, subRes, batRes] = await Promise.allSettled([
        api.get('/examinations'),
        api.get('/examinations/student-results'),
        api.get('/users/students'),
        api.get('/academics/subjects'),
        api.get('/academics/batches'),
      ]);

      if (examRes.status === 'fulfilled' && examRes.value.data?.success) {
        setExaminations(examRes.value.data.data);
        if (examRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, examinationId: examRes.value.data.data[0]._id }));
        }
      }
      if (resRes.status === 'fulfilled' && resRes.value.data?.success) {
        setResults(resRes.value.data.data);
      }
      if (stuRes.status === 'fulfilled' && stuRes.value.data?.success) {
        setStudents(stuRes.value.data.data);
        if (stuRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, studentId: stuRes.value.data.data[0]._id }));
        }
      }
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) {
        setSubjects(subRes.value.data.data);
        if (subRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, subjectId: subRes.value.data.data[0]._id }));
        }
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) {
        setBatches(batRes.value.data.data);
        if (batRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, batchId: batRes.value.data.data[0]._id }));
          setExamForm((prev) => ({
            ...prev,
            department: batRes.value.data.data[0].department?._id || batRes.value.data.data[0].department,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (filterExam !== 'all') {
        const eId = r.examination?._id || r.examination;
        if (eId?.toString() !== filterExam) return false;
      }
      if (filterSub !== 'all') {
        const sId = r.subject?._id || r.subject;
        if (sId?.toString() !== filterSub) return false;
      }
      if (filterType !== 'all') {
        if (r.type !== filterType) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSub = r.subject?.name?.toLowerCase().includes(q) || r.subject?.code?.toLowerCase().includes(q);
        const matchExam = r.examination?.title?.toLowerCase().includes(q);
        const matchTeacher = r.enteredBy?.name?.toLowerCase().includes(q);
        if (!matchSub && !matchExam && !matchTeacher) return false;
      }
      return true;
    });
  }, [results, filterExam, filterSub, filterType, searchQuery]);

  const stats = useMemo(() => {
    if (!results || results.length === 0) return { total: 0, avg: 0, top: 0, passRate: 100 };
    const total = results.length;
    const avg = Math.round(
      results.reduce((acc, r) => acc + (r.marksObtained / (r.maxMarks || 50)) * 100, 0) / total
    );
    const top = Math.max(...results.map((r) => r.marksObtained));
    const passed = results.filter((r) => r.grade !== 'F').length;
    const passRate = Math.round((passed / total) * 100);
    return { total, avg, top, passRate };
  }, [results]);

  const handleCreateExam = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/examinations', examForm);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Examination registered' });
        setShowExamModal(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create examination' });
    }
  };

  const handleSubmitMarks = async (e) => {
    e.preventDefault();
    const selectedExam = examinations.find((x) => x._id === formData.examinationId);
    const endpoint = selectedExam?.type === 'semester'
      ? '/examinations/semester-marks'
      : '/examinations/internal-marks';

    try {
      const res = await api.post(endpoint, formData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Marks recorded successfully' });
        setShowModal(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to record marks' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Academic Examinations & Marks Entry</h1>
          <p className="text-xs text-slate-500 mt-1">
            Faculty enters continuous internal assessments; College Admin manages official semester examination results.
          </p>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowExamModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
            >
              <Plus size={16} />
              <span>Register Exam</span>
            </button>
          )}

          {(isTeacher || isHod || isAdmin) && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
            >
              <Award size={16} />
              <span>Input Marks</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg.text && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Academic Marks KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Evaluations</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total} Records</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Class Average</span>
          <p className="text-2xl font-extrabold text-brand-700 mt-1">{stats.avg}%</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Top Mark</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.top} Pts</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Pass Clearance</span>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{stats.passRate}%</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject, examination title, faculty..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterExam}
            onChange={(e) => setFilterExam(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Examinations</option>
            {examinations.map((x) => (
              <option key={x._id} value={x._id}>
                {x.title} ({x.type?.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterSub}
            onChange={(e) => setFilterSub(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Assessment Types</option>
            <option value="internal">Continuous Internal (CIA)</option>
            <option value="semester">End Semester Exam (ESE)</option>
          </select>
        </div>
      </div>

      {/* Marks Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800">Recorded Academic Marks</h2>
          <span className="text-xs text-slate-500">
            {filteredResults.length} of {results.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Examination</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Subject</th>
                <th className="py-3.5 px-5">Score</th>
                <th className="py-3.5 px-5">Percentage</th>
                <th className="py-3.5 px-5">Entered By</th>
                {(isTeacher || isHod || isAdmin) && <th className="py-3.5 px-5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No examination records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => {
                  const pct = Math.round((r.marksObtained / r.maxMarks) * 100);
                  return (
                    <tr key={r._id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-5 font-bold text-slate-800">{r.examination?.title}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            r.type === 'semester' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-700">{r.subject?.name}</td>
                      <td className="py-3.5 px-5 font-bold text-slate-800">
                        {r.marksObtained} / {r.maxMarks}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`font-semibold ${
                            pct >= 75
                              ? 'text-emerald-600'
                              : pct >= 50
                              ? 'text-blue-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 text-[11px]">{r.enteredBy?.name || 'Staff'}</td>
                      {(isTeacher || isHod || isAdmin) && (
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditResult(r)}
                              title="Edit Marks"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteResult(r._id)}
                              title="Delete Record"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input Marks Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Enter Examination Marks</h2>

            <form onSubmit={handleSubmitMarks} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Examination</label>
                <select
                  value={formData.examinationId}
                  onChange={(e) => setFormData({ ...formData, examinationId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {examinations.map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.title} ({x.type?.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Student</label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {students.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.profile?.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marks Obtained</label>
                  <input
                    type="number"
                    required
                    value={formData.marksObtained}
                    onChange={(e) => setFormData({ ...formData, marksObtained: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Maximum Marks</label>
                  <input
                    type="number"
                    value={formData.maxMarks}
                    onChange={(e) => setFormData({ ...formData, maxMarks: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-md shadow-blue-600/20"
                >
                  Record Marks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Register Examination</h2>

            <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Exam Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End Semester Examinations Dec 2026"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={examForm.type}
                    onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="internal">Continuous Internal Assessment</option>
                    <option value="semester">Official Semester Examination</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Academic Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={examForm.semester}
                    onChange={(e) => setExamForm({ ...examForm, semester: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
                >
                  Create Examination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Marks Modal */}
      {editingResult && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">Edit Academic Score</h2>
                <p className="text-xs text-slate-500">
                  {editingResult.subject?.name} • {editingResult.examination?.title}
                </p>
              </div>
              <button
                onClick={() => setEditingResult(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateResult} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marks Obtained</label>
                  <input
                    type="number"
                    min="0"
                    max={editResultData.maxMarks}
                    required
                    value={editResultData.marksObtained}
                    onChange={(e) => setEditResultData({ ...editResultData, marksObtained: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Maximum Marks</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editResultData.maxMarks}
                    onChange={(e) => setEditResultData({ ...editResultData, maxMarks: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Letter Grade</label>
                <select
                  value={editResultData.grade}
                  onChange={(e) => setEditResultData({ ...editResultData, grade: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F'].map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingResult(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
                >
                  Update Marks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
