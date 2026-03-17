import { Router } from 'express';
import multer from 'multer';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  deleteTransactionSchema,
  listTransactionsQuerySchema,
  monthlyReportQuerySchema,
  categoryBreakdownQuerySchema,
  dashboardSummaryQuerySchema,
  quickStatsQuerySchema,
  spentTodayQuerySchema,
  analyticsQuerySchema,
  topCategoryTodayQuerySchema,
  chartDataQuerySchema
} from '../cvalidator/transactions.validation.js';
import * as ctrl from '../controllers/transactions.js';

const router = Router();

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'text/csv'
      || file.mimetype === 'text/plain'
      || file.originalname.toLowerCase().endsWith('.csv');
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted.'));
    }
  }
});

router
  .post('/create', zodBody(createTransactionSchema), ctrl.create)
  .get('/list', zodQuery(listTransactionsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateTransactionSchema), ctrl.update)
  .post('/delete', zodBody(deleteTransactionSchema), ctrl.deleteTransaction)
  .get('/report/monthly', zodQuery(monthlyReportQuerySchema), ctrl.getMonthlyReport)
  .get('/report/category', zodQuery(categoryBreakdownQuerySchema), ctrl.getCategoryBreakdown)
  .post('/import', csvUpload.single('file'), ctrl.importTransactions)
  .get('/summary', zodQuery(dashboardSummaryQuerySchema), ctrl.getSummary)
  .get('/quick-stats', zodQuery(quickStatsQuerySchema), ctrl.getQuickStats)
  .get('/chart-data', zodQuery(chartDataQuerySchema), ctrl.getChartData)
  .get('/spent-today', zodQuery(spentTodayQuerySchema), ctrl.getSpentToday)
  .get('/analytics', zodQuery(analyticsQuerySchema), ctrl.getAnalytics)
  .get('/top-category-today', zodQuery(topCategoryTodayQuerySchema), ctrl.getTopCategoryToday)
  .get('/tags', ctrl.getAllTags);

export default router;
