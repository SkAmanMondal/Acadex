import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-xs font-semibold">
        Verifying Acadex session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    // Role inheritance: 'hod' satisfies 'teacher' checks
    const hasRole = allowedRoles.includes(role) || (allowedRoles.includes('teacher') && role === 'hod');
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
