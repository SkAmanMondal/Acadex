import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import {
  Users,
  Plus,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Building,
  Search,
  Filter,
  UserCheck,
  Award,
  Edit2,
} from 'lucide-react';

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedDesignation, setSelectedDesignation] = useState('all');
  const [selectedMentorFilter, setSelectedMentorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    department: '',
    designation: 'Assistant Professor',
    qualification: 'M.Tech / MCA',
    isHod: false,
    isMentor: false,
  });

  const [assignData, setAssignData] = useState({
    subjectId: '',
    batchId: '',
    semester: 1,
  });

  // Edit Teacher State
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editTeacherForm, setEditTeacherForm] = useState({
    name: '',
    phone: '',
    department: '',
    designation: 'Assistant Professor',
    qualification: '',
    specialization: '',
    isMentor: false,
  });

  const handleOpenEditTeacher = (t) => {
    setEditingTeacher(t);
    setEditTeacherForm({
      name: t.name || '',
      phone: t.phone || '',
      department: t.department?._id || t.profile?.department?._id || '',
      designation: t.profile?.designation || 'Assistant Professor',
      qualification: t.profile?.qualification || '',
      specialization: t.profile?.specialization || '',
      isMentor: Boolean(t.profile?.isMentor),
    });
  };

  const handleUpdateTeacher = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/users/teachers/${editingTeacher._id}`, editTeacherForm);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Faculty profile updated successfully' });
        setEditingTeacher(null);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update faculty profile' });
    }
  };

  const handleToggleMentor = async (teacherId, currentStatus, teacherName) => {
    try {
      const res = await api.patch(`/users/teachers/${teacherId}/toggle-mentor`, {
        isMentor: !currentStatus,
      });
      if (res.data?.success) {
        setStatusMsg({
          type: 'success',
          text: `Updated ${teacherName}'s mentorship status to ${!currentStatus ? 'Authorized Faculty Mentor' : 'Standard Faculty'}.`,
        });
        loadData();
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to toggle mentorship status',
      });
    }
  };

  const loadData = async () => {
    try {
      const [teaRes, depRes, subRes, batRes] = await Promise.allSettled([
        api.get('/users/teachers'),
        api.get('/academics/departments'),
        api.get('/academics/subjects'),
        api.get('/academics/batches'),
      ]);

      if (teaRes.status === 'fulfilled' && teaRes.value.data?.success) setTeachers(teaRes.value.data.data);
      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
        if (depRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, department: depRes.value.data.data[0]._id }));
        }
      }
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) {
        setSubjects(subRes.value.data.data);
        if (subRes.value.data.data.length > 0) {
          setAssignData((prev) => ({ ...prev, subjectId: subRes.value.data.data[0]._id }));
        }
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) {
        setBatches(batRes.value.data.data);
        if (batRes.value.data.data.length > 0) {
          setAssignData((prev) => ({ ...prev, batchId: batRes.value.data.data[0]._id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Multi-dimensional filtering logic
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // Department
      if (selectedDepartment !== 'all') {
        const dId = t.department?._id || t.department;
        if (dId?.toString() !== selectedDepartment) return false;
      }
      // Designation
      if (selectedDesignation !== 'all') {
        if (selectedDesignation === 'hod') {
          if (t.role !== 'hod' && !t.profile?.isHod) return false;
        } else {
          if (!t.profile?.designation?.toLowerCase().includes(selectedDesignation.toLowerCase())) return false;
        }
      }
      // Mentor Capability
      if (selectedMentorFilter === 'mentor') {
        if (!t.profile?.isMentor) return false;
      } else if (selectedMentorFilter === 'non_mentor') {
        if (t.profile?.isMentor) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = t.name?.toLowerCase().includes(q);
        const matchEmail = t.email?.toLowerCase().includes(q);
        const matchEmpId = t.profile?.employeeId?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchEmpId) return false;
      }
      return true;
    });
  }, [teachers, selectedDepartment, selectedDesignation, selectedMentorFilter, searchQuery]);

  const handleRegisterTeacher = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users/teachers', formData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Faculty registered successfully!' });
        setShowModal(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Registration failed' });
    }
  };

  const handleAssignSubject = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users/teachers/assign-subject', {
        teacherId: selectedTeacher._id,
        ...assignData,
      });
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Teaching subject assigned successfully' });
        setShowAssignModal(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Assignment failed' });
    }
  };

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
              Faculty Staff Roster
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Faculty Directory & Teaching Allocations
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Manage academic appointments, inspect department faculty allocations, and map teaching workloads across degree cohorts.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          <span>Onboard Faculty Member</span>
        </button>
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

      {/* Faculty Registry KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Faculty Members</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{teachers.length} Professors</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Department Leads</span>
          <p className="text-2xl font-extrabold text-brand-700 mt-1">
            {teachers.filter((t) => t.role === 'hod').length} HODs
          </p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Active Mentors</span>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">
            {teachers.filter((t) => t.profile?.isMentor).length} Mentors
          </p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Subject Coverage</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {teachers.reduce((acc, t) => acc + (t.profile?.assignedSubjects?.length || 0), 0)} Courses
          </p>
        </div>
      </div>

      {/* Multi-Dimensional Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          {/* Designation Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Award size={12} />
              <span>Designation / Role</span>
            </label>
            <select
              value={selectedDesignation}
              onChange={(e) => setSelectedDesignation(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Designations</option>
              <option value="hod">Head of Department (HOD)</option>
              <option value="professor">Professor</option>
              <option value="associate">Associate Professor</option>
              <option value="assistant">Assistant Professor</option>
            </select>
          </div>

          {/* Mentorship Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck size={12} />
              <span>Mentorship Capability</span>
            </label>
            <select
              value={selectedMentorFilter}
              onChange={(e) => setSelectedMentorFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Faculty</option>
              <option value="mentor">Active Mentors Only</option>
              <option value="non_mentor">Teaching Faculty Only</option>
            </select>
          </div>
        </div>

        {/* Search Bar & Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing <strong className="text-slate-900">{filteredTeachers.length}</strong> of {teachers.length} faculty
            </span>
            {(selectedDepartment !== 'all' || selectedDesignation !== 'all' || selectedMentorFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedDesignation('all');
                  setSelectedMentorFilter('all');
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
              placeholder="Search faculty name, email, or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-72"
            />
          </div>
        </div>
      </div>

      {/* Teachers Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => (
          <div
            key={teacher._id}
            className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{teacher.name}</h3>
                  <div className="text-xs text-slate-500">{teacher.email}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    teacher.role === 'hod'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {teacher.role === 'hod' ? 'HOD & Faculty' : 'Faculty'}
                </span>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <div>
                  Emp ID: <span className="font-mono font-bold text-slate-800">{teacher.profile?.employeeId || 'EMP-001'}</span>
                </div>
                <div>
                  Department: <strong className="text-slate-800">{teacher.department?.name || 'Computer Applications'}</strong>
                </div>
                <div>Designation: {teacher.profile?.designation || 'Professor'}</div>

                {/* Mentorship Status & Portfolio */}
                <div className="pt-1 border-t border-dashed border-slate-100 flex items-center justify-between">
                  <div>
                    Mentorship:{' '}
                    <span className={teacher.profile?.isMentor ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                      {teacher.profile?.isMentor ? 'Authorized Mentor' : 'Standard Faculty'}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    (teacher.menteeCount || 0) > 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {teacher.menteeCount || 0} Mentees
                  </span>
                </div>

                {teacher.mentoredBatches?.length > 0 && (
                  <div className="text-[10px] text-slate-500">
                    Mentoring: <strong className="text-slate-700">{teacher.mentoredBatches.join(', ')}</strong>
                  </div>
                )}
              </div>

              {/* Admin 1-Click Mentor Toggle Control */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleMentor(teacher._id, teacher.profile?.isMentor, teacher.name)}
                  className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    teacher.profile?.isMentor
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <UserCheck size={13} className={teacher.profile?.isMentor ? 'text-amber-600' : 'text-slate-400'} />
                  <span>{teacher.profile?.isMentor ? 'Designated Mentor (Click to Revoke)' : 'Grant Mentor Designation'}</span>
                </button>
              </div>

              {/* Assigned Subjects */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Teaching Workload ({teacher.profile?.assignedSubjects?.length || 0} classes):
                </span>
                <div className="flex flex-wrap gap-1">
                  {teacher.profile?.assignedSubjects?.map((item, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {item.subject?.code || 'SUBJ'} ({item.batch?.name || 'Batch'})
                    </span>
                  ))}
                  {(!teacher.profile?.assignedSubjects || teacher.profile.assignedSubjects.length === 0) && (
                    <span className="text-[10px] text-slate-400 italic">No subjects mapped yet</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleOpenEditTeacher(teacher)}
                className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 size={13} />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTeacher(teacher);
                  setShowAssignModal(true);
                }}
                className="py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <BookOpen size={13} />
                <span>Map Subject</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTeachers.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 space-y-2">
          <Users size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No faculty members found matching filters</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try resetting your Department or Designation filters.
          </p>
        </div>
      )}

      {/* Register Faculty Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Onboard New Faculty Member</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterTeacher} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-104"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="password"
                    placeholder="Defaults to Teacher@123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formData.isHod}
                    onChange={(e) => setFormData({ ...formData, isHod: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span>Designate as Department HOD</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formData.isMentor}
                    onChange={(e) => setFormData({ ...formData, isMentor: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span>Active Academic Mentor</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md"
                >
                  Register Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Subject & Batch Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Assign Teaching Subject to {selectedTeacher.name}
            </h3>

            <form onSubmit={handleAssignSubject} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject</label>
                <select
                  value={assignData.subjectId}
                  onChange={(e) => setAssignData({ ...assignData, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Batch Cohort</label>
                <select
                  value={assignData.batchId}
                  onChange={(e) => setAssignData({ ...assignData, batchId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                >
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Faculty Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Edit Faculty Profile</h3>
                <p className="text-xs text-slate-500">{editingTeacher.email}</p>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editTeacherForm.name}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={editTeacherForm.phone}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={editTeacherForm.department}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Designation</label>
                  <select
                    value={editTeacherForm.designation}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lecturer">Lecturer</option>
                    <option value="Guest Lecturer">Guest Lecturer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Highest Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g. Ph.D, M.Tech"
                    value={editTeacherForm.qualification}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Specialization</label>
                  <input
                    type="text"
                    placeholder="e.g. Distributed Systems"
                    value={editTeacherForm.specialization}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, specialization: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mentorEditCheck"
                    checked={editTeacherForm.isMentor}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, isMentor: e.target.checked })}
                    className="rounded text-amber-600 cursor-pointer"
                  />
                  <label htmlFor="mentorEditCheck" className="font-bold text-slate-800 cursor-pointer flex items-center gap-1">
                    <UserCheck size={14} className="text-amber-700" />
                    <span>Designated Faculty Mentor & Counselor</span>
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 pl-5">
                  Allows this faculty member (Professor, Assistant Professor, or HOD) to be assigned to batches and receive 1-on-1 student counseling requests.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
