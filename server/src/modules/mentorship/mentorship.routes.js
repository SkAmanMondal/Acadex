import express from 'express';
import {
  createSupportRequest,
  getMySupportRequests,
  updateSupportRequest,
  deleteSupportRequest,
  getMyMentees,
  logMentorshipSession,
} from './mentorship.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.post('/requests', authenticate, createSupportRequest);
router.get('/requests', authenticate, getMySupportRequests);
router.patch('/requests/:id', authenticate, updateSupportRequest);
router.delete('/requests/:id', authenticate, deleteSupportRequest);
router.get('/mentees', authenticate, getMyMentees);
router.post('/counseling-log', authenticate, logMentorshipSession);

export default router;
