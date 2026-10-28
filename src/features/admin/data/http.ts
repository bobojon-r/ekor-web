/**
 * HTTP админки: отдельная сессия сотрудника в httpOnly-cookie (12 ч), клиентские токены не отправляем.
 * Изменяющие запросы несут X-CSRF-Token из ответа входа: cookie eyor_admin_csrf выдаётся с Path=/api/admin
 * и со страниц /admin не читается, поэтому токен храним в localStorage (живёт столько же, сколько сессия).
 * 401 на любом запросе — на страницу входа с возвратом на текущий адрес.
 */
import { ApiError } from '@/lib/api';
import { uuid } from '@/lib/browser';

const CSRF_KEY = 'ekor_admin_csrf';
/** Названия полей для сообщений 422 */
const FIELD: Record<string, string> = {
  comment: 'комментарий', basis: 'основание', reason: 'основание', reason_id: 'причина', text: 'текст', note: 'заметка', title: 'заголовок', description: 'описание', body: 'текст',
  name: 'ФИО', email: 'почта', password: 'пароль', contact_phone: 'телефон', phone: 'телефон', value: 'значение', resolution: 'решение', terms_deadline: 'срок доработки', confirm_last4: '4 цифры номера',
};
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

/** Связь с сервером для плашки в каркасе: событие ekor-admin-net с detail = есть ли связь */
let netOk = true;
function netState(ok: boolean) {
  if (ok === netOk || typeof window === 'undefined') return;
  netOk = ok;
  window.dispatchEvent(new CustomEvent('ekor-admin-net', { detail: ok }));
}

export function toLogin() {
  if (typeof window === 'undefined' || location.pathname.startsWith('/admin/login')) return;
  location.replace(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`);
}

export async function adminHttp<T>(path: string, o: Opts = {}): Promise<T> {
  const method = o.method ?? 'GET';
  const mutating = method !== 'GET';
  const token = mutating ? csrf.get() : null;
  let r: Response;
  try {
    r = await fetch(adminUrl(path, o.query), {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(o.body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { 'x-csrf-token': token }),
      ...(mutating && { 'idempotency-key': uuid() }),
    },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
  } catch (e) {
    if (!mutating) netState(false);
    throw e;
  }
  // Загрузка данных: сеть или 5xx — плашка «Нет связи»; удачный ответ её убирает
  if (!mutating) netState(r.status < 500);
  if (r.status === 204) return undefined as T;
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && !o.noRedirect && path.startsWith('/admin') && !path.startsWith('/admin/auth')) toLogin();
    // 422 в модалках с одним полем: показываем, что именно не так (поле и текст ошибки)
    const first = r.status === 422 && Array.isArray(d?.details) ? d.details[0] : null;
    const text = first?.field ? `${d?.message_ru ?? d?.message ?? 'Проверьте поля'}: ${FIELD[String(first.field).split('.').pop()!] ?? first.field} — ${first.message_ru ?? first.error ?? ''}` : null;
    const e = new ApiError(r.status, d?.code ?? `http_${r.status}`, text ?? d?.message_ru ?? d?.message ?? r.statusText);
    (e as ApiError & { details?: unknown }).details = d?.details;
    throw e;
  }
  return d as T;
}

/** 422: ошибки по полям из details [{field, error}] — «body.email» → «email» */
export function fieldErrors(e: unknown): Record<string, string> {
  const x = e as { status?: number; details?: unknown };
  if (x?.status !== 422 || !Array.isArray(x.details)) return {};
  return Object.fromEntries(
    (x.details as { field?: string; error?: string; message_ru?: string }[]).filter((d) => d.field).map((d) => [String(d.field).split('.').pop()!, d.message_ru ?? d.error ?? 'Проверьте значение']),
  );
}
