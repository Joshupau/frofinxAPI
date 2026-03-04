import { Router } from 'express';
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
    .get('/getadminlist', zodQuery(getAdminListQuerySchema), ctrl.getadminlist)
    .get('/searchadminlist', zodQuery(searchAdminListQuerySchema), ctrl.searchadminlist)
    .post('/updateadmin', zodBody(updateAdminBodySchema), ctrl.updateadmin)
    .post('/multiplebanstaffusers', zodBody(multipleBanStaffUsersBodySchema), ctrl.multiplebanstaffusers)
    .post('/changepasssuperadmin', zodBody(changePassBodySchema), ctrl.changepass)
    .post('/changepasadmin', zodBody(changePassBodySchema), ctrl.changepass)
    .post('/banunbanuser', zodBody(banUnbanUserBodySchema), ctrl.banunbanuser);

export default staffuserRoute;
