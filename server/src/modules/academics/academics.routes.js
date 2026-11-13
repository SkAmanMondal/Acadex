import express from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  assignBatchMentor,
  getClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
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
router.delete('/departments/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), deleteDepartment);

router.post('/courses', authenticate, authorizeRoles('college_admin', 'super_admin'), createCourse);
router.put('/courses/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), updateCourse);
router.delete('/courses/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), deleteCourse);

router.post('/batches', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createBatch);
router.put('/batches/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateBatch);
router.delete('/batches/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), deleteBatch);
router.post('/batches/:id/assign-mentor', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), assignBatchMentor);

router.post('/classrooms', authenticate, authorizeRoles('college_admin', 'super_admin'), createClassroom);
router.put('/classrooms/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), updateClassroom);
router.delete('/classrooms/:id', authenticate, authorizeRoles('college_admin', 'super_admin'), deleteClassroom);

router.post('/subjects', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createSubject);
router.put('/subjects/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateSubject);
router.delete('/subjects/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), deleteSubject);

export default router;
