import express from 'express';
import {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
  getQuizAttempts,
} from './quizzes.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getQuizzes);
router.get('/:id', authenticate, getQuizById);
router.post('/', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), createQuiz);
router.put('/:id', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), updateQuiz);
router.delete('/:id', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), deleteQuiz);
router.post('/:id/submit', authenticate, authorizeRoles('student'), submitQuiz);
router.get('/:id/attempts', authenticate, authorizeRoles('teacher', 'hod', 'college_admin', 'super_admin'), getQuizAttempts);

export default router;
