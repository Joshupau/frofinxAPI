import { Router } from 'express';
import { protectusers } from '../middleware/middleware.js';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createBudgetSchema,
  updateBudgetSchema,
  listBudgetsQuerySchema,
  currentBudgetsQuerySchema,
  budgetStatusQuerySchema
} from '../cvalidator/budgets.validation.js';
import * as ctrl from '../controllers/budgets.js';

const router = Router();

router
  .post('/create', protectusers, zodBody(createBudgetSchema), ctrl.create)
  .get('/list', protectusers, zodQuery(listBudgetsQuerySchema), ctrl.list)
  .post('/update', protectusers, zodBody(updateBudgetSchema), ctrl.update)
  .get('/current', protectusers, zodQuery(currentBudgetsQuerySchema), ctrl.getCurrent)
  .get('/status', protectusers, zodQuery(budgetStatusQuerySchema), ctrl.checkStatus)
  .get('/summary', protectusers, ctrl.getSummary);

export default router;
