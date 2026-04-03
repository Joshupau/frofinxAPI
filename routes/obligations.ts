import { Router } from 'express';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createObligationSchema,
  updateObligationSchema,
  recordPaymentSchema,
  listObligationsQuerySchema,
  deleteObligationSchema
} from '../cvalidator/obligations.validation.js';
import * as ctrl from '../controllers/obligations.js';

const router = Router();

router
  .post('/create', zodBody(createObligationSchema), ctrl.create)
  .get('/list', zodQuery(listObligationsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateObligationSchema), ctrl.update)
  .post('/delete', zodBody(deleteObligationSchema), ctrl.deleteObligation)
  .post('/record-payment', zodBody(recordPaymentSchema), ctrl.recordPayment)
  .get('/summary', ctrl.getSummary);

export default router;
