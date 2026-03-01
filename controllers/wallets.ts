import type { Request, Response, NextFunction } from 'express';
import type { WalletCreateBody, WalletUpdateBody, WalletAdjustBalanceBody, WalletListQuery } from '../ctypes/wallets.types.js';
import * as walletService from '../cservice/wallets.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const { name, type, balance, currency, icon, color, description, accountNumber } = req.validatedBody as WalletCreateBody;
  const { id } = req.user!;

  try {
    const result = await walletService.create(id, name, type, balance, currency, icon, color, description, accountNumber);

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
  const { page, limit, type, currency, status } = req.validatedQuery as WalletListQuery;
  const { id } = req.user!;

  try {
    const result = await walletService.list(id, page || '0', limit || '20', type, currency, status);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  const { id: walletId } = req.validatedQuery as { id: string };
  const { id: userId } = req.user!;

  try {
    const result = await walletService.getById(userId, walletId);

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
  const { id: walletId, name, type, icon, color, description, accountNumber, status } = req.validatedBody as WalletUpdateBody;
  const { id: userId } = req.user!;

  try {
    const result = await walletService.update(userId, walletId, {
      name,
      type,
      icon,
      color,
      description,
      accountNumber,
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

export const adjustBalance = async (req: Request, res: Response, next: NextFunction) => {
  const { id: walletId, amount } = req.validatedBody as WalletAdjustBalanceBody;
  const { id: userId } = req.user!;

  try {
    const result = await walletService.adjustBalance(userId, walletId, amount);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};

export const archive = async (req: Request, res: Response, next: NextFunction) => {
  const { id: walletId } = req.validatedBody as { id: string };
  const { id: userId } = req.user!;

  try {
    const result = await walletService.archive(userId, walletId);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.message });
  } catch (err) {
    next(err);
  }
};

export const getTotalBalance = async (req: Request, res: Response, next: NextFunction) => {
  const { currency } = req.validatedQuery as { currency?: string };
  const { id } = req.user!;

  try {
    const result = await walletService.getTotalBalance(id, currency);

    if (result.error) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ message: 'failed', data: result.message });
    }

    return res.status(200).json({ message: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
};
