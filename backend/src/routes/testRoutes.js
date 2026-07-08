import express from 'express';
import {
  createTest,
  getAdminTests,
  getAdminTestById,
  verifyTestId,
  getStudentTestById,
  getDashboardStats,
  deleteTest,
  updateTest,
} from '../controllers/testController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Admin routes
router.post('/', requireAuth, requireRole(['ADMIN']), createTest);
router.get('/admin', requireAuth, requireRole(['ADMIN']), getAdminTests);
router.get('/admin/dashboard', requireAuth, requireRole(['ADMIN']), getDashboardStats);
router.get('/admin/:id', requireAuth, requireRole(['ADMIN']), getAdminTestById);
router.put('/admin/:id', requireAuth, requireRole(['ADMIN']), updateTest);
router.delete('/admin/:id', requireAuth, requireRole(['ADMIN']), deleteTest);

// Student routes
router.post('/verify', requireAuth, verifyTestId);
router.get('/student/:id', requireAuth, getStudentTestById);

export default router;
