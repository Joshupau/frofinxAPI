import type { Request, Response, NextFunction } from 'express';
import type { AuthLoginBody, AuthRegisterBody, AuthRegisterStaffBody } from '../ctypes/auth.types.js';
import { login, register as registerService, registerStaffs as registerStaffsService } from '../cservice/auth.service.js';

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

// referral endpoint removed

export const automaticlogin = async (req: Request, res: Response) => {
    const {auth} = req.user!

    return res.json({message: "success", data: {
        auth: auth
    }})
}