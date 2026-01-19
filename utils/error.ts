export interface AppError {
  message: string;
  status?: number;
  code?: string;
}

export function isError(err: unknown): err is Error {
  return typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string';
}

export function toAppError(err: unknown): AppError {
  if (isError(err)) {
    return { message: err.message, status: (err as any).status ?? 500, code: (err as any).code };
  }
  if (typeof err === 'string') return { message: err, status: 500 };
  return { message: 'Unknown error', status: 500 };
}
