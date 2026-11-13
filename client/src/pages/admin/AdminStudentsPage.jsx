import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  GraduationCap,
  Plus,
  Upload,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Building,
  Filter,
  Search,
  User,
  Edit2,
} from 'lucide-react';

export default function AdminStudentsPage() {
  const { user, isHod, isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [filterMentor, setFilterMentor] = useState('all'); // 'all' | 'unassigned' | teacherId
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rollNumber: '',
    department: '',
    course: '',
    batch: '',
    currentSemester: 1,
    phone: '',
  });

  // Batch Mentor Fast Reassign Tool State
  const [showBatchMentorTool, setShowBatchMentorTool] = useState(false);
  const [batchToolBatchId, setBatchToolBatchId] = useState('');
  const [batchToolMentorId, setBatchToolMentorId] = useState('');
  const [batchToolLoading, setBatchToolLoading] = useState(false);

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState({
    name: '',
    phone: '',
    rollNumber: '',
    department: '',
    batch: '',
    currentSemester: 1,
    mentor: '',
  });

  const handleOpenEditStudent = (s) => {
    setEditingStudent(s);
    setEditStudentForm({
      name: s.name || '',
      phone: s.phone || '',
      rollNumber: s.profile?.rollNumber || '',
      department: s.department?._id || s.profile?.department?._id || '',
      batch: s.profile?.batch?._id || '',
      currentSemester: s.profile?.currentSemester || 1,
      mentor: s.profile?.mentor?._id || s.profile?.mentor || '',
    });
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/users/students/${editingStudent._id}`, editStudentForm);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Student profile updated successfully' });
        setEditingStudent(null);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update student profile' });
    }
  };

  const handleBatchMentorFastAssign = async (e) => {
    e.preventDefault();
    if (!batchToolBatchId || !batchToolMentorId) return;
    try {
      setBatchToolLoading(true);
      const res = await api.post(`/academics/batches/${batchToolBatchId}/assign-mentor`, {
        mentorId: batchToolMentorId,
        updateExistingStudents: true,
        notifyStudents: true,
      });
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: res.data.message || 'Batch mentor reallocated successfully' });
        setShowBatchMentorTool(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to reassign batch mentor' });
    } finally {
      setBatchToolLoading(false);
    }
  };

  const [bulkInput, setBulkInput] = useState('');

  const loadData = async () => {
    try {
      const [stuRes, depRes, crsRes, batRes, teaRes] = await Promise.allSettled([
        api.get('/users/students'),
        api.get('/academics/departments'),
        api.get('/academics/courses'),
        api.get('/academics/batches'),
        api.get('/users/teachers'),
      ]);

      if (stuRes.status === 'fulfilled' && stuRes.value.data?.success) setStudents(stuRes.value.data.data);
      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
        if (depRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, department: depRes.value.data.data[0]._id }));
        }
      }
      if (crsRes.status === 'fulfilled' && crsRes.value.data?.success) {
        setCourses(crsRes.value.data.data);
        if (crsRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, course: crsRes.value.data.data[0]._id }));
        }
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) {
        setBatches(batRes.value.data.data);
        if (batRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, batch: batRes.value.data.data[0]._id }));
        }
      }
      if (teaRes.status === 'fulfilled' && teaRes.value.data?.success) {
        setTeachers(teaRes.value.data.data);
        const mentors = teaRes.value.data.data.filter((t) => Boolean(t.profile?.isMentor));
        if (mentors.length > 0) {
          setSelectedMentor(mentors[0]._id);
          setBatchToolMentorId(mentors[0]._id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Zero-refresh automatic live synchronization on any student/batch/mentor change
  useRealtimeSync(['students_updated', 'batch_updated', 'teachers_updated'], loadData);

  // Multi-dimensional filtering logic (Batch, Mentor, Department, Semester, Search)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Department filter
      if (selectedDepartment !== 'all') {
        const dId = s.department?._id || s.department || s.profile?.department?._id || s.profile?.department;
        if (dId?.toString() !== selectedDepartment) return false;
      }
      // Batch filter
      if (selectedBatch !== 'all') {
        const bId = s.profile?.batch?._id || s.profile?.batch;
        if (bId?.toString() !== selectedBatch) return false;
      }
      // Semester filter
      if (selectedSemester !== 'all') {
        if (s.profile?.currentSemester?.toString() !== selectedSemester) return false;
      }
      // Mentor filter (Specific mentor or unallocated)
      if (filterMentor !== 'all') {
        const mId = s.profile?.mentor?._id || s.profile?.mentor;
        if (filterMentor === 'unassigned') {
          if (mId) return false;
        } else {
          if (mId?.toString() !== filterMentor) return false;
        }
      }
      // Search query across name, roll, email, batch, and mentor
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchEmail = s.email?.toLowerCase().includes(q);
        const matchRoll = s.profile?.rollNumber?.toLowerCase().includes(q);
        const matchBatch = s.profile?.batch?.name?.toLowerCase().includes(q);
        const matchMentor = s.profile?.mentor?.name?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRoll && !matchBatch && !matchMentor) return false;
      }
      return true;
    });
  }, [students, selectedDepartment, selectedBatch, selectedSemester, filterMentor, searchQuery]);

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users/students', formData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Student registered successfully' });
        setShowModal(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Registration failed' });
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(bulkInput);
      const res = await api.post('/users/students/bulk-import', { students: parsed });
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: res.data.message });
        setShowBulkModal(false);
        setBulkInput('');
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Invalid JSON syntax' });
    }
  };

  const handleAssignMentor = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0 || !selectedMentor) return;

    try {
      const res = await api.post('/users/students/assign-mentor', {
        studentIds: selectedStudentIds,
        mentorId: selectedMentor,
      });
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Mentor allocated to selected students!' });
        setShowMentorModal(false);
        setSelectedStudentIds([]);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to assign mentor' });
    }
  };

  // Strictly authorized faculty members with mentor privileges enabled
  const authorizedMentors = useMemo(() => {
    return teachers.filter((t) => Boolean(t.profile?.isMentor));
  }, [teachers]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-brand-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Institutional Governance
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Student Information System
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Student Cohort Registry & Mentorship Management
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Manage student enrollment records, inspect cohort profiles by Department, Degree Batch, or Semester, and bulk-assign faculty mentors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedStudentIds.length > 0 && (
            <button
              onClick={() => setShowMentorModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <UserCheck size={16} />
              <span>Assign Mentor ({selectedStudentIds.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              if (batches.length > 0) setBatchToolBatchId(batches[0]._id);
              if (teachers.length > 0) setBatchToolMentorId(teachers[0]._id);
              setShowBatchMentorTool(true);
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
          >
            <UserCheck size={16} />
            <span>Batch Mentor Fast Reassign</span>
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Upload size={16} />
            <span>Bulk Import JSON</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Enroll Student</span>
          </button>
        </div>
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

      {/* Student Registry KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled Cohort</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{students.length} Students</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Academic Batches</span>
          <p className="text-2xl font-extrabold text-brand-700 mt-1">{batches.length} Programs</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Active Departments</span>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{departments.length} Depts</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Mentor Allocation</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {students.length > 0
              ? Math.round(
                  (students.filter((s) => s.mentor?._id || s.mentor).length / students.length) * 100
                )
              : 100}%
          </p>
        </div>
      </div>

      {/* Multi-Dimensional Filter Toolbar: Batches, Mentors, Depts, Semesters */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Building size={12} className="text-brand-600" />
              <span>Department</span>
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedBatch('all'); // Reset batch when department changes
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none font-medium text-slate-800"
            >
              <option value="all">All Departments ({departments.length})</option>
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
              <GraduationCap size={12} className="text-brand-600" />
              <span>Student Batch Cohort</span>
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none font-medium text-slate-800"
            >
              <option value="all">All Active Batches ({batches.length})</option>
              {batches
                .filter((b) => selectedDepartment === 'all' || (b.department?._id || b.department) === selectedDepartment)
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.department?.code || 'CSA'} • Sem {b.currentSemester || 1})
                  </option>
                ))}
            </select>
          </div>

          {/* Faculty Mentor Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck size={12} className="text-amber-600" />
              <span>Faculty Mentor</span>
            </label>
            <select
              value={filterMentor}
              onChange={(e) => setFilterMentor(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none font-medium text-slate-800"
            >
              <option value="all">All Faculty Mentors (Any)</option>
              <option value="unassigned">⚠️ Unallocated (No Mentor Assigned)</option>
              <optgroup label="Active Faculty Mentors">
                {authorizedMentors.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.department?.code || 'Faculty'})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Filter size={12} className="text-indigo-600" />
              <span>Academic Semester</span>
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none font-medium text-slate-800"
            >
              <option value="all">All Semesters (1 - 8)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem.toString()}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Batch Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <GraduationCap size={12} className="text-brand-600" />
            Quick Batches:
          </span>
          <button
            onClick={() => setSelectedBatch('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedBatch === 'all'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Batches ({students.length})
          </button>
          {batches
            .filter((b) => selectedDepartment === 'all' || (b.department?._id || b.department) === selectedDepartment)
            .map((b) => {
              const isSelected = selectedBatch === b._id;
              const batchCount = students.filter((st) => (st.profile?.batch?._id || st.profile?.batch) === b._id).length;

              return (
                <button
                  key={b._id}
                  onClick={() => setSelectedBatch(isSelected ? 'all' : b._id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  <span>{b.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {batchCount}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Search Bar, Active Filter Badges & Reset Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{filteredStudents.length}</strong> of {students.length} students
            </span>

            {/* Active Filter Pills with 1-Click Clear */}
            {selectedDepartment !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                Dept: {departments.find((d) => d._id === selectedDepartment)?.code || selectedDepartment}
                <button onClick={() => setSelectedDepartment('all')} className="hover:text-brand-900 cursor-pointer ml-0.5">✕</button>
              </span>
            )}
            {selectedBatch !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Batch: {batches.find((b) => b._id === selectedBatch)?.name || selectedBatch}
                <button onClick={() => setSelectedBatch('all')} className="hover:text-indigo-900 cursor-pointer ml-0.5">✕</button>
              </span>
            )}
            {filterMentor !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Mentor: {filterMentor === 'unassigned' ? 'Unallocated' : (teachers.find((t) => t._id === filterMentor)?.name || filterMentor)}
                <button onClick={() => setFilterMentor('all')} className="hover:text-amber-900 cursor-pointer ml-0.5">✕</button>
              </span>
            )}
            {selectedSemester !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Sem {selectedSemester}
                <button onClick={() => setSelectedSemester('all')} className="hover:text-purple-900 cursor-pointer ml-0.5">✕</button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-slate-900 cursor-pointer ml-0.5">✕</button>
              </span>
            )}

            {(selectedDepartment !== 'all' || selectedBatch !== 'all' || selectedSemester !== 'all' || filterMentor !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedBatch('all');
                  setSelectedSemester('all');
                  setFilterMentor('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer ml-1"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, roll no, email, mentor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-72 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStudentIds(filteredStudents.map((s) => s._id));
                      else setSelectedStudentIds([]);
                    }}
                    checked={
                      selectedStudentIds.length > 0 &&
                      selectedStudentIds.length === filteredStudents.length
                    }
                    className="rounded text-brand-600 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Roll Number</th>
                <th className="py-3.5 px-4">Cohort Batch</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Semester</th>
                <th className="py-3.5 px-4">Assigned Mentor</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No students match the current filter selection.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const isChecked = selectedStudentIds.includes(s._id);

                  return (
                    <tr key={s._id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) setSelectedStudentIds(selectedStudentIds.filter((id) => id !== s._id));
                            else setSelectedStudentIds([...selectedStudentIds, s._id]);
                          }}
                          className="rounded text-brand-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-400">{s.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {s.profile?.rollNumber || 'PENDING'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        {s.profile?.batch ? (
                          <button
                            type="button"
                            onClick={() => setSelectedBatch(s.profile.batch._id || s.profile.batch)}
                            title="Filter students by this batch"
                            className="text-left font-semibold text-slate-800 hover:text-brand-600 hover:underline cursor-pointer flex items-center gap-1 group"
                          >
                            <span>{s.profile.batch.name}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {s.department?.code || s.profile?.department?.code || 'CSA'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        Sem {s.profile?.currentSemester || 1}
                      </td>
                      <td className="py-3.5 px-4">
                        {s.profile?.mentor ? (
                          <button
                            type="button"
                            onClick={() => setFilterMentor(s.profile.mentor._id || s.profile.mentor)}
                            title={`Filter students mentored by ${s.profile.mentor.name}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                          >
                            <UserCheck size={11} className="text-emerald-600" />
                            <span>{s.profile.mentor.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFilterMentor('unassigned')}
                            title="Filter unallocated students without mentors"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            <AlertCircle size={11} className="text-amber-600" />
                            <span>Unallocated</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditStudent(s)}
                          title="Edit Student Profile"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition cursor-pointer"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Mentor Modal */}
      {showMentorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Assign Mentor to {selectedStudentIds.length} Student(s)
            </h3>
            <p className="text-xs text-slate-500">
              Select a designated faculty mentor to allocate for academic guidance and support tickets.
            </p>

            <form onSubmit={handleAssignMentor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Faculty Mentor (Authorized Mentors Only)</label>
                <select
                  value={selectedMentor}
                  onChange={(e) => setSelectedMentor(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                >
                  {authorizedMentors.length === 0 ? (
                    <option disabled value="">No faculty members currently have mentor privileges enabled</option>
                  ) : (
                    authorizedMentors.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.department?.code || 'CSA'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMentorModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Enroll New Student</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course *</label>
                  <select
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch *</label>
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

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 p-6 md:p-8 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Bulk Import Students (JSON Array)</h3>
            <p className="text-xs text-slate-500">
              Paste a JSON array containing student records with name, email, rollNumber, department, and batch.
            </p>

            <form onSubmit={handleBulkImport} className="space-y-4">
              <textarea
                rows="8"
                required
                placeholder='[{"name": "John Doe", "email": "john@campus360.edu", "rollNumber": "24MCA099", "department": "dept_id", "batch": "batch_id"}]'
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl outline-none bg-slate-50"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md"
                >
                  Import All Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Student Profile Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Edit Student Record</h3>
                <p className="text-xs text-slate-500">{editingStudent.email}</p>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editStudentForm.name}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={editStudentForm.rollNumber}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, rollNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={editStudentForm.department}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cohort Batch</label>
                  <select
                    value={editStudentForm.batch}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, batch: e.target.value })}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={editStudentForm.currentSemester}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, currentSemester: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={editStudentForm.phone}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <UserCheck size={13} className="text-amber-600" />
                  <span>Assigned Faculty Mentor</span>
                </label>
                <select
                  value={editStudentForm.mentor}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, mentor: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                >
                  <option value="">-- No Mentor (Unallocated) --</option>
                  {authorizedMentors.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.profile?.designation || (t.role === 'hod' ? 'HOD' : 'Faculty')} • {t.department?.code || 'CSA'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Change this student's mentor individually if they require special advisory or remedial counseling.
                </p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Batch Mentor Fast Reassign Modal */}
      {showBatchMentorTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Batch Mentor Fast Reassign
                  </h3>
                  <p className="text-xs text-slate-500">
                    Reassign all students in a cohort to any faculty member in 1 click
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchMentorTool(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBatchMentorFastAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Cohort Batch</label>
                <select
                  value={batchToolBatchId}
                  onChange={(e) => setBatchToolBatchId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.department?.code || 'CSA'} • Sem {b.currentSemester || 1})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select New Faculty Mentor (Authorized Mentors Only)
                </label>
                <select
                  value={batchToolMentorId}
                  onChange={(e) => setBatchToolMentorId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {authorizedMentors.length === 0 ? (
                    <option disabled value="">No faculty members currently have mentor privileges enabled</option>
                  ) : (
                    authorizedMentors.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} — {t.profile?.designation || (t.role === 'hod' ? 'HOD' : 'Faculty')} ({t.department?.code || 'CSA'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                This will automatically update the batch's official mentor, sync all students enrolled in this batch to the selected teacher, and dispatch system notifications.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchMentorTool(false)}
                  className="px-4 py-2 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchToolLoading || !batchToolBatchId || !batchToolMentorId}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  {batchToolLoading ? 'Reassigning...' : 'Apply Mentor to Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
