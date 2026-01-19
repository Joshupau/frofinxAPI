import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Zod schemas
export const createPassSchema = z.object({
  secretkey: z.string().min(1, 'Please input secret key.')
});

export const getUsageHistorySchema = z.object({
  limit: z.string().optional(),
  page: z.string().optional()
});



// Export inferred types
export type CreatePassBody = z.infer<typeof createPassSchema>;

// Validators
export const createpass = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;
  
  if (!id) return res.status(400).json({ message: 'Unauthorized', data: 'You are not authorized to view this page. Please login to the right account.' });
  
  const parsed = createPassSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(400).json({ message: 'failed', data: firstError.message });
  }
  
  req.body = parsed.data;
  next();
};

export const getusagehistory = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;

  if (!id) return res.status(400).json({ message: 'Unauthorized', data: 'You are not authorized to view this page. Please login to the right account.' });

  const parsed = getUsageHistorySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return res.status(400).json({ message: 'failed', data: firstError.message });
  }
  req.validatedQuery = parsed.data;
  next();
}