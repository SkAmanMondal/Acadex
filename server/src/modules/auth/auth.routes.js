import express from 'express';
import { login, getMe, bootstrapAdmin, getLoginDirectory } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/directory', getLoginDirectory);
router.post('/bootstrap-admin', bootstrapAdmin);
router.get('/me', authenticate, getMe);

export default router;
