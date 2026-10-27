/**
 * HTTP-клиент бэкенда. В браузере ходим на свой домен (/api проксирует Next, см. next.config.ts) —
 * CORS не нужен; на сервере — напрямую в API_ORIGIN.
 */
export const API_ORIGIN = process.env.API_ORIGIN || 'https://lab.tcell.tj';
const BASE = typeof window === 'undefined' ? `${API_ORIGIN}/api` : '/api';
const TOKENS = 'ekor_tokens';

export type Tokens = { access: string; refresh: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const tokens = {
  get(): Tokens | null {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(TOKENS) || 'null');
    } catch {
      return null;
    }
  },
  set(t: Tokens | null) {
    try {
      if (t) localStorage.setItem(TOKENS, JSON.stringify(t));
      else localStorage.removeItem(TOKENS);
    } catch {}
  },
};

type Opts = { method?: string; body?: unknown; form?: FormData; headers?: Record<string, string>; query?: Record<string, string | number | boolean | null | undefined>; signal?: AbortSignal };

function url(path: string, query?: Opts['query']) {
  const q = Object.entries(query ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  return `${BASE}${path}${q.length ? `?${new URLSearchParams(q.map(([k, v]) => [k, String(v)]))}` : ''}`;
}

let refreshing: Promise<boolean> | null = null;
/** Один refresh на все параллельные запросы, получившие 401 */
export function refresh(): Promise<boolean> {
  const t = tokens.get();
  if (!t) return Promise.resolve(false);
  refreshing ??= fetch(url('/auth/refresh'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh }) })
    .then(async (r) => {
      if (!r.ok) return tokens.set(null), false;
      const d = await r.json();
      tokens.set({ access: d.access_token, refresh: d.refresh_token });
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function http<T>(path: string, o: Opts = {}, retried = false): Promise<T> {
  const t = tokens.get();
  const r = await fetch(url(path, o.query), {
    method: o.method ?? 'GET',
    headers: { ...(o.body !== undefined && { 'content-type': 'application/json' }), ...(t && { authorization: `Bearer ${t.access}` }), ...o.headers },
    body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
    signal: o.signal,
    cache: 'no-store',
  });
  if (r.status === 401 && t && !retried && (await refresh())) return http<T>(path, o, true);
  if (r.status === 204) return undefined as T;
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, d?.code ?? 'http_' + r.status, d?.message ?? r.statusText);
  return d as T;
}

/** Текст ошибки для тоста: сообщение сервера (по-русски) или «нет связи» */
export function apiErrorText(e: unknown, lang: 'ru' | 'tj') {
  if (e instanceof ApiError && e.message && e.status < 500) return e.message;
  if (e instanceof ApiError) return lang === 'tj' ? 'Хатои сервер. Каме дертар кӯшиш кунед' : 'Ошибка сервера. Попробуйте чуть позже';
  return lang === 'tj' ? 'Пайваст нест. Интернетро санҷед' : 'Нет связи. Проверьте интернет';
}
