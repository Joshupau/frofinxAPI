import type { Request, Response, NextFunction } from 'express';
import type { CategoryCreateBody, CategoryUpdateBody, CategoryListQuery } from '../ctypes/categories.types.js';
import * as categoryService from '../cservice/categories.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const { name, type, icon, color } = req.validatedBody as CategoryCreateBody;
  const { id } = req.user!;

  try {
    const result = await categoryService.create(id, name, type, icon, color);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit, type, search, includeDefault } = req.validatedQuery as CategoryListQuery;
  const { id } = req.user!;

  try {
    const result = await categoryService.list(id, page || '0', limit || '50', type, search, includeDefault);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  const { id: categoryId, name, icon, color, status } = req.validatedBody as CategoryUpdateBody;
  const { id: userId } = req.user!;

  try {
    const result = await categoryService.update(userId, categoryId, { name, icon, color, status });

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const archive = async (req: Request, res: Response, next: NextFunction) => {
  const { id: categoryId } = req.validatedBody as { id: string };
  const { id: userId } = req.user!;

  try {
    const result = await categoryService.archive(userId, categoryId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;

  try {
    const result = await categoryService.getSummary(id);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
