import { Router } from 'express';
import { protectusers } from '../middleware/middleware.js';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  deleteTransactionSchema,
  listTransactionsQuerySchema,
  monthlyReportQuerySchema,
  categoryBreakdownQuerySchema
} from '../cvalidator/transactions.validation.js';
import * as ctrl from '../controllers/transactions.js';

const router = Router();

router
  .post('/create', protectusers, zodBody(createTransactionSchema), ctrl.create)
  .get('/list', protectusers, zodQuery(listTransactionsQuerySchema), ctrl.list)
  .post('/update', protectusers, zodBody(updateTransactionSchema), ctrl.update)
  .post('/delete', protectusers, zodBody(deleteTransactionSchema), ctrl.deleteTransaction)
  .get('/report/monthly', protectusers, zodQuery(monthlyReportQuerySchema), ctrl.getMonthlyReport)
  .get('/report/category', protectusers, zodQuery(categoryBreakdownQuerySchema), ctrl.getCategoryBreakdown);

export default router;
