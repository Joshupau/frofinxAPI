import { Router } from 'express';
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
  .post('/create', zodBody(createWalletSchema), ctrl.create)
  .get('/list', zodQuery(listWalletsQuerySchema), ctrl.list)
  .get('/get', zodQuery(getWalletQuerySchema), ctrl.getById)
  .post('/update', zodBody(updateWalletSchema), ctrl.update)
  .post('/adjust-balance', zodBody(adjustBalanceSchema), ctrl.adjustBalance)
  .post('/archive', zodBody(archiveWalletSchema), ctrl.archive)
  .get('/total-balance', zodQuery(listWalletsQuerySchema), ctrl.getTotalBalance);

export default router;
