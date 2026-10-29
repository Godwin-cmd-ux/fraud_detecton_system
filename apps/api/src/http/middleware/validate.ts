import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../../lib/errors';

export type Source = 'body' | 'query' | 'params';

/** Parses `req[source]` with the schema; the parsed value lands in `res.locals[source]`. */
export function validate(schema: ZodType, source: Source): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.length ? issue.path.map(String).join('.') : '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      const message = Object.values(fields).join('\n');
      return next(new HttpError(400, 'VALIDATION', message || 'Invalid request', fields));
    }
    res.locals[source] = result.data;
    next();
  };
}
