import { z } from 'zod';
import {
  optionalString,
  optionalNumber,
  optionalObjectId,
  optionalBooleanFromString,
  dateString,
  optionalDateString
} from './validation.utils.js';

export const createObligationSchema = z
  .object({
    direction: z.enum(['debt', 'lending']),
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    counterparty: z.string().min(1, 'Counterparty is required').max(100, 'Counterparty name is too long'),
    counterpartyContact: optionalString,
    principalAmount: z.number().positive('Principal amount must be positive'),
    currency: optionalString,
    interestRate: optionalNumber,
    interestType: z.enum(['simple', 'compound']).optional(),
    startDate: dateString,
    dueDate: optionalDateString,
    walletId: optionalObjectId,
    categoryId: optionalObjectId,
    notes: optionalString,
    tags: z.array(z.string()).optional(),
    isInstallment: z.boolean().optional(),
    installmentAmount: optionalNumber,
    totalInstallments: optionalNumber,
    installmentFrequency: z.enum(['weekly', 'monthly', 'yearly']).optional()
  })
  .superRefine((data, ctx) => {
    if (data.isInstallment) {
      if (!data.installmentAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installmentAmount'],
          message: 'installmentAmount is required for installment obligations.'
        });
      }
      if (!data.totalInstallments) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['totalInstallments'],
          message: 'totalInstallments is required for installment obligations.'
        });
      }
      if (!data.installmentFrequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installmentFrequency'],
          message: 'installmentFrequency is required for installment obligations.'
        });
      }
    }
  });

export const updateObligationSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid obligation ID'),
  name: z.string().min(1).max(100).optional(),
  counterparty: z.string().min(1).max(100).optional(),
  counterpartyContact: optionalString,
  dueDate: optionalDateString,
  interestRate: optionalNumber,
  interestType: z.enum(['simple', 'compound']).optional(),
  walletId: optionalObjectId,
  categoryId: optionalObjectId,
  notes: optionalString,
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'partially_paid', 'settled', 'defaulted', 'archived']).optional()
});

export const recordPaymentSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid obligation ID'),
  amount: z.number().positive('Payment amount must be positive'),
  walletId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet ID'),
  date: optionalDateString,
  notes: optionalString,
  idempotencyKey: optionalString
});

export const listObligationsQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  direction: z.enum(['debt', 'lending']).optional(),
  status: z.enum(['active', 'partially_paid', 'settled', 'defaulted', 'archived']).optional(),
  isInstallment: optionalBooleanFromString
});

export const deleteObligationSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid obligation ID')
});
