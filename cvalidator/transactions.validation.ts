import { z } from 'zod';
import { optionalString, optionalObjectId } from './validation.utils.js';

// Accept both ISO date (YYYY-MM-DD) and ISO datetime (YYYY-MM-DDTHH:mm:ssZ)
const dateOrDateTime = z.string().refine(
  (val) => {
    // Match ISO date (YYYY-MM-DD) or ISO datetime (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ssZ)
    return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/.test(val);
  },
  { message: 'Must be a valid ISO date (YYYY-MM-DD) or ISO datetime (YYYY-MM-DDTHH:mm:ssZ)' }
);

export const createTransactionSchema = z.object({
  walletId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  categoryId: optionalObjectId,
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense', 'transfer']),
  description: optionalString,
  date: dateOrDateTime.optional().or(z.literal('')),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  toWalletId: optionalObjectId,
  billId: optionalObjectId,
  serviceFee: z.number().nonnegative('Service fee cannot be negative').optional(),
  createBillForFee: z.boolean().optional()
});

export const updateTransactionSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid transaction ID'),
  walletId: optionalObjectId,
  categoryId: optionalObjectId,
  amount: z.number().positive().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  description: optionalString,
  date: dateOrDateTime.optional().or(z.literal('')),
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
  startDate: dateOrDateTime.optional().or(z.literal('')),
  endDate: dateOrDateTime.optional().or(z.literal('')),
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


export const dashboardSummaryQuerySchema = z.object({
  month: z.string().regex(/^(0?[1-9]|1[0-2])$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  walletId: z.string().regex(/^[0-9a-f]{24}$/i).optional()
});


export const quickStatsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year', 'all']).optional(),
  walletId: z.string().regex(/^[0-9a-f]{24}$/i).optional()
});

export const spentTodayQuerySchema = z.object({
  walletId: z.string().regex(/^[0-9a-f]{24}$/i).optional()
});

export const analyticsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'yearly']),
  walletId: z.string().regex(/^[0-9a-f]{24}$/i).optional(),
  startDate: dateOrDateTime.optional().or(z.literal('')),
  endDate: dateOrDateTime.optional().or(z.literal(''))
});

export const topCategoryTodayQuerySchema = z.object({
  walletId: z.string().regex(/^[0-9a-f]{24}$/i).optional()
});
