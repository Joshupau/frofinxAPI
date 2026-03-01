import type { Request, Response, NextFunction } from 'express';
import type {
  TransactionCreateBody,
  TransactionUpdateBody,
  TransactionDeleteBody,
  TransactionListQuery,
  TransactionReportQuery
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
    billId
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
      billId
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
    status
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
      status
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
