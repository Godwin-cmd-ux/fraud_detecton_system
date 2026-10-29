export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/** Calls the same-origin API with the session cookie and required CSRF headers. */
export async function api<T>(path: string, init: ApiOptions = {}): Promise<T> {
  const url = new URL(`/api/${path.replace(/^\/?api\//, '').replace(/^\//, '')}`, window.location.origin);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url.pathname + url.search, {
    method: init.method ?? 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = (payload as { error?: { code?: unknown; message?: unknown; fields?: unknown } } | undefined)?.error;
    const fields = error?.fields;
    throw new ApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
      typeof error?.message === 'string' ? error.message : `Request failed (${response.status})`,
      fields && typeof fields === 'object' && !Array.isArray(fields) &&
        Object.values(fields).every((value) => typeof value === 'string')
        ? fields as Record<string, string> : undefined,
    );
  }
  if (payload === undefined) throw new ApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response');
  return payload as T;
}
