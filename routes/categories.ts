import { Router } from 'express';
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
  .post('/create', zodBody(createCategorySchema), ctrl.create)
  .get('/list', zodQuery(listCategoriesQuerySchema), ctrl.list)
  .post('/update', zodBody(updateCategorySchema), ctrl.update)
  .post('/archive', zodBody(archiveCategorySchema), ctrl.archive)
  .get('/summary', ctrl.getSummary);

export default router;
