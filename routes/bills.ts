import { Router } from 'express';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createBillSchema,
  updateBillSchema,
  markPaidSchema,
  markUnpaidSchema,
  listBillsQuerySchema,
  upcomingBillsQuerySchema
} from '../cvalidator/bills.validation.js';
import * as ctrl from '../controllers/bills.js';

const router = Router();

router
  .post('/create', zodBody(createBillSchema), ctrl.create)
  .get('/list', zodQuery(listBillsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateBillSchema), ctrl.update)
  .post('/mark-paid', zodBody(markPaidSchema), ctrl.markPaid)
  .post('/mark-unpaid', zodBody(markUnpaidSchema), ctrl.markUnpaid)
  .get('/upcoming', zodQuery(upcomingBillsQuerySchema), ctrl.getUpcoming)
  .get('/overdue', ctrl.getOverdue)
  .get('/summary', ctrl.getSummary);

export default router;
