import express from 'express';
import { recordViolation, getStudentProctoringLogs, resumeStudentExam } from '../controllers/proctorController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/violation', requireAuth, recordViolation);
router.get('/admin/test/:testId/student/:studentId', requireAuth, requireRole(['ADMIN']), getStudentProctoringLogs);
router.post('/admin/test/:testId/student/:studentId/resume', requireAuth, requireRole(['ADMIN']), resumeStudentExam);

export default router;
