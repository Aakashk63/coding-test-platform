import express from 'express';
import { downloadCSVReport, getHTMLReport } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/test/:testId/csv', requireAuth, requireRole(['ADMIN']), downloadCSVReport);
router.get('/test/:testId/html', requireAuth, requireRole(['ADMIN']), getHTMLReport);

export default router;
