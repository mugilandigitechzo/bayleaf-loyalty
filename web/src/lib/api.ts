import type { ApiErrorBody } from '../../../shared/types.ts';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: Record<string, any> = {}) {
    super(message);
  }
  /** Field-level messages from validation errors. */
  get fields(): Record<string, string> { return (this.details?.fields as Record<string, string>) ?? {}; }
}

export const OFFLINE_MESSAGE = 'You’re offline. Check the connection and try again — nothing was saved.';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', navigator.onLine === false ? OFFLINE_MESSAGE : 'Can’t reach Bay Leaf right now. Check the connection and try again.');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const e = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'HTTP_' + res.status, e?.message ?? 'Something went wrong. Please try again.', e?.details ?? {});
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
};

/** A key per user intent; reused if the same intent is retried, so the server never double-counts. */
export function newRequestKey(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
