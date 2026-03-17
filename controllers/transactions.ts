import type { Request, Response, NextFunction } from 'express';
import type {
  TransactionCreateBody,
  TransactionUpdateBody,
  TransactionDeleteBody,
  TransactionListQuery,
  TransactionReportQuery,
  DashboardSummaryQuery,
  DashboardQuickStatsQuery
} from '../ctypes/transactions.types.js';
import * as transactionService from '../cservice/transactions.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const {
    walletId,
    categoryId,
    amount,
    type,
    description,
    date,
    attachments,
    tags,
    toWalletId,
    billId,
    serviceFee,
    createBillForFee
  } = req.validatedBody as TransactionCreateBody;
  const { id } = req.user!;

  try {
    const result = await transactionService.create(
      id,
      walletId,
      amount,
      type,
      categoryId,
      description,
      date,
      attachments,
      tags,
      toWalletId,
      billId,
      serviceFee,
      createBillForFee
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
  const {
    page,
    limit,
    walletId,
    categoryId,
    type,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    search,
    status,
    tags
  } = req.validatedQuery as TransactionListQuery;
  const { id } = req.user!;

  try {
    const result = await transactionService.list(id, page || '0', limit || '20', {
      walletId,
      categoryId,
      type,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      status,
      tags
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
    id: transactionId,
    walletId,
    categoryId,
    amount,
    type,
    description,
    date,
    attachments,
    tags,
    status
  } = req.validatedBody as TransactionUpdateBody;
  const { id: userId } = req.user!;

  try {
    const result = await transactionService.update(userId, transactionId, {
      walletId,
      categoryId,
      amount,
      type,
      description,
      date,
      attachments,
      tags,
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

export const deleteTransaction = async (req: Request, res: Response, next: NextFunction) => {
  const { id: transactionId } = req.validatedBody as TransactionDeleteBody;
  const { id: userId } = req.user!;

  try {
    const result = await transactionService.deleteTransaction(userId, transactionId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const getMonthlyReport = async (req: Request, res: Response, next: NextFunction) => {
  const { month, year, walletId } = req.validatedQuery as TransactionReportQuery;
  const { id } = req.user!;

  try {
    const result = await transactionService.getMonthlyReport(id, month, year, walletId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getCategoryBreakdown = async (req: Request, res: Response, next: NextFunction) => {
  const { type, startDate, endDate, walletId } = req.validatedQuery as any;
  const { id } = req.user!;

  try {
    const result = await transactionService.getCategoryBreakdown(id, type, startDate, endDate, walletId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const importTransactions = async (req: Request, res: Response, next: NextFunction) => {
  const { walletId, categoryId, preview } = req.body as { walletId: string; categoryId?: string; preview?: string };
  const { id } = req.user!;

  if (!req.file) {
    return res.status(400).json({ message: 'failed', data: 'A CSV file is required.' });
  }
  if (!walletId || !/^[0-9a-fA-F]{24}$/.test(walletId)) {
    return res.status(400).json({ message: 'failed', data: 'A valid walletId is required.' });
  }
  if (categoryId && !/^[0-9a-fA-F]{24}$/.test(categoryId)) {
    return res.status(400).json({ message: 'failed', data: 'Invalid categoryId.' });
  }

  try {
    const result = await transactionService.importTransactions(id, walletId, req.file.buffer, {
      categoryId,
      preview: preview === 'true' || preview === '1'
    });

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  const { month, year, walletId } = req.query as DashboardSummaryQuery;
  const { id } = req.user!;

  try {
    const result = await transactionService.getDashboardSummary(id, month, year, walletId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getQuickStats = async (req: Request, res: Response, next: NextFunction) => {
  const { period = 'month', walletId } = req.query as DashboardQuickStatsQuery;
  const { id } = req.user!;

  try {
    const validPeriods = ['today', 'week', 'month', 'year', 'all'];
    if (period && !validPeriods.includes(period)) {
      return res.status(400).json({
        message: 'failed',
        data: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
      });
    }

    const aggregatedResult: any = {}
    const result = await transactionService.getQuickStats(
      id,
      (period || 'month') as 'today' | 'week' | 'month' | 'year' | 'all',
      walletId
    );

    const spentTodayResult = await transactionService.getSpentToday(id, walletId);
    if (!spentTodayResult.error) {
      aggregatedResult['spentToday'] = spentTodayResult.data;
    }

    const topCategoryResult = await transactionService.getTopCategoryToday(id, walletId);
    if (!topCategoryResult.error) {
      aggregatedResult['topCategory'] = topCategoryResult.data;
    }

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    aggregatedResult['stats'] = result.data;

    return res.status(200).json({ message: 'success', data: aggregatedResult });
  } catch (err) {
    next(err);
  }
};

export const getAllTags = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;

  try {
    const result = await transactionService.getAllUserTags(id);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getSpentToday = async (req: Request, res: Response, next: NextFunction) => {
  const { walletId } = req.validatedQuery as any;
  const { id } = req.user!;

  try {
    const result = await transactionService.getSpentToday(id, walletId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  const { period, walletId, startDate, endDate } = req.validatedQuery as any;
  const { id } = req.user!;

  try {
    if (!period || !['daily', 'weekly', 'yearly'].includes(period)) {
      return res.status(400).json({
        message: 'failed',
        data: 'Period must be one of: daily, weekly, yearly'
      });
    }

    const result = await transactionService.getAnalytics(id, period, walletId, startDate, endDate);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getTopCategoryToday = async (req: Request, res: Response, next: NextFunction) => {
  const { walletId } = req.validatedQuery as any;
  const { id } = req.user!;

  try {
    const result = await transactionService.getTopCategoryToday(id, walletId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
