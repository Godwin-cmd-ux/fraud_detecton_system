import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

afterEach(() => vi.unstubAllGlobals());
describe('API client', () => {
  it('encodes query values and sends session and CSRF headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetcher);
    expect(await api('/api/admin/users', { query: { search: 'a & b', page: 2, missing: undefined } })).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith('/api/admin/users?search=a+%26+b&page=2', expect.objectContaining({
      credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    }));
  });
  it('serializes mutations and accepts an empty logout response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await api('auth/logout', { method: 'POST', body: {} })).toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', body: '{}' }));
  });
  it('preserves lockout status and field details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'LOCKED', message: 'Please wait', fields: { minutesRemaining: '5' } },
    }), { status: 423 })));
    await expect(api('auth/login')).rejects.toMatchObject({ status: 423, code: 'LOCKED', message: 'Please wait', fields: { minutesRemaining: '5' } });
  });
  it('handles a non-JSON server failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    await expect(api('health')).rejects.toBeInstanceOf(ApiError);
    await expect(api('health')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });
});
