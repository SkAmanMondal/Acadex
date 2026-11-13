import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  Building,
  Plus,
  BookOpen,
  Layers,
  CheckCircle,
  AlertCircle,
  Edit2,
  UserCheck,
  Users,
  ShieldCheck,
  X,
  Bell,
  ArrowRight,
  Search,
  Filter,
  GraduationCap,
} from 'lucide-react';

export default function AdminAcademicsPage() {
  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [subjectFilterDept, setSubjectFilterDept] = useState('all');
  const [subjectFilterCourse, setSubjectFilterCourse] = useState('all');
  const [subjectFilterSem, setSubjectFilterSem] = useState('all');

  // Batch filters
  const [batchFilterDept, setBatchFilterDept] = useState('all');
  const [batchFilterMentor, setBatchFilterMentor] = useState('all');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  // Edit states
  const [editingDept, setEditingDept] = useState(null);
  const [editingBatch, setEditingBatch] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);

  // Dedicated Batch Mentor Assignment Modal
  const [mentorModalBatch, setMentorModalBatch] = useState(null);
  const [mentorModalTeacherId, setMentorModalTeacherId] = useState('');
  const [mentorModalSyncStudents, setMentorModalSyncStudents] = useState(true);
  const [mentorModalNotify, setMentorModalNotify] = useState(true);
  const [mentorModalLoading, setMentorModalLoading] = useState(false);

  // Forms
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [courseForm, setCourseForm] = useState({ name: '', code: '', department: '', durationYears: 2, totalSemesters: 4 });
  const [batchForm, setBatchForm] = useState({
    name: '',
    course: '',
    department: '',
    startYear: 2024,
    endYear: 2026,
    currentSemester: 1,
    mentor: '',
    updateStudents: true,
  });
  const [roomForm, setRoomForm] = useState({ roomNumber: '', block: 'Main Block', capacity: 60, type: 'lecture_hall' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', department: '', course: '', semester: 1, credits: 4, type: 'theory' });

  const loadData = async () => {
    try {
      const [depRes, crsRes, batRes, clrRes, subRes, teaRes] = await Promise.allSettled([
        api.get('/academics/departments'),
        api.get('/academics/courses'),
        api.get('/academics/batches'),
        api.get('/academics/classrooms'),
        api.get('/academics/subjects'),
        api.get('/users/teachers'),
      ]);

      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
        if (depRes.value.data.data.length > 0) {
          const firstDept = depRes.value.data.data[0]._id;
          setCourseForm((prev) => ({ ...prev, department: firstDept }));
          setBatchForm((prev) => ({ ...prev, department: firstDept }));
          setSubjectForm((prev) => ({ ...prev, department: firstDept }));
        }
      }
      if (crsRes.status === 'fulfilled' && crsRes.value.data?.success) {
        setCourses(crsRes.value.data.data);
        if (crsRes.value.data.data.length > 0) {
          const firstCrs = crsRes.value.data.data[0]._id;
          setBatchForm((prev) => ({ ...prev, course: firstCrs }));
          setSubjectForm((prev) => ({ ...prev, course: firstCrs }));
        }
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) setBatches(batRes.value.data.data);
      if (clrRes.status === 'fulfilled' && clrRes.value.data?.success) setClassrooms(clrRes.value.data.data);
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) setSubjects(subRes.value.data.data);
      if (teaRes.status === 'fulfilled' && teaRes.value.data?.success) setTeachers(teaRes.value.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Zero-refresh automatic live synchronization on any curriculum/batch/subject change
  useRealtimeSync(['academics_updated', 'batch_updated', 'subject_updated', 'teachers_updated'], loadData);

  const openBatchMentorModal = (b) => {
    setMentorModalBatch(b);
    setMentorModalTeacherId(b.mentor?._id || b.mentor || '');
    setMentorModalSyncStudents(true);
    setMentorModalNotify(true);
  };

  const handleAssignBatchMentor = async (e) => {
    e.preventDefault();
    if (!mentorModalBatch) return;
    try {
      setMentorModalLoading(true);
      const res = await api.post(`/academics/batches/${mentorModalBatch._id}/assign-mentor`, {
        mentorId: mentorModalTeacherId || null,
        updateExistingStudents: mentorModalSyncStudents,
        notifyStudents: mentorModalNotify,
      });
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: res.data.message || 'Mentor assigned to batch successfully' });
        setMentorModalBatch(null);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to assign mentor' });
    } finally {
      setMentorModalLoading(false);
    }
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/academics/departments/${editingDept._id}`, deptForm);
        setStatusMsg({ type: 'success', text: 'Department updated successfully' });
        setEditingDept(null);
      } else {
        await api.post('/academics/departments', deptForm);
        setStatusMsg({ type: 'success', text: 'Department registered' });
      }
      setDeptForm({ name: '', code: '', description: '' });
      loadData();
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.response?.data?.message || 'Failed' });
    }
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    try {
      if (editingBatch) {
        await api.put(`/academics/batches/${editingBatch._id}`, batchForm);
        setStatusMsg({ type: 'success', text: 'Batch updated successfully' });
        setEditingBatch(null);
      } else {
        await api.post('/academics/batches', batchForm);
        setStatusMsg({ type: 'success', text: 'Batch registered' });
      }
      loadData();
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.response?.data?.message || 'Failed' });
    }
  };

  const handleSaveClassroom = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await api.put(`/academics/classrooms/${editingRoom._id}`, roomForm);
        setStatusMsg({ type: 'success', text: 'Classroom updated successfully' });
        setEditingRoom(null);
      } else {
        await api.post('/academics/classrooms', roomForm);
        setStatusMsg({ type: 'success', text: 'Classroom registered' });
      }
      setRoomForm({ roomNumber: '', block: 'Main Block', capacity: 60, type: 'lecture_hall' });
      loadData();
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.response?.data?.message || 'Failed' });
    }
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        await api.put(`/academics/subjects/${editingSubject._id}`, subjectForm);
        setStatusMsg({ type: 'success', text: 'Subject updated successfully' });
        setEditingSubject(null);
      } else {
        await api.post('/academics/subjects', subjectForm);
        setStatusMsg({ type: 'success', text: 'Subject registered' });
      }
      setSubjectForm({ ...subjectForm, name: '', code: '' });
      loadData();
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.response?.data?.message || 'Failed' });
    }
  };

  // Strictly authorized faculty members with mentor privileges enabled
  const authorizedMentors = useMemo(() => {
    return teachers.filter((t) => Boolean(t.profile?.isMentor));
  }, [teachers]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Academic Hierarchy & Structure Management</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure departments, degree courses, academic batches, physical classrooms, and curriculum subjects.
        </p>
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

      {/* Academics Hierarchy KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Departments</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{departments.length} Depts</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Active Batches</span>
          <p className="text-2xl font-extrabold text-brand-700 mt-1">{batches.length} Cohorts</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Halls & Labs</span>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{classrooms.length} Venues</p>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Curriculum Subjects</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{subjects.length} Courses</p>
        </div>
      </div>

      {/* Tabs with Guaranteed Navigation Icons */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold scrollbar-none">
        {[
          { id: 'departments', label: 'Departments', icon: Building },
          { id: 'batches', label: 'Student Batches & Mentors', icon: Layers },
          { id: 'classrooms', label: 'Lecture Halls & Labs', icon: BookOpen },
          { id: 'subjects', label: 'Curriculum Subjects', icon: CheckCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span
                data-nav-icon="true"
                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 min-w-[20px] min-h-[20px] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon size={14} strokeWidth={2.2} className="shrink-0 text-current" />
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Departments */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">
                {editingDept ? `Edit Department (${editingDept.code})` : 'Add Department'}
              </h2>
              {editingDept && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setDeptForm({ name: '', code: '', description: '' });
                  }}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Applications"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSA"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 cursor-pointer"
              >
                {editingDept ? 'Update Department' : 'Register Department'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Registered Departments</h2>
            <div className="divide-y divide-slate-100">
              {departments.map((d) => (
                <div key={d._id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{d.name}</div>
                    <div className="text-slate-400">HOD: {d.hod?.name || 'Unassigned'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {d.code}
                    </span>
                    <button
                      onClick={() => {
                        setEditingDept(d);
                        setDeptForm({ name: d.name, code: d.code, description: d.description || '' });
                      }}
                      title="Edit Department"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Classrooms */}
      {activeTab === 'classrooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">
                {editingRoom ? `Edit Classroom (${editingRoom.roomNumber})` : 'Add Classroom Record'}
              </h2>
              {editingRoom && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoom(null);
                    setRoomForm({ roomNumber: '', block: 'Main Block', capacity: 60, type: 'lecture_hall' });
                  }}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveClassroom} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Room Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LH-301 or LAB-2"
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Room Type</label>
                <select
                  value={roomForm.type}
                  onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="lecture_hall">Lecture Hall</option>
                  <option value="computer_lab">Computer Lab</option>
                  <option value="seminar_hall">Seminar Hall</option>
                  <option value="tutorial_room">Tutorial Room</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 cursor-pointer"
              >
                {editingRoom ? 'Update Classroom' : 'Save Classroom'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Active Classrooms</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {classrooms.map((c) => (
                <div key={c._id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800">Room {c.roomNumber}</div>
                    <button
                      onClick={() => {
                        setEditingRoom(c);
                        setRoomForm({ roomNumber: c.roomNumber, block: c.block || 'Main Block', capacity: c.capacity, type: c.type });
                      }}
                      title="Edit Classroom"
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 cursor-pointer"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 capitalize">{c.type?.replace('_', ' ')}</div>
                  <div className="text-[10px] text-slate-400">Capacity: {c.capacity} Students</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Batches */}
      {activeTab === 'batches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">
                {editingBatch ? `Edit Batch (${editingBatch.name})` : 'Register Student Batch'}
              </h2>
              {editingBatch && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBatch(null);
                    setBatchForm({ name: '', course: '', department: '', startYear: 2024, endYear: 2026, currentSemester: 1, mentor: '', updateStudents: true });
                  }}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveBatch} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Batch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MCA Batch 2024-2026"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={batchForm.department}
                  onChange={(e) => setBatchForm({ ...batchForm, department: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Course Program</label>
                <select
                  value={batchForm.course}
                  onChange={(e) => setBatchForm({ ...batchForm, course: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {/* Faculty Mentor Allocation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 flex items-center gap-1">
                    <UserCheck size={13} className="text-amber-600" />
                    <span>Assigned Faculty Mentor</span>
                  </label>
                  <span className="text-[10px] text-amber-600 font-semibold">{authorizedMentors.length} Authorized</span>
                </div>
                <select
                  value={batchForm.mentor}
                  onChange={(e) => setBatchForm({ ...batchForm, mentor: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="">-- No Mentor Assigned (Unallocated) --</option>
                  {authorizedMentors.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.profile?.designation || (t.role === 'hod' ? 'HOD' : 'Faculty')} • {t.department?.code || 'CSA'})
                    </option>
                  ))}
                </select>
              </div>

              {editingBatch && (
                <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-blue-900 font-medium">
                    <input
                      type="checkbox"
                      checked={batchForm.updateStudents}
                      onChange={(e) => setBatchForm({ ...batchForm, updateStudents: e.target.checked })}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Sync & update mentor for all students currently in this batch</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Year</label>
                  <input
                    type="number"
                    value={batchForm.startYear}
                    onChange={(e) => setBatchForm({ ...batchForm, startYear: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Year</label>
                  <input
                    type="number"
                    value={batchForm.endYear}
                    onChange={(e) => setBatchForm({ ...batchForm, endYear: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 cursor-pointer"
              >
                {editingBatch ? 'Update Batch' : 'Create Batch'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Student Cohort Batches & Mentorship Assignments</h2>
                <p className="text-[11px] text-slate-500">
                  Inspect batches by department or mentor, and reassign faculty mentors at any time.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                {batches.length} Total Batches
              </span>
            </div>

            {/* Batch Filter Toolbar: Department, Mentor, and Search */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Department Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Building size={12} className="text-brand-600" />
                    <span>Filter Department</span>
                  </label>
                  <select
                    value={batchFilterDept}
                    onChange={(e) => setBatchFilterDept(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-800"
                  >
                    <option value="all">All Departments ({departments.length})</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mentor Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <UserCheck size={12} className="text-amber-600" />
                    <span>Filter Assigned Mentor</span>
                  </label>
                  <select
                    value={batchFilterMentor}
                    onChange={(e) => setBatchFilterMentor(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-800"
                  >
                    <option value="all">All Faculty Mentors</option>
                    <option value="unassigned">⚠️ Unassigned (No Mentor)</option>
                    <optgroup label="Authorized Faculty Mentors">
                      {authorizedMentors.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.department?.code || 'Faculty'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Batch Search */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Search size={12} className="text-slate-400" />
                    <span>Search Batches</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search batch name, dept..."
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Filter status & Reset button */}
              {(batchFilterDept !== 'all' || batchFilterMentor !== 'all' || batchSearchQuery) && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                  <span className="text-[11px] text-slate-500">
                    Filtered view active
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchFilterDept('all');
                      setBatchFilterMentor('all');
                      setBatchSearchQuery('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset Batch Filters
                  </button>
                </div>
              )}
            </div>

            {/* Batches Cards List */}
            <div className="space-y-3">
              {(() => {
                const filteredBatches = batches.filter((b) => {
                  if (batchFilterDept !== 'all') {
                    const dId = b.department?._id || b.department;
                    if (dId?.toString() !== batchFilterDept) return false;
                  }
                  if (batchFilterMentor !== 'all') {
                    const mId = b.mentor?._id || b.mentor;
                    if (batchFilterMentor === 'unassigned') {
                      if (mId) return false;
                    } else {
                      if (mId?.toString() !== batchFilterMentor) return false;
                    }
                  }
                  if (batchSearchQuery.trim()) {
                    const q = batchSearchQuery.toLowerCase();
                    const matchName = b.name?.toLowerCase().includes(q);
                    const matchDept = b.department?.name?.toLowerCase().includes(q) || b.department?.code?.toLowerCase().includes(q);
                    const matchMentor = b.mentor?.name?.toLowerCase().includes(q);
                    if (!matchName && !matchDept && !matchMentor) return false;
                  }
                  return true;
                });

                if (filteredBatches.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200/60">
                      No batches match the selected department, mentor, or search query.
                    </div>
                  );
                }

                return filteredBatches.map((b) => {
                  const mentorUser = b.mentor;

                  return (
                    <div
                      key={b._id}
                      className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{b.name}</span>
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                            {b.department?.code || 'CSA'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Sem {b.currentSemester || 1} • {b.startYear}-{b.endYear}
                          </span>
                        </div>

                        {/* Mentor Status Badge / Info */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faculty Mentor:</span>
                          {mentorUser ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/80 text-xs">
                              <UserCheck size={13} className="text-amber-700 shrink-0" />
                              <strong className="font-bold">{mentorUser.name}</strong>
                              <span className="text-[10px] text-amber-700">({mentorUser.email})</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <AlertCircle size={11} /> Unassigned (No Mentor)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions: Change Mentor & Edit Details */}
                      <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                        <button
                          onClick={() => openBatchMentorModal(b)}
                          className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <UserCheck size={13} />
                          <span>{mentorUser ? 'Change Mentor' : 'Assign Mentor'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingBatch(b);
                            setBatchForm({
                              name: b.name,
                              course: b.course?._id || b.course || '',
                              department: b.department?._id || b.department || '',
                              startYear: b.startYear,
                              endYear: b.endYear,
                              currentSemester: b.currentSemester || 1,
                              mentor: b.mentor?._id || b.mentor || '',
                              updateStudents: true,
                            });
                          }}
                          title="Edit Batch Details"
                          className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Subjects with Semester-Wise Management */}
      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Subject Form */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {editingSubject ? `Edit Subject (${editingSubject.code})` : 'Add Semester Academic Subject'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Assign to degree program and designated academic semester.
                </p>
              </div>
              {editingSubject && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSubject(null);
                    setSubjectForm({
                      name: '',
                      code: '',
                      department: departments[0]?._id || '',
                      course: courses[0]?._id || '',
                      semester: 1,
                      credits: 4,
                      type: 'theory',
                    });
                  }}
                  className="text-xs text-rose-600 hover:underline cursor-pointer font-bold"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Degree Course *</label>
                <select
                  value={subjectForm.course}
                  onChange={(e) => {
                    const selCourse = courses.find((c) => c._id === e.target.value);
                    setSubjectForm({
                      ...subjectForm,
                      course: e.target.value,
                      department: selCourse?.department?._id || selCourse?.department || subjectForm.department,
                    });
                  }}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Academic Department *</label>
                <select
                  value={subjectForm.department}
                  onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Academic Semester *</label>
                  <select
                    value={subjectForm.semester}
                    onChange={(e) => setSubjectForm({ ...subjectForm, semester: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-brand-700"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject Type *</label>
                  <select
                    value={subjectForm.type}
                    onChange={(e) => setSubjectForm({ ...subjectForm, type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                  >
                    <option value="theory">Theory Lecture</option>
                    <option value="practical">Practical / Lab</option>
                    <option value="elective">Department Elective</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design & Analysis of Algorithms"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-301"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credits (1-6) *</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    required
                    value={subjectForm.credits}
                    onChange={(e) => setSubjectForm({ ...subjectForm, credits: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl cursor-pointer shadow-md transition"
              >
                {editingSubject ? 'Update Subject Record' : '+ Add Subject to Semester'}
              </button>
            </form>
          </div>

          {/* Curriculum Subjects Explorer with Semester Filters */}
          <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Curriculum Subjects Ledger</h2>
                <p className="text-[11px] text-slate-500">
                  Organized semester-by-semester across degree programs.
                </p>
              </div>

              {/* Course filter */}
              <div className="flex items-center gap-2">
                <select
                  value={subjectFilterCourse}
                  onChange={(e) => setSubjectFilterCourse(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none"
                >
                  <option value="all">All Degree Courses</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Semester Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSubjectFilterSem('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  subjectFilterSem === 'all'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Semesters
              </button>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSubjectFilterSem(sem.toString())}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    subjectFilterSem === sem.toString()
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sem {sem}
                </button>
              ))}
            </div>

            {/* Grouped Subjects by Semester */}
            <div className="space-y-4">
              {(() => {
                const filtered = subjects.filter((s) => {
                  if (subjectFilterCourse !== 'all') {
                    const cId = s.course?._id || s.course;
                    if (cId?.toString() !== subjectFilterCourse) return false;
                  }
                  if (subjectFilterSem !== 'all') {
                    if (s.semester?.toString() !== subjectFilterSem) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      No subjects recorded for this course/semester selection.
                    </div>
                  );
                }

                // Group by semester
                const semGroups = {};
                filtered.forEach((s) => {
                  const sem = s.semester || 1;
                  if (!semGroups[sem]) semGroups[sem] = [];
                  semGroups[sem].push(s);
                });

                return Object.keys(semGroups)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((semKey) => {
                    const semSubs = semGroups[semKey];

                    return (
                      <div key={semKey} className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <span className="font-extrabold text-xs text-brand-800 uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen size={14} className="text-brand-600" />
                            Semester {semKey}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                            {semSubs.length} Subjects (4-7 standard)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {semSubs.map((s) => (
                            <div
                              key={s._id}
                              className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5 hover:border-brand-300 transition"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                                  {s.code}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                      s.type === 'practical'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : s.type === 'elective'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {s.type}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold">{s.credits} Credits</span>
                                  <button
                                    onClick={() => {
                                      setEditingSubject(s);
                                      setSubjectForm({
                                        name: s.name,
                                        code: s.code,
                                        department: s.department?._id || s.department || '',
                                        course: s.course?._id || s.course || '',
                                        semester: s.semester || 1,
                                        credits: s.credits || 4,
                                        type: s.type || 'theory',
                                      });
                                    }}
                                    title="Edit Subject"
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 cursor-pointer ml-1"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <h4 className="font-bold text-xs text-slate-900 leading-tight">{s.name}</h4>
                              <p className="text-[10px] text-slate-400 truncate">
                                {s.course?.name || s.department?.name || 'Academic Course'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Batch Mentor Assignment Modal */}
      {mentorModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Assign / Change Batch Mentor
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Batch: <strong className="text-slate-800">{mentorModalBatch.name}</strong> ({mentorModalBatch.department?.code || 'CSA'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMentorModalBatch(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">
                Authorized Faculty Mentorship
              </span>
              <p>
                Only faculty members with verified mentor privileges (<strong>isMentor</strong> active) can be appointed as batch mentors.
              </p>
            </div>

            <form onSubmit={handleAssignBatchMentor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Faculty Mentor
                </label>
                <select
                  value={mentorModalTeacherId}
                  onChange={(e) => setMentorModalTeacherId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Choose Authorized Mentor ({authorizedMentors.length} available) --</option>
                  {authorizedMentors.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} — {t.profile?.designation || (t.role === 'hod' ? 'HOD' : 'Faculty')} ({t.department?.code || 'CSA'}) {t.menteeCount ? `• ${t.menteeCount} Mentees` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Manage or grant mentor status anytime in the Faculty Management portal.
                </p>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/70 rounded-2xl">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={mentorModalSyncStudents}
                    onChange={(e) => setMentorModalSyncStudents(e.target.checked)}
                    className="rounded text-amber-600 cursor-pointer"
                  />
                  <span>Sync all currently enrolled students in {mentorModalBatch.name} to this mentor</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={mentorModalNotify}
                    onChange={(e) => setMentorModalNotify(e.target.checked)}
                    className="rounded text-amber-600 cursor-pointer"
                  />
                  <span>Dispatch immediate system notification to batch students & the faculty mentor</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                {mentorModalBatch.mentor && (
                  <button
                    type="button"
                    disabled={mentorModalLoading}
                    onClick={async () => {
                      if (window.confirm(`Unassign mentor from ${mentorModalBatch.name}?`)) {
                        try {
                          setMentorModalLoading(true);
                          await api.post(`/academics/batches/${mentorModalBatch._id}/assign-mentor`, {
                            mentorId: null,
                            updateExistingStudents: mentorModalSyncStudents,
                          });
                          setStatusMsg({ type: 'success', text: `Unassigned mentor from ${mentorModalBatch.name}` });
                          setMentorModalBatch(null);
                          loadData();
                        } catch (err) {
                          setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed' });
                        } finally {
                          setMentorModalLoading(false);
                        }
                      }
                    }}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition cursor-pointer"
                  >
                    Unassign Mentor
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setMentorModalBatch(null)}
                    className="py-2 px-3 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mentorModalLoading || !mentorModalTeacherId}
                    className="py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                  >
                    {mentorModalLoading ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <UserCheck size={14} />
                        <span>Save & Apply Mentor</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
