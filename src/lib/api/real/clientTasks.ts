/**
 * Задания клиента с бэкенда. Экран «Мои задания» объединяет задание и заказ по нему,
 * поэтому список собирается из /me/tasks, /me/orders, откликов, отзывов и чатов.
 */
import { http } from '../http';
import { ref } from '../ref';
import { catKey, cityKey, nm, WHEN, YEARS, type NR, type TaskCardOut } from '../remote';
import type { ClientTask, ClientTaskStatus, TaskResponse } from '../clientTasks';
import { CHAT } from '@/lib/features';
import { budgetStr, digits, monthYear, reasonId, termIdx, upload } from './common';

type Reason = { code: string; text_ru: string; user_message_ru: string | null } | null;
export type TaskOwnOut = TaskCardOut & {
  description: string; address: string | null; created_at: string; reject_reason: Reason; reject_comment: string | null;
};
type MasterBrief = { id: number; name: string | null; rating_avg: number | null; reviews_count: number; verified: boolean; experience: keyof typeof YEARS | null };
type RespOut = { id: number; status: string; price: number | null; inspect: boolean; term: string; message: string; created_at: string; master: MasterBrief };
export type OrderOut = {
  id: number; status: 'chosen' | 'work' | 'wait' | 'dispute' | 'done' | 'cancelled' | 'declined'; task: TaskCardOut & { district: NR | null }; price: number | null;
  term: string | null; address: string | null; counterpart: { id: number; name: string; phone: string | null }; chat_id: number | null; created_at: string;
  actions: string[]; dispute?: { id: number; status: 'open' | 'resolved' } | null;
};
type MyReview = { order_id: number; rating: number; text: string; created_at: string; reply_text: string | null };
type Chat = { order_id: number | null; role: 'client' | 'master'; unread_count: number };

const ORDER: Record<OrderOut['status'], ClientTaskStatus | null> = { chosen: 'chosen', work: 'chosen', wait: 'wait', dispute: 'dispute', done: 'done', cancelled: null, declined: null };

const toResp = (r: RespOut): TaskResponse => ({
  id: String(r.id),
  masterId: r.master.id,
  name: r.master.name ?? '',
  rating: r.master.rating_avg ?? 0,
  reviews: r.master.reviews_count,
  verified: r.master.verified,
  years: r.master.experience ? YEARS[r.master.experience] : 0,
  price: r.inspect ? null : r.price,
  term: Math.min(2, termIdx(r.term)),
  createdAt: r.created_at,
  msg: r.message,
});

let last: ClientTask[] | null = null;

async function list(): Promise<ClientTask[]> {
  return (last = await build());
}

async function build(): Promise<ClientTask[]> {
  const [active, archive, oa, oz, reviews, chats] = await Promise.all([
    http<{ items: TaskOwnOut[] }>('/me/tasks', { query: { tab: 'active', limit: 50 } }),
    http<{ items: TaskOwnOut[] }>('/me/tasks', { query: { tab: 'archive', limit: 50 } }),
    http<{ items: OrderOut[] }>('/me/orders', { query: { role: 'client', tab: 'active', limit: 50 } }),
    http<{ items: OrderOut[] }>('/me/orders', { query: { role: 'client', tab: 'archive', limit: 50 } }),
    http<{ items: MyReview[] }>('/me/reviews', { query: { role: 'client', limit: 50 } }).catch(() => ({ items: [] as MyReview[] })),
    CHAT ? http<{ items: Chat[] }>('/chats').catch(() => ({ items: [] as Chat[] })) : { items: [] as Chat[] },
  ]);
  const tasks = [...active.items, ...archive.items];
  // Последний живой заказ по заданию (отменённые/отказ не считаем — задание снова открыто)
  const orders = new Map<number, OrderOut>();
  for (const o of [...oz.items, ...oa.items]) if (ORDER[o.status]) orders.set(o.task.id, o);
  const resp = new Map<number, RespOut[]>();
  await Promise.all(
    tasks
      .filter((k) => k.status === 'open' || k.status === 'chosen' || orders.has(k.id))
      .map((k) => http<{ items: RespOut[] }>(`/tasks/${k.id}/responses`).then((r) => resp.set(k.id, r.items), () => {})),
  );

  return tasks.map((k): ClientTask => {
    const o = orders.get(k.id);
    const rs = resp.get(k.id) ?? [];
    const status: ClientTaskStatus = o ? ORDER[o.status]! : k.status === 'draft' ? 'review' : k.status === 'closed' ? 'cancelled' : (k.status as ClientTaskStatus);
    const chosen = o && rs.find((r) => r.master.id === o.counterpart.id);
    const rv = o && reviews.items.find((r) => r.order_id === o.id);
    const reason = k.reject_reason;
    return {
      id: k.id,
      title: k.title,
      category: catKey(k.subcategory ?? k.category),
      status,
      createdAt: k.published_at ?? k.created_at,
      region: cityKey(k.city) ?? 'dushanbe',
      district: nm(k.district),
      address: o?.address ?? k.address ?? undefined,
      budget: budgetStr(k),
      disputeId: o?.dispute?.id,
      budgetMax: k.budget_mode === 'sum' ? (k.budget_max ?? k.budget_min) : null,
      when: WHEN[k.when],
      views: k.views_count,
      desc: k.description,
      newResponses: status === 'open' ? rs.filter((r) => r.status === 'sent').length : 0,
      unread: o ? (chats.items.find((c) => c.order_id === o.id && c.role === 'client')?.unread_count ?? 0) : 0,
      responses: status === 'open' ? rs.filter((r) => r.status === 'sent' || r.status === 'viewed').map(toResp) : undefined,
      master: o && {
        name: o.counterpart.name,
        masterId: o.counterpart.id,
        rating: chosen?.master.rating_avg ?? 0,
        reviews: chosen?.master.reviews_count ?? 0,
        verified: chosen?.master.verified ?? false,
        category: catKey(k.subcategory ?? k.category),
        price: o.price,
        phone: digits(o.counterpart.phone),
      },
      review: rv ? { stars: rv.rating, text: rv.text, date: monthYear(rv.created_at), reply: rv.reply_text ?? undefined } : undefined,
      rejectReason: reason ? [reason.user_message_ru ?? reason.text_ru, k.reject_comment].filter(Boolean).join(' ') : undefined,
      orderId: o?.id,
      chatId: o?.chat_id ?? undefined,
    };
  });
}

/** Действие с заданием/заказом, затем свежий список */
const then = async (p: Promise<unknown>) => (await p, list());
const orderOf = async (taskId: number) => {
  const k = (await list()).find((x) => x.id === taskId);
  if (!k?.orderId) throw new Error('order not found');
  return k.orderId;
};
const WHEN_KEY = ['today', 'tomorrow', 'week', 'flexible'] as const;

export const realClientTasks = {
  list,
  /** Отклики помечает просмотренными сам сервер при загрузке; локально только сбрасываем «новые» */
  markSeen: async (id: number) => (last ?? (await list())).map((k) => (k.id === id ? { ...k, newResponses: 0 } : k)),
  choose: (_id: number, respId: string) => then(http(`/responses/${respId}/choose`, { method: 'POST', headers: { 'idempotency-key': `choose-${respId}` } })),
  cancelChoice: async (id: number, reason: number, note: string) =>
    then(http(`/orders/${await orderOf(id)}/cancel`, { method: 'POST', body: { reason_id: await reasonId('choice_cancel', reason), comment: note || null } })),
  /** Демо-кнопка мока: с бэкендом «выполнено» отмечает сам мастер */
  demoMasterDone: (_id: number) => list(),
  confirmDone: async (id: number) => then(http(`/orders/${await orderOf(id)}/confirm`, { method: 'POST' })),
  problem: async (id: number, reason: number, note: string) =>
    then(http(`/orders/${await orderOf(id)}/dispute`, { method: 'POST', body: { reason_id: await reasonId('dispute', reason), text: note || null, photo_ids: [] } })),
  update: (id: number, p: { title: string; desc: string; budgetMax: number | null; when: number }) =>
    then(
      http(`/tasks/${id}`, {
        method: 'PATCH',
        body: {
          title: p.title, description: p.desc, when: WHEN_KEY[p.when] ?? 'flexible',
          ...(p.budgetMax === null ? { budget_mode: 'negotiable', budget_min: null, budget_max: null } : { budget_mode: 'sum', budget_min: null, budget_max: p.budgetMax }),
        },
      }),
    ),
  cancelTask: async (id: number, reason: number) => then(http(`/tasks/${id}/cancel`, { method: 'POST', body: { reason_id: await reasonId('task_cancel', reason), comment: null } })),
  republish: (id: number) => then(http(`/tasks/${id}/republish`, { method: 'POST' })),
  review: async (id: number, stars: number, text: string, _date: string) => then(http(`/orders/${await orderOf(id)}/review`, { method: 'POST', body: { rating: stars, text } })),

  /** Новое задание: фото загружаются заранее, затем POST /tasks — уходит на модерацию */
  async create(
    d: { cat: string | null; sub: number | null; title: string; desc: string; mode: 'site' | 'online'; region: string; district: string | null; addr: string; when: number | null; date: string; tod: number | null; bmode: 'sum' | 'neg'; bmin: string; bmax: string },
    files: Blob[] = [],
  ) {
    const cat = ref.cat(d.cat) ?? ref.cat('other');
    const sub = d.sub !== null ? cat?.children[d.sub] : undefined;
    const city = ref.city(d.region);
    const district = d.district ? ref.get()?.districts[d.region]?.find((x) => x.name.ru === d.district || x.name.tj === d.district) : undefined;
    const photos = await Promise.all(files.map((f) => upload('task_photo', f)));
    const online = d.mode === 'online';
    return http<TaskOwnOut>('/tasks', {
      method: 'POST',
      body: {
        category_id: cat?.id, subcategory_id: sub?.id ?? null, title: d.title.trim(), description: d.desc.trim(), photo_ids: photos.map((p) => p.id),
        mode: d.mode, city_id: online ? null : city?.id, district_id: online ? null : (district?.id ?? null), address: online ? null : d.addr.trim() || null,
        when: (['today', 'tomorrow', 'date', 'flexible'] as const)[d.when ?? 3], date: d.when === 2 ? d.date || null : null,
        time_of_day: d.tod !== null ? (['morning', 'day', 'evening'] as const)[d.tod] : null,
        budget_mode: d.bmode === 'neg' ? 'negotiable' : 'sum', budget_min: d.bmode === 'neg' ? null : Number(d.bmin) || null, budget_max: d.bmode === 'neg' ? null : Number(d.bmax) || null,
      },
    });
  },
};
