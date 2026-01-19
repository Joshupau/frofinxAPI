import { Router } from 'express';
import { protectsuperadmin, protectusers } from '../middleware/middleware.js';
import { zodQuery, zodBody } from '../cvalidator/zod.middleware.js';
import {
    getUserDetailsSuperadminQuerySchema,
    changePasswordUserBodySchema,
    changePasswordUserForAdminBodySchema,
    updateUserProfileBodySchema,
    searchPlayerListQuerySchema,
    getPlayerListQuerySchema,
    banUnbanUserBodySchema,
    multipleBanUsersBodySchema
} from '../cvalidator/user.validation.js';
import * as ctrl from '../controllers/user.js';

const router = Router();

router
    .get('/getreferrallink', protectusers, ctrl.getreferrallink)
    .get('/getuserdetails', protectusers, ctrl.getuserdetails)
    .post('/changepassworduser', protectusers, zodBody(changePasswordUserBodySchema), ctrl.changepassworduser)
    .post('/updateuserprofile', protectusers, zodBody(updateUserProfileBodySchema), ctrl.updateuserprofile)

router
    .get('/getuserdetailssuperadmin', protectsuperadmin, zodQuery(getUserDetailsSuperadminQuerySchema), ctrl.getuserdetailssuperadmin)
    .post('/changepassworduserforadmin', protectsuperadmin, zodBody(changePasswordUserForAdminBodySchema), ctrl.changepassworduserforadmin)
    .get('/searchplayerlist', protectsuperadmin, zodQuery(searchPlayerListQuerySchema), ctrl.searchplayerlist)
    .get('/getplayerlist', protectsuperadmin, zodQuery(getPlayerListQuerySchema), ctrl.getplayerlist)
    .post('/banunbanuser', protectsuperadmin, zodBody(banUnbanUserBodySchema), ctrl.banunbanuser)
    .post('/multiplebanusers', protectsuperadmin, zodBody(multipleBanUsersBodySchema), ctrl.multiplebanusers)
    .get('/getplayercount', protectsuperadmin, ctrl.getplayercount)

router
    .get('/lp/getplayercount', ctrl.getplayercount);
export default router;
