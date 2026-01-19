import type { Request, Response, NextFunction } from 'express';
import { GlobalPassCreateBody, GlobalPassQuery } from '../ctypes/globalpass.types.js';
import { create, get_usage_history } from '../cservice/globalpass.service.js';

export const createGlobalPass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.user!;
  const { secretkey } = req.validatedBody as GlobalPassCreateBody;

  try {
    const data = await create(id, secretkey);
    return res.status(200).json({ message: 'success', data });
  } catch (err) {
    next(err);
  }
};

export const getusagehistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { limit, page } = req.validatedQuery as GlobalPassQuery;
  try {
    const finaldata = await get_usage_history(page, limit);
    return res.status(200).json({ message: 'success', data: finaldata });
  } catch (err) {
    next(err);
  }
};
