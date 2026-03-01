import { Router } from 'express';
import { protectusers } from '../middleware/middleware.js';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  archiveCategorySchema,
  listCategoriesQuerySchema
} from '../cvalidator/categories.validation.js';
import * as ctrl from '../controllers/categories.js';

const router = Router();

router
  .post('/create', protectusers, zodBody(createCategorySchema), ctrl.create)
  .get('/list', protectusers, zodQuery(listCategoriesQuerySchema), ctrl.list)
  .post('/update', protectusers, zodBody(updateCategorySchema), ctrl.update)
  .post('/archive', protectusers, zodBody(archiveCategorySchema), ctrl.archive)
  .get('/summary', protectusers, ctrl.getSummary);

export default router;
