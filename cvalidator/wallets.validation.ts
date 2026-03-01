import { z } from 'zod';
import { optionalString, optionalNumber } from './validation.utils.js';

export const createWalletSchema = z.object({
  name: z.string().min(1, 'Wallet name is required').max(100, 'Wallet name is too long'),
  type: z.enum(['bank', 'cash', 'ewallet', 'credit_card', 'other']),
  balance: optionalNumber,
  currency: z.string().length(3, 'Currency code must be 3 characters (e.g., PHP, USD)').optional(),
  icon: optionalString,
  color: optionalString,
  description: optionalString,
  accountNumber: optionalString
});

export const updateWalletSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['bank', 'cash', 'ewallet', 'credit_card', 'other']).optional(),
  icon: optionalString,
  color: optionalString,
  description: optionalString,
  accountNumber: optionalString,
  status: z.enum(['active', 'archived']).optional()
});

export const adjustBalanceSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  amount: z.number(),
  description: optionalString
});

export const archiveWalletSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID')
});

export const listWalletsQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  type: z.enum(['bank', 'cash', 'ewallet', 'credit_card', 'other']).optional(),
  currency: optionalString,
  status: z.enum(['active', 'archived']).optional()
});

export const getWalletQuerySchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID')
});
