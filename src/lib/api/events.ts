/**
 * Аналитика продукта: события копятся и уходят пачкой в POST /events (раз в 5 с и при уходе со страницы).
 * Ошибки не показываем — потеря события не должна мешать пользователю.
 */
import { USE_API } from './flags';
import { API_ORIGIN, tokens } from './http';

export type EventName = 'home_view' | 'search' | 'master_profile_view' | 'task_started' | 'master_signup_started';
type Ev = { name: EventName; city_id?: number | null; category_id?: number | null; props?: Record<string, unknown> };

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const token = tokens.get()?.access;
  fetch(`${typeof window === 'undefined' ? API_ORIGIN : ''}/api/events`, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ events }),
  }).catch(() => {});
}

export function track(name: EventName, e: Omit<Ev, 'name'> = {}) {
  if (!USE_API || typeof window === 'undefined') return;
  queue.push({ name, ...e, props: e.props ?? {} });
  if (!timer) timer = setTimeout(flush, 5000);
}

if (typeof window !== 'undefined') addEventListener('pagehide', flush);
