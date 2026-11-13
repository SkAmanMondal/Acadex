import express from 'express';
import {
  createAssignment,
  getAssignments,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissionsForAssignment,
  uploadAssignmentFile,
} from './assignments.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getAssignments);
router.post('/', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), uploadAssignmentFile.single('file'), createAssignment);
router.put('/:assignmentId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), uploadAssignmentFile.single('file'), updateAssignment);
router.delete('/:assignmentId', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), deleteAssignment);
router.post('/:assignmentId/submit', authenticate, authorizeRoles('student'), uploadAssignmentFile.single('file'), submitAssignment);
router.get('/:assignmentId/submissions', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), getSubmissionsForAssignment);
router.patch('/submissions/:submissionId/grade', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), gradeSubmission);

export default router;
