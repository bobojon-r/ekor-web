/** Уведомления с бэкенда: кэш в памяти + подписчики (шапка и страница), обновление по WebSocket */
import { http, tokens } from '../http';
import { realtime } from '../realtime';
import { CHAT } from '@/lib/features';
import type { Notif, NotifAct, NotifRole, NotifType } from '../notifications';

type NotificationOut = {
  id: number; role: NotifRole; type: string; title: string; body: string | null; action: string | null;
  target_type: 'task' | 'order' | 'chat' | 'invite' | 'review' | 'profile' | null; target_id: number | null; created_at: string; read_at: string | null;
};

const ACT: Record<string, [NotifType, NotifAct | undefined]> = {
  compare: ['resp', 'compare'], confirm: ['wait', 'confirm'], chat: ['msg', 'chat'], fix: ['rej', 'fix'], respond: ['task', 'respond'], reply: ['review', 'reply'],
  invite: ['task', undefined], confirm_invite: ['chosen', undefined], invite_other: ['lost', undefined], edit: ['rej', undefined], republish: ['lost', undefined],
};

function href(n: NotificationOut): string | undefined {
  const id = n.target_id;
  const m = n.role === 'master';
  switch (n.target_type) {
    case 'task': return m ? `/tasks/${id}` : n.action === 'fix' || n.action === 'edit' || n.action === 'republish' ? `/client/tasks/${id}/manage` : `/client/tasks/${id}`;
    case 'order': return m ? '/master/orders' : '/client';
    case 'chat': return CHAT ? `/chats/${id}` : m ? '/master/orders' : '/client';
    case 'invite': return m ? `/master/invites/${id}` : `/client/invites/${id}`;
    case 'review': return m ? '/master/reviews' : '/client/reviews';
    case 'profile': return '/master/profile';
    default: return undefined;
  }
}

function short(iso: string): Notif['time'] {
  const d = new Date(iso);
  const min = Math.max(1, Math.round((Date.now() - +d) / 60000));
  if (min < 60) return { ru: `${min} мин`, tj: `${min} дақ` };
  if (min < 24 * 60 && d.getDate() === new Date().getDate()) return { ru: `${Math.round(min / 60)} ч`, tj: `${Math.round(min / 60)} соат` };
  if (min < 48 * 60) {
    const hm = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return { ru: hm, tj: hm };
  }
  const days = Math.round(min / 1440);
  return { ru: `${days} дн`, tj: `${days} рӯз` };
}

function group(iso: string): Notif['g'] {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return +d >= +today ? 0 : +d >= +today - 864e5 ? 1 : 2;
}

function toNotif(n: NotificationOut): Notif & { orderId?: number } {
  const [type, act] = ACT[n.action ?? ''] ?? ['ok', undefined];
  // Тексты сервер отдаёт по-русски
  const L = (s: string) => ({ ru: s, tj: s });
  return {
    id: n.id, g: group(n.created_at), type, unread: !n.read_at, time: short(n.created_at), title: L(n.title), body: L(n.body ?? ''),
    act, href: href(n), orderId: n.target_type === 'order' && n.target_id ? n.target_id : undefined,
  };
}

let cache: Record<NotifRole, Notif[]> = { client: [], master: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
let inflight: Promise<void> | null = null;
let at = 0;

async function refresh(force = false) {
  if (!tokens.get() || (!force && Date.now() - at < 5000)) return;
  inflight ??= http<{ items: NotificationOut[] }>('/notifications', { query: { limit: 50 } })
    .then((p) => {
      at = Date.now();
      cache = { client: [], master: [] };
      for (const n of p.items) cache[n.role].push(toNotif(n));
      emit();
    })
    .catch(() => {})
    .finally(() => (inflight = null));
  return inflight;
}

let rtOff: (() => void) | null = null;

export const realNotifications = {
  read: () => cache,
  write(s: Record<NotifRole, Notif[]>) {
    cache = s;
    emit();
  },
  patch(role: NotifRole, id: number, p: Partial<Notif>) {
    cache = { ...cache, [role]: cache[role].map((n) => (n.id === id ? { ...n, ...p } : n)) };
    emit();
    if (p.unread === false) http('/notifications/read', { method: 'POST', body: { ids: [id] } }).catch(() => {});
  },
  readAll(role: NotifRole) {
    cache = { ...cache, [role]: cache[role].map((n) => ({ ...n, unread: false })) };
    emit();
    http('/notifications/read', { method: 'POST', body: { role } }).catch(() => {});
  },
  subscribe(f: () => void) {
    listeners.add(f);
    refresh();
    rtOff ??= realtime.on((e) => (e.type === 'notification' || e.type === 'reconnected') && refresh(true));
    return () => {
      listeners.delete(f);
      if (!listeners.size) rtOff?.(), (rtOff = null);
    };
  },
  /** «Подтвердить выполнение» прямо из уведомления */
  confirmOrder: (orderId: number) => http<void>(`/orders/${orderId}/confirm`, { method: 'POST' }),
};
