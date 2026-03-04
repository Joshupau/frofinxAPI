import { Router } from 'express';
import * as gpCtrl from '../controllers/globalpass.js';
import { zodBody } from '../cvalidator/zod.middleware.js';
import { createPassSchema, getusagehistory } from '../cvalidator/globalpass.validation.js';

const router = Router();

router
    .post("/create", zodBody(createPassSchema), gpCtrl.createGlobalPass)
    .get("/getusagehistory", getusagehistory, gpCtrl.getusagehistory)

export default router;