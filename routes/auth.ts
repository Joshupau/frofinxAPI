import { Router } from 'express';
import { authlogin, automaticlogin, logout, register, registerstaffs, oauthCallback, passportLogin } from '../controllers/auth.js';
import { protectallusers, protectsuperadmin } from '../middleware/middleware.js';
import { zodBody } from '../cvalidator/zod.middleware.js';
import { loginSchema, passportLoginSchema, registerSchema, registerStaffSchema } from '../cvalidator/auth.validation.js';
import passport from '../config/passport.js';

const router = Router();

router
    .post("/logout", logout)
    // referral endpoint removed
    .post("/login", zodBody(loginSchema), authlogin)
    .post("/passport-login", zodBody(passportLoginSchema), passportLogin)
    .post("/register", zodBody(registerSchema), register)
    .get("/automaticlogin", protectallusers, automaticlogin)
    .post("/registerstaffs", protectsuperadmin, zodBody(registerStaffSchema), registerstaffs)
    
    // Google OAuth
    .get("/google", passport.authenticate('google', { scope: ['profile', 'email'], session: false }))
    .get("/google/callback", 
        passport.authenticate('google', { 
            session: false,
            failureRedirect: '/login?error=google_auth_failed'
        }), 
        oauthCallback
    )
    
    // Facebook OAuth
    .get("/facebook", passport.authenticate('facebook', { scope: ['email'], session: false }))
    .get("/facebook/callback", 
        passport.authenticate('facebook', { 
            session: false,
            failureRedirect: '/login?error=facebook_auth_failed'
        }), 
        oauthCallback
    );

export default router;
