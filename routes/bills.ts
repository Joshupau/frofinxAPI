import { Router } from 'express';
import { protectusers } from '../middleware/middleware.js';
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
  .post('/create', protectusers, zodBody(createBillSchema), ctrl.create)
  .get('/list', protectusers, zodQuery(listBillsQuerySchema), ctrl.list)
  .post('/update', protectusers, zodBody(updateBillSchema), ctrl.update)
  .post('/mark-paid', protectusers, zodBody(markPaidSchema), ctrl.markPaid)
  .post('/mark-unpaid', protectusers, zodBody(markUnpaidSchema), ctrl.markUnpaid)
  .get('/upcoming', protectusers, zodQuery(upcomingBillsQuerySchema), ctrl.getUpcoming)
  .get('/overdue', protectusers, ctrl.getOverdue)
  .get('/summary', protectusers, ctrl.getSummary);

export default router;
