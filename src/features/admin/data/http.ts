/**
 * HTTP админки: отдельная сессия сотрудника в httpOnly-cookie (12 ч), клиентские токены не отправляем.
 * Изменяющие запросы несут X-CSRF-Token из ответа входа: cookie eyor_admin_csrf выдаётся с Path=/api/admin
 * и со страниц /admin не читается, поэтому токен храним в localStorage (живёт столько же, сколько сессия).
 * 401 на любом запросе — на страницу входа с возвратом на текущий адрес.
 */
import { ApiError } from '@/lib/api';

const CSRF_KEY = 'ekor_admin_csrf';
type Opts = { method?: string; body?: unknown; query?: Record<string, string | number | boolean | null | undefined>; noRedirect?: boolean };

export const csrf = {
  get(): string | null {
    try {
      const m = document.cookie.match(/(?:^|;\s*)eyor_admin_csrf=([^;]+)/);
      return (m && decodeURIComponent(m[1])) || localStorage.getItem(CSRF_KEY);
    } catch {
      return null;
    }
  },
  set(v: string | null) {
    try {
      if (v) localStorage.setItem(CSRF_KEY, v);
      else localStorage.removeItem(CSRF_KEY);
    } catch {}
  },
};

export function adminUrl(path: string, query?: Opts['query']) {
  const q = Object.entries(query ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  return `/api${path}${q.length ? `?${new URLSearchParams(q.map(([k, v]) => [k, String(v)]))}` : ''}`;
}

export function toLogin() {
  if (typeof window === 'undefined' || location.pathname.startsWith('/admin/login')) return;
  location.replace(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`);
}

export async function adminHttp<T>(path: string, o: Opts = {}): Promise<T> {
  const method = o.method ?? 'GET';
  const mutating = method !== 'GET';
  const token = mutating ? csrf.get() : null;
  const r = await fetch(adminUrl(path, o.query), {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(o.body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { 'x-csrf-token': token }),
      ...(mutating && { 'idempotency-key': crypto.randomUUID() }),
    },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
  if (r.status === 204) return undefined as T;
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && !o.noRedirect && path.startsWith('/admin') && !path.startsWith('/admin/auth')) toLogin();
    const e = new ApiError(r.status, d?.code ?? `http_${r.status}`, d?.message_ru ?? d?.message ?? r.statusText);
    (e as ApiError & { details?: unknown }).details = d?.details;
    throw e;
  }
  return d as T;
}
