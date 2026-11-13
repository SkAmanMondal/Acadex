import express from 'express';
import {
  createTeacher,
  getTeachers,
  updateTeacher,
  toggleTeacherMentor,
  assignTeacherSubjects,
  createStudent,
  bulkImportStudents,
  getStudents,
  updateStudent,
  assignMentor,
} from './users.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

// Teacher management
router.post('/teachers', authenticate, authorizeRoles('college_admin', 'super_admin'), createTeacher);
router.get('/teachers', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod', 'teacher'), getTeachers);
router.put('/teachers/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateTeacher);
router.patch('/teachers/:id/toggle-mentor', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), toggleTeacherMentor);
router.post('/teachers/assign-subject', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), assignTeacherSubjects);

// Student management
router.post('/students', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createStudent);
router.get('/students', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod', 'teacher'), getStudents);
router.put('/students/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateStudent);
router.post('/students/bulk-import', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), bulkImportStudents);
router.post('/students/assign-mentor', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), assignMentor);

export default router;
