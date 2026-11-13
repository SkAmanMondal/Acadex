import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen,
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Plus,
  Building,
  User,
  GraduationCap,
  Search,
  Filter,
  Edit2,
  Trash2,
} from 'lucide-react';

export default function MaterialsPage() {
  const { user, isTeacher, isHod, isAdmin } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    subject: '',
    unit: 1,
    topic: '',
  });
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Edit Material State
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    subject: '',
    unit: 1,
    topic: '',
  });

  const handleOpenEdit = (mat) => {
    setEditingMaterial(mat);
    setEditData({
      title: mat.title || '',
      description: mat.description || '',
      subject: mat.subject?._id || mat.subject || '',
      unit: mat.unit || 1,
      topic: mat.topic || '',
    });
  };

  const handleUpdateMaterial = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/materials/${editingMaterial._id}`, editData);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: 'Study material updated successfully!' });
        setEditingMaterial(null);
        loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update material' });
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm('Are you sure you want to delete this study resource?')) return;
    try {
      const res = await api.delete(`/materials/${id}`);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: 'Study material removed' });
        loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete material' });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [matRes, depRes, subRes, teaRes] = await Promise.allSettled([
        api.get('/materials'),
        api.get('/academics/departments'),
        api.get('/academics/subjects'),
        api.get('/users/teachers'),
      ]);

      if (matRes.status === 'fulfilled' && matRes.value.data?.success) {
        setMaterials(matRes.value.data.data);
      }
      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
      }
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) {
        setSubjects(subRes.value.data.data);
        if (!uploadData.subject && subRes.value.data.data.length > 0) {
          setUploadData((prev) => ({ ...prev, subject: subRes.value.data.data[0]._id }));
        }
      }
      if (teaRes.status === 'fulfilled' && teaRes.value.data?.success) {
        setTeachers(teaRes.value.data.data);
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

  // Multi-dimensional filtering logic
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Department filter
      if (selectedDepartment !== 'all') {
        const deptId = m.department?._id || m.department || m.subject?.department?._id || m.subject?.department;
        if (deptId?.toString() !== selectedDepartment) return false;
      }
      // Subject filter
      if (selectedSubject !== 'all') {
        const subId = m.subject?._id || m.subject;
        if (subId?.toString() !== selectedSubject) return false;
      }
      // Teacher filter
      if (selectedTeacher !== 'all') {
        const teachId = m.uploadedBy?._id || m.uploadedBy;
        if (teachId?.toString() !== selectedTeacher) return false;
      }
      // Unit filter
      if (selectedUnit !== 'all') {
        if (m.unit?.toString() !== selectedUnit) return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title?.toLowerCase().includes(q);
        const matchTopic = m.topic?.toLowerCase().includes(q);
        const matchSub = m.subject?.name?.toLowerCase().includes(q) || m.subject?.code?.toLowerCase().includes(q);
        const matchTeacher = m.uploadedBy?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchTopic && !matchSub && !matchTeacher) return false;
      }
      return true;
    });
  }, [materials, selectedDepartment, selectedSubject, selectedTeacher, selectedUnit, searchQuery]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatusMessage({ type: 'error', text: 'Please select a file to upload' });
      return;
    }

    const data = new FormData();
    data.append('file', file);
    data.append('title', uploadData.title);
    data.append('description', uploadData.description);
    data.append('subject', uploadData.subject);
    data.append('unit', uploadData.unit);
    data.append('topic', uploadData.topic);

    try {
      const res = await api.post('/materials/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: 'Study material published successfully!' });
        setShowUploadModal(false);
        setFile(null);
        setUploadData({ title: '', description: '', subject: subjects[0]?._id || '', unit: 1, topic: '' });
        loadData();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Upload failed' });
    }
  };

  const handleDownload = async (id, fileUrl) => {
    try {
      await api.patch(`/materials/${id}/download`);
      window.open(fileUrl, '_blank');
      loadData();
    } catch (e) {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-brand-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Learning Management
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
              Curriculum Repository
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Academic Learning Resources Repository
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Centralized study materials: browse by Academic Department, Subject, Teaching Faculty, Unit, or Topic.
          </p>
        </div>

        {(isTeacher || isHod || isAdmin) && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 rounded-2xl text-xs font-bold shadow-lg hover:bg-brand-50 transition cursor-pointer self-start md:self-auto"
          >
            <Upload size={16} />
            <span>Upload New Material</span>
          </button>
        )}
      </div>

      {statusMessage.text && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage({ type: '', text: '' })} className="font-bold cursor-pointer">
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
              <span>Uploaded By Teacher</span>
            </label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
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

          {/* Unit Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <FileText size={12} />
              <span>Syllabus Unit</span>
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Units (1 - 5)</option>
              {[1, 2, 3, 4, 5].map((u) => (
                <option key={u} value={u.toString()}>
                  Unit {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Search & Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Found <strong className="text-slate-900">{filteredMaterials.length}</strong> study resources
            </span>
            {(selectedDepartment !== 'all' || selectedSubject !== 'all' || selectedTeacher !== 'all' || selectedUnit !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedSubject('all');
                  setSelectedTeacher('all');
                  setSelectedUnit('all');
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
              placeholder="Search title, topic, or instructor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-64"
            />
          </div>
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMaterials.map((mat) => (
          <div
            key={mat._id}
            className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {mat.subject?.code || 'MCA'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    Unit {mat.unit || 1}
                  </span>
                  {(isAdmin || isHod || (isTeacher && (mat.teacher?._id === user?._id || mat.teacher === user?._id))) && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => handleOpenEdit(mat)}
                        title="Edit Material"
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(mat._id)}
                        title="Delete Material"
                        className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{mat.title}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {mat.description || 'Reference study materials and lecture slide deck.'}
              </p>

              {mat.topic && (
                <div className="mt-3 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <strong>Topic:</strong> {mat.topic}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[10px] text-slate-500">
                <p>By {mat.uploadedBy?.name || 'Faculty'}</p>
                <p className="text-slate-400">{mat.downloadCount || 0} downloads</p>
              </div>

              <button
                onClick={() => handleDownload(mat._id, mat.fileUrl)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download size={13} />
                <span>Download</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredMaterials.length === 0 && !loading && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 space-y-2">
          <BookOpen size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No study materials match the selected filters</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your Department, Subject, or Faculty Instructor selection.
          </p>
        </div>
      )}

      {/* Upload Material Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Upload Learning Resource</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resource Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Consensus Algorithms (Raft & Paxos)"
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                <select
                  value={uploadData.subject}
                  onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={uploadData.unit}
                    onChange={(e) => setUploadData({ ...uploadData, unit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. State Machine Replication"
                    value={uploadData.topic}
                    onChange={(e) => setUploadData({ ...uploadData, topic: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Brief overview of contents..."
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document File (PDF / PPT / DOCX) *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Publish Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Edit Study Material</h3>
              <button
                onClick={() => setEditingMaterial(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resource Title *</label>
                <input
                  type="text"
                  required
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                <select
                  value={editData.subject}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Syllabus Unit</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editData.unit}
                    onChange={(e) => setEditData({ ...editData, unit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Topic</label>
                  <input
                    type="text"
                    value={editData.topic}
                    onChange={(e) => setEditData({ ...editData, topic: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMaterial(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Update Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
