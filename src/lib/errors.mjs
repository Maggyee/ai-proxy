export class AppError extends Error {
  constructor(
    message,
    { statusCode = 500, code = 'internal_error', details = null } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function asAppError(error) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError(
    error instanceof Error ? error.message : 'Unknown server error.',
    { statusCode: 500, code: 'internal_error' },
  );
}
