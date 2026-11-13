import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Eye,
  ExternalLink,
  X,
  File,
  Image as ImageIcon,
  Film,
  Music,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Calendar,
  Sparkles,
} from 'lucide-react';

/* ==========================================================================
   Helper Utilities for In-App Previews & File Metadata
   ========================================================================== */
const resolveFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getFileCategory = (fileName, fileType) => {
  const name = (fileName || '').toLowerCase();
  const type = (fileType || '').toLowerCase();

  if (name.endsWith('.pdf') || type.includes('pdf')) return 'pdf';
  if (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif') ||
    name.endsWith('.svg') ||
    type.startsWith('image/')
  ) {
    return 'image';
  }
  if (
    name.endsWith('.mp4') ||
    name.endsWith('.webm') ||
    name.endsWith('.ogg') ||
    name.endsWith('.mov') ||
    type.startsWith('video/')
  ) {
    return 'video';
  }
  if (
    name.endsWith('.mp3') ||
    name.endsWith('.wav') ||
    name.endsWith('.aac') ||
    type.startsWith('audio/')
  ) {
    return 'audio';
  }
  if (
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    name.endsWith('.pptx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  ) {
    return 'office';
  }
  if (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.json') ||
    name.endsWith('.js') ||
    name.endsWith('.jsx') ||
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.py') ||
    name.endsWith('.java') ||
    name.endsWith('.cpp') ||
    name.endsWith('.c') ||
    name.endsWith('.html') ||
    name.endsWith('.css') ||
    type.startsWith('text/')
  ) {
    return 'text';
  }
  return 'other';
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/* ==========================================================================
   In-Website Material Preview Modal
   Allows viewing PDFs, Images, Office Docs, Videos, Audio, and Code directly
   without downloading, while keeping full download controls accessible.
   ========================================================================== */
function MaterialViewerModal({ material, onClose, onDownload }) {
  const [activeEngine, setActiveEngine] = useState('native'); // 'native', 'google', 'office'
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileCategory = getFileCategory(material.fileName, material.fileType);
  const fullUrl = resolveFileUrl(material.fileUrl);
  const teacherName = material.teacher?.name || material.uploadedBy?.name || 'Faculty Member';
  const teacherRole =
    material.teacher?.role === 'hod'
      ? 'Head of Department'
      : material.teacher?.role === 'college_admin'
      ? 'Administrator'
      : 'Faculty Instructor';
  const dateFormatted = new Date(material.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // If text/code, fetch content to render directly
  useEffect(() => {
    if (fileCategory === 'text' && fullUrl) {
      let isMounted = true;
      setLoadingText(true);
      fetch(fullUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load text file');
          return res.text();
        })
        .then((text) => {
          if (isMounted) {
            setTextContent(text);
            setLoadingText(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setTextContent('Unable to preview text content directly in browser. Please use the Download option to inspect this file.');
            setLoadingText(false);
          }
        });
      return () => {
        isMounted = false;
      };
    }
  }, [fileCategory, fullUrl]);

  const handleCopyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Google Docs Viewer (Universal for PDFs, Word, PPT on web)
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
  // Office Online Viewer
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`;

  const getIframeSrc = () => {
    if (fileCategory === 'pdf') {
      return activeEngine === 'google' ? googleViewerUrl : `${fullUrl}#toolbar=1&navpanes=1`;
    }
    if (fileCategory === 'office') {
      return activeEngine === 'office' ? officeViewerUrl : googleViewerUrl;
    }
    return fullUrl;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[92vh] max-h-[900px]'
        }`}
      >
        {/* Modal Top Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {fileCategory === 'pdf' ? (
                <FileText size={20} className="text-rose-600" />
              ) : fileCategory === 'image' ? (
                <ImageIcon size={20} className="text-emerald-600" />
              ) : fileCategory === 'video' ? (
                <Film size={20} className="text-purple-600" />
              ) : fileCategory === 'audio' ? (
                <Music size={20} className="text-amber-600" />
              ) : (
                <BookOpen size={20} className="text-brand-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {material.subject?.code || 'MCA'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  Unit {material.unit || 1}
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 truncate" title={material.title}>
                  {material.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 truncate">
                <span className="font-semibold text-brand-700">Shared by Prof. {teacherName}</span>
                <span>•</span>
                <span>{teacherRole}</span>
                <span>•</span>
                <span>{dateFormatted}</span>
                {material.topic && (
                  <>
                    <span>•</span>
                    <span className="text-slate-600 font-medium truncate">Topic: {material.topic}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onDownload(material._id, material.fileUrl)}
              className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Download file directly to device"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => window.open(fullUrl, '_blank')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Open raw file in new browser tab"
            >
              <ExternalLink size={16} />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer hidden md:flex"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
              title="Close Viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-header Controls Toolbar */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 truncate max-w-xs">{material.fileName}</span>
            <span className="text-[11px] text-slate-400">({formatFileSize(material.fileSize)})</span>
          </div>

          <div className="flex items-center gap-2">
            {fileCategory === 'pdf' && (
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveEngine('native')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                    activeEngine === 'native' ? 'bg-brand-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Native Viewer
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEngine('google')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                    activeEngine === 'google' ? 'bg-brand-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cloud Viewer
                </button>
              </div>
            )}

            {fileCategory === 'office' && (
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveEngine('office')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                    activeEngine === 'office' ? 'bg-brand-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Office Online
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEngine('google')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                    activeEngine === 'google' ? 'bg-brand-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Google Viewer
                </button>
              </div>
            )}

            {fileCategory === 'image' && (
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="px-1 text-[11px] font-bold text-slate-600">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(300, z + 25))}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 ml-1 cursor-pointer"
                  title="Rotate 90deg"
                >
                  <RotateCw size={14} />
                </button>
              </div>
            )}

            {fileCategory === 'text' && (
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 transition cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy Content'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Main Content Viewport */}
        <div className="flex-1 min-h-0 bg-slate-900/5 relative overflow-hidden flex items-center justify-center">
          {fileCategory === 'pdf' ? (
            <iframe
              src={getIframeSrc()}
              title={material.title}
              className="w-full h-full border-0 bg-white"
            />
          ) : fileCategory === 'image' ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4 bg-slate-950/90 select-none">
              <img
                src={fullUrl}
                alt={material.title}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          ) : fileCategory === 'video' ? (
            <div className="w-full h-full flex items-center justify-center p-4 bg-slate-950">
              <video
                controls
                autoPlay
                src={fullUrl}
                className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl"
              />
            </div>
          ) : fileCategory === 'audio' ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-white space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-xl">
                <Music size={32} />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-extrabold text-white">{material.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{material.fileName}</p>
              </div>
              <audio controls autoPlay src={fullUrl} className="w-full max-w-md pt-2" />
            </div>
          ) : fileCategory === 'office' ? (
            <iframe
              src={getIframeSrc()}
              title={material.title}
              className="w-full h-full border-0 bg-white"
            />
          ) : fileCategory === 'text' ? (
            <div className="w-full h-full overflow-auto p-4 sm:p-6 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed select-text">
              {loadingText ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <span>Loading text content...</span>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words">{textContent}</pre>
              )}
            </div>
          ) : (
            /* Fallback Card for generic binary formats */
            <div className="p-8 text-center space-y-4 max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl m-4">
              <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
                <FileText size={32} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">{material.title}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {material.fileName} • {formatFileSize(material.fileSize)}
                </p>
                <p className="text-xs text-brand-700 font-semibold mt-1">
                  Shared by Prof. {teacherName}
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct in-browser interactive rendering is not available for this binary format. You can download the complete original file to view it on your device.
              </p>
              <button
                type="button"
                onClick={() => onDownload(material._id, material.fileUrl)}
                className="w-full py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
              >
                <Download size={15} />
                <span>Download Original File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Main Materials Page Component
   ========================================================================== */
export default function MaterialsPage() {
  const { user, isTeacher, isHod, isAdmin } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // In-App Preview Modal State
  const [previewMaterial, setPreviewMaterial] = useState(null);

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

  // Multi-dimensional filtering logic (correctly matches populated teacher field)
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
        const teachId = m.teacher?._id || m.teacher || m.uploadedBy?._id || m.uploadedBy;
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
        const matchTeacher = m.teacher?.name?.toLowerCase().includes(q) || m.uploadedBy?.name?.toLowerCase().includes(q);
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
    } catch {
      // ignore
    }
    const resolved = resolveFileUrl(fileUrl);
    const link = document.createElement('a');
    link.href = resolved;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    loadData();
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 flex items-center gap-1">
              <Sparkles size={11} />
              <span>Interactive Repository</span>
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Academic Learning Resources Repository
          </h1>
          <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Preview PDFs, lecture slides, notes, and study media directly in your browser without downloading, or save copies to your device.
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
              <span>Shared By Faculty</span>
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
              placeholder="Search title, topic, or faculty name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-64"
            />
          </div>
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMaterials.map((mat) => {
          const category = getFileCategory(mat.fileName, mat.fileType);
          const teacherName = mat.teacher?.name || mat.uploadedBy?.name || 'Faculty Member';
          const teacherRole =
            mat.teacher?.role === 'hod'
              ? 'Head of Department'
              : mat.teacher?.role === 'college_admin'
              ? 'Administrator'
              : 'Faculty Instructor';
          const dateFormatted = new Date(mat.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <div
              key={mat._id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
            >
              <div>
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {mat.subject?.code || 'MCA'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      Unit {mat.unit || 1}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                        category === 'pdf'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : category === 'office'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : category === 'image'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : category === 'video'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : category === 'audio'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {category.toUpperCase()}
                    </span>
                  </div>

                  {(isAdmin || isHod || (isTeacher && (mat.teacher?._id === user?._id || mat.teacher === user?._id))) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(mat)}
                        title="Edit Material"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(mat._id)}
                        title="Delete Material"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Material Title & Subject */}
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-700 transition line-clamp-1" title={mat.title}>
                  {mat.title}
                </h3>
                {mat.subject?.name && (
                  <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                    {mat.subject.name}
                  </p>
                )}

                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {mat.description || 'Reference study materials, slide decks, and academic curriculum resources.'}
                </p>

                {mat.topic && (
                  <div className="mt-2.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">Topic:</span>
                    <span className="truncate">{mat.topic}</span>
                  </div>
                )}

                {/* Prominently Show by Whom it is Shared */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                    {teacherName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      Shared by <span className="text-brand-700 font-extrabold">{teacherName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <span>{teacherRole}</span>
                      <span>•</span>
                      <span>{dateFormatted}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Both View Online & Download Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-400 flex flex-col">
                  <span className="font-semibold text-slate-600">{formatFileSize(mat.fileSize)}</span>
                  <span>{mat.downloadCount || 0} downloads</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setPreviewMaterial(mat)}
                    className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title="View directly in website without downloading"
                  >
                    <Eye size={13} className="text-brand-600" />
                    <span>View Online</span>
                  </button>

                  <button
                    onClick={() => handleDownload(mat._id, mat.fileUrl)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title="Download file to device"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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

      {/* In-Website Material Preview Modal */}
      {previewMaterial && (
        <MaterialViewerModal
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          onDownload={handleDownload}
        />
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Document File (PDF / PPT / DOCX / Image / Media) *</label>
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
