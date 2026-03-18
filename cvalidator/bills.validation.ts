import { z } from 'zod';
import { optionalString, optionalNumber, optionalObjectId, optionalBooleanFromString, dateString, optionalDateString, booleanFromString } from './validation.utils.js';

export const createBillSchema = z.object({
  name: z.string().min(1, 'Bill name is required').max(100, 'Bill name is too long'),
  amount: z.number().positive('Amount must be positive'),
  categoryId: optionalObjectId,
  dueDate: dateString,
  isRecurring: booleanFromString,
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  walletId: optionalObjectId,
  reminder: z.boolean().optional(),
  reminderDays: optionalNumber,
  notes: optionalString
});

export const updateBillSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bill ID'),
  name: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  categoryId: optionalObjectId,
  dueDate: optionalDateString,
  isRecurring: optionalBooleanFromString,
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  walletId: optionalObjectId,
  reminder: z.boolean().optional(),
  reminderDays: optionalNumber,
  notes: optionalString,
  status: z.enum(['active', 'archived']).optional()
});

export const markPaidSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bill ID'),
  paidAmount: optionalNumber,
  paidDate: optionalDateString,
  walletId: optionalObjectId,
  createTransaction: z.boolean().optional()
});

export const markUnpaidSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bill ID')
});

export const listBillsQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  paymentStatus: z.enum(['paid', 'unpaid', 'overdue', 'partial']).optional(),
  isRecurring: optionalBooleanFromString,
  startDate: optionalDateString,
  endDate: optionalDateString,
  status: z.enum(['active', 'archived']).optional()
});

export const upcomingBillsQuerySchema = z.object({
  days: optionalString
});

export const billCalendarQuerySchema = z.object({
  month: optionalString, // 1-12
  year: optionalString, // YYYY
  startDate: optionalDateString,
  endDate: optionalDateString
});
