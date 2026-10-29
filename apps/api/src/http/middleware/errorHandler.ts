import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { HttpError, errorToResponse } from '../../lib/errors';

export function errorHandler(logger: Logger | null): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (!(err instanceof HttpError)) {
      logger?.error({ err }, 'unhandled error');
    }
    const { status, body } = errorToResponse(err);
    res.status(status).json(body);
  };
}
