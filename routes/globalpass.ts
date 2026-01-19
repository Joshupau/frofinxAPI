import { Router } from 'express';
import { protectsuperadmin } from '../middleware/middleware.js';
import * as gpCtrl from '../controllers/globalpass.js';
import { zodBody } from '../cvalidator/zod.middleware.js';
import { createPassSchema, getusagehistory } from '../cvalidator/globalpass.validation.js';

const router = Router();

router
    .post("/create", protectsuperadmin, zodBody(createPassSchema), gpCtrl.createGlobalPass)
    .get("/getusagehistory", protectsuperadmin, getusagehistory, gpCtrl.getusagehistory)

export default router;