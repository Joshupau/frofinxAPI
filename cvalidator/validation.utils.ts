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
