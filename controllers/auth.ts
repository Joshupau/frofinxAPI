import type { Request, Response, NextFunction } from 'express';
import type { AuthLoginBody, AuthRegisterBody, AuthRegisterStaffBody } from '../ctypes/auth.types.js';
import { login, register as registerService, registerStaffs as registerStaffsService } from '../cservice/auth.service.js';
import passport from 'passport';
import { generateAccess } from '../config/generate-token.js';

export const authlogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { username, password, ipAddress } = req.validatedBody as AuthLoginBody;

  try {
    const result = await login(username, password, ipAddress);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    res.cookie('sessionToken', result.data.token, { secure: true, sameSite: 'none' });
    return res.status(200).json({ message: 'success', data: { auth: result.data } });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('sessionToken', { path: '/' });
  return res.json({ message: 'success' });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.validatedBody as AuthRegisterBody;

  try {
    const result = await registerService(body);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success' });
  } catch (err) {
    next(err);
  }
};

export const registerstaffs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { username, password } = req.validatedBody as AuthRegisterStaffBody;

  try {
    const result = await registerStaffsService(username, password);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success' });
  } catch (err) {
    next(err);
  }
};

export const automaticlogin = async (req: Request, res: Response) => {
    const {auth} = req.user!

    return res.json({message: "success", data: {
        auth: auth
    }})
}


export const passportLogin = async (req: Request, res: Response) => {
    passport.authenticate('local', (err: Error, user: any, info: any) => {
      if (err) {
        console.error('Passport auth error:', err);
        return res.status(500).json({ message: 'failed', data: 'An error occurred during authentication.' });
      }
      
      if (!user) {
        return res.status(400).json({ message: 'failed', data: info?.message || 'Authentication failed.' });
      }

      const access = generateAccess(user)
      
      if (user.status === 'banned') {
        return res.status(403).json({ 
          message: 'failed', 
          data: {
            message: 'Your account has been banned.',
            reason: user.banreason,
            date: user.bandate
          }
        });
      }

      // Return user data (JWT generation should be handled by login service)
      return res.status(200).json({ message: 'success', data: access});
    })(req, res);
}

export const oauthCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Passport attaches user data from OAuth strategy
        const userData = req.user as any;
        
        if (!userData?.token) {
            return res.status(400).json({ 
              message: 'failed', 
              data: 'Authentication failed. No token received.' 
            });
        }

        // Set secure cookie with JWT token
        res.cookie('sessionToken', userData.token, { 
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            httpOnly: true,
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        return res.status(200).json({ 
            message: 'success', 
            data: { 
                token: userData.token,
                auth: userData.auth,
                username: userData.username,
                userid: userData.userid
            } 
        });
    } catch (err) {
        console.error('OAuth callback error:', err);
        next(err);
    }
};