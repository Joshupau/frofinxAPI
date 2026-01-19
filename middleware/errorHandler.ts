import type { Request, Response, NextFunction } from 'express';
import { toAppError } from '../utils/error.js';

type ErrorResponse = {
  status: 'error';
  message: string;
  data?: unknown;
  details?: unknown;
  stack?: unknown;
};

const globalErrorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', err);
  if (res.headersSent) return next(err as any);

  const appErr = toAppError(err);
  const errAny = err as any;

  let statusCode = appErr.status ?? 500;
  let message = appErr.message ?? 'Internal Server Error';
  let details: unknown = errAny?.details ?? undefined;
  let data: unknown = undefined;

  if (errAny?.name === 'ValidationError' || errAny?.name === 'BadRequestError') {
    statusCode = 400;
    message = 'Validation Error';
    details = errAny?.errors ?? errAny?.details ?? appErr.message;
  }

  if (errAny?.isOperational) {
    statusCode = errAny?.statusCode ?? 400;
    message = errAny?.message ?? message;
    details = errAny?.details ?? details;
  }

  if (statusCode === 500) {
    data = 'bad-request';
    message = "There's a problem with the server! Please contact support for more details!";
    details = undefined;
  }

  const response: ErrorResponse = { status: 'error', message };
  if (data) response.data = data;
  if (details) response.details = details;
  if (process.env.NODE_ENV === 'development' && errAny?.stack) response.stack = errAny.stack;

  res.status(statusCode).json(response);
};

export default globalErrorHandler;
