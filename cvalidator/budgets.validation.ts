import { z } from 'zod';
import { optionalString, optionalNumber, optionalObjectId, dateString, optionalDateString } from './validation.utils.js';

export const createBudgetSchema = z.object({
  categoryId: optionalObjectId,
  name: z.string().min(1, 'Budget name is required').max(100, 'Budget name is too long'),
  amount: z.number().positive('Amount must be positive'),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: dateString,
  endDate: optionalDateString,
  alertThreshold: optionalNumber
});

export const updateBudgetSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid budget ID'),
  categoryId: optionalObjectId,
  name: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  startDate: optionalDateString,
  endDate: optionalDateString,
  alertThreshold: optionalNumber,
  status: z.enum(['active', 'exceeded', 'archived']).optional()
});

export const listBudgetsQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  categoryId: optionalObjectId,
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  status: z.enum(['active', 'exceeded', 'archived']).optional(),
  startDate: optionalDateString,
  endDate: optionalDateString
});

export const currentBudgetsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional()
});

export const budgetStatusQuerySchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid budget ID')
});

export const budgetRolloverSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid budget ID')
});
