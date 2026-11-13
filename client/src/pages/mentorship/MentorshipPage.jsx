import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  MessageSquare,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Award,
  Calendar,
  Search,
  Filter,
  Check,
  X,
  Send,
  AlertTriangle,
  UserCheck,
  Sparkles,
  FileText,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';

export default function MentorshipPage() {
  const { user, isStudent, isMentor, isTeacher, isHod, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(isStudent ? 'my_requests' : 'mentees'); // 'mentees' | 'requests' | 'counseling' | 'my_requests'
  const [requests, setRequests] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [studentMentor, setStudentMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Student New Request Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    category: 'subject_difficulty',
    subject: '',
    description: '',
  });

  // Mentor Respond Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [mentorNotes, setMentorNotes] = useState('');
  const [ticketStatus, setTicketStatus] = useState('responded');

  // Mentor Log Advisory Session Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMenteeForLog, setSelectedMenteeForLog] = useState(null);
  const [logFormData, setLogFormData] = useState({
    studentId: '',
    category: 'personal_guidance',
    subject: 'Advisory & Progress Review',
    description: '',
    mentorNotes: '',
    sessionDate: new Date().toISOString().split('T')[0],
  });

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [menteeBatchFilter, setMenteeBatchFilter] = useState('all');

  // Extract unique batches among assigned mentees
  const menteeBatches = useMemo(() => {
    const map = new Map();
    mentees.forEach((m) => {
      const bId = m.batch?._id || m.batch;
      const bName = m.batch?.name;
      if (bId && bName) {
        map.set(bId.toString(), bName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [mentees]);

  const loadData = async () => {
    try {
      setLoading(true);
      const promises = [api.get('/mentorship/requests')];
      if (!isStudent) {
        promises.push(api.get('/mentorship/mentees'));
      } else {
        promises.push(api.get('/analytics/dashboard-metrics'));
      }

      const [reqRes, secondaryRes] = await Promise.allSettled(promises);

      if (reqRes.status === 'fulfilled' && reqRes.value.data?.success) {
        setRequests(reqRes.value.data.data);
      }
      if (secondaryRes && secondaryRes.status === 'fulfilled' && secondaryRes.value.data?.success) {
        if (!isStudent) {
          setMentees(secondaryRes.value.data.data);
        } else if (secondaryRes.value.data.data?.profile?.mentor) {
          setStudentMentor(secondaryRes.value.data.data.profile.mentor);
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

  // Zero-refresh automatic live synchronization on mentorship & student allocations
  useRealtimeSync(['mentorship_updated', 'students_updated', 'batch_updated'], loadData);

  // Submit student ticket
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/mentorship/requests', formData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Support request submitted to your assigned mentor!' });
        setShowCreateModal(false);
        setFormData({ category: 'subject_difficulty', subject: '', description: '' });
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Submission failed' });
    }
  };

  // Update ticket (Mentor)
  const handleUpdateTicket = async (ticketId) => {
    try {
      await api.patch(`/mentorship/requests/${ticketId}`, {
        mentorNotes,
        status: ticketStatus,
      });
      setStatusMsg({ type: 'success', text: 'Mentorship response recorded successfully!' });
      setSelectedTicket(null);
      loadData();
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Failed to update ticket' });
    }
  };

  // Log advisory session (Mentor)
  const handleLogSession = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/mentorship/counseling-log', logFormData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Counseling session documented successfully!' });
        setShowLogModal(false);
        setSelectedMenteeForLog(null);
        setLogFormData({
          studentId: '',
          category: 'personal_guidance',
          subject: 'Advisory & Progress Review',
          description: '',
          mentorNotes: '',
          sessionDate: new Date().toISOString().split('T')[0],
        });
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to document session' });
    }
  };

  const openLogModalForStudent = (mentee) => {
    setSelectedMenteeForLog(mentee);
    setLogFormData({
      studentId: mentee.user?._id || mentee._id,
      category: mentee.isDefaulter ? 'attendance_concern' : 'personal_guidance',
      subject: mentee.isDefaulter ? 'Attendance Defaulter Advisory & Makeup Plan' : 'Academic Advisory & Semester Progress Review',
      description: mentee.isDefaulter
        ? `Attendance at ${mentee.attendancePct}%. Discussed leaves and structured makeup assignment submission.`
        : 'Reviewed academic coursework, CIA exam preparation, and project development progress.',
      mentorNotes: '',
      sessionDate: new Date().toISOString().split('T')[0],
    });
    setShowLogModal(true);
  };

  // Mentor Stats
  const defaulterCount = mentees.filter((m) => m.isDefaulter).length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'submitted' || r.status === 'in_review').length;
  const resolvedSessionsCount = requests.filter((r) => r.status === 'resolved' || r.status === 'responded').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-brand-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Student Care & Pastoral Guidance
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Mentorship Hub
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {isStudent ? 'My Assigned Faculty Mentor & Support' : 'Faculty Mentorship & Cohort Advisory Portal'}
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            {isStudent
              ? 'Connect directly with your designated professor for academic difficulty resolution, attendance issues, exam preparation, and career roadmap.'
              : 'Monitor your assigned mentee cohort, review real-time attendance & assessment health, respond to guidance requests, and document official counseling sessions.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isStudent && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Request Mentor Support</span>
            </button>
          )}

          {!isStudent && (
            <button
              onClick={() => {
                if (mentees.length > 0) {
                  openLogModalForStudent(mentees[0]);
                } else {
                  setShowLogModal(true);
                }
              }}
              className="px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Log Advisory Session</span>
            </button>
          )}
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
          <button onClick={() => setStatusMsg({ type: '', text: '' })} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 2. KPI Statistics Bar */}
      {!isStudent ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Mentees</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{mentees.length} Students</p>
          </div>
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">At-Risk Defaulters (&lt;75%)</span>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{defaulterCount} Flagged</p>
          </div>
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending Requests</span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingRequestsCount} Open</p>
          </div>
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Resolved Guidance</span>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{resolvedSessionsCount} Sessions</p>
          </div>
        </div>
      ) : (
        /* Student Mentor Info Card */
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <UserCheck size={22} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Designated Faculty Mentor</span>
              <h3 className="text-base font-bold text-slate-900">
                {studentMentor?.name || 'Assigned Faculty Mentor'}
              </h3>
              <p className="text-xs text-slate-500">
                Academic Advisory & Guidance • {studentMentor?.email || 'mentor@campus360.edu'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate(studentMentor?._id ? `/messages?contactId=${studentMentor._id}` : '/messages', { state: { contactId: studentMentor?._id } })}
              className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-xl border border-brand-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Direct Chat</span>
            </button>
            <a
              href={`mailto:${studentMentor?.email || 'mentor@campus360.edu'}`}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <Mail size={14} />
              <span>Email Mentor</span>
            </a>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs (For Faculty Mentor / Admin) */}
      {!isStudent && (
        <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'mentees', label: `Assigned Mentees (${mentees.length})`, icon: Users },
            { id: 'requests', label: `Support Tickets (${requests.length})`, icon: MessageSquare },
            { id: 'counseling', label: `Advisory Logs (${resolvedSessionsCount})`, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span
                  data-nav-icon="true"
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 min-w-[24px] min-h-[24px] ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon size={15} strokeWidth={2.2} className="shrink-0 text-current" />
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Tab Content: Assigned Mentees Directory (Mentor View) */}
      {!isStudent && activeTab === 'mentees' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Assigned Student Cohort</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Real-time attendance health, assessment performance, and 1-click advisory logging.</p>
            </div>
            <div className="flex items-center gap-2">
              {menteeBatches.length > 0 && (
                <select
                  value={menteeBatchFilter}
                  onChange={(e) => setMenteeBatchFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium text-slate-800"
                >
                  <option value="all">All Batches ({mentees.length})</option>
                  {menteeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search mentee name, roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-56 sm:w-64 bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">Roll No</th>
                  <th className="pb-3">Student Name</th>
                  <th className="pb-3">Degree & Batch</th>
                  <th className="pb-3">Sem</th>
                  <th className="pb-3">Attendance</th>
                  <th className="pb-3">CIA Avg</th>
                  <th className="pb-3">Tickets</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mentees
                  .filter((m) => {
                    if (menteeBatchFilter !== 'all') {
                      const bId = m.batch?._id || m.batch;
                      if (bId?.toString() !== menteeBatchFilter) return false;
                    }
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      const matchName = m.user?.name?.toLowerCase().includes(q);
                      const matchRoll = m.rollNumber?.toLowerCase().includes(q);
                      const matchBatch = m.batch?.name?.toLowerCase().includes(q);
                      if (!matchName && !matchRoll && !matchBatch) return false;
                    }
                    return true;
                  })
                  .map((mentee) => (
                    <tr key={mentee._id} className="hover:bg-slate-50 transition">
                      <td className="py-3 font-mono font-bold text-slate-700">{mentee.rollNumber}</td>
                      <td className="py-3">
                        <div className="font-bold text-slate-900">{mentee.user?.name}</div>
                        <div className="text-[11px] text-slate-400">{mentee.user?.email}</div>
                      </td>
                      <td className="py-3 text-slate-600 font-medium">{mentee.batch?.name || mentee.course?.name}</td>
                      <td className="py-3 text-slate-600">Sem {mentee.currentSemester}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 font-extrabold ${
                            mentee.isDefaulter ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {mentee.attendancePct}%
                          {mentee.isDefaulter && (
                            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                              &lt;75% Risk
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-slate-800">
                        {mentee.avgScore !== null ? `${mentee.avgScore}%` : 'N/A'}
                      </td>
                      <td className="py-3">
                        {mentee.openTickets > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {mentee.openTickets} Open
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openLogModalForStudent(mentee)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100/80 border border-brand-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            title="Document counseling or advisory notes"
                          >
                            <FileText size={11} />
                            <span>Log Advisory</span>
                          </button>
                          <button
                            onClick={() => navigate('/messages')}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Message Mentee"
                          >
                            <MessageSquare size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {mentees.length === 0 && (
              <p className="text-center text-slate-400 py-10 text-xs">No mentees assigned to your profile yet.</p>
            )}
          </div>
        </div>
      )}

      {/* 5. Support Tickets List (Available for both Student and Mentor) */}
      {(isStudent || activeTab === 'requests') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900">
              {isStudent ? 'My Support Requests & Inquiries' : 'Mentee Support Tickets & Guidance Queue'}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <Filter size={13} className="text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs outline-none"
              >
                <option value="all">All Concern Categories</option>
                <option value="subject_difficulty">Subject Difficulty</option>
                <option value="attendance_concern">Attendance Shortage</option>
                <option value="exam_preparation">Exam Preparation</option>
                <option value="personal_guidance">Personal Guidance</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {requests
              .filter((r) => (categoryFilter === 'all' ? true : r.category === categoryFilter))
              .map((item) => (
                <div key={item._id} className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3 transition hover:shadow-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{item.subject || 'Academic Support'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize border border-slate-200">
                          {item.category?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {isStudent
                          ? `Assigned Mentor: Dr. ${item.mentor?.name || 'Faculty Mentor'}`
                          : `Mentee: ${item.student?.name} (${item.student?.email})`}
                        {item.createdAt && ` • ${new Date(item.createdAt).toLocaleDateString()}`}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        item.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.status === 'responded'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 leading-relaxed">
                    "{item.description}"
                  </p>

                  {item.mentorNotes && (
                    <div className="text-xs text-blue-950 bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200/70 space-y-1">
                      <span className="font-bold text-[11px] text-blue-700 flex items-center gap-1.5">
                        <Sparkles size={12} />
                        Mentor's Official Guidance:
                      </span>
                      <p className="leading-relaxed">{item.mentorNotes}</p>
                    </div>
                  )}

                  {!isStudent && item.status !== 'resolved' && (
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedTicket(item);
                          setMentorNotes(item.mentorNotes || '');
                          setTicketStatus(item.status);
                        }}
                        className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                      >
                        Provide Guidance / Update Status
                      </button>
                    </div>
                  )}
                </div>
              ))}

            {requests.length === 0 && (
              <div className="py-14 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 text-xs">
                No support requests recorded at this time.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Documented Advisory / Counseling Logs Tab (Mentor View) */}
      {!isStudent && activeTab === 'counseling' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Documented Counseling & Progress Reviews</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Formal record of 1-on-1 advisory sessions, remedial plans, and attendance undertakings.</p>
            </div>
            <button
              onClick={() => setShowLogModal(true)}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus size={13} />
              <span>Log New Session</span>
            </button>
          </div>

          <div className="space-y-3">
            {requests
              .filter((r) => r.status === 'resolved' || r.sessionDate)
              .map((item) => (
                <div key={item._id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{item.subject}</h4>
                      <p className="text-[11px] text-slate-500">
                        Mentee: <strong>{item.student?.name}</strong> • Category: {item.category?.replace('_', ' ')}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {item.sessionDate ? new Date(item.sessionDate).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/60">
                    {item.mentorNotes || item.description}
                  </p>
                </div>
              ))}

            {requests.filter((r) => r.status === 'resolved' || r.sessionDate).length === 0 && (
              <p className="text-center text-slate-400 py-8 text-xs">No counseling sessions recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal: Student Request Support */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900">Request Guidance from Mentor</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Area of Concern</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="subject_difficulty">Subject / Theory Difficulty</option>
                  <option value="attendance_concern">Attendance Shortage (&lt;75% Appeal)</option>
                  <option value="exam_preparation">CIA / Semester Exam Preparation</option>
                  <option value="personal_guidance">Career, GATE & Placement Guidance</option>
                  <option value="other">General Pastoral Concern</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject / Specific Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Consensus, DBMS Query Plans, Medical Leave Compensation"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Details & Context</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Explain your challenge or question so your mentor can prepare specific advice..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 text-white rounded-xl font-bold shadow-xs hover:bg-brand-700"
                >
                  Submit to Mentor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Mentor Respond & Provide Guidance */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900">Provide Mentor Guidance</h2>
              <button onClick={() => setSelectedTicket(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Update Status</label>
                <select
                  value={ticketStatus}
                  onChange={(e) => setTicketStatus(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="in_review">In Review (Under Consideration)</option>
                  <option value="responded">Responded with Actionable Guidance</option>
                  <option value="resolved">Resolved & Closed</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Guidance Notes for Mentee</label>
                <textarea
                  rows="4"
                  value={mentorNotes}
                  onChange={(e) => setMentorNotes(e.target.value)}
                  placeholder="Record guidance given, action steps, or makeup assignment deadlines..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateTicket(selectedTicket._id)}
                  className="px-5 py-2 bg-brand-600 text-white rounded-xl font-bold shadow-xs hover:bg-brand-700"
                >
                  Save & Notify Mentee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mentor Document Advisory Session */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900">Document 1-on-1 Counseling Session</h2>
              <button onClick={() => setShowLogModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogSession} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Mentee</label>
                <select
                  value={logFormData.studentId}
                  onChange={(e) => setLogFormData({ ...logFormData, studentId: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="">Select Student...</option>
                  {mentees.map((m) => (
                    <option key={m._id} value={m.user?._id || m._id}>
                      {m.user?.name} ({m.rollNumber}) {m.isDefaulter ? '- Attendance Defaulter' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={logFormData.category}
                  onChange={(e) => setLogFormData({ ...logFormData, category: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="attendance_concern">Attendance Shortage & Remedial Plan</option>
                  <option value="subject_difficulty">Academic Performance & Remediation</option>
                  <option value="exam_preparation">Internal Assessment & Exam Prep</option>
                  <option value="personal_guidance">General Career & Well-being Advisory</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Topic / Discussion Summary</label>
                <input
                  type="text"
                  required
                  value={logFormData.subject}
                  onChange={(e) => setLogFormData({ ...logFormData, subject: e.target.value })}
                  placeholder="e.g. Mid-term review, medical leave justification"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Agreed Action Plan & Notes</label>
                <textarea
                  rows="4"
                  required
                  value={logFormData.description}
                  onChange={(e) => setLogFormData({ ...logFormData, description: e.target.value })}
                  placeholder="Document recommendations given, student commitments, and follow-up timeline..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 text-white rounded-xl font-bold shadow-xs hover:bg-brand-700"
                >
                  Document Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
