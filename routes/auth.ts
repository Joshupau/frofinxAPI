import { Router } from 'express';
import { authlogin, automaticlogin, logout, register, registerstaffs } from '../controllers/auth.js';
import { protectallusers, protectsuperadmin } from '../middleware/middleware.js';
import { zodQuery, zodBody } from '../cvalidator/zod.middleware.js';
import { loginSchema, registerSchema, registerStaffSchema } from '../cvalidator/auth.validation.js';

const router = Router();

router
    .post("/logout", logout)
    // referral endpoint removed
    .post("/login", zodBody(loginSchema), authlogin)
    .post("/register", zodBody(registerSchema), register)
    .get("/automaticlogin", protectallusers, automaticlogin)
    .post("/registerstaffs", protectsuperadmin, zodBody(registerStaffSchema), registerstaffs);

export default router;
