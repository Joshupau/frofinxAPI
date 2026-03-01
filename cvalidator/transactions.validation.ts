import { z } from 'zod';
import { optionalString, optionalObjectId } from './validation.utils.js';

export const createTransactionSchema = z.object({
  walletId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  categoryId: optionalObjectId,
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense', 'transfer']),
  description: optionalString,
  date: z.string().datetime().optional().or(z.literal('')),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  toWalletId: optionalObjectId,
  billId: optionalObjectId
});

export const updateTransactionSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid transaction ID'),
  walletId: optionalObjectId,
  categoryId: optionalObjectId,
  amount: z.number().positive().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  description: optionalString,
  date: z.string().datetime().optional().or(z.literal('')),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['completed', 'pending', 'cancelled']).optional()
});

export const deleteTransactionSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid transaction ID')
});

export const listTransactionsQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  walletId: optionalObjectId,
  categoryId: optionalObjectId,
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  startDate: z.string().datetime().optional().or(z.literal('')),
  endDate: z.string().datetime().optional().or(z.literal('')),
  minAmount: optionalString,
  maxAmount: optionalString,
  search: optionalString,
  status: z.enum(['completed', 'pending', 'cancelled']).optional()
});

export const monthlyReportQuerySchema = z.object({
  month: optionalString,
  year: optionalString,
  walletId: optionalObjectId,
  categoryId: optionalObjectId
});

export const categoryBreakdownQuerySchema = z.object({
  type: z.enum(['income', 'expense']),
  startDate: z.string().datetime().optional().or(z.literal('')),
  endDate: z.string().datetime().optional().or(z.literal('')),
  walletId: optionalObjectId
});
