import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Zod middleware for validating and attaching query parameters to req.validatedQuery
 * Use this in routes before controllers to ensure type-safe, validated query data
 */
export const zodQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return res.status(400).json({ 
        message: 'failed', 
        data: firstError.message 
      });
    }
    
    req.validatedQuery = parsed.data;
    next();
  };
};

/**
 * Zod middleware for validating and attaching request body to req.validatedBody
 * Use this in routes before controllers to ensure type-safe, validated body data
 */
export const zodBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return res.status(400).json({ 
        message: 'failed', 
        data: firstError.message 
      });
    }
    
    req.validatedBody = parsed.data;
    next();
  };
};

/**
 * Middleware to check user authorization
 * Use this before zodQuery or zodBody when endpoints require authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user || {};
  
  if (!id) {
    return res.status(401).json({ 
      message: 'Unauthorized', 
      data: 'You are not authorized.' 
    });
  }
  
  next();
};
