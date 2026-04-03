import type { Request, Response, NextFunction } from 'express';
import type {
  InvestmentCreateBody,
  InvestmentUpdateBody,
  InvestmentUpdateValueBody,
  InvestmentRecordReturnBody,
  InvestmentSellBody,
  InvestmentListQuery
} from '../ctypes/investments.types.js';
import * as investmentService from '../cservice/investments.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const body = req.validatedBody as InvestmentCreateBody;
  const { id } = req.user!;

  try {
    const result = await investmentService.create(id, body);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit, type, status } = req.validatedQuery as InvestmentListQuery;
  const { id } = req.user!;

  try {
    const result = await investmentService.list(id, page || '0', limit || '20', { type, status });

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  const { id: investmentId, ...updates } = req.validatedBody as InvestmentUpdateBody;
  const { id } = req.user!;

  try {
    const result = await investmentService.update(id, investmentId, updates);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const deleteInvestment = async (req: Request, res: Response, next: NextFunction) => {
  const { id: investmentId } = req.validatedBody as { id: string };
  const { id } = req.user!;

  try {
    const result = await investmentService.deleteInvestment(id, investmentId);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const updateValue = async (req: Request, res: Response, next: NextFunction) => {
  const { id: investmentId, value, date, notes } = req.validatedBody as InvestmentUpdateValueBody;
  const { id } = req.user!;

  try {
    const result = await investmentService.updateValue(id, investmentId, value, date, notes);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const recordReturn = async (req: Request, res: Response, next: NextFunction) => {
  const { id: investmentId, amount, walletId, date, notes } = req.validatedBody as InvestmentRecordReturnBody;
  const { id } = req.user!;

  try {
    const result = await investmentService.recordReturn(id, investmentId, amount, walletId, date, notes);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const sell = async (req: Request, res: Response, next: NextFunction) => {
  const { id: investmentId, saleAmount, walletId, date, notes } = req.validatedBody as InvestmentSellBody;
  const { id } = req.user!;

  try {
    const result = await investmentService.sell(id, investmentId, saleAmount, walletId, date, notes);

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
    const result = await investmentService.summary(id);

    if (result.error) {
      return res.status(result.statusCode || 400).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
