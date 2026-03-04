import { Router } from 'express';
import { zodQuery, zodBody } from '../cvalidator/zod.middleware.js';
import {
    changeMaintenanceBodySchema,
    getEventMainteQuerySchema
} from '../cvalidator/maintenance.validation.js';
import * as ctrl from '../controllers/maintenance.js';

const router = Router();

const maintenanceRoute = router
    .get('/getmaintenance', ctrl.getmaintenance)
    .post('/changemaintenance', zodBody(changeMaintenanceBodySchema), ctrl.changemaintenance)
    .get('/geteventmainte', zodQuery(getEventMainteQuerySchema), ctrl.geteventmainte);

export default maintenanceRoute;
