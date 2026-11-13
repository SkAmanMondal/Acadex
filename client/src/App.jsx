import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import ClassroomKioskScanner from './pages/kiosk/ClassroomKioskScanner';
import DashboardOverview from './pages/DashboardOverview';
import TimetablePage from './pages/timetables/TimetablePage';
import MaterialsPage from './pages/materials/MaterialsPage';
import AssignmentsPage from './pages/assignments/AssignmentsPage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import MentorshipPage from './pages/mentorship/MentorshipPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import StudentQrPage from './pages/student/StudentQrPage';
import ClassroomScanner from './pages/teacher/ClassroomScanner';
import InternalMarksPage from './pages/examinations/InternalMarksPage';
import SemesterGradeCardPage from './pages/examinations/SemesterGradeCardPage';
import QuizzesPage from './pages/quizzes/QuizzesPage';
import MessagesPage from './pages/communication/MessagesPage';
import AttendanceReportPage from './pages/attendance/AttendanceReportPage';
import StudentCurriculumPage from './pages/curriculum/StudentCurriculumPage';
import AdminAcademicsPage from './pages/admin/AdminAcademicsPage';
import AdminTeachersPage from './pages/admin/AdminTeachersPage';
import AdminStudentsPage from './pages/admin/AdminStudentsPage';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Kiosk for Classroom Podium PC (No login required) */}
          <Route path="/kiosk" element={<ClassroomKioskScanner />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardOverview />} />
            <Route path="timetables" element={<TimetablePage />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="material" element={<Navigate to="/materials" replace />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="assignment" element={<Navigate to="/assignments" replace />} />
            <Route path="quizzes" element={<QuizzesPage />} />
            <Route path="quiz" element={<Navigate to="/quizzes" replace />} />
            <Route path="attendance/report" element={<AttendanceReportPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="message" element={<Navigate to="/messages" replace />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="announcement" element={<Navigate to="/announcements" replace />} />
            <Route path="mentorship" element={<MentorshipPage />} />

            {/* Student Specific */}
            <Route
              path="student/qr"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentQrPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="student/curriculum"
              element={
                <ProtectedRoute allowedRoles={['student', 'teacher', 'hod', 'college_admin', 'super_admin']}>
                  <StudentCurriculumPage />
                </ProtectedRoute>
              }
            />
            <Route path="curriculum" element={<Navigate to="/student/curriculum" replace />} />

            {/* Teacher / Classroom Specific */}
            <Route
              path="teacher/scanner"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'hod', 'college_admin']}>
                  <ClassroomScanner />
                </ProtectedRoute>
              }
            />

            {/* Examinations & Marks */}
            <Route
              path="examinations/internals"
              element={<InternalMarksPage />}
            />
            <Route
              path="examinations/transcript"
              element={<SemesterGradeCardPage />}
            />
            <Route
              path="admin/results"
              element={<SemesterGradeCardPage />}
            />
            <Route
              path="student/results"
              element={<SemesterGradeCardPage />}
            />

            {/* Analytics */}
            <Route
              path="analytics"
              element={
                <ProtectedRoute allowedRoles={['college_admin', 'super_admin', 'hod', 'teacher']}>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin & HOD Scoped Pages */}
            <Route
              path="admin/academics"
              element={
                <ProtectedRoute allowedRoles={['college_admin', 'super_admin', 'hod']}>
                  <AdminAcademicsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/teachers"
              element={
                <ProtectedRoute allowedRoles={['college_admin', 'super_admin']}>
                  <AdminTeachersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/students"
              element={
                <ProtectedRoute allowedRoles={['college_admin', 'super_admin', 'hod']}>
                  <AdminStudentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="hod/students"
              element={
                <ProtectedRoute allowedRoles={['hod', 'college_admin', 'super_admin']}>
                  <AdminStudentsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  </AuthProvider>
  );
}
