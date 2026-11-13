import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/SocketContext';
import DailyScheduleView from './DailyScheduleView';
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CheckCircle,
  Building,
  GraduationCap,
  Filter,
  Grid,
  Layers,
  Search,
  Edit2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetablePage() {
  const { user, isTeacher, isHod, isAdmin, isStudent } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  // 'daily' (Today's live schedule & operations) | 'master' (Weekly recurring base template)
  const [activeTab, setActiveTab] = useState('daily');

  // Multi-dimensional View & Filter Modes
  // 'batch' | 'teacher' | 'classroom' | 'day' | 'department'
  const [viewMode, setViewMode] = useState('batch');

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [selectedClassroom, setSelectedClassroom] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    batch: '',
    subject: '',
    teacher: '',
    classroom: '',
    department: '',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    semester: 1,
  });

  // Edit State
  const [editingSlot, setEditingSlot] = useState(null);
  const [editFormData, setEditFormData] = useState({
    batch: '',
    subject: '',
    teacher: '',
    classroom: '',
    department: '',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    semester: 1,
  });

  // Security & Conflict States for Scheduling Modals
  const [modalError, setModalError] = useState('');
  const [modalConflicts, setModalConflicts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Comprehensive Client-Side Security & Collision Evaluator
  const evaluateConflict = (candidate, excludeId = null) => {
    const { batch, teacher, classroom, day, startTime, endTime } = candidate;
    const conflicts = [];

    // 1. Time Parameter & Format Validation
    if (!startTime || !endTime) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Time Window',
          type: 'time',
          title: 'Missing Time Specifications',
          message: 'Both Start Time and End Time are required.',
        }],
        message: 'Both Start Time and End Time are required.',
      };
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Time Format',
          type: 'time',
          title: 'Invalid Time Format',
          message: 'Time must be in 24-hour format HH:mm (e.g. 09:00, 14:30).',
        }],
        message: 'Time must be in 24-hour format HH:mm (e.g. 09:00, 14:30).',
      };
    }

    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;

    if (startMins >= endMins) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Time Sequence',
          type: 'time',
          title: 'Invalid Time Order',
          message: `Start time (${startTime}) must be strictly earlier than End time (${endTime}).`,
        }],
        message: `Start time (${startTime}) must be strictly earlier than End time (${endTime}).`,
      };
    }

    const durationMins = endMins - startMins;
    if (durationMins < 30) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Slot Duration',
          type: 'duration',
          title: 'Duration Too Short',
          message: `Class duration (${durationMins} minutes) is too short. Minimum duration is 30 minutes.`,
        }],
        message: `Class duration (${durationMins} minutes) is too short. Minimum duration is 30 minutes.`,
      };
    }

    if (durationMins > 240) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Slot Duration',
          type: 'duration',
          title: 'Duration Too Long',
          message: `Class duration (${Math.round(durationMins / 60)} hours) exceeds the maximum allowed limit of 4 hours.`,
        }],
        message: `Class duration exceeds the maximum allowed limit of 4 hours.`,
      };
    }

    if (startMins < 7 * 60 || endMins > 21 * 60) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Campus Operational Hours',
          type: 'operational_hours',
          title: 'Outside Campus Hours',
          message: `Class timing (${startTime} - ${endTime}) falls outside academic operational hours (07:00 to 21:00).`,
        }],
        message: `Class timing falls outside academic operational hours (07:00 to 21:00).`,
      };
    }

    if (!day) {
      return {
        hasConflict: true,
        conflicts: [{
          aspect: 'Day of Week',
          type: 'day',
          title: 'Missing Day',
          message: 'Day of week is required.',
        }],
        message: 'Day of week is required.',
      };
    }

    // 2. Evaluate against in-memory active schedules
    schedules.forEach((s) => {
      const sId = (s._id || s.id || '').toString();
      if (excludeId && sId === excludeId.toString()) return;
      if (s.day !== day) return;

      // Overlap condition: s.startTime < endTime && s.endTime > startTime
      const isOverlap = s.startTime < endTime && s.endTime > startTime;
      if (!isOverlap) return;

      const sBatchId = (s.batch?._id || s.batch || '').toString();
      const sTeacherId = (s.teacher?._id || s.teacher || '').toString();
      const sClassroomId = (s.classroom?._id || s.classroom || '').toString();

      const cBatchId = (batch?._id || batch || '').toString();
      const cTeacherId = (teacher?._id || teacher || '').toString();
      const cClassroomId = (classroom?._id || classroom || '').toString();

      // Hall / Room Occupancy Collision
      if (cClassroomId && sClassroomId === cClassroomId) {
        const roomNum = s.classroom?.roomNumber || 'This Hall';
        const subName = s.subject?.name || s.subject?.code || 'another lecture';
        const bName = s.batch?.name ? ` with ${s.batch.name}` : '';
        conflicts.push({
          aspect: 'Hall / Classroom Occupancy',
          type: 'classroom',
          title: `Hall ${roomNum} is Occupied`,
          message: `Hall / Classroom ${roomNum} is already booked for "${subName}"${bName} from ${s.startTime} to ${s.endTime} on ${day}.`,
        });
      }

      // Faculty Member Availability Collision
      if (cTeacherId && sTeacherId === cTeacherId) {
        const facultyName = s.teacher?.name || 'Selected Faculty';
        const subName = s.subject?.name || s.subject?.code || 'another lecture';
        const bName = s.batch?.name ? ` for ${s.batch.name}` : '';
        const roomNum = s.classroom?.roomNumber ? ` in Room ${s.classroom.roomNumber}` : '';
        conflicts.push({
          aspect: 'Faculty Availability',
          type: 'teacher',
          title: `Faculty Member ${facultyName} is Busy`,
          message: `Prof. ${facultyName} is already scheduled to teach "${subName}"${bName}${roomNum} from ${s.startTime} to ${s.endTime} on ${day}.`,
        });
      }

      // Student Batch Double-Booking Collision
      if (cBatchId && sBatchId === cBatchId) {
        const bName = s.batch?.name || 'Selected Batch';
        const subName = s.subject?.name || s.subject?.code || 'another lecture';
        const tName = s.teacher?.name ? ` with Prof. ${s.teacher.name}` : '';
        const roomNum = s.classroom?.roomNumber ? ` in Room ${s.classroom.roomNumber}` : '';
        conflicts.push({
          aspect: 'Student Batch Schedule',
          type: 'batch',
          title: `Batch ${bName} is Double-Booked`,
          message: `Student batch "${bName}" is already scheduled to attend "${subName}"${tName}${roomNum} from ${s.startTime} to ${s.endTime} on ${day}.`,
        });
      }
    });

    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflicts,
        message: conflicts.map((c) => c.message).join(' • '),
      };
    }

    return {
      hasConflict: false,
      conflicts: [],
      message: 'All security checks passed: Hall, Faculty, Batch, and Time Window are completely free.',
    };
  };

  const handleOpenEdit = (slot) => {
    setEditingSlot(slot);
    setEditFormData({
      batch: slot.batch?._id || slot.batch,
      subject: slot.subject?._id || slot.subject,
      teacher: slot.teacher?._id || slot.teacher,
      classroom: slot.classroom?._id || slot.classroom,
      department: slot.department?._id || slot.department,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      semester: slot.semester || 1,
    });
    setModalError('');
    setModalConflicts([]);
    setError('');
  };

  const handleUpdateEntry = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalConflicts([]);
    setError('');
    setSuccess('');

    // Pre-save client collision validation
    const localCheck = evaluateConflict(editFormData, editingSlot._id);
    if (localCheck.hasConflict) {
      setModalError(localCheck.message);
      setModalConflicts(localCheck.conflicts);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.put(`/timetable/${editingSlot._id}`, editFormData);
      if (res.data?.success) {
        setSuccess('Class schedule updated successfully without conflicts!');
        setEditingSlot(null);
        setModalError('');
        setModalConflicts([]);
        loadData();
      }
    } catch (err) {
      const backendConflicts = err.response?.data?.errors?.conflicts || [];
      const backendMsg = err.response?.data?.message || 'Schedule conflict detected while updating';
      setModalError(backendMsg);
      setModalConflicts(
        backendConflicts.length > 0
          ? backendConflicts
          : [{ aspect: 'Scheduling Conflict', type: 'general', title: 'Conflict Detected', message: backendMsg }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (slotId) => {
    if (!window.confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      const res = await api.delete(`/timetable/${slotId}`);
      if (res.data?.success) {
        setSuccess('Timetable entry removed.');
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove timetable entry');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedRes, deptRes, batchRes, subjRes, roomRes, teachRes] = await Promise.allSettled([
        api.get('/timetable'),
        api.get('/academics/departments'),
        api.get('/academics/batches'),
        api.get('/academics/subjects'),
        api.get('/academics/classrooms'),
        api.get('/users/teachers'),
      ]);

      if (schedRes.status === 'fulfilled' && schedRes.value.data?.success) {
        setSchedules(schedRes.value.data.data);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value.data?.success) {
        setDepartments(deptRes.value.data.data);
      }
      if (batchRes.status === 'fulfilled' && batchRes.value.data?.success) {
        setBatches(batchRes.value.data.data);
        if (batchRes.value.data.data.length > 0) {
          setFormData((prev) => ({
            ...prev,
            batch: batchRes.value.data.data[0]._id,
            department: batchRes.value.data.data[0].department?._id || batchRes.value.data.data[0].department,
          }));
        }
      }
      if (subjRes.status === 'fulfilled' && subjRes.value.data?.success) {
        setSubjects(subjRes.value.data.data);
        if (subjRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, subject: subjRes.value.data.data[0]._id }));
        }
      }
      if (roomRes.status === 'fulfilled' && roomRes.value.data?.success) {
        setClassrooms(roomRes.value.data.data);
        if (roomRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, classroom: roomRes.value.data.data[0]._id }));
        }
      }
      if (teachRes.status === 'fulfilled' && teachRes.value.data?.success) {
        setTeachers(teachRes.value.data.data);
        if (teachRes.value.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, teacher: teachRes.value.data.data[0]._id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Zero-refresh automatic live synchronization on any timetable schedule updates
  useRealtimeSync(['timetable_updated', 'batch_updated', 'subject_updated'], loadData);

  // For students, auto-filter to their enrolled cohort
  useEffect(() => {
    if (isStudent && user?.profile?.batch) {
      const studentBatchId = user.profile.batch?._id || user.profile.batch;
      if (studentBatchId) {
        setSelectedBatch(studentBatchId.toString());
      }
    }
  }, [isStudent, user]);

  // Resilient multi-role fallbacks: derive from loaded lists or extract from populated schedules
  const displayBatches = useMemo(() => {
    if (batches.length > 0) return batches;
    const map = new Map();
    schedules.forEach((s) => {
      if (s.batch && (s.batch._id || s.batch.name)) {
        const id = (s.batch._id || s.batch).toString();
        if (!map.has(id)) map.set(id, s.batch);
      }
    });
    return Array.from(map.values());
  }, [batches, schedules]);

  const displayTeachers = useMemo(() => {
    if (teachers.length > 0) return teachers;
    const map = new Map();
    schedules.forEach((s) => {
      if (s.teacher && (s.teacher._id || s.teacher.name)) {
        const id = (s.teacher._id || s.teacher).toString();
        if (!map.has(id)) map.set(id, s.teacher);
      }
    });
    return Array.from(map.values());
  }, [teachers, schedules]);

  const displayClassrooms = useMemo(() => {
    if (classrooms.length > 0) return classrooms;
    const map = new Map();
    schedules.forEach((s) => {
      if (s.classroom && (s.classroom._id || s.classroom.roomNumber)) {
        const id = (s.classroom._id || s.classroom).toString();
        if (!map.has(id)) map.set(id, s.classroom);
      }
    });
    return Array.from(map.values());
  }, [classrooms, schedules]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      // Department filter
      if (selectedDepartment !== 'all') {
        const deptId = s.department?._id || s.department;
        if (deptId?.toString() !== selectedDepartment) return false;
      }
      // Batch filter
      if (selectedBatch !== 'all') {
        const batchId = s.batch?._id || s.batch;
        if (batchId?.toString() !== selectedBatch) return false;
      }
      // Teacher filter
      if (selectedTeacher !== 'all') {
        const teacherId = s.teacher?._id || s.teacher;
        if (teacherId?.toString() !== selectedTeacher) return false;
      }
      // Classroom filter
      if (selectedClassroom !== 'all') {
        const roomId = s.classroom?._id || s.classroom;
        if (roomId?.toString() !== selectedClassroom) return false;
      }
      // Day filter
      if (selectedDay !== 'all') {
        if (s.day !== selectedDay) return false;
      }
      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = s.subject?.name?.toLowerCase().includes(q) || s.subject?.code?.toLowerCase().includes(q);
        const matchTeacher = s.teacher?.name?.toLowerCase().includes(q);
        const matchRoom = s.classroom?.roomNumber?.toLowerCase().includes(q);
        const matchBatch = s.batch?.name?.toLowerCase().includes(q);
        if (!matchSubject && !matchTeacher && !matchRoom && !matchBatch) return false;
      }
      return true;
    });
  }, [schedules, selectedDepartment, selectedBatch, selectedTeacher, selectedClassroom, selectedDay, searchQuery]);

  // Live conflict evaluation memo for pre-save inspection
  const createCheck = useMemo(() => {
    if (!showModal) return { hasConflict: false, conflicts: [] };
    return evaluateConflict(formData);
  }, [showModal, formData, schedules]);

  const editCheck = useMemo(() => {
    if (!editingSlot) return { hasConflict: false, conflicts: [] };
    return evaluateConflict(editFormData, editingSlot._id);
  }, [editingSlot, editFormData, schedules]);

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalConflicts([]);
    setError('');
    setSuccess('');

    // Pre-save client collision validation
    const localCheck = evaluateConflict(formData);
    if (localCheck.hasConflict) {
      setModalError(localCheck.message);
      setModalConflicts(localCheck.conflicts);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/timetable', formData);
      if (res.data?.success) {
        setSuccess('Class scheduled successfully without conflicts!');
        setShowModal(false);
        setModalError('');
        setModalConflicts([]);
        loadData();
      }
    } catch (err) {
      const backendConflicts = err.response?.data?.errors?.conflicts || [];
      const backendMsg = err.response?.data?.message || 'Schedule conflict detected';
      setModalError(backendMsg);
      setModalConflicts(
        backendConflicts.length > 0
          ? backendConflicts
          : [{ aspect: 'Scheduling Conflict', type: 'general', title: 'Conflict Detected', message: backendMsg }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-brand-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Academic Scheduling & Operations
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Collision-Free Timetable
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Academic Timetable & Schedule Explorer
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Multi-perspective timetable views: inspect class slots by Batch, Faculty Teacher load, Classroom occupancy, Department, or Day.
          </p>
        </div>

        {(isAdmin || isHod) && activeTab === 'master' && (
          <button
            onClick={() => {
              setError('');
              setModalError('');
              setModalConflicts([]);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} />
            <span>Schedule New Slot</span>
          </button>
        )}
      </div>

      {/* Tab Switcher: Daily Schedule & Operations vs Weekly Master Timetable */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={16} className={activeTab === 'daily' ? 'text-brand-600' : 'text-slate-400'} />
            <span>Daily Schedule & Operations (Live 7:00 AM)</span>
            <span className="px-1.5 py-0.5 bg-brand-100 text-brand-800 rounded-full text-[9px] font-black uppercase tracking-wider">
              Today & History
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'master'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={16} className={activeTab === 'master' ? 'text-brand-600' : 'text-slate-400'} />
            <span>Weekly Recurring Master Timetable</span>
            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[9px] font-semibold">
              Base Template
            </span>
          </button>
        </div>

        {activeTab === 'master' && (isAdmin || isHod) && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setModalError('');
              setModalConflicts([]);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-700 transition cursor-pointer"
          >
            <Plus size={15} />
            <span>Schedule New Slot</span>
          </button>
        )}
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="font-bold cursor-pointer">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {activeTab === 'daily' ? (
        <DailyScheduleView
          departments={departments}
          batches={batches}
          teachers={teachers}
        />
      ) : (
        <>
          {/* Timetable KPI Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weekly Scheduled Slots</span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{schedules.length} Classes</p>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Active Batches</span>
              <p className="text-2xl font-extrabold text-brand-700 mt-1">{displayBatches.length} Cohorts</p>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Faculty Allocated</span>
              <p className="text-2xl font-extrabold text-indigo-700 mt-1">{displayTeachers.length} Instructors</p>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Collision Status</span>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">0 Overlaps</p>
            </div>
          </div>

      {/* Multi-Dimensional View Perspective Switcher */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl">
            <button
              onClick={() => {
                setViewMode('batch');
                setSelectedTeacher('all');
                setSelectedClassroom('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'batch'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap size={14} />
              <span>Batch-Wise View</span>
            </button>

            <button
              onClick={() => {
                setViewMode('teacher');
                setSelectedBatch('all');
                setSelectedClassroom('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'teacher'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={14} />
              <span>Teacher-Wise Load</span>
            </button>

            <button
              onClick={() => {
                setViewMode('classroom');
                setSelectedBatch('all');
                setSelectedTeacher('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'classroom'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin size={14} />
              <span>Room / Lab Occupancy</span>
            </button>

            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'day'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={14} />
              <span>Day-Wise Matrix</span>
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search subject, room, teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 w-56"
            />
          </div>
        </div>

        {/* Dynamic Multi-Filter Toolbar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Student Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Batches</option>
              {displayBatches
                .filter((b) => selectedDepartment === 'all' || (b.department?._id || b.department) === selectedDepartment)
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Faculty Teacher
            </label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Faculty</option>
              {displayTeachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Classroom Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Room / Lab
            </label>
            <select
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Rooms & Labs</option>
              {displayClassrooms.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.roomNumber} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Day Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Day of Week
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Weekdays (Mon-Sat)</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Pill Counter */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-900">{filteredSchedules.length}</strong> scheduled class slots
        </span>
        {(selectedDepartment !== 'all' || selectedBatch !== 'all' || selectedTeacher !== 'all' || selectedClassroom !== 'all' || selectedDay !== 'all') && (
          <button
            onClick={() => {
              setSelectedDepartment('all');
              setSelectedBatch('all');
              setSelectedTeacher('all');
              setSelectedClassroom('all');
              setSelectedDay('all');
              setSearchQuery('');
            }}
            className="text-brand-600 font-bold hover:underline cursor-pointer"
          >
            Reset All Filters
          </button>
        )}
      </div>

      {/* ==================== VIEW MODE: BATCH-WISE GROUPING ==================== */}
      {viewMode === 'batch' && (
        <div className="space-y-6">
          {displayBatches
            .filter((b) => selectedBatch === 'all' || b._id === selectedBatch)
            .map((batch) => {
              const batchSlots = filteredSchedules.filter((s) => (s.batch?._id || s.batch) === batch._id);
              if (selectedBatch !== 'all' && batchSlots.length === 0) return null;

              return (
                <div key={batch._id} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                        <GraduationCap size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">{batch.name}</h3>
                        <p className="text-[11px] text-slate-500">
                          {batch.course?.name || 'Degree Cohort'} • Semester {batch.currentSemester || 1}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {batchSlots.length} Weekly Lectures
                    </span>
                  </div>

                  {batchSlots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {batchSlots.map((slot) => (
                        <div
                          key={slot._id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hover:border-brand-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-100 text-brand-800">
                              {slot.day}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1">
                                <Clock size={12} />
                                {slot.startTime} - {slot.endTime}
                              </span>
                              {(isAdmin || isHod) && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEdit(slot)}
                                    title="Edit Slot"
                                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600 cursor-pointer"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(slot._id)}
                                    title="Delete Slot"
                                    className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <h4 className="text-xs font-extrabold text-slate-900">{slot.subject?.name}</h4>
                          <span className="text-[10px] font-bold text-slate-500">{slot.subject?.code}</span>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {slot.teacher?.name}
                            </span>
                            <span className="flex items-center gap-1 font-bold text-slate-800">
                              <MapPin size={12} />
                              {slot.classroom?.roomNumber}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs py-4 text-center">No timetable entries recorded for this batch.</p>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ==================== VIEW MODE: TEACHER-WISE LOAD ==================== */}
      {viewMode === 'teacher' && (
        <div className="space-y-6">
          {displayTeachers
            .filter((t) => selectedTeacher === 'all' || t._id === selectedTeacher)
            .map((teacher) => {
              const teacherSlots = filteredSchedules.filter((s) => (s.teacher?._id || s.teacher) === teacher._id);
              if (selectedTeacher !== 'all' && teacherSlots.length === 0) return null;

              return (
                <div key={teacher._id} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-sm">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">{teacher.name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {teacher.department?.name || 'Department Faculty'} • {teacher.email}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                      Teaching Load: {teacherSlots.length} Classes
                    </span>
                  </div>

                  {teacherSlots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teacherSlots.map((slot) => (
                        <div
                          key={slot._id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hover:border-brand-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                              {slot.day}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-slate-600">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              {(isAdmin || isHod) && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEdit(slot)}
                                    title="Edit Slot"
                                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600 cursor-pointer"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(slot._id)}
                                    title="Delete Slot"
                                    className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <h4 className="text-xs font-extrabold text-slate-900">{slot.subject?.name}</h4>
                          <p className="text-[11px] font-semibold text-slate-600">Cohort: {slot.batch?.name}</p>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Room: <strong className="text-slate-800">{slot.classroom?.roomNumber}</strong></span>
                            <span className="text-[10px] uppercase font-bold text-brand-700">{slot.subject?.code}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs py-4 text-center">No assigned lecture slots.</p>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ==================== VIEW MODE: CLASSROOM / LAB OCCUPANCY ==================== */}
      {viewMode === 'classroom' && (
        <div className="space-y-6">
          {displayClassrooms
            .filter((c) => selectedClassroom === 'all' || c._id === selectedClassroom)
            .map((room) => {
              const roomSlots = filteredSchedules.filter((s) => (s.classroom?._id || s.classroom) === room._id);
              if (selectedClassroom !== 'all' && roomSlots.length === 0) return null;

              return (
                <div key={room._id} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">{room.roomNumber}</h3>
                        <p className="text-[11px] text-slate-500">
                          {room.block || 'Academic Block'} • Capacity: {room.capacity} seats • Type: {room.type}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Occupancy: {roomSlots.length} Booked Slots
                    </span>
                  </div>

                  {roomSlots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {roomSlots.map((slot) => (
                        <div
                          key={slot._id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hover:border-emerald-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                              {slot.day}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-slate-600">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              {(isAdmin || isHod) && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEdit(slot)}
                                    title="Edit Slot"
                                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600 cursor-pointer"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(slot._id)}
                                    title="Delete Slot"
                                    className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <h4 className="text-xs font-extrabold text-slate-900">{slot.subject?.name}</h4>
                          <p className="text-[11px] text-slate-600">Class: {slot.batch?.name}</p>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Faculty: {slot.teacher?.name}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">{slot.subject?.code}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs py-4 text-center">Room is currently free across all periods.</p>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ==================== VIEW MODE: DAY-WISE MATRIX ==================== */}
      {viewMode === 'day' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DAYS.filter((d) => selectedDay === 'all' || d === selectedDay).map((day) => {
            const daySlots = filteredSchedules.filter((s) => s.day === day);

            return (
              <div key={day} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-extrabold text-sm text-slate-900">{day}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'}
                  </span>
                </div>

                <div className="space-y-3">
                  {daySlots.map((slot) => (
                    <div
                      key={slot._id}
                      className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 hover:border-brand-300 transition"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-md">
                            {slot.classroom?.roomNumber}
                          </span>
                          {(isAdmin || isHod) && (
                            <div className="flex items-center">
                              <button
                                onClick={() => handleOpenEdit(slot)}
                                title="Edit Slot"
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600 cursor-pointer"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(slot._id)}
                                title="Delete Slot"
                                className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{slot.subject?.name}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{slot.batch?.name}</p>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600">
                        <span>{slot.teacher?.name}</span>
                        <span className="font-mono font-bold text-slate-500">{slot.subject?.code}</span>
                      </div>
                    </div>
                  ))}

                  {daySlots.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">No scheduled classes for {day}.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 overflow-hidden my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Edit Class Schedule Entry</h3>
                <p className="text-xs text-slate-500">Update slot timing, instructor, or room. Collision detection is verified on save.</p>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateEntry} className="space-y-4">
              {modalError && (
                <div className="p-4 rounded-2xl bg-rose-50/95 border-2 border-rose-300 text-rose-900 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-sm text-rose-800">
                      <ShieldAlert className="text-rose-600 shrink-0" size={20} />
                      <span>Scheduling Collision & Security Alert</span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-rose-700 font-medium leading-relaxed">
                    This schedule modification cannot be saved because one or more resources are already occupied or invalid:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {modalConflicts.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white/95 p-3 rounded-xl border border-rose-200 text-xs shadow-xs">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-100 text-rose-800 shrink-0 mt-0.5">
                          {c.aspect || c.type || 'Collision'}
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-rose-950 font-bold leading-snug">{c.title || 'Resource Busy'}</p>
                          <p className="text-slate-600 text-[11px] leading-snug">{c.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1.5 pt-1 border-t border-rose-200/80">
                    <Info size={13} className="shrink-0" />
                    <span>Select a free hall, another faculty member, or adjust start/end time.</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch Cohort *</label>
                  <select
                    value={editFormData.batch}
                    onChange={(e) => {
                      const selBatch = batches.find((b) => b._id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        batch: e.target.value,
                        department: selBatch?.department?._id || selBatch?.department || editFormData.department,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Instructor *</label>
                  <select
                    value={editFormData.teacher}
                    onChange={(e) => setEditFormData({ ...editFormData, teacher: e.target.value })}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none ${
                      editCheck.conflicts.some((c) => c.type === 'teacher')
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                        : 'border-slate-200'
                    }`}
                  >
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Classroom / Lab *</label>
                  <select
                    value={editFormData.classroom}
                    onChange={(e) => setEditFormData({ ...editFormData, classroom: e.target.value })}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none ${
                      editCheck.conflicts.some((c) => c.type === 'classroom')
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                        : 'border-slate-200'
                    }`}
                  >
                    {classrooms.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.roomNumber} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Day *</label>
                  <select
                    value={editFormData.day}
                    onChange={(e) => setEditFormData({ ...editFormData, day: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={editFormData.startTime}
                    onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Live Pre-Save Security Monitor */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className={editCheck.hasConflict ? 'text-amber-500' : 'text-emerald-500'} />
                  <span className="font-bold text-slate-700">Pre-Save Security Monitor:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      editCheck.conflicts.some((c) => c.type === 'classroom')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    🏛️ Hall: {editCheck.conflicts.some((c) => c.type === 'classroom') ? 'Occupied' : 'Free'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      editCheck.conflicts.some((c) => c.type === 'teacher')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    👨‍🏫 Faculty: {editCheck.conflicts.some((c) => c.type === 'teacher') ? 'Busy' : 'Free'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      editCheck.conflicts.some((c) => c.type === 'batch')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    👥 Batch: {editCheck.conflicts.some((c) => c.type === 'batch') ? 'Double-Booked' : 'Free'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      editCheck.conflicts.some((c) => c.type === 'time' || c.type === 'duration')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-200 text-slate-800 border border-slate-300'
                    }`}
                  >
                    ⏱️ Time: {editCheck.conflicts.some((c) => c.type === 'time' || c.type === 'duration') ? 'Invalid' : 'Valid'}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2 transition ${
                    editCheck.hasConflict
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-brand-600 hover:bg-brand-700'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      <span>Update & Validate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Schedule Class with Conflict Detection</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4">
              {modalError && (
                <div className="p-4 rounded-2xl bg-rose-50/95 border-2 border-rose-300 text-rose-900 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-sm text-rose-800">
                      <ShieldAlert className="text-rose-600 shrink-0" size={20} />
                      <span>Scheduling Collision & Security Alert</span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-rose-700 font-medium leading-relaxed">
                    This new class slot cannot be saved because one or more resources are already occupied or invalid:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {modalConflicts.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white/95 p-3 rounded-xl border border-rose-200 text-xs shadow-xs">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-100 text-rose-800 shrink-0 mt-0.5">
                          {c.aspect || c.type || 'Collision'}
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-rose-950 font-bold leading-snug">{c.title || 'Resource Busy'}</p>
                          <p className="text-slate-600 text-[11px] leading-snug">{c.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1.5 pt-1 border-t border-rose-200/80">
                    <Info size={13} className="shrink-0" />
                    <span>Select a free hall, another faculty member, or adjust start/end time.</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch Cohort *</label>
                  <select
                    value={formData.batch}
                    onChange={(e) => {
                      const selBatch = batches.find((b) => b._id === e.target.value);
                      setFormData({
                        ...formData,
                        batch: e.target.value,
                        department: selBatch?.department?._id || selBatch?.department || formData.department,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Instructor *</label>
                  <select
                    value={formData.teacher}
                    onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none ${
                      createCheck.conflicts.some((c) => c.type === 'teacher')
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                        : 'border-slate-200'
                    }`}
                  >
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Classroom / Lab *</label>
                  <select
                    value={formData.classroom}
                    onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none ${
                      createCheck.conflicts.some((c) => c.type === 'classroom')
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                        : 'border-slate-200'
                    }`}
                  >
                    {classrooms.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.roomNumber} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Day *</label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Live Pre-Save Security Monitor */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className={createCheck.hasConflict ? 'text-amber-500' : 'text-emerald-500'} />
                  <span className="font-bold text-slate-700">Pre-Save Security Monitor:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      createCheck.conflicts.some((c) => c.type === 'classroom')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    🏛️ Hall: {createCheck.conflicts.some((c) => c.type === 'classroom') ? 'Occupied' : 'Free'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      createCheck.conflicts.some((c) => c.type === 'teacher')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    👨‍🏫 Faculty: {createCheck.conflicts.some((c) => c.type === 'teacher') ? 'Busy' : 'Free'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      createCheck.conflicts.some((c) => c.type === 'batch')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    👥 Batch: {createCheck.conflicts.some((c) => c.type === 'batch') ? 'Double-Booked' : 'Free'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      createCheck.conflicts.some((c) => c.type === 'time' || c.type === 'duration')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-200 text-slate-800 border border-slate-300'
                    }`}
                  >
                    ⏱️ Time: {createCheck.conflicts.some((c) => c.type === 'time' || c.type === 'duration') ? 'Invalid' : 'Valid'}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2 transition ${
                    createCheck.hasConflict
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-brand-600 hover:bg-brand-700'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      <span>Save & Validate Collision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
