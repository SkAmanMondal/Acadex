import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from '../components/notifications/NotificationCenter';
import FloatingChatButton from '../components/chat/FloatingChatButton';
import {
  GraduationCap,
  Calendar,
  QrCode,
  BookOpen,
  FileText,
  Award,
  Users,
  AlertTriangle,
  Bell,
  LogOut,
  Menu,
  X,
  Compass,
  MessageSquare,
  Building,
  ChevronRight,
  HelpCircle,
  Send,
  CheckCircle2,
  Monitor,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout, isTeacher, isHod, isAdmin, isMentor, isStudent } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('acadex_sidebar_open') || localStorage.getItem('campus360_sidebar_open');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('acadex_sidebar_open', String(next));
        localStorage.setItem('campus360_sidebar_open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Generate dynamic navigation items based on user role and capabilities
  const getNavItems = () => {
    const items = [{ name: 'Dashboard', path: '/', icon: Compass }];

    if (isAdmin) {
      items.push(
        { name: 'Academics & Structure', path: '/admin/academics', icon: Building },
        { name: 'Faculty Management', path: '/admin/teachers', icon: Users },
        { name: 'Student Registry', path: '/admin/students', icon: GraduationCap },
        { name: 'Timetables', path: '/timetables', icon: Calendar },
        { name: 'Attendance Audit', path: '/attendance/report', icon: CheckCircle2 },
        { name: 'Semester Results', path: '/admin/results', icon: Award },
        { name: 'Quizzes & CIA', path: '/quizzes', icon: HelpCircle },
        { name: 'Direct Messages', path: '/messages', icon: Send },
        { name: 'Academic Intelligence', path: '/analytics', icon: AlertTriangle },
        { name: 'Announcements', path: '/announcements', icon: Bell }
      );
    } else if (isHod) {
      items.push(
        { name: 'Dept Timetable', path: '/timetables', icon: Calendar },
        { name: 'Classroom Scanner', path: '/teacher/scanner', icon: QrCode },
        { name: 'Dept Students', path: '/hod/students', icon: GraduationCap },
        { name: 'Attendance Audit', path: '/attendance/report', icon: CheckCircle2 },
        { name: 'Study Materials', path: '/materials', icon: BookOpen },
        { name: 'Assignments', path: '/assignments', icon: FileText },
        { name: 'Quizzes & CIA', path: '/quizzes', icon: HelpCircle },
        { name: 'Internal Marks', path: '/examinations/internals', icon: Award },
        { name: 'Direct Messages', path: '/messages', icon: Send },
        { name: 'Academic Intelligence', path: '/analytics', icon: AlertTriangle }
      );
      if (isMentor) {
        items.push({ name: 'Mentee Support', path: '/mentorship', icon: MessageSquare });
      }
      items.push({ name: 'Announcements', path: '/announcements', icon: Bell });
    } else if (isTeacher) {
      items.push(
        { name: 'My Schedule', path: '/timetables', icon: Calendar },
        { name: 'Classroom Scanner', path: '/teacher/scanner', icon: QrCode },
        { name: 'Attendance Ledger', path: '/attendance/report', icon: CheckCircle2 },
        { name: 'Study Materials', path: '/materials', icon: BookOpen },
        { name: 'Assignments', path: '/assignments', icon: FileText },
        { name: 'Quizzes & CIA', path: '/quizzes', icon: HelpCircle },
        { name: 'Internal Marks', path: '/examinations/internals', icon: Award },
        { name: 'Direct Messages', path: '/messages', icon: Send }
      );
      if (isMentor) {
        items.push({ name: 'Mentee Support', path: '/mentorship', icon: MessageSquare });
      }
      items.push({ name: 'Announcements', path: '/announcements', icon: Bell });
    } else if (isStudent) {
      items.push(
        { name: 'My Attendance QR', path: '/student/qr', icon: QrCode },
        { name: 'Attendance Stats', path: '/attendance/report', icon: CheckCircle2 },
        { name: 'Course Curriculum & Calendar', path: '/student/curriculum', icon: BookOpen },
        { name: 'Class Timetable', path: '/timetables', icon: Calendar },
        { name: 'Study Materials', path: '/materials', icon: FileText },
        { name: 'Assignments', path: '/assignments', icon: CheckCircle2 },
        { name: 'Interactive Quizzes', path: '/quizzes', icon: HelpCircle },
        { name: 'Official Grade Card', path: '/student/results', icon: Award },
        { name: 'Direct Messages', path: '/messages', icon: Send },
        { name: 'Mentor Support', path: '/mentorship', icon: MessageSquare },
        { name: 'Announcements', path: '/announcements', icon: Bell }
      );
    }

    return items;
  };

  // Pinned Quick Shortcuts
  const getQuickShortcuts = () => {
    if (isAdmin) {
      return [
        { name: 'Enroll Student', path: '/admin/students', icon: GraduationCap, badge: 'New' },
        { name: 'Timetable Matrix', path: '/timetables', icon: Calendar, badge: 'Matrix' },
        { name: 'Risk Analytics', path: '/analytics', icon: AlertTriangle, badge: 'AI Monitor' },
        { name: 'Classroom Kiosk', path: '/kiosk', icon: Monitor, badge: 'Terminal' },
      ];
    }
    if (isHod) {
      return [
        { name: 'Classroom Scanner', path: '/teacher/scanner', icon: QrCode, badge: 'Live QR' },
        { name: 'Attendance Audit', path: '/attendance/report', icon: CheckCircle2, badge: 'Defaulters' },
        { name: 'Verify CIA Marks', path: '/examinations/internals', icon: Award, badge: 'Marks' },
        { name: 'Dept Timetable', path: '/timetables', icon: Calendar, badge: 'Schedule' },
      ];
    }
    if (isTeacher) {
      if (isMentor) {
        return [
          { name: 'Mentee Roster', path: '/mentorship', icon: Users, badge: '5 Mentees' },
          { name: 'Support Tickets', path: '/mentorship', icon: MessageSquare, badge: 'Advisory' },
          { name: 'Classroom Scanner', path: '/teacher/scanner', icon: QrCode, badge: 'Attendance' },
          { name: 'Enter CIA Marks', path: '/examinations/internals', icon: Award, badge: 'Exams' },
        ];
      }
      return [
        { name: 'Classroom Scanner', path: '/teacher/scanner', icon: QrCode, badge: 'Attendance' },
        { name: 'Enter CIA Marks', path: '/examinations/internals', icon: Award, badge: 'Exams' },
        { name: 'My Schedule', path: '/timetables', icon: Calendar, badge: 'Weekly' },
        { name: 'Classroom Kiosk', path: '/kiosk', icon: Monitor, badge: 'Podium' },
      ];
    }
    // Student
    return [
      { name: 'Attendance Pass', path: '/student/qr', icon: QrCode, badge: 'Dynamic QR' },
      { name: 'Class Schedule', path: '/timetables', icon: Calendar, badge: 'Today' },
      { name: 'Active Quizzes', path: '/quizzes', icon: HelpCircle, badge: 'Assessment' },
      { name: 'Grade Card', path: '/student/results', icon: Award, badge: 'Results' },
    ];
  };

  const navItems = getNavItems();
  const quickShortcuts = getQuickShortcuts();

  return (
    <div className="fixed inset-0 w-full h-full max-h-[100dvh] bg-slate-50/70 flex flex-col font-sans overflow-hidden">
      {/* ====================================================================== */}
      {/* 1. MOBILE TOP APP BAR - Clean header for phones (< sm)                 */}
      {/* ====================================================================== */}
      <header className="flex sm:hidden h-14 bg-white border-b border-slate-200/80 px-3 items-center justify-between shrink-0 z-30 sticky top-0 shadow-2xs select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 text-slate-700 hover:text-brand-600 rounded-xl hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Open Side Navigation Menu"
            aria-label="Toggle Navigation"
          >
            <Menu size={20} className="w-5 h-5 shrink-0" />
          </button>
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-xs shrink-0 min-w-[32px] min-h-[32px]">
              <GraduationCap size={18} className="shrink-0 text-white" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <span className="text-base font-extrabold bg-gradient-to-r from-brand-700 via-indigo-700 to-blue-700 bg-clip-text text-transparent tracking-tight truncate block leading-tight">
                Acadex
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-brand-600 truncate block">
                Smart College
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <NotificationCenter align="right" buttonClassName="w-8 h-8 p-0 rounded-xl" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 cursor-pointer"
            title={user?.name || 'Account'}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </button>
        </div>
      </header>

      {/* ====================================================================== */}
      {/* 2. DESKTOP PERMANENT SIDEBAR (sm:flex)                                 */}
      {/* Hidden on mobile phones to prevent layout squeezing / obstruction.      */}
      {/* Smoothly toggles between Full Expanded (w-64) and Mini-Rail (w-16).    */}
      {/* ====================================================================== */}
      {desktopSidebarOpen ? (
        /* Full Expanded Sidebar (w-64 lg:w-72) */
        <nav
          id="acadex-desktop-nav"
          aria-label="Acadex Primary Navigation"
          className="hidden sm:flex flex-col w-64 lg:w-72 fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200/80 shadow-xs h-screen overflow-hidden select-none"
        >
          {/* Brand Header & Live Notification Center */}
          <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <Link to="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-brand-500/25 group-hover:shadow-glow-brand transition shrink-0 min-w-[40px] min-h-[40px]">
                <GraduationCap size={22} className="shrink-0 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <span className="text-xl font-extrabold bg-gradient-to-r from-brand-700 via-indigo-700 to-blue-700 bg-clip-text text-transparent tracking-tight truncate block leading-tight">
                  Acadex
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 truncate block">
                  Smart College
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleDesktopSidebar}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Collapse Side Navigation Bar"
              >
                <ChevronLeft size={16} />
              </button>
              <NotificationCenter align="sidebar" buttonClassName="w-8 h-8 p-0 rounded-xl" />
            </div>
          </div>

          {/* Scrollable Navigation Area (Independently scrollable if screen is short) */}
          <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
            {/* Quick Shortcuts */}
            <div className="bg-gradient-to-br from-brand-50/80 via-indigo-50/40 to-white rounded-2xl border border-brand-100/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5 shrink-0">
                  <Sparkles size={12} strokeWidth={2.2} className="shrink-0 text-brand-600" />
                  Quick Shortcuts
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white text-brand-600 border border-brand-200 shadow-2xs shrink-0">
                  Fast Track
                </span>
              </div>

              <div className="space-y-1.5">
                {quickShortcuts.map((sc) => {
                  const Icon = sc.icon;
                  const isActive = location.pathname === sc.path;
                  return (
                    <Link
                      key={sc.path}
                      to={sc.path}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition group cursor-pointer ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-white hover:bg-brand-50/70 border border-slate-200/80 hover:border-brand-200 text-slate-700 hover:text-brand-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          data-nav-icon="true"
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 min-w-[24px] min-h-[24px] transition-colors ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
                          }`}
                        >
                          <Icon size={14} strokeWidth={2.2} className="shrink-0 text-current" />
                        </span>
                        <span className="truncate font-semibold">{sc.name}</span>
                      </div>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ml-1 ${
                          isActive
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-700'
                        }`}
                      >
                        {sc.badge}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Main Navigation Menu */}
            <nav className="space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Navigation Menu</span>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-medium">
                  {user?.role ? user.role.toUpperCase() : 'USER'}
                </span>
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        data-nav-icon="true"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 min-w-[28px] min-h-[28px] transition-all ${
                          isActive
                            ? 'bg-white/20 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600'
                        }`}
                      >
                        <Icon size={16} strokeWidth={2.2} className="shrink-0 text-current" />
                      </span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    {isActive ? (
                      <ChevronRight size={14} strokeWidth={2.2} className="shrink-0 text-white/80" />
                    ) : (
                      <ChevronRight size={14} strokeWidth={2.2} className="shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Platform Status Badge */}
            <div className="px-3 py-2 rounded-xl bg-slate-100/80 border border-slate-200/70 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Active Term: 2025-26
              </span>
              <span className="font-semibold text-slate-700">Even Sem</span>
            </div>
          </div>

          {/* Pinned Bottom Area: User Profile & Sign Out */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 space-y-2.5">
            <div className="flex items-center gap-2.5 px-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 min-w-[36px] min-h-[36px]">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate leading-tight" title={user?.name}>
                  {user?.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5" title={user?.department?.name || user?.role}>
                  {user?.role === 'hod'
                    ? 'Head of Department'
                    : user?.role === 'college_admin'
                    ? 'Administrator'
                    : user?.role === 'teacher'
                    ? 'Faculty Member'
                    : 'Enrolled Student'}
                  {user?.department?.name ? ` • ${user.department.name}` : ''}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50/80 border border-slate-200 hover:border-rose-200 rounded-xl transition cursor-pointer shadow-2xs"
              title="Sign out of Acadex"
            >
              <LogOut size={14} strokeWidth={2.2} className="shrink-0 text-current" />
              <span>Sign Out</span>
            </button>
          </div>
        </nav>
      ) : (
        /* Collapsed Mini-Rail (w-16) - Navigation icons always visible on desktop (sm:flex) */
        <nav
          id="acadex-desktop-nav"
          aria-label="Acadex Primary Navigation"
          className="hidden sm:flex flex-col w-16 fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200/80 shadow-xs h-screen overflow-hidden select-none items-center py-3 justify-between"
        >
          {/* Top Logo & Expand Button */}
          <div className="flex flex-col items-center gap-3 w-full shrink-0">
            <Link to="/" className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-brand-500/25 shrink-0" title="Acadex Home">
              <GraduationCap size={20} className="shrink-0 text-white" strokeWidth={2.2} />
            </Link>
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition cursor-pointer"
              title="Expand Side Navigation Bar"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Center Nav Icons */}
          <div className="flex-1 w-full overflow-y-auto space-y-2 py-3 px-1 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.name}
                  className={`flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition cursor-pointer group ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} strokeWidth={2.2} className="shrink-0 text-current" />
                </Link>
              );
            })}
          </div>

          {/* Bottom Avatar & Sign Out */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100 w-full shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0" title={user?.name}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <button
              onClick={logout}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut size={16} strokeWidth={2.2} />
            </button>
          </div>
        </nav>
      )}

      {/* ====================================================================== */}
      {/* 3. MOBILE NAVIGATION DRAWER                                            */}
      {/* ====================================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex animate-fadeIn">
          <div className="w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Mobile Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0 min-w-[36px] min-h-[36px]">
                  <GraduationCap size={20} className="shrink-0 text-white" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900 block leading-tight text-base truncate">
                    Acadex
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize truncate block">
                    {user?.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer shrink-0"
                aria-label="Close Menu"
              >
                <X size={18} className="shrink-0" />
              </button>
            </div>

            {/* Mobile Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Mobile Navigation Links */}
              <div className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  All Sections
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        data-nav-icon="true"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 min-w-[28px] min-h-[28px] ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon size={16} strokeWidth={2.2} className="shrink-0 text-current" />
                      </span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Drawer Bottom: User Profile & Logout */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 space-y-2.5 shrink-0">
              <div className="flex items-center gap-2.5 px-1 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0 min-w-[32px] min-h-[32px]">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {user?.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {user?.department?.name || user?.role}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-700 rounded-xl font-semibold text-xs border border-rose-200 cursor-pointer"
              >
                <LogOut size={14} strokeWidth={2.2} className="shrink-0 text-current" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Backdrop Dismiss Area */}
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* ====================================================================== */}
      {/* 4. MAIN CONTENT AREA                                                   */}
      {/* Dynamic desktop padding (pl-0 on mobile, sm:pl-64 or sm:pl-16 desktop) */}
      {/* Bottom padding on mobile to accommodate native bottom app navigation   */}
      {/* ====================================================================== */}
      <div
        className={`flex-1 pl-0 ${
          desktopSidebarOpen ? 'sm:pl-64 lg:pl-72' : 'sm:pl-16'
        } min-h-0 ${
          location.pathname === '/messages' ? 'overflow-hidden flex flex-col pb-0' : 'overflow-y-auto pb-20 sm:pb-0'
        } flex flex-col min-w-0 transition-all duration-200`}
      >
        <main
          className={`flex-1 min-h-0 flex flex-col ${
            location.pathname === '/messages'
              ? 'p-0 sm:p-2 sm:py-2.5 max-w-6xl w-full mx-auto overflow-hidden'
              : 'p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto'
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* ====================================================================== */}
      {/* 5. NATIVE MOBILE BOTTOM NAVIGATION BAR (< sm)                         */}
      {/* Fast, thumb-friendly access to core workflows with active state badges */}
      {/* ====================================================================== */}
      {location.pathname !== '/messages' && (
        <nav className="flex sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 px-2 py-1 items-center justify-around shadow-lg shadow-slate-900/10 select-none">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
              location.pathname === '/'
                ? 'text-brand-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass size={20} strokeWidth={location.pathname === '/' ? 2.5 : 2} className="shrink-0" />
            <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
          </Link>

          <Link
            to="/timetables"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
              location.pathname.startsWith('/timetable')
                ? 'text-brand-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={20} strokeWidth={location.pathname.startsWith('/timetable') ? 2.5 : 2} className="shrink-0" />
            <span className="text-[10px] mt-0.5 tracking-tight">Schedule</span>
          </Link>

          <Link
            to="/messages"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition relative ${
              location.pathname === '/messages'
                ? 'text-brand-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send size={20} strokeWidth={location.pathname === '/messages' ? 2.5 : 2} className="shrink-0" />
            <span className="text-[10px] mt-0.5 tracking-tight">Messages</span>
          </Link>

          <Link
            to={
              isStudent
                ? '/student/curriculum'
                : isTeacher || isHod
                ? '/teacher/scanner'
                : '/attendance/report'
            }
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
              location.pathname.includes('curriculum') ||
              location.pathname.includes('scanner') ||
              location.pathname.includes('attendance')
                ? 'text-brand-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isStudent ? (
              <BookOpen size={20} strokeWidth={2} className="shrink-0" />
            ) : isTeacher || isHod ? (
              <QrCode size={20} strokeWidth={2} className="shrink-0" />
            ) : (
              <CheckCircle2 size={20} strokeWidth={2} className="shrink-0" />
            )}
            <span className="text-[10px] mt-0.5 tracking-tight">
              {isStudent ? 'Courses' : isTeacher || isHod ? 'Scan QR' : 'Audit'}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <Menu size={20} strokeWidth={2} className="shrink-0" />
            <span className="text-[10px] mt-0.5 tracking-tight">All Tabs</span>
          </button>
        </nav>
      )}

      {/* Floating Real-Time Chat Navigation Button */}
      <FloatingChatButton />
    </div>
  );
}
