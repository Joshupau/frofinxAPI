import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { optionalObjectId } from './validation.utils.js';

// Zod schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Please input username.'),
  password: z.string().min(1, 'Please input password.'),
  ipAddress: z.string().min(1, 'Please provide a valid IP address.')
});

export const registerSchema = z.object({
  username: z.string()
    .min(5, 'Minimum of 5 characters for username! Please try again.')
    .max(40, 'Maximum of 40 characters for username! Please try again.')
    .regex(/^[a-zA-Z0-9]+$/, "Please don't use special characters for username! Please try again."),
  password: z.string()
    .min(5, 'Minimum of 5 characters for password! Please try again.')
    .max(20, 'Maximum of 20 characters for password! Please try again.')
    .regex(/^[a-z0-9]+$/, "Please use lowercase letters and numbers only for username."),
  referral: z.string().min(1, 'Referral is required.'),
  phonenumber: z.string()
    .length(11, 'Please enter your right phone number! 11 numbers are needed to be entered.')
    .regex(/^[0-9]+$/, 'Please input a valid phone number and try again.')
});

export const registerStaffSchema = z.object({
  username: z.string()
    .min(5, 'Minimum of 5 characters for username! Please try again.')
    .max(40, 'Maximum of 40 characters for username! Please try again.')
    .regex(/^[a-zA-Z0-9]+$/, "Please don't use special characters for username! Please try again."),
  password: z.string()
    .min(5, 'Minimum of 5 characters for password! Please try again.')
    .max(20, 'Maximum of 20 characters for password! Please try again.')
    .regex(/^[a-zA-Z0-9[\]!@#*]+$/, 'Only []!@#* are supported special characters for password! Please try again.')
});

export const referralQuerySchema = z.object({
  id: optionalObjectId.or(z.string().min(1, "No referral found! Please don't tamper with the URL."))
});

// Export inferred types
export type LoginBody = z.infer<typeof loginSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
export type RegisterStaffBody = z.infer<typeof registerStaffSchema>;
export type ReferralQuery = z.infer<typeof referralQuerySchema>;

// Validators
export const login = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(400).json({ message: 'failed', data: firstError.message });
  }
  req.body = parsed.data;
  next();
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(400).json({ message: 'failed', data: firstError.message });
  }
  req.body = parsed.data;
  next();
};

export const registerStaffs = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = registerStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(400).json({ message: 'bad-request', data: firstError.message });
  }
  req.body = parsed.data;
  next();
};

export const getReferralUsername = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = referralQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(400).json({ message: 'failed', data: firstError.message });
  }
  req.query = parsed.data as any;
  next();
};

export const referralQuery = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = referralQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(401).json({ message: 'failed', data: firstError.message });
  }
  req.query = parsed.data as any;
  next();
};
