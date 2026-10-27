/**
 * Domain errors carry a stable `code` (the UI maps it to friendly copy) and an
 * HTTP status. Raw database errors are never sent to clients.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (message: string, details: Record<string, unknown> = {}) => new AppError('VALIDATION', 400, message, details),
  unauthenticated: () => new AppError('UNAUTHENTICATED', 401, 'Please sign in to continue.'),
  forbidden: () => new AppError('FORBIDDEN', 403, 'Your account does not have permission for this action.'),
  notFound: (what = 'record') => new AppError('NOT_FOUND', 404, `That ${what} could not be found.`),
  conflict: (code: string, message: string, details: Record<string, unknown> = {}) => new AppError(code, 409, message, details),
  rateLimited: (retryAfterSec: number) => new AppError('RATE_LIMITED', 429, 'Too many attempts. Please wait a moment and try again.', { retryAfterSec }),
};
