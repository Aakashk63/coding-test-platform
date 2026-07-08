import express from 'express';
import { recordViolation, getStudentProctoringLogs } from '../controllers/proctorController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/violation', requireAuth, recordViolation);
router.get('/admin/test/:testId/student/:studentId', requireAuth, requireRole(['ADMIN']), getStudentProctoringLogs);

export default router;
