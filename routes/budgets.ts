import { Router } from 'express';
import { z } from 'zod';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createBudgetSchema,
  updateBudgetSchema,
  listBudgetsQuerySchema,
  currentBudgetsQuerySchema,
  budgetStatusQuerySchema,
  budgetRolloverSchema
} from '../cvalidator/budgets.validation.js';
import * as ctrl from '../controllers/budgets.js';

const router = Router();

router
  .post('/create', zodBody(createBudgetSchema), ctrl.create)
  .get('/list', zodQuery(listBudgetsQuerySchema), ctrl.list)
  .post('/update', zodBody(updateBudgetSchema), ctrl.update)
  .get('/current', zodQuery(currentBudgetsQuerySchema), ctrl.getCurrent)
  .get('/status', zodQuery(budgetStatusQuerySchema), ctrl.checkStatus)
  .post('/rollover', zodBody(budgetRolloverSchema), ctrl.rolloverBudget)
  .get('/performance', ctrl.getPerformance)
  .get('/suggestions', ctrl.getSuggestions)
  .get('/summary', ctrl.getSummary);

export default router;
