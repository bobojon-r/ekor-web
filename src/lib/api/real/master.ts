/** Кабинет мастера и отклики из ленты — с бэкенда */
import { ago } from '../../i18n/format';
import { http } from '../http';
import { nm } from '../remote';
import type { MasterOrder, MasterProp, MasterReview, OrderStatus, PropStatus } from '../masterCabinet';
import type { Proposal } from '../types';
import type { OrderOut } from './clientTasks';
import { dayMonth, digits, reasonId, TERM, termIdx } from './common';

type Resp = {
  id: number; status: 'sent' | 'viewed' | 'chosen' | 'rejected' | 'withdrawn' | 'closed'; price: number | null; inspect: boolean; term: string; message: string; edited: boolean;
  created_at: string; task: OrderOut['task'];
};
type RespPage = { items: Resp[]; daily_limit: number; daily_left: number };
type Rev = { id: number; author_name: string; rating: number; text: string; task_title: string; created_at: string; reply_text: string | null };

const L = (ru: string, tj: string) => ({ ru, tj });
const TASK_WHEN = { today: L('Сегодня', 'Имрӯз'), tomorrow: L('Завтра', 'Фардо'), date: L('В выбранный день', 'Дар рӯзи интихобшуда'), week: L('На этой неделе', 'Дар ин ҳафта'), flexible: L('Не срочно', 'Фаврӣ нест') };
const TERM_L = [L('Сегодня', 'Имрӯз'), L('Завтра', 'Фардо'), L('За 2–3 дня', 'Дар 2–3 рӯз'), L('Обсудим', 'Гуфтугӯ мекунем')];
const OST: Record<OrderOut['status'], OrderStatus> = { chosen: 'chosen', work: 'work', wait: 'wait', dispute: 'wait', done: 'done', cancelled: 'cancelled', declined: 'cancelled' };
const PST: Record<Resp['status'], PropStatus> = { sent: 'sent', viewed: 'viewed', chosen: 'viewed', rejected: 'rejected', closed: 'rejected', withdrawn: 'withdrawn' };

async function load() {
  const [oa, oz, rs, rv] = await Promise.all([
    http<{ items: OrderOut[] }>('/me/orders', { query: { role: 'master', tab: 'active', limit: 50 } }),
    http<{ items: OrderOut[] }>('/me/orders', { query: { role: 'master', tab: 'archive', limit: 50 } }),
    http<RespPage>('/me/responses', { query: { limit: 50 } }),
    http<{ items: Rev[] }>('/me/reviews', { query: { role: 'master', limit: 50 } }),
  ]);
  const orders = [...oa.items, ...oz.items].map(
    (o): MasterOrder => ({
      id: o.id, title: o.task.title, client: o.counterpart.name, district: nm(o.task.district), when: o.term ? TERM_L[termIdx(o.term)] : TASK_WHEN[o.task.when],
      price: o.price ?? 0, status: OST[o.status], chatId: o.chat_id ?? undefined, disputeId: o.dispute?.id, contacts: o.address || o.counterpart.phone ? { address: o.address ?? '', phone: digits(o.counterpart.phone) } : undefined,
    }),
  );
  const props = rs.items
    .filter((r) => r.status !== 'chosen')
    .map(
      (r): MasterProp => ({
        id: r.id, title: r.task.title, district: nm(r.task.district), when: TERM_L[termIdx(r.term)], price: r.inspect ? null : r.price, msg: r.message,
        status: PST[r.status], ago: L(ago('ru', r.created_at), ago('tj', r.created_at)), responses: r.task.responses_count, edited: r.edited,
      }),
    );
  const reviews = rv.items.map((r): MasterReview => ({ id: r.id, name: r.author_name, stars: r.rating, text: r.text, date: dayMonth(r.created_at), task: r.task_title, reply: r.reply_text }));
  return { orders, props, reviews };
}

const then = async (p: Promise<unknown>) => (await p, load());

export const realMasterCabinet = {
  load,
  start: (id: number) => then(http(`/orders/${id}/start`, { method: 'POST' })),
  done: (id: number) => then(http(`/orders/${id}/done`, { method: 'POST' })),
  remind: (id: number) => then(http(`/orders/${id}/remind`, { method: 'POST' })),
  decline: async (id: number, reason: number) => then(http(`/orders/${id}/decline`, { method: 'POST', body: { reason_id: await reasonId('order_decline', reason), comment: null } })),
  editProp: (id: number, price: number | null, msg: string) => then(http(`/responses/${id}`, { method: 'PATCH', body: { price, inspect: price === null, message: msg } })),
  withdraw: (id: number) => then(http(`/responses/${id}`, { method: 'DELETE' })),
  reply: (id: number, text: string) => then(http(`/reviews/${id}/reply`, { method: 'POST', body: { text } })),
};

/* ---------- отклики из ленты ---------- */

type Store = { used: number; limit: number; sent: Record<number, Proposal>; ids: Record<number, number> };

async function state(): Promise<Store> {
  const r = await http<RespPage>('/me/responses', { query: { limit: 50 } });
  const live = r.items.filter((x) => x.status === 'sent' || x.status === 'viewed');
  return {
    used: r.daily_limit - r.daily_left,
    limit: r.daily_limit,
    sent: Object.fromEntries(live.map((x) => [x.task.id, { price: x.inspect ? null : x.price, term: termIdx(x.term), msg: x.message }])),
    ids: Object.fromEntries(live.map((x) => [x.task.id, x.id])),
  };
}

export const realProposals = {
  load: state,
  async send(taskId: number, p: Proposal) {
    const cur = await state();
    const body = { price: p.price, inspect: p.price === null, term: TERM[p.term] ?? 'discuss', message: p.msg };
    if (cur.ids[taskId]) await http(`/responses/${cur.ids[taskId]}`, { method: 'PATCH', body });
    else await http(`/tasks/${taskId}/responses`, { method: 'POST', body });
    return state();
  },
  async withdraw(taskId: number) {
    const id = (await state()).ids[taskId];
    if (id) await http(`/responses/${id}`, { method: 'DELETE' });
    return state();
  },
};
