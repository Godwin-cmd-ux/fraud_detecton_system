export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 400 with one or more human-readable messages joined by newlines, as the original system showed them. */
export class ValidationError extends HttpError {
  constructor(public readonly messages: string[]) {
    super(400, 'VALIDATION', messages.join('\n'));
    this.name = 'ValidationError';
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export function errorToResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) } },
    };
  }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Internal server error' } } };
}
