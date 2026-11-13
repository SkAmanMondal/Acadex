import express from 'express';
import {
  createExamination,
  deleteExamination,
  getExaminations,
  enterInternalMarks,
  enterSemesterMarks,
  updateExamResult,
  deleteExamResult,
  getStudentResults,
  getStudentTranscript,
} from './examinations.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getExaminations);
router.post('/', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createExamination);
router.delete('/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), deleteExamination);

// Marks entry with strict separation of duties
router.post('/internal-marks', authenticate, authorizeRoles('teacher', 'hod'), enterInternalMarks);
router.post('/semester-marks', authenticate, authorizeRoles('college_admin', 'super_admin'), enterSemesterMarks);
router.put('/results/:id', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), updateExamResult);
router.delete('/results/:id', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), deleteExamResult);

// Results access
router.get('/student-results', authenticate, getStudentResults);
router.get('/student-results/:studentId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), getStudentResults);

// Comprehensive Official Grade Card / Academic Transcript
router.get('/transcript', authenticate, getStudentTranscript);
router.get('/transcript/:studentId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), getStudentTranscript);

export default router;
