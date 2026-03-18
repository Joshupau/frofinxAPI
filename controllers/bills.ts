import type { Request, Response, NextFunction } from 'express';
import type {
  BillCreateBody,
  BillUpdateBody,
  BillMarkPaidBody,
  BillListQuery,
  BillUpcomingQuery
} from '../ctypes/bills.types.js';
import * as billService from '../cservice/bills.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const {
    name,
    amount,
    categoryId,
    dueDate,
    isRecurring,
    recurringFrequency,
    walletId,
    reminder,
    reminderDays,
    notes
  } = req.validatedBody as BillCreateBody;
  const { id } = req.user!;

  try {
    const result = await billService.create(
      id,
      name,
      amount,
      dueDate,
      isRecurring,
      categoryId,
      recurringFrequency,
      walletId,
      reminder,
      reminderDays,
      notes
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
  const { page, limit, paymentStatus, isRecurring, startDate, endDate, status } = req.validatedQuery as BillListQuery;
  const { id } = req.user!;

  try {
    const result = await billService.list(id, page || '0', limit || '20', {
      paymentStatus,
      isRecurring,
      startDate,
      endDate,
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
    id: billId,
    name,
    amount,
    categoryId,
    dueDate,
    isRecurring,
    recurringFrequency,
    walletId,
    reminder,
    reminderDays,
    notes,
    status
  } = req.validatedBody as BillUpdateBody;
  const { id: userId } = req.user!;

  try {
    const result = await billService.update(userId, billId, {
      name,
      amount,
      categoryId,
      dueDate,
      isRecurring,
      recurringFrequency,
      walletId,
      reminder,
      reminderDays,
      notes,
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

export const markPaid = async (req: Request, res: Response, next: NextFunction) => {
  const { id: billId, paidAmount, paidDate, idempotencyKey } = req.validatedBody as BillMarkPaidBody & { idempotencyKey?: string };
  const { id: userId } = req.user!;

  try {
    const result = await billService.markPaid(userId, billId, paidAmount, paidDate, idempotencyKey);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const markUnpaid = async (req: Request, res: Response, next: NextFunction) => {
  const { id: billId } = req.validatedBody as { id: string };
  const { id: userId } = req.user!;

  try {
    const result = await billService.markUnpaid(userId, billId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const getUpcoming = async (req: Request, res: Response, next: NextFunction) => {
  const { days } = req.validatedQuery as BillUpcomingQuery;
  const { id } = req.user!;

  try {
    const result = await billService.getUpcoming(id, days);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getOverdue = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;

  try {
    const result = await billService.getOverdue(id);

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
    const result = await billService.getSummary(id);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getCalendar = async (req: Request, res: Response, next: NextFunction) => {
  const { month, year, startDate, endDate } = req.validatedQuery as any;
  const { id } = req.user!;

  try {
    const result = await billService.getCalendar(id, month, year, startDate, endDate);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
