import { Router } from 'express';
import { protectsuperadmin, protectadmin } from '../middleware/middleware.js';
import { zodQuery, zodBody } from '../cvalidator/zod.middleware.js';
import {
    banUnbanUserBodySchema,
    multipleBanStaffUsersBodySchema,
    getAdminListQuerySchema,
    updateAdminBodySchema,
    changePassBodySchema,
    searchAdminListQuerySchema
} from '../cvalidator/staffuser.validation.js';
import * as ctrl from '../controllers/staffuser.js';

const router = Router();

const staffuserRoute = router
    .get('/getadminlist', protectsuperadmin, zodQuery(getAdminListQuerySchema), ctrl.getadminlist)
    .get('/searchadminlist', protectsuperadmin, zodQuery(searchAdminListQuerySchema), ctrl.searchadminlist)
    .post('/updateadmin', protectsuperadmin, zodBody(updateAdminBodySchema), ctrl.updateadmin)
    .post('/multiplebanstaffusers', protectsuperadmin, zodBody(multipleBanStaffUsersBodySchema), ctrl.multiplebanstaffusers)
    .post('/changepasssuperadmin', protectsuperadmin, zodBody(changePassBodySchema), ctrl.changepass)
    .post('/changepasadmin', protectadmin, zodBody(changePassBodySchema), ctrl.changepass)
    .post('/banunbanuser', protectsuperadmin, zodBody(banUnbanUserBodySchema), ctrl.banunbanuser);

export default staffuserRoute;
