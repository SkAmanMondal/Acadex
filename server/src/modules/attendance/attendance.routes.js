import express from 'express';
import {
  getMyQrToken,
  activateSession,
  getSessionById,
  scanStudentQr,
  getSessionRecords,
  getStudentAttendanceAnalytics,
  getBatchAttendanceReport,
  getKioskSession,
  scanKioskQr,
  manualRecordAttendance,
  updateAttendanceRecord,
  getStudentSessionRecords,
  startDirectTeacherScanner,
  endSessionEarly,
  cancelSession,
  getActiveSessionForUser,
} from './attendance.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

// Public Classroom Kiosk Terminal (No teacher login required on classroom PC)
router.get('/kiosk/session/:sessionCode', getKioskSession);
router.post('/kiosk/scan', scanKioskQr);

// Student dynamic QR endpoint
router.get('/student/qr-token', authenticate, getMyQrToken);

// Teacher/Classroom session endpoints (Authenticated)
router.get('/active-session', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), getActiveSessionForUser);
router.post('/session/activate', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), activateSession);
router.get('/session/:id', authenticate, getSessionById);
router.post('/session/:id/start-direct', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), startDirectTeacherScanner);
router.post('/session/:id/end', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), endSessionEarly);
router.post('/session/:id/cancel', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), cancelSession);
router.post('/session/:id/scan', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), scanStudentQr);
router.get('/session/:id/records', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), getSessionRecords);

// Analytics endpoints
router.get('/student-stats', authenticate, getStudentAttendanceAnalytics);
router.get('/student-stats/:studentId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), getStudentAttendanceAnalytics);
router.get('/batch-report/:batchId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), getBatchAttendanceReport);

// Manual attendance records & overrides (Teacher / HOD / Admin)
router.post('/manual-record', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), manualRecordAttendance);
router.put('/records/:recordId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), updateAttendanceRecord);
router.get('/student/:studentId/records', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), getStudentSessionRecords);

export default router;
