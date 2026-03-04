import type { Request, Response, NextFunction } from 'express';

import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';
import Staffusers from '../models/Staffusers.js';
import Users from '../models/Users.js';
import jsonwebtokenPromisified from 'jsonwebtoken-promisified';
import passport from '../config/passport.js';
import { encrypt } from '../utils/password.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Passport Local Strategy Middleware
export const localAuthenticate = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
    
        if (err) {
            console.error('Passport auth error:', err);
            return next(err);
        }

        if (!user) {
            console.error('Authentication failed:', info?.message);
            return res.status(401).json({ message: 'failed', data: info?.message || 'Authentication failed' });
        }

        req.logIn(user, async (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return next(loginErr);
            }

            try {
                const privateKey = fs.readFileSync(path.resolve(__dirname, '../keys/private-key.pem'), 'utf-8');
                const token = await encrypt(privateKey);
                
                // Update user webtoken
                if (user.userType === 'Staffusers' || user.auth) {
                    await Staffusers.findByIdAndUpdate({ _id: user._id }, { $set: { webtoken: token } });
                } else {
                    await Users.findByIdAndUpdate({ _id: user._id }, { $set: { webtoken: token } });
                }

                // Create JWT token
                const payload = {
                    id: user._id,
                    username: user.username,
                    status: user.status,
                    token: token,
                    auth: user.auth || 'player'
                };

                const jwtoken = await jsonwebtokenPromisified.sign(payload, privateKey, { algorithm: 'RS256' });

                // Set cookie with appropriate settings for environment
                const isProduction = process.env.NODE_ENV === 'production';
                res.cookie('sessionToken', jwtoken, { 
                    secure: isProduction,          // HTTPS only in production
                    sameSite: isProduction ? 'none' : 'lax',  // 'lax' for dev, 'none' for prod
                    httpOnly: true,
                    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
                    path: '/'
                });
                
                console.log('✓ Local authentication successful - token set for user:', user.username);
                return res.status(200).json({
                    message: 'success',
                    data: {
                        token: jwtoken,
                        username: user.username,
                        auth: user.auth || 'player'
                    }
                });
            } catch (error) {
                console.error('Token generation error:', error);
                return next(error);
            }
        });
    })(req, res, next);
};

// Google OAuth Callback Handler
export const googleAuthCallback = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', async (err: any, data: any) => {
        if (err) {
            console.error('Google auth error:', err);
            return res.redirect(`/auth/failure?error=${encodeURIComponent(err.message)}`);
        }

        if (!data) {
            return res.redirect('/auth/failure?error=Google authentication failed');
        }

        try {
            const jwtoken = data.token;
            const isProduction = process.env.NODE_ENV === 'production';

            res.cookie('sessionToken', jwtoken, { 
                secure: isProduction,
                sameSite: isProduction ? 'none' : 'lax',
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
            });
            
            console.log('✓ Google OAuth successful - redirecting with token');
            return res.redirect(`/auth/success?token=${encodeURIComponent(jwtoken)}&auth=player&username=${encodeURIComponent(data.username)}`);
        } catch (error) {
            console.error('Google callback error:', error);
            return res.redirect('/auth/failure?error=Server error during authentication');
        }
    })(req, res, next);
};

// Facebook OAuth Callback Handler
export const facebookAuthCallback = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('facebook', async (err: any, data: any) => {
        if (err) {
            console.error('Facebook auth error:', err);
            return res.redirect(`/auth/failure?error=${encodeURIComponent(err.message)}`);
        }

        if (!data) {
            return res.redirect('/auth/failure?error=Facebook authentication failed');
        }

        try {
            const jwtoken = data.token;
            const isProduction = process.env.NODE_ENV === 'production';

            res.cookie('sessionToken', jwtoken, { 
                secure: isProduction,
                sameSite: isProduction ? 'none' : 'lax',
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
            });
            
            console.log('✓ Facebook OAuth successful - redirecting with token');
            return res.redirect(`/auth/success?token=${encodeURIComponent(jwtoken)}&auth=player&username=${encodeURIComponent(data.username)}`);
        } catch (error) {
            console.error('Facebook callback error:', error);
            return res.redirect('/auth/failure?error=Server error during authentication');
        }
    })(req, res, next);
};

// Passport Serialization (for session support)
passport.serializeUser((user: any, done) => {
    done(null, { id: user._id, type: user.auth ? 'staff' : 'player' });
});

passport.deserializeUser(async (obj: any, done) => {
    try {
        let user;
        if (obj.type === 'staff') {
            user = await Staffusers.findById(obj.id);
        } else {
            user = await Users.findById(obj.id);
        }
        done(null, user);
    } catch (error) {
        done(error);
    }
});