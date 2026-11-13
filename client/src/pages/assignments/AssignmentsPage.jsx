import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Plus,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Building,
  GraduationCap,
  BookOpen,
  User,
  Search,
  Filter,
  Edit2,
  Trash2,
} from 'lucide-react';

export default function AssignmentsPage() {
  const { user, isTeacher, isHod, isAdmin, isStudent } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [marks, setMarks] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    batch: '',
    deadline: '',
    maxMarks: 100,
  });

  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    subject: '',
    batch: '',
    deadline: '',
    maxMarks: 100,
  });

  const handleOpenEdit = (assign) => {
    setEditingAssignment(assign);
    setEditFormData({
      title: assign.title || '',
      description: assign.description || '',
      subject: assign.subject?._id || assign.subject || '',
      batch: assign.batch?._id || assign.batch || '',
      deadline: assign.deadline ? new Date(assign.deadline).toISOString().split('T')[0] : '',
      maxMarks: assign.maxMarks || 100,
    });
  };

  const handleUpdateAssignment = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/assignments/${editingAssignment._id}`, editFormData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Assignment updated successfully!' });
        setEditingAssignment(null);
        loadAssignments();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update assignment' });
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this assignment and its submissions?')) return;
    try {
      const res = await api.delete(`/assignments/${id}`);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Assignment deleted successfully' });
        loadAssignments();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete assignment' });
    }
  };

  const loadAssignments = async () => {
    try {
      const [assignRes, depRes, subjRes, batchRes, teachRes] = await Promise.allSettled([
        api.get('/assignments'),
        api.get('/academics/departments'),
        api.get('/academics/subjects'),
        api.get('/academics/batches'),
        api.get('/users/teachers'),
      ]);

      if (assignRes.status === 'fulfilled' && assignRes.value.data?.success) {
        setAssignments(assignRes.value.data.data);
      }
      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
      }
      if (subjRes.status === 'fulfilled' && subjRes.value.data?.success) {
        setSubjects(subjRes.value.data.data);
        if (subjRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, subject: subjRes.value.data.data[0]._id }));
        }
      }
      if (batchRes.status === 'fulfilled' && batchRes.value.data?.success) {
        setBatches(batchRes.value.data.data);
        if (batchRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, batch: batchRes.value.data.data[0]._id }));
        }
      }
      if (teachRes.status === 'fulfilled' && teachRes.value.data?.success) {
        setTeachers(teachRes.value.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Multi-dimensional filtering logic
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Department filter
      if (selectedDepartment !== 'all') {
        const deptId =
          a.department?._id ||
          a.department ||
          a.batch?.department?._id ||
          a.batch?.department ||
          a.subject?.department?._id ||
          a.subject?.department;
        if (deptId?.toString() !== selectedDepartment) return false;
      }
      // Batch filter
      if (selectedBatch !== 'all') {
        const bId = a.batch?._id || a.batch;
        if (bId?.toString() !== selectedBatch) return false;
      }
      // Subject filter
      if (selectedSubject !== 'all') {
        const subId = a.subject?._id || a.subject;
        if (subId?.toString() !== selectedSubject) return false;
      }
      // Teacher filter
      if (selectedTeacher !== 'all') {
        const tId = a.teacher?._id || a.teacher;
        if (tId?.toString() !== selectedTeacher) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = a.title?.toLowerCase().includes(q);
        const matchSub = a.subject?.name?.toLowerCase().includes(q) || a.subject?.code?.toLowerCase().includes(q);
        const matchBatch = a.batch?.name?.toLowerCase().includes(q);
        const matchTeacher = a.teacher?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchBatch && !matchTeacher) return false;
      }
      return true;
    });
  }, [assignments, selectedDepartment, selectedBatch, selectedSubject, selectedTeacher, searchQuery]);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/assignments', formData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Assignment created successfully' });
        setShowCreateModal(false);
        loadAssignments();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Creation failed' });
    }
  };

  const handleStudentSubmit = async (assignmentId) => {
    if (!submissionFile) {
      setStatusMsg({ type: 'error', text: 'Please select a solution file to submit' });
      return;
    }

    const data = new FormData();
    data.append('file', submissionFile);

    try {
      const res = await api.post(`/assignments/${assignmentId}/submit`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Assignment submitted successfully!' });
        setSubmissionFile(null);
        loadAssignments();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Submission failed' });
    }
  };

  const viewSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    try {
      const res = await api.get(`/assignments/${assignment._id}/submissions`);
      if (res.data?.success) {
        setSubmissions(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const gradeStudent = async (subId) => {
    try {
      await api.patch(`/assignments/submissions/${subId}/grade`, {
        marksObtained: marks,
        feedback,
      });
      setStatusMsg({ type: 'success', text: 'Grade and feedback recorded' });
      viewSubmissions(selectedAssignment);
      setMarks('');
      setFeedback('');
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to grade submission' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-brand-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Coursework & Continuous Evaluation
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Submissions & Grading
            </span>
      
    </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Assignments & Assessment Tasks
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Multi-perspective coursework manager: explore by Academic Department, Student Batch, Subject, or Teaching Faculty.
          </p>
    
    </div>

        {(isTeacher || isHod || isAdmin) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} />
            <span>Create New Assignment</span>
          </button>
        )}
  
    </div>

      {statusMsg.text && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
      
    </div>
          <button onClick={() => setStatusMsg({ type: '', text: '' })} className="font-bold cursor-pointer">
            ✕
          </button>
    
    </div>
      )}

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

          {/* Batch Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <GraduationCap size={12} />
              <span>Batch Cohort</span>
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Batches</option>
              {batches
                .filter((b) => selectedDepartment === 'all' || (b.department?._id || b.department) === selectedDepartment)
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
            </select>
      
    </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <BookOpen size={12} />
              <span>Subject</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
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
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Faculty</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
      
    </div>
    
    </div>

        {/* Search Bar & Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing <strong className="text-slate-900">{filteredAssignments.length}</strong> assignments
            </span>
            {(selectedDepartment !== 'all' || selectedBatch !== 'all' || selectedSubject !== 'all' || selectedTeacher !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedBatch('all');
                  setSelectedSubject('all');
                  setSelectedTeacher('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
      
    </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search assignment title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-64"
            />
      
    </div>
    
    </div>
  
    </div>

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssignments.map((assign) => (
          <div
            key={assign._id}
            className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {assign.subject?.code || 'SUBJ'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                    Max: {assign.maxMarks || 100} pts
                  </span>
                  {(isAdmin || isHod || (isTeacher && (assign.teacher?._id === user?._id || assign.teacher === user?._id))) && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(assign);
                        }}
                        title="Edit Assignment"
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAssignment(assign._id);
                        }}
                        title="Delete Assignment"
                        className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                
    </div>
                  )}
            
    </div>
          
    </div>

              <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{assign.title}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{assign.description}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                <p>
                  <strong>Cohort:</strong> {assign.batch?.name || 'Class Batch'}
                </p>
                <p>
                  <strong>Faculty:</strong> {assign.teacher?.name || 'Faculty Member'}
                </p>
                <p className="text-slate-400">
                  <strong>Deadline:</strong> {assign.deadline ? new Date(assign.deadline).toLocaleDateString() : 'Continuous'}
                </p>
          
    </div>
        
    </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              {isStudent ? (
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      onChange={(e) => setSubmissionFile(e.target.files[0])}
                      className="text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-100 hover:file:bg-slate-200 cursor-pointer"
                    />
                    <button
                      onClick={() => handleStudentSubmit(assign._id)}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                    >
                      Submit
                    </button>
              
    </div>
            
    </div>
              ) : (
                <button
                  onClick={() => viewSubmissions(assign)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Review Submissions</span>
                </button>
              )}
        
    </div>
      
    </div>
        ))}
  
    </div>

      {filteredAssignments.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 space-y-2">
          <FileText size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No assignments found matching the criteria</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try resetting your Department, Batch, or Subject filter selections.
          </p>
    
    </div>
      )}

      {/* Submissions Review Modal (Faculty / Admin) */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  {selectedAssignment.subject?.name}
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Submissions: {selectedAssignment.title}
                </h3>
          
    </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
        
    </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-2">Student</th>
                    <th className="pb-2">Submitted</th>
                    <th className="pb-2">File</th>
                    <th className="pb-2">Marks ({selectedAssignment.maxMarks || 100})</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-900">{sub.student?.name}</td>
                      <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">
                        <a
                          href={sub.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline font-bold"
                        >
                          View File
                        </a>
                      </td>
                      <td className="py-2.5 font-bold text-slate-800">
                        {sub.marksObtained !== null && sub.marksObtained !== undefined
                          ? `${sub.marksObtained} pts`
                          : 'Ungraded'}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder="Score"
                            className="w-14 px-1.5 py-1 text-xs border border-slate-200 rounded-lg text-center"
                            onChange={(e) => setMarks(e.target.value)}
                          />
                          <button
                            onClick={() => gradeStudent(sub._id)}
                            className="px-2 py-1 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 cursor-pointer"
                          >
                            Grade
                          </button>
                    
    </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {submissions.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-xs">No submissions received yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Create Coursework Assignment</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assignment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Database CAP Theorem Case Study"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch *</label>
                  <select
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Marks</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.maxMarks}
                    onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Submission Deadline</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructions & Problem Statement</label>
                <textarea
                  rows="3"
                  placeholder="Detail the deliverable requirements..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Edit Assignment</h3>
              <button
                onClick={() => setEditingAssignment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Subject *</label>
                  <select
                    value={editFormData.subject}
                    onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch *</label>
                  <select
                    value={editFormData.batch}
                    onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Score</label>
                  <input
                    type="number"
                    value={editFormData.maxMarks}
                    onChange={(e) => setEditFormData({ ...editFormData, maxMarks: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Submission Deadline</label>
                  <input
                    type="date"
                    value={editFormData.deadline}
                    onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructions & Description</label>
                <textarea
                  rows="3"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Update Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
