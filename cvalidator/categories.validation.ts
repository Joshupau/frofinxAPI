import { z } from 'zod';
import { optionalString } from './validation.utils.js';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50, 'Category name is too long'),
  type: z.enum(['income', 'expense']),
  icon: optionalString,
  color: optionalString
});

export const updateCategorySchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  name: z.string().min(1).max(50).optional(),
  icon: optionalString,
  color: optionalString,
  status: z.enum(['active', 'archived']).optional()
});

export const archiveCategorySchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID')
});

export const listCategoriesQuerySchema = z.object({
  page: optionalString,
  limit: optionalString,
  type: z.enum(['income', 'expense']).optional(),
  search: optionalString,
  includeDefault: optionalString
});
