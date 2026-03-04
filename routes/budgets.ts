import { Router } from 'express';
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
  .post('/create', zodBody(createBudgetSchema), ctrl.create)
  .get('/list', zodQuery(listBudgetsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateBudgetSchema), ctrl.update)
  .get('/current', zodQuery(currentBudgetsQuerySchema), ctrl.getCurrent)
  .get('/status', zodQuery(budgetStatusQuerySchema), ctrl.checkStatus)
  .get('/summary', ctrl.getSummary);

export default router;
