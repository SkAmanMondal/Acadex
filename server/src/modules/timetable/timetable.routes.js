import express from 'express';
import {
  createTimetableEntry,
  getTimetables,
  updateTimetableEntry,
  deleteTimetableEntry,
  validateTimetableSlot,
} from './timetable.controller.js';
import {
  getDailyClasses,
  pauseDailyClass,
  substituteFaculty,
  substituteFacultyForDay,
  getClassAbsentees,
  getMissedClasses,
} from './dailyClass.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

// Master Weekly Timetable Routes
router.get('/', authenticate, getTimetables);
router.post('/validate-slot', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), validateTimetableSlot);
router.post('/', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), createTimetableEntry);
router.put('/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), updateTimetableEntry);
router.delete('/:id', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), deleteTimetableEntry);

// Daily Live Schedule & Substitution Operations
router.get('/daily-classes', authenticate, getDailyClasses);
router.get('/daily-classes/missed-classes', authenticate, getMissedClasses);
router.get('/daily-classes/:id/absentees', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), getClassAbsentees);
router.patch('/daily-classes/:id/pause', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), pauseDailyClass);
router.patch('/daily-classes/:id/substitute', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), substituteFaculty);
router.post('/daily-classes/substitute-day', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod'), substituteFacultyForDay);

export default router;
