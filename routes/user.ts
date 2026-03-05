import { Router } from 'express';
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
    .get('/getuserdetails', ctrl.getuserdetails)
    .post('/changepassworduser', zodBody(changePasswordUserBodySchema), ctrl.changepassworduser)
    .post('/updateuserprofile', zodBody(updateUserProfileBodySchema), ctrl.updateuserprofile)

router
    .get('/getuserdetailssuperadmin', zodQuery(getUserDetailsSuperadminQuerySchema), ctrl.getuserdetailssuperadmin)
    .post('/changepassworduserforadmin', zodBody(changePasswordUserForAdminBodySchema), ctrl.changepassworduserforadmin)
    .get('/searchplayerlist', zodQuery(searchPlayerListQuerySchema), ctrl.searchplayerlist)
    .get('/getplayerlist', zodQuery(getPlayerListQuerySchema), ctrl.getplayerlist)
    .post('/banunbanuser', zodBody(banUnbanUserBodySchema), ctrl.banunbanuser)
    .post('/multiplebanusers', zodBody(multipleBanUsersBodySchema), ctrl.multiplebanusers)

export default router;
