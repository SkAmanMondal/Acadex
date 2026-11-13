import React from 'react';
import { useAuth } from '../context/AuthContext';
import StudentDashboard from '../components/dashboard/StudentDashboard';
import TeacherDashboard from '../components/dashboard/TeacherDashboard';
import HodDashboard from '../components/dashboard/HodDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';

export default function DashboardOverview() {
  const { user, isTeacher, isHod, isAdmin, isStudent } = useAuth();

  if (isAdmin) {
    return <AdminDashboard user={user} />;
  }

  if (isHod) {
    return <HodDashboard user={user} />;
  }

  if (isTeacher) {
    return <TeacherDashboard user={user} />;
  }

  if (isStudent) {
    return <StudentDashboard user={user} />;
  }

  // Fallback to Student Dashboard
  return <StudentDashboard user={user} />;
}
