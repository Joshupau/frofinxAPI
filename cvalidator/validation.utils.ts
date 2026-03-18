import { z } from 'zod';

/**
 * Common Zod validation utilities for handling various input formats
 * Especially useful for query parameters and edit operations where clients may send empty strings
 */

/**
 * Accepts number, string (converts to number), or empty string (becomes undefined)
 * Use for optional numeric fields in queries and edits
 */
export const optionalNumber = z.union([
  z.number(),
  z.string().transform(val => val === '' ? undefined : Number(val))
]).optional();

/**
 * Accepts boolean, string, or empty string (becomes undefined)
 * Use for optional boolean/string fields that can be empty
 */
export const optionalBooleanOrString = z.union([
  z.boolean(),
  z.string().transform(val => val === '' ? undefined : val)
]).optional();

/**
 * Accepts string or empty string (becomes undefined)
 * Use for optional string fields in queries and edits
 */
export const optionalString = z.string()
  .transform(val => val === '' ? undefined : val)
  .optional();

/**
 * Accepts string with minimum length, or empty string (becomes undefined)
 * Use for optional string fields with validation
 */
export const optionalStringWithMin = (minLength: number) =>
  z.string()
    .min(minLength)
    .or(z.literal('').transform(() => undefined))
    .optional();

/**
 * Converts string 'true'/'false' to boolean, or empty string to undefined
 * Use for boolean query parameters from URLs
 */
export const optionalBooleanFromString = z.union([
  z.boolean(),
  z.string().transform(val => {
    if (val === '') return undefined;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
]).optional();

/**
 * Required boolean parser accepting boolean or 'true'/'false' strings.
 */
export const booleanFromString = z.union([
  z.boolean(),
  z.string().transform(val => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    // keep original to trigger validation error downstream
    return val;
  })
]).refine(v => typeof v === 'boolean', { message: 'Invalid boolean value' });

/**
 * Accepts positive number, string (converts to positive number), or empty string (becomes undefined)
 * Use for pagination, amounts, etc.
 */
export const optionalPositiveNumber = z.union([
  z.number().positive(),
  z.string().transform(val => {
    if (val === '') return undefined;
    const num = Number(val);
    return num > 0 ? num : undefined;
  })
]).optional();

/**
 * Accepts MongoDB ObjectId string or empty string (becomes undefined)
 * Use for optional ID fields
 */
export const optionalObjectId = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format')
  .or(z.literal('').transform(() => undefined))
  .optional();

/**
 * Flexible date string validator.
 * Accepts ISO (YYYY-MM-DD or full datetime), MM-DD-YYYY, or MM/DD/YYYY.
 */
export const dateString = z.string().refine((val) => {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length === 0) return false;

  // ISO date or datetime: 2026-03-18 or 2026-03-18T12:00:00Z
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
  if (isoRegex.test(s)) {
    const d = new Date(s);
    return !Number.isNaN(d.getTime());
  }

  // MM-DD-YYYY or MM/DD/YYYY
  const mdYRegex = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/;
  const m = s.match(mdYRegex);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month < 1 || month > 12) return false;
    const dt = new Date(year, month - 1, day);
    return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
  }

  return false;
}, { message: 'Invalid date format' });

export const optionalDateString = dateString.or(z.literal('')).transform((v) => v === '' ? undefined : v).optional();
