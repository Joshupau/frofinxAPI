import type { Request, Response, NextFunction } from 'express';
import type {
  ObligationCreateBody,
  ObligationUpdateBody,
  ObligationRecordPaymentBody,
  ObligationListQuery
} from '../ctypes/obligations.types.js';
import * as obligationService from '../cservice/obligations.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const body = req.validatedBody as ObligationCreateBody;
  const { id } = req.user!;

  try {
    const result = await obligationService.create(id, body);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit, direction, status, isInstallment } = req.validatedQuery as ObligationListQuery;
  const { id } = req.user!;

  try {
    const result = await obligationService.list(id, page || '0', limit || '20', {
      direction,
      status,
      isInstallment
    });

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  const { id: obligationId, ...updates } = req.validatedBody as ObligationUpdateBody;
  const { id } = req.user!;

  try {
    const result = await obligationService.update(id, obligationId, updates);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const deleteObligation = async (req: Request, res: Response, next: NextFunction) => {
  const { id: obligationId } = req.validatedBody as { id: string };
  const { id } = req.user!;

  try {
    const result = await obligationService.deleteObligation(id, obligationId);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  const { id: obligationId, amount, walletId, date, notes, idempotencyKey } = req.validatedBody as ObligationRecordPaymentBody;
  const { id } = req.user!;

  try {
    const result = await obligationService.recordPayment(id, obligationId, amount, walletId, date, notes, idempotencyKey);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user!;

  try {
    const result = await obligationService.summary(id);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
