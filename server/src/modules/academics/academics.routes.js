import express from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  getCourses,
  createCourse,
  updateCourse,
  getBatches,
  createBatch,
  updateBatch,
  assignBatchMentor,
  getClassrooms,
  createClassroom,
  updateClassroom,
  getSubjects,
  createSubject,
  updateSubject,
  getStudentCurriculumAttendance,
} from './academics.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

// Read routes available to authenticated users
router.get('/departments', authenticate, getDepartments);
router.get('/courses', authenticate, getCourses);
router.get('/batches', authenticate, getBatches);
router.get('/classrooms', authenticate, getClassrooms);
router.get('/subjects', authenticate, getSubjects);
router.get('/student/curriculum', authenticate, getStudentCurriculumAttendance);

// Management routes (College Admin and HOD for department subjects)
router.post('/departments', authenticate, authorizeRoles('college_admin', 'super_admin'), createDepartment);
router.put('/departments/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), updateDepartment);

router.post('/courses', authenticate, authorizeRoles('college_admin', 'super_admin'), createCourse);
router.put('/courses/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), updateCourse);

router.post('/batches', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createBatch);
router.put('/batches/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateBatch);
router.post('/batches/:id/assign-mentor', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), assignBatchMentor);

router.post('/classrooms', authenticate, authorizeRoles('college_admin', 'super_admin'), createClassroom);
router.put('/classrooms/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), updateClassroom);

router.post('/subjects', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createSubject);
router.put('/subjects/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateSubject);

export default router;
