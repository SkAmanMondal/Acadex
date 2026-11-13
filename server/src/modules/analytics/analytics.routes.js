import express from 'express';
import { getAcademicRiskIndicators, getDashboardMetrics } from './analytics.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

router.get('/dashboard-metrics', authenticate, getDashboardMetrics);
router.get('/risk-indicators', authenticate, authorizeRoles('college_admin', 'super_admin', 'hod', 'teacher'), getAcademicRiskIndicators);

export default router;
