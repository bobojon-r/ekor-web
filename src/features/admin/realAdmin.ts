/** Админ-панель с бэкенда (/api/admin/*). Доступ — только сотрудникам; иначе 401/403 */
import { http } from '@/lib/api';
import { ref } from '@/lib/api/ref';

type QueueItem = {
  type: 'task' | 'master' | 'profession'; id: number; title: string; city_ru: string | null; author_id: number; author_name: string | null; category: string | null;
  budget: string | null; text: string; flags: string[]; age_minutes: number; profession_id: number | null;
};
type AuditRow = { at: string; actor_name: string | null; action: string; object_type: string; object_id: number | null; old: object | null; new: object | null; comment: string | null };
type DisputeRow = { id: number; order_id: number; task_title: string; reason_ru: string; text: string | null; chat_id: number | null; created_at: string; client_id: number; master_id: number };
type Msg = { sender_id: number | null; type: string; body: string | null; system_code: string | null; created_at: string };
type Funnel = { tasks_published: number; tasks_with_response: number; tasks_with_response_24h: number; tasks_chosen: number; orders_done: number; moderation_median_minutes: number | null };

export type AdminItem = { id: string; type: 'task' | 'master'; title: string; city: string; age: number; author: string; cat: string; budget: string; pre: string; hl: string; post: string; flags: string[] };
export type AdminAudit = { t: string; who: string; act: string; obj: string; fresh?: boolean };
export type AdminDispute = { id: number; head: string; title: string; client: string; master: string; reason: string; text: string; transcript: [string, string, string][] };

/** Контакт в тексте подсвечиваем, как в дизайне: телефон, ссылка, @ник */
const CONTACT = /(\+?992[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{9}\b|https?:\/\/\S+|\b[\w-]+\.(?:com|tj|ru|me)\/?\S*|@\w{3,}|telegram\s*@?\w+)/i;
const split = (text: string) => {
  const m = text.match(CONTACT);
  return m && m.index !== undefined ? { pre: text.slice(0, m.index), hl: m[0], post: text.slice(m.index + m[0].length) } : { pre: text, hl: '', post: '' };
};
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const ACTION: Record<string, string> = {
  'task.approve': 'Одобрил(а) задание', 'task.reject': 'Отклонил(а) задание', 'master.approve': 'Одобрил(а) профиль', 'master.reject': 'Отклонил(а) профиль',
  'dispute.resolve': 'Закрыл(а) спор', 'review.hide': 'Скрыл(а) отзыв', 'review.restore': 'Вернул(а) отзыв', 'user.block': 'Заблокировал(а)', 'user.unblock': 'Разблокировал(а)', 'limits.update': 'Изменил(а) лимиты',
};

const items = new Map<string, QueueItem>();
const disputes = new Map<number, DisputeRow>();

export async function loadAdmin() {
  const [queue, audit, disp, funnel] = await Promise.all([
    http<QueueItem[]>('/admin/queue', { query: { type: 'all' } }),
    http<{ items: AuditRow[] }>('/admin/audit', { query: { limit: 50 } }),
    http<{ items: DisputeRow[] }>('/admin/disputes', { query: { status: 'open', limit: 10 } }),
    http<Funnel>('/admin/stats/funnel', { query: { days: 30 } }),
  ]);
  const cities = ref.get()?.cities ?? [];
  const byCity = await Promise.all(cities.map((c) => http<Funnel>('/admin/stats/funnel', { query: { days: 30, city_id: c.id } }).catch(() => null)));

  items.clear();
  const q: AdminItem[] = queue.map((x) => {
    const id = `${x.type}:${x.id}:${x.profession_id ?? ''}`;
    items.set(id, x);
    return {
      id, type: x.type === 'task' ? 'task' : 'master', title: x.title, city: x.city_ru ?? '—', age: x.age_minutes, author: x.author_name ?? `#${x.author_id}`,
      cat: x.category ?? '—', budget: x.budget ?? '—', flags: x.flags, ...split(x.text),
    };
  });

  let dispute: AdminDispute | undefined;
  const d = disp.items[0];
  disp.items.forEach((x) => disputes.set(x.id, x));
  if (d) {
    const msgs = d.chat_id ? await http<Msg[]>(`/admin/chats/${d.chat_id}/messages`).catch(() => [] as Msg[]) : [];
    dispute = {
      id: d.id, head: `#${d.id} · открыт ${when(d.created_at)}`, title: d.task_title, client: `Клиент #${d.client_id}`, master: `Мастер #${d.master_id}`,
      reason: d.reason_ru, text: d.text ?? '',
      transcript: msgs.map((m) => [when(m.created_at), m.type === 'system' ? 'Система' : m.sender_id === d.client_id ? 'Клиент' : 'Мастер', m.body ?? m.system_code ?? '']),
    };
  }

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%');
  const f = funnel;
  return {
    queue: q,
    audit: audit.items.map((a): AdminAudit => ({ t: when(a.at), who: a.actor_name ?? 'Система', act: ACTION[a.action] ?? a.action, obj: [`${a.object_type} #${a.object_id ?? ''}`, a.comment].filter(Boolean).join(' · ') })),
    disp: { open: !!d, result: '' },
    dispute,
    disputesOpen: disp.items.length,
    funnel: [
      ['Заданий создано', f.tasks_published, '100%', ''],
      ['Получили отклик', f.tasks_with_response, pct(f.tasks_with_response, f.tasks_published), `${pct(f.tasks_with_response, f.tasks_published)} от созданных`],
      ['Мастер выбран', f.tasks_chosen, pct(f.tasks_chosen, f.tasks_published), `${pct(f.tasks_chosen, f.tasks_with_response)} от получивших отклик`],
      ['Завершено', f.orders_done, pct(f.orders_done, f.tasks_published), `${pct(f.orders_done, f.tasks_chosen)} от выбранных`],
    ] as [string, number, string, string][],
    regions: cities.flatMap((c, i) => {
      const x = byCity[i];
      return x ? [[c.name.ru, x.tasks_published, x.tasks_with_response, x.orders_done, x.tasks_published - x.tasks_with_response_24h] as [string, number, number, number, number]] : [];
    }),
    medianMod: f.moderation_median_minutes,
  };
}
export type AdminData = Awaited<ReturnType<typeof loadAdmin>>;

const REJECT_KIND = { task: 'task_reject', master: 'master_reject' } as const;
async function rejectReasonId(type: 'task' | 'master', code: string) {
  const list = await http<{ id: number; code: string }[]>('/reasons', { query: { kind: REJECT_KIND[type] } });
  return (list.find((r) => r.code === code) ?? list.find((r) => r.code === 'other') ?? list[0]).id;
}

export async function moderate(id: string, ok: boolean, code?: string, comment?: string) {
  const x = items.get(id);
  if (!x) throw new Error('queue item not found');
  if (x.type === 'profession') return http(`/admin/masters/${x.author_id}/professions/${x.profession_id}/${ok ? 'approve' : 'reject'}`, { method: 'POST' });
  const base = x.type === 'task' ? `/admin/tasks/${x.id}` : `/admin/masters/${x.id}`;
  if (ok) return http(`${base}/approve`, { method: 'POST' });
  return http(`${base}/reject`, { method: 'POST', body: { reason_id: await rejectReasonId(x.type, code ?? 'other'), comment: comment || null } });
}

/** client → не выполнена, master → выполнена */
export const resolveDispute = (id: number, dec: 'client' | 'master', comment: string) =>
  http(`/admin/disputes/${id}/resolve`, { method: 'POST', body: { resolution: dec === 'client' ? 'not_done' : 'done', comment } });
