import type { Request, Response, NextFunction } from 'express';
import type {
  BudgetCreateBody,
  BudgetUpdateBody,
  BudgetListQuery,
  BudgetCurrentQuery
} from '../ctypes/budgets.types.js';
import * as budgetService from '../cservice/budgets.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const {
    categoryId,
    name,
    amount,
    period,
    startDate,
    endDate,
    alertThreshold
  } = req.validatedBody as BudgetCreateBody;
  const { id } = req.user!;

  try {
    const result = await budgetService.create(
      id,
      name,
      amount,
      period,
      startDate,
      categoryId,
      endDate,
      alertThreshold
    );

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
  const { page, limit, categoryId, period, status, startDate, endDate } = req.validatedQuery as BudgetListQuery;
  const { id } = req.user!;

  try {
    const result = await budgetService.list(id, page || '0', limit || '20', {
      categoryId,
      period,
      status,
      startDate,
      endDate
    });

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
  const {
    id: budgetId,
    categoryId,
    name,
    amount,
    period,
    startDate,
    endDate,
    alertThreshold,
    status
  } = req.validatedBody as BudgetUpdateBody;
  const { id: userId } = req.user!;

  try {
    const result = await budgetService.update(userId, budgetId, {
      categoryId,
      name,
      amount,
      period,
      startDate,
      endDate,
      alertThreshold,
      status
    });

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const getCurrent = async (req: Request, res: Response, next: NextFunction) => {
  const { period } = req.validatedQuery as BudgetCurrentQuery;
  const { id } = req.user!;

  try {
    const result = await budgetService.getCurrent(id, period);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const checkStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { id: budgetId } = req.validatedQuery as { id: string };
  const { id: userId } = req.user!;

  try {
    const result = await budgetService.checkStatus(userId, budgetId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;

  try {
    const result = await budgetService.getSummary(id);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
