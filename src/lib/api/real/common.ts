/** Общее для реальных хранилищ: справочник причин, форматирование, загрузка фото */
import { http } from '../http';
import type { TaskCardOut } from '../remote';

export type ReasonKind = 'task_cancel' | 'choice_cancel' | 'order_decline' | 'invite_decline' | 'dispute' | 'chat_report' | 'task_report' | 'profile_report' | 'review_report';
type ReasonRow = { id: number; code: string; text_ru: string; text_tj: string | null };

const cache = new Map<ReasonKind, Promise<ReasonRow[]>>();
/** Причины в модалках идут в том же порядке, что и справочник бэкенда — индекс → id */
export async function reasonId(kind: ReasonKind, index: number) {
  if (!cache.has(kind)) cache.set(kind, http<ReasonRow[]>('/reasons', { query: { kind } }).catch((e) => (cache.delete(kind), Promise.reject(e))));
  const list = await cache.get(kind)!;
  const r = list[index] ?? list[list.length - 1];
  if (!r) throw new Error(`reason ${kind}#${index}`);
  return r.id;
}

/** «80–150», «до 300», «от 300», null — договорная */
export function budgetStr(k: Pick<TaskCardOut, 'budget_mode' | 'budget_min' | 'budget_max'>) {
  if (k.budget_mode !== 'sum') return null;
  const { budget_min: a, budget_max: b } = k;
  if (a && b) return a === b ? String(a) : `${a}–${b}`;
  if (b) return `до ${b}`;
  if (a) return `от ${a}`;
  return null;
}

/** 9 цифр без +992 */
export const digits = (phone: string | null | undefined) => (phone ?? '').replace(/\D/g, '').slice(-9);
export const intl = (d9: string) => `+992${d9}`;

export const TERM = ['today', 'tomorrow', '2_3_days', 'discuss'] as const;
export const termIdx = (t: string | null | undefined) => Math.max(0, TERM.indexOf((t ?? 'discuss') as (typeof TERM)[number]));

export async function upload(kind: 'avatar' | 'portfolio' | 'task_photo' | 'chat_photo' | 'dispute_photo' | 'verify_doc', file: Blob) {
  const fd = new FormData();
  fd.append('kind', kind);
  fd.append('file', file);
  return http<{ id: number; url: string }>('/uploads', { method: 'POST', form: fd });
}

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${SHORT[d.getMonth()]}`;
};
