import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Bell,
  Plus,
  CheckCircle,
  AlertCircle,
  Building,
  Users,
  GraduationCap,
  BookOpen,
  Filter,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Send,
  Layers,
} from 'lucide-react';

export default function AnnouncementsPage() {
  const { user, isTeacher, isHod, isAdmin } = useAuth();
  const { socket } = useSocket();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'college' | 'department' | 'subject' | 'urgent'

  // Broadcast Target Metadata
  const [targetsData, setTargetsData] = useState({
    allowedScopes: [],
    departments: [],
    batches: [],
    subjects: [],
  });

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    scope: isAdmin ? 'college' : 'department',
    department: '',
    batch: '',
    subject: '',
    priority: 'normal',
  });

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communication/announcements');
      if (res.data?.success) {
        setAnnouncements(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load announcements:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadBroadcastTargets = async () => {
    if (!isAdmin && !isHod && !isTeacher) return;
    try {
      const res = await api.get('/communication/broadcast-targets');
      if (res.data?.success) {
        const data = res.data.data;
        setTargetsData({
          allowedScopes: data.allowedScopes || [],
          departments: data.departments || [],
          batches: data.batches || [],
          subjects: data.subjects || [],
        });

        // Set initial form state based on allowed scopes
        const defaultScope = data.allowedScopes[0]?.value || (isAdmin ? 'college' : 'department');
        setFormData((prev) => ({
          ...prev,
          scope: defaultScope,
          department: data.departments[0]?._id || '',
          batch: data.batches[0]?._id || '',
          subject: data.subjects[0]?._id || '',
        }));
      }
    } catch (e) {
      console.error('Failed to load broadcast targets:', e);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    loadBroadcastTargets();
  }, [user]);

  // Real-time socket event listener for newly broadcasted announcements
  useEffect(() => {
    if (!socket) return;

    const onNewAnnouncement = (newAnn) => {
      setAnnouncements((prev) => {
        // Prevent duplicate prepend
        if (prev.some((a) => a._id === newAnn._id)) return prev;
        return [newAnn, ...prev];
      });
    };

    socket.on('new_announcement', onNewAnnouncement);
    return () => {
      socket.off('new_announcement', onNewAnnouncement);
    };
  }, [socket]);

  const handleOpenModal = () => {
    setStatusMsg({ type: '', text: '' });
    const defaultScope = targetsData.allowedScopes[0]?.value || (isAdmin ? 'college' : 'department');
    setFormData({
      title: '',
      content: '',
      scope: defaultScope,
      department: targetsData.departments[0]?._id || user?.department?._id || user?.department || '',
      batch: targetsData.batches[0]?._id || '',
      subject: targetsData.subjects[0]?._id || '',
      priority: 'normal',
    });
    setShowModal(true);
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        scope: formData.scope,
        priority: formData.priority,
      };

      if (formData.scope === 'department') {
        payload.department = formData.department || user?.department?._id || user?.department;
      } else if (formData.scope === 'subject') {
        payload.subject = formData.subject;
        if (formData.batch) payload.batch = formData.batch;
      } else if (formData.scope === 'batch') {
        payload.batch = formData.batch;
      }

      const res = await api.post('/communication/announcements', payload);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Announcement broadcasted successfully to targeted audience.' });
        setShowModal(false);
        setFormData((prev) => ({ ...prev, title: '', content: '' }));
        loadAnnouncements();
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'Publishing failed. Please verify your permissions.',
      });
    }
  };

  const filteredAnnouncements = announcements.filter((item) => {
    if (activeFilter === 'urgent') return item.priority === 'urgent';
    if (activeFilter === 'college') return item.scope === 'college';
    if (activeFilter === 'department') return item.scope === 'department';
    if (activeFilter === 'subject') return item.scope === 'subject';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-700 via-indigo-700 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Institutional Communications
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Targeted Broadcasting
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Official Announcements & Bulletins
          </h1>
          <p className="text-blue-100 text-xs md:text-sm max-w-2xl leading-relaxed">
            {isAdmin
              ? 'Campus Administration authority: broadcast institutional circulars college-wide or to any department.'
              : isHod
              ? `Departmental authority: publish notices to ${user?.department?.name || 'your department'} and department batches/subjects.`
              : isTeacher
              ? 'Faculty broadcast console: publish notices to your department and your assigned subjects/classes.'
              : 'Official real-time notices from College Administration, your Department, and Course Instructors.'}
          </p>
        </div>

        {(isAdmin || isHod || isTeacher) && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 hover:bg-brand-50 rounded-2xl text-xs font-bold shadow-lg transition cursor-pointer self-start md:self-auto shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Broadcast Announcement</span>
          </button>
        )}
      </div>

      {statusMsg.text && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMsg.type === 'success' ? <CheckCircle size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
            <span className="font-semibold">{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg({ type: '', text: '' })} className="font-bold cursor-pointer text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Stats Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === 'all'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>All Bulletins</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 text-white">{announcements.length}</span>
          </button>

          <button
            onClick={() => setActiveFilter('college')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === 'college'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building size={13} />
            <span>College-Wide</span>
          </button>

          <button
            onClick={() => setActiveFilter('department')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === 'department'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users size={13} />
            <span>Department</span>
          </button>

          <button
            onClick={() => setActiveFilter('subject')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === 'subject'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={13} />
            <span>Subject / Course</span>
          </button>

          <button
            onClick={() => setActiveFilter('urgent')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === 'urgent'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Urgent Notices</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong className="text-slate-900">{filteredAnnouncements.length}</strong> broadcasts
        </div>
      </div>

      {/* Announcements Stream */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 text-xs">
            Loading announcements feed...
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 text-xs space-y-2">
            <Bell size={28} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">No announcements found matching this view.</p>
            <p className="text-[11px] text-slate-400">Targeted circulars and notices will appear here automatically.</p>
          </div>
        ) : (
          filteredAnnouncements.map((item) => {
            const isCollege = item.scope === 'college';
            const isDept = item.scope === 'department';
            const isSubject = item.scope === 'subject';
            const isBatch = item.scope === 'batch';

            return (
              <div
                key={item._id}
                className={`bg-white rounded-3xl border p-6 shadow-xs space-y-3 transition hover:shadow-md ${
                  item.priority === 'urgent'
                    ? 'border-rose-300/80 bg-rose-50/15 ring-1 ring-rose-200'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900">{item.title}</h3>
                      {item.priority === 'urgent' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle size={11} />
                          Urgent Notice
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-700">
                        {item.author?.name || 'Campus Administration'}
                      </span>
                      <span>•</span>
                      <span className="capitalize text-slate-500">
                        {item.author?.role === 'hod'
                          ? 'Head of Department'
                          : item.author?.role === 'teacher'
                          ? 'Faculty Member'
                          : item.author?.role === 'college_admin'
                          ? 'College Administrator'
                          : 'Official Office'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Target Scope Pill */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isCollege && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <Building size={12} />
                        College-Wide
                      </span>
                    )}

                    {isDept && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Users size={12} />
                        {item.department?.name ? `Dept: ${item.department.name}` : 'Department'}
                      </span>
                    )}

                    {isSubject && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <BookOpen size={12} />
                        {item.subject?.name ? `${item.subject.name} (${item.subject.code})` : 'Subject Course'}
                      </span>
                    )}

                    {isBatch && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                        <GraduationCap size={12} />
                        {item.batch?.name ? `Cohort: ${item.batch.name}` : 'Student Batch'}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed pt-1">
                  {item.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Broadcast Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Send size={18} className="text-brand-600" />
                  Broadcast Announcement
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdmin
                    ? 'Administrator Authority: Broadcast to the entire college or select any specific department.'
                    : isHod
                    ? 'Department Leadership: Broadcast to your department or assigned department cohorts.'
                    : 'Faculty Broadcast: Broadcast to your department or your assigned subject courses.'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notice Headline / Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Schedule for Mid-Term Practical Evaluations"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Broadcast Scope Picker */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Audience Scope *</label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-800"
                  >
                    {targetsData.allowedScopes.map((scope) => (
                      <option key={scope.value} value={scope.value}>
                        {scope.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority Level *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold"
                  >
                    <option value="normal">Normal Bulletin</option>
                    <option value="urgent">Urgent Circular (Alert Notification)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Target Selectors based on Scope */}
              {/* 1. Department Scope Selector */}
              {formData.scope === 'department' && (
                <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-blue-900 font-bold text-[11px]">
                    <Building size={14} className="text-blue-600" />
                    <span>Target Department</span>
                  </div>
                  {isAdmin ? (
                    <div>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl outline-none font-medium text-slate-800"
                      >
                        <option value="">-- Choose Any Department --</option>
                        {targetsData.departments.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-blue-700 mt-1">
                        As an Administrator, you can target this notice to any academic department.
                      </p>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-white rounded-xl border border-blue-200 text-slate-800 font-semibold flex items-center justify-between">
                      <span>{user?.department?.name || 'My Department'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                        Enforced Department
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Subject Scope Selector */}
              {formData.scope === 'subject' && (
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px]">
                    <BookOpen size={14} className="text-emerald-600" />
                    <span>Target Academic Subject *</span>
                  </div>
                  {targetsData.subjects.length > 0 ? (
                    <div>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl outline-none font-medium text-slate-800"
                      >
                        <option value="">-- Choose Subject Course --</option>
                        {targetsData.subjects.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.code}) {s.department?.name ? `• ${s.department.name}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-emerald-700 mt-1">
                        Only students enrolled in this subject will receive this broadcast in their bulletin and notification center.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-800 py-1">
                      No assigned subjects recorded on your schedule. Contact HOD or Admin for subject assignment.
                    </p>
                  )}
                </div>
              )}

              {/* 3. Batch Scope Selector */}
              {formData.scope === 'batch' && (
                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[11px]">
                    <GraduationCap size={14} className="text-indigo-600" />
                    <span>Target Student Batch / Cohort *</span>
                  </div>
                  {targetsData.batches.length > 0 ? (
                    <div>
                      <select
                        value={formData.batch}
                        onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl outline-none font-medium text-slate-800"
                      >
                        <option value="">-- Choose Batch --</option>
                        {targetsData.batches.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name} {b.department?.name ? `(${b.department.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-indigo-700 mt-1">
                        This notice will be broadcasted exclusively to students in this cohort.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-indigo-800 py-1">
                      No batches available for this scope.
                    </p>
                  )}
                </div>
              )}

              {/* College Notice Explanatory Banner for Non-Admins */}
              {!isAdmin && formData.scope === 'college' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>College-wide broadcasting is restricted to College Administrators.</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Notice Content *</label>
                <textarea
                  rows="4"
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Provide complete announcement details, instructions, links, or deadlines..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md shadow-brand-500/25 cursor-pointer transition flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  <span>Publish Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
