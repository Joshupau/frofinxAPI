import { Router } from 'express';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createInvestmentSchema,
  updateInvestmentSchema,
  updateInvestmentValueSchema,
  recordInvestmentReturnSchema,
  sellInvestmentSchema,
  listInvestmentsQuerySchema,
  deleteInvestmentSchema
} from '../cvalidator/investments.validation.js';
import * as ctrl from '../controllers/investments.js';

const router = Router();

router
  .post('/create', zodBody(createInvestmentSchema), ctrl.create)
  .get('/list', zodQuery(listInvestmentsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateInvestmentSchema), ctrl.update)
  .post('/delete', zodBody(deleteInvestmentSchema), ctrl.deleteInvestment)
  .post('/update-value', zodBody(updateInvestmentValueSchema), ctrl.updateValue)
  .post('/record-return', zodBody(recordInvestmentReturnSchema), ctrl.recordReturn)
  .post('/sell', zodBody(sellInvestmentSchema), ctrl.sell)
  .get('/summary', ctrl.getSummary);

export default router;
