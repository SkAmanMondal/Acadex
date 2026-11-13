import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  GraduationCap,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Camera,
  UserCheck,
  Sparkles,
  AlertTriangle,
  BookOpen,
  Users,
  Eye,
  EyeOff,
  CheckCircle2,
  LogIn,
  Search,
  Filter,
  Copy,
  Check,
  X,
  Building,
  Layers,
  ChevronDown,
} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeQuickEmail, setActiveQuickEmail] = useState(null);
  const [selectedPersonaNote, setSelectedPersonaNote] = useState(null);

  // Directory state
  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [visibleCount, setVisibleCount] = useState(40);
  const [mobileTab, setMobileTab] = useState('directory'); // 'directory' or 'form'

  const { login } = useAuth();
  const navigate = useNavigate();

  // Fetch full institutional directory on mount
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        setDirectoryLoading(true);
        const res = await api.get('/auth/directory');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setDirectory(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load login directory:', err);
      } finally {
        setDirectoryLoading(false);
      }
    };
    fetchDirectory();
  }, []);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(40);
  }, [searchQuery, selectedRole, selectedDept, selectedBatch]);

  // Handle standard form submit
  const handleLoginSubmit = async (loginEmail, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      await login(loginEmail || email, loginPassword || password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
      setActiveQuickEmail(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLoginSubmit(email, password);
  };

  // Auto-fill credentials into the fixed left form
  const fillCredentials = (acc) => {
    setEmail(acc.email);
    setPassword(acc.passwordHint || 'Admin@123');
    setSelectedPersonaNote({
      name: acc.name,
      role: acc.role,
      designation: acc.designation || acc.batch?.name || '',
    });
    setError('');
  };

  // 1-Click instant login
  const instantLogin = async (acc) => {
    setActiveQuickEmail(acc.email);
    fillCredentials(acc);
    await handleLoginSubmit(acc.email, acc.passwordHint || 'Admin@123');
  };

  // Copy email to clipboard
  const copyToClipboard = (text, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Extract distinct departments from directory
  const availableDepartments = useMemo(() => {
    const map = new Map();
    directory.forEach((acc) => {
      if (acc.department && acc.department.code) {
        map.set(acc.department.code, acc.department);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [directory]);

  // Extract distinct batches from directory
  const availableBatches = useMemo(() => {
    const map = new Map();
    directory.forEach((acc) => {
      if (acc.batch && acc.batch._id && acc.batch.name) {
        map.set(acc.batch._id, acc.batch);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [directory]);

  // Compute counts by role
  const roleCounts = useMemo(() => {
    return {
      all: directory.length,
      college_admin: directory.filter((a) => a.role === 'college_admin').length,
      hod: directory.filter((a) => a.role === 'hod').length,
      teacher: directory.filter((a) => a.role === 'teacher').length,
      mentor: directory.filter((a) => a.isMentor).length,
      student: directory.filter((a) => a.role === 'student').length,
    };
  }, [directory]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return directory.filter((acc) => {
      // Role filter
      if (selectedRole === 'mentor') {
        if (!acc.isMentor) return false;
      } else if (selectedRole !== 'all') {
        if (acc.role !== selectedRole) return false;
      }

      // Department filter
      if (selectedDept !== 'all') {
        if (acc.department?.code !== selectedDept) return false;
      }

      // Batch filter
      if (selectedBatch !== 'all') {
        if (acc.batch?._id !== selectedBatch) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = acc.name?.toLowerCase().includes(q);
        const matchEmail = acc.email?.toLowerCase().includes(q);
        const matchRoll = acc.rollNumber?.toLowerCase().includes(q);
        const matchDesig = acc.designation?.toLowerCase().includes(q);
        const matchDept =
          acc.department?.name?.toLowerCase().includes(q) ||
          acc.department?.code?.toLowerCase().includes(q);
        const matchBatch = acc.batch?.name?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRoll && !matchDesig && !matchDept && !matchBatch) {
          return false;
        }
      }

      return true;
    });
  }, [directory, selectedRole, selectedDept, selectedBatch, searchQuery]);

  // Slice for high-performance rendering
  const paginatedAccounts = useMemo(() => {
    return filteredAccounts.slice(0, visibleCount);
  }, [filteredAccounts, visibleCount]);

  // Role badge helper
  const getRoleBadge = (acc) => {
    if (acc.role === 'college_admin') {
      return {
        label: 'Admin',
        icon: ShieldCheck,
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        cardClass: 'hover:border-purple-300 hover:bg-purple-50/20',
      };
    }
    if (acc.role === 'hod') {
      return {
        label: 'HOD',
        icon: Users,
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        cardClass: 'hover:border-indigo-300 hover:bg-indigo-50/20',
      };
    }
    if (acc.isMentor) {
      return {
        label: 'Chief Mentor',
        icon: UserCheck,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        cardClass: 'hover:border-amber-300 hover:bg-amber-50/20 ring-1 ring-amber-400/30',
      };
    }
    if (acc.role === 'teacher') {
      return {
        label: 'Faculty',
        icon: BookOpen,
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        cardClass: 'hover:border-blue-300 hover:bg-blue-50/20',
      };
    }
    return {
      label: 'Student',
      icon: Sparkles,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cardClass: 'hover:border-emerald-300 hover:bg-emerald-50/20',
    };
  };

  return (
    <div className="min-h-screen lg:h-screen bg-slate-950 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950 overflow-y-auto lg:overflow-hidden py-3 sm:py-6">
      {/* Mobile Screen Segmented Tab Switcher */}
      <div className="lg:hidden flex items-center p-1 bg-slate-900/90 rounded-2xl border border-slate-800 mb-2.5 w-full max-w-sm mx-auto shrink-0 shadow-lg">
        <button
          type="button"
          onClick={() => setMobileTab('directory')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'directory'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          <span>Accounts ({filteredAccounts.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'form'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock size={14} />
          <span>Sign In Form</span>
        </button>
      </div>

      {/* Main Container Card: Natural scroll on mobile, pinned viewport height on desktop */}
      <div className="w-full max-w-7xl min-h-0 lg:h-full lg:max-h-[96vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 grid grid-cols-1 lg:grid-cols-12 my-auto">

        {/* ====================================================================== */}
        {/* LEFT COLUMN: FIXED LOGIN AREA                                          */}
        {/* Strictly pinned and stationary; does not scroll when browsing data     */}
        {/* ====================================================================== */}
        <div className={`lg:col-span-5 p-5 sm:p-6 lg:p-8 flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 bg-white h-auto lg:h-full overflow-y-auto select-none shrink-0 ${mobileTab === 'form' ? 'flex' : 'hidden lg:flex'}`}>
          <div>
            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/25 text-white shrink-0">
                <GraduationCap size={26} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Acadex
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full">
                    v2.5
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">Smart Academic ERP & Mentorship Portal</p>
              </div>
            </div>

            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-800">Sign In to Campus</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your credentials or click <strong>Quick Login</strong> on any persona on the right.
              </p>
            </div>

            {/* Mobile quick jump to accounts */}
            <button
              type="button"
              onClick={() => setMobileTab('directory')}
              className="lg:hidden w-full py-2 px-3 mb-4 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Users size={13} />
              <span>Browse 547 Accounts & 1-Click Login →</span>
            </button>

            {/* Selected Persona Floating Indicator */}
            {selectedPersonaNote && (
              <div className="mb-4 p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex items-center justify-between text-xs text-blue-900 animate-fadeIn">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold truncate block">{selectedPersonaNote.name}</span>
                    <span className="text-[10px] text-blue-700 block truncate">
                      {selectedPersonaNote.designation || selectedPersonaNote.role}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPersonaNote(null);
                    setEmail('');
                    setPassword('');
                  }}
                  className="p-1 rounded-lg hover:bg-blue-100 text-blue-600 cursor-pointer shrink-0"
                  title="Clear auto-filled account"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-fadeIn">
                <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-bold">Authentication Failed: </span>
                  {error}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Institutional Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-400" size={17} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. mentor@campus360.edu"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <span className="text-[10px] text-slate-400">Case-sensitive</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-400" size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition text-slate-800 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs transition shadow-md shadow-brand-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Podium Attendance Kiosk Link */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link
                to="/kiosk"
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition flex items-center justify-between border border-slate-800 group shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Camera size={15} className="text-brand-400 group-hover:scale-110 transition-transform" />
                  <span>Podium Kiosk (QR Scanner)</span>
                </div>
                <span className="text-[9px] bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded border border-brand-400/30">
                  Classroom Mode
                </span>
              </Link>
            </div>
          </div>

          {/* Left Footer Info */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>© 2026 Acadex</span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 size={13} /> {directory.length || 547} Real Accounts Ready
            </span>
          </div>
        </div>

        {/* ====================================================================== */}
        {/* RIGHT COLUMN: DATA PART (SEARCH, FILTERS & SCROLLABLE DIRECTORY)        */}
        {/* Fixed header toolbar at top; ONLY data list scrolls independently     */}
        {/* ====================================================================== */}
        <div className={`lg:col-span-7 flex-col h-[82vh] sm:h-[86vh] lg:h-full bg-slate-50/80 overflow-hidden min-w-0 ${mobileTab === 'directory' ? 'flex' : 'hidden lg:flex'}`}>

          {/* Fixed Filter & Search Toolbar (Pinned at Top of Data Area) */}
          <div className="p-4 lg:p-5 border-b border-slate-200/80 bg-white shrink-0 space-y-3 z-10 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-brand-600" />
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Institutional Directory & 1-Click Access
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Browse and instantly sign in to any administrator, HOD, faculty mentor, or student account.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-xl">
                  {directoryLoading
                    ? 'Loading...'
                    : `${filteredAccounts.length} Account${filteredAccounts.length === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, roll number, designation, or department..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills & Select Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              {/* Role Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
                {[
                  { id: 'all', label: `All (${roleCounts.all})` },
                  { id: 'college_admin', label: `Admin (${roleCounts.college_admin})` },
                  { id: 'hod', label: `HODs (${roleCounts.hod})` },
                  { id: 'mentor', label: `⭐ Mentors (${roleCounts.mentor})` },
                  { id: 'teacher', label: `Faculty (${roleCounts.teacher})` },
                  { id: 'student', label: `Students (${roleCounts.student})` },
                ].map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setSelectedRole(rf.id)}
                    className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition shrink-0 cursor-pointer ${
                      selectedRole === rf.id
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>

              {/* Department & Batch Dropdown Filters */}
              <div className="flex items-center gap-2">
                {/* Department select */}
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-2 py-1 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer"
                  title="Filter by Department"
                >
                  <option value="all">All Departments ({availableDepartments.length})</option>
                  {availableDepartments.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>

                {/* Batch select (relevant for students) */}
                {(selectedRole === 'all' || selectedRole === 'student') && availableBatches.length > 0 && (
                  <select
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                    className="px-2 py-1 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer max-w-[150px] truncate"
                    title="Filter by Student Cohort Batch"
                  >
                    <option value="all">All Batches ({availableBatches.length})</option>
                    {availableBatches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ====================================================================== */}
          {/* SCROLLABLE DATA LIST (ONLY THIS CONTAINER SCROLLS ON SCREEN)           */}
          {/* ====================================================================== */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 space-y-3 min-h-0 touch-pan-y overscroll-y-contain">
            {directoryLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-semibold">Loading verified accounts directory...</p>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Search size={22} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">No matching credentials found</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Try adjusting your role or department filter, or clear your search query to see all accounts.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRole('all');
                    setSelectedDept('all');
                    setSelectedBatch('all');
                  }}
                  className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paginatedAccounts.map((account) => {
                    const badge = getRoleBadge(account);
                    const IconComponent = badge.icon;
                    const isLoggingThis = loading && activeQuickEmail === account.email;

                    return (
                      <div
                        key={account._id || account.email}
                        className={`bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs transition-all flex flex-col justify-between ${badge.cardClass}`}
                      >
                        <div>
                          {/* Badges Row */}
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${badge.badgeClass}`}
                              >
                                {badge.label}
                              </span>

                              {account.department?.code && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  {account.department.code}
                                </span>
                              )}
                            </div>

                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                              <IconComponent size={13} />
                            </div>
                          </div>

                          {/* Account Identity */}
                          <div className="mb-2">
                            <h4 className="text-xs font-bold text-slate-900 truncate" title={account.name}>
                              {account.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                              {account.designation ||
                                (account.batch
                                  ? `${account.batch.name} • Sem ${account.batch.currentSemester}`
                                  : account.role)}
                            </p>

                            {/* Additional Student / Mentor Details */}
                            {account.rollNumber && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Roll: <strong className="text-slate-600">{account.rollNumber}</strong>
                                {account.mentor?.name && (
                                  <span> • Mentor: <strong className="text-amber-700">{account.mentor.name}</strong></span>
                                )}
                              </p>
                            )}
                          </div>

                          {/* Credentials Box */}
                          <div className="bg-slate-50/90 border border-slate-200/60 rounded-xl p-2 mb-2.5 text-[10px] font-mono text-slate-700 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 uppercase text-[9px]">Email:</span>
                              <div className="flex items-center gap-1 truncate">
                                <span className="font-semibold text-slate-800 truncate" title={account.email}>
                                  {account.email}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => copyToClipboard(account.email, e)}
                                  className="text-slate-400 hover:text-brand-600 cursor-pointer p-0.5 rounded"
                                  title="Copy email to clipboard"
                                >
                                  {copiedEmail === account.email ? (
                                    <Check size={11} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase text-[9px]">Pass:</span>
                              <span className="font-bold text-slate-800">{account.passwordHint}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => fillCredentials(account)}
                            className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition text-center cursor-pointer"
                          >
                            Auto-Fill
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => instantLogin(account)}
                            className="py-1 px-2 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
                          >
                            {isLoggingThis ? (
                              <span className="text-[10px]">Logging in...</span>
                            ) : (
                              <>
                                <LogIn size={11} />
                                <span>Quick Login</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button if filtered items exceed visible count */}
                {filteredAccounts.length > visibleCount && (
                  <div className="pt-2 pb-4 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 40)}
                      className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>Show More Accounts (+40)</span>
                      <span className="text-slate-400 text-[10px]">
                        ({paginatedAccounts.length} of {filteredAccounts.length} displayed)
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fixed Footer Note at Bottom of Data Area */}
          <div className="p-3 bg-white border-t border-slate-200/80 flex items-center justify-between text-[11px] shrink-0 text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Click <strong>Quick Login</strong> on any card to sign in instantly.</span>
            </span>
            <span className="font-semibold text-slate-700">
              Showing {Math.min(visibleCount, filteredAccounts.length)} of {filteredAccounts.length}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
