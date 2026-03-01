import { Router } from 'express';
import { protectusers } from '../middleware/middleware.js';
import { zodBody, zodQuery } from '../cvalidator/zod.middleware.js';
import {
  createWalletSchema,
  updateWalletSchema,
  adjustBalanceSchema,
  archiveWalletSchema,
  listWalletsQuerySchema,
  getWalletQuerySchema
} from '../cvalidator/wallets.validation.js';
import * as ctrl from '../controllers/wallets.js';

const router = Router();

router
  .post('/create', protectusers, zodBody(createWalletSchema), ctrl.create)
  .get('/list', protectusers, zodQuery(listWalletsQuerySchema), ctrl.list)
  .get('/get', protectusers, zodQuery(getWalletQuerySchema), ctrl.getById)
  .post('/update', protectusers, zodBody(updateWalletSchema), ctrl.update)
  .post('/adjust-balance', protectusers, zodBody(adjustBalanceSchema), ctrl.adjustBalance)
  .post('/archive', protectusers, zodBody(archiveWalletSchema), ctrl.archive)
  .get('/total-balance', protectusers, zodQuery(listWalletsQuerySchema), ctrl.getTotalBalance);

export default router;
