import { Router } from 'express';
import { protectsuperadmin, protectallusers } from '../middleware/middleware.js';
import { zodQuery, zodBody } from '../cvalidator/zod.middleware.js';
import {
    changeMaintenanceBodySchema,
    getEventMainteQuerySchema
} from '../cvalidator/maintenance.validation.js';
import * as ctrl from '../controllers/maintenance.js';

const router = Router();

const maintenanceRoute = router
    .get('/getmaintenance', protectallusers, ctrl.getmaintenance)
    .post('/changemaintenance', protectsuperadmin, zodBody(changeMaintenanceBodySchema), ctrl.changemaintenance)
    .get('/geteventmainte', protectallusers, zodQuery(getEventMainteQuerySchema), ctrl.geteventmainte);

export default maintenanceRoute;
