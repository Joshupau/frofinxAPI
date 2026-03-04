import { Router } from 'express';
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
  .post('/create', zodBody(createTransactionSchema), ctrl.create)
  .get('/list', zodQuery(listTransactionsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateTransactionSchema), ctrl.update)
  .post('/delete', zodBody(deleteTransactionSchema), ctrl.deleteTransaction)
  .get('/report/monthly', zodQuery(monthlyReportQuerySchema), ctrl.getMonthlyReport)
  .get('/report/category', zodQuery(categoryBreakdownQuerySchema), ctrl.getCategoryBreakdown);

export default router;
