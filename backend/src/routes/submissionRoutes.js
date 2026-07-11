import express from 'express';
import {
  runCode,
  submitQuestion,
  submitExam,
  getAdminSubmissions,
  getStudentSubmissionStatus,
  allowRetest,
} from '../controllers/submissionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { codeExecutionLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Code running & grading triggers
router.post('/run', requireAuth, codeExecutionLimiter, runCode);
router.post('/submit-question', requireAuth, codeExecutionLimiter, submitQuestion);
router.post('/submit-exam', requireAuth, submitExam);

// Submission status retrieval
router.get('/admin/test/:testId', requireAuth, requireRole(['ADMIN']), getAdminSubmissions);
router.get('/student/test/:testId', requireAuth, getStudentSubmissionStatus);
router.delete('/admin/:submissionId/retest', requireAuth, requireRole(['ADMIN']), allowRetest);

export default router;
