import express from 'express';
import {
  uploadMaterial,
  getMaterials,
  updateMaterial,
  deleteMaterial,
  incrementDownloadCount,
  downloadMaterialFile,
  viewMaterialFile,
  uploadMiddleware,
} from './materials.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getMaterials);
router.get('/:id/download', downloadMaterialFile);
router.get('/:id/download-file', downloadMaterialFile);
router.get('/:id/view', viewMaterialFile);
router.post('/upload', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), uploadMiddleware.single('file'), uploadMaterial);
router.put('/:id', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), uploadMiddleware.single('file'), updateMaterial);
router.delete('/:id', authenticate, authorizeRoles('teacher', 'hod', 'college_admin'), deleteMaterial);
router.patch('/:id/download', authenticate, incrementDownloadCount);

export default router;
