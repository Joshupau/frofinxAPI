import { z } from 'zod';
import {
  optionalString,
  optionalNumber,
  optionalObjectId,
  dateString,
  optionalDateString
} from './validation.utils.js';

export const createInvestmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  type: z.enum(['stocks', 'bonds', 'mutual_funds', 'crypto', 'real_estate', 'savings', 'other']),
  principalAmount: z.number().positive('Principal amount must be positive'),
  currency: optionalString,
  platform: optionalString,
  walletId: optionalObjectId,
  categoryId: optionalObjectId,
  startDate: dateString,
  maturityDate: optionalDateString,
  expectedReturnRate: optionalNumber,
  notes: optionalString,
  tags: z.array(z.string()).optional()
});

export const updateInvestmentSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid investment ID'),
  name: z.string().min(1).max(100).optional(),
  platform: optionalString,
  maturityDate: optionalDateString,
  expectedReturnRate: optionalNumber,
  walletId: optionalObjectId,
  categoryId: optionalObjectId,
  notes: optionalString,
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'matured', 'sold', 'archived']).optional()
});

export const updateInvestmentValueSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid investment ID'),
  value: z.number().nonnegative('Value must be zero or positive'),
  date: optionalDateString,
  notes: optionalString
});

export const recordInvestmentReturnSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid investment ID'),
  amount: z.number().positive('Return amount must be positive'),
  walletId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  date: optionalDateString,
  notes: optionalString
});

export const sellInvestmentSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid investment ID'),
  saleAmount: z.number().positive('Sale amount must be positive'),
  walletId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  date: optionalDateString,
  notes: optionalString
});

export const listInvestmentsQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  type: z.enum(['stocks', 'bonds', 'mutual_funds', 'crypto', 'real_estate', 'savings', 'other']).optional(),
  status: z.enum(['active', 'matured', 'sold', 'archived']).optional()
});

export const deleteInvestmentSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid investment ID')
});
