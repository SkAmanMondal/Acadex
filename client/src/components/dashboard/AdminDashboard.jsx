import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useRealtimeSync } from '../../context/SocketContext';
import {
  Building,
  Users,
  GraduationCap,
  Calendar,
  Award,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  CheckCircle,
  BookOpen,
  Plus,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function AdminDashboard({ user }) {
  const [metrics, setMetrics] = useState(() => {
    try {
      const cached = sessionStorage.getItem('acadex_admin_metrics');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(!metrics);

  const loadAdminData = async (isSilent = false) => {
    try {
      if (!isSilent && !metrics) setLoading(true);
      const [metRes, deptRes, couRes] = await Promise.allSettled([
        api.get('/analytics/dashboard-metrics'),
        api.get('/academics/departments'),
        api.get('/academics/courses'),
      ]);

      if (metRes.status === 'fulfilled' && metRes.value.data?.success) {
        const data = metRes.value.data.data;
        setMetrics(data);
        try {
          sessionStorage.setItem('acadex_admin_metrics', JSON.stringify(data));
        } catch {}
      }
      if (deptRes.status === 'fulfilled' && deptRes.value.data?.success) {
        setDepartments(deptRes.value.data.data);
      }
      if (couRes.status === 'fulfilled' && couRes.value.data?.success) {
        setCourses(couRes.value.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData(Boolean(metrics));
  }, []);

  // Zero-refresh automatic live synchronization on any institution/analytics change
  useRealtimeSync(['students_updated', 'academics_updated', 'batch_updated', 'attendance_updated', 'dashboard_refresh'], () => loadAdminData(true));

  return (
    <div className="space-y-6">
      {/* 1. College Administrator Command Center Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20">
                Institutional Central Administration
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                Acadex Enterprise Control
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Institutional Governance Console
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-xl leading-relaxed">
              Managing departments, faculty onboarding, student registries, timetables, and official end-semester examinations across all degree programs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/teachers"
              className="px-4 py-2.5 rounded-2xl bg-white text-slate-900 text-xs font-bold shadow-lg hover:bg-slate-100 transition cursor-pointer flex items-center gap-2"
            >
              <Users size={16} />
              <span>+ Onboard Faculty</span>
            </Link>
            <Link
              to="/admin/students"
              className="px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md shadow-brand-500/25"
            >
              <GraduationCap size={16} />
              <span>+ Register Students</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. College-Wide Macro KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        <div className="bg-gradient-to-br from-white to-indigo-50/50 p-4 sm:p-5 rounded-2xl border-2 border-indigo-200/90 border-t-4 border-t-indigo-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Total Students</span>
            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <GraduationCap size={15} />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tabular-nums">{metrics?.totalStudents || 0}</p>
          <Link to="/admin/students" className="text-[11px] text-brand-600 font-bold hover:underline mt-1 block">
            Student Registry →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-white to-blue-50/50 p-4 sm:p-5 rounded-2xl border-2 border-blue-200/90 border-t-4 border-t-blue-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Faculty & Staff</span>
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Users size={15} />
            </span>
          </div>
          <p className="text-2xl font-black text-blue-900 mt-2 tabular-nums">{metrics?.totalTeachers || 0}</p>
          <Link to="/admin/teachers" className="text-[11px] text-blue-700 font-bold hover:underline mt-1 block">
            Faculty Roster →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 p-4 sm:p-5 rounded-2xl border-2 border-emerald-200/90 border-t-4 border-t-emerald-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Departments</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Building size={15} />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2 tabular-nums">{metrics?.totalDepartments || 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">CSA, CSE, AIDS</p>
        </div>

        <div className="bg-gradient-to-br from-white to-violet-50/50 p-4 sm:p-5 rounded-2xl border-2 border-violet-200/90 border-t-4 border-t-violet-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Degree Programs</span>
            <span className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
              <BookOpen size={15} />
            </span>
          </div>
          <p className="text-2xl font-black text-violet-900 mt-2 tabular-nums">{metrics?.totalCourses || 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">MCA, B.Tech</p>
        </div>

        <div className="bg-gradient-to-br from-white to-amber-50/50 p-4 sm:p-5 rounded-2xl border-2 border-amber-200/90 border-t-4 border-t-amber-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Active Batches</span>
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Calendar size={15} />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-800 mt-2 tabular-nums">{metrics?.totalBatches || 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">Cohorts 2023-28</p>
        </div>

        <div className="bg-gradient-to-br from-white to-rose-50/50 p-4 sm:p-5 rounded-2xl border-2 border-rose-200/90 border-t-4 border-t-rose-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Repository Files</span>
            <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Award size={15} />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-800 mt-2 tabular-nums">{metrics?.totalMaterials || 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">Uploaded resources</p>
        </div>
      </div>

      {/* 3. Executive Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/admin/results"
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Award size={20} />
            </div>
            <ArrowUpRight size={18} className="text-slate-400 group-hover:text-amber-600 transition" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Official Semester Examinations & Grade Cards</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Publish official university semester examination grades, generate student transcripts, and verify SGPA.
          </p>
        </Link>

        <Link
          to="/attendance/report"
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle size={20} />
            </div>
            <ArrowUpRight size={18} className="text-slate-400 group-hover:text-emerald-600 transition" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Institutional Attendance Compliance Audit</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Review cohort-by-cohort attendance rates and identify students at risk of shortage (&lt;75%).
          </p>
        </Link>

        <Link
          to="/analytics"
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={20} />
            </div>
            <ArrowUpRight size={18} className="text-slate-400 group-hover:text-rose-600 transition" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Early Warning & Academic Intelligence</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Multi-factor explainable risk engine analyzing attendance, CIA exam performance, and coursework compliance.
          </p>
        </Link>
      </div>

      {/* 4. Academic Structure & Degree Programs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building size={18} className="text-brand-600" />
            <h3 className="text-sm font-extrabold text-slate-900">Degree Programs & Departments Hierarchy</h3>
          </div>
          <Link to="/admin/academics" className="text-xs font-bold text-brand-600 hover:text-brand-700">
            Configure Academic Hierarchy →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="pb-3">Program Code</th>
                <th className="pb-3">Degree Program Name</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3">Semesters</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => (
                <tr key={course._id} className="hover:bg-slate-50">
                  <td className="py-3 font-mono font-bold text-slate-700">{course.code}</td>
                  <td className="py-3 font-bold text-slate-900">{course.name}</td>
                  <td className="py-3 text-slate-600">{course.department?.name || 'Department'}</td>
                  <td className="py-3 text-slate-600">{course.durationYears} Years</td>
                  <td className="py-3 text-slate-600">{course.totalSemesters} Semesters</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
