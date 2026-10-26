/** Отклики мастера. Мок в localStorage; лимит — 10 откликов в сутки (ТЗ) */
import type { Proposal } from './types';

const KEY = 'ekor_proposals';
export const DAILY_LIMIT = 10;
const delay = <T,>(v: T, ms = 800) => new Promise<T>((r) => setTimeout(() => r(v), ms));

type Store = { used: number; sent: Record<number, Proposal> };
const SEED: Store = { used: 3, sent: { 3: { price: 220, term: 1, msg: 'Здравствуйте! Смеситель могу привезти свой или поставить ваш. Работаю 11 лет, гарантия на установку.' } } };

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : SEED;
  } catch {
    return SEED;
  }
}
function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export const proposals = {
  state: () => read(),
  send: (taskId: number, p: Proposal) => {
    const s = read();
    const next = { used: s.used + (s.sent[taskId] ? 0 : 1), sent: { ...s.sent, [taskId]: p } };
    write(next);
    return delay(next);
  },
  withdraw: (taskId: number) => {
    const s = read();
    const sent = { ...s.sent };
    delete sent[taskId];
    const next = { ...s, sent };
    write(next);
    return delay(next, 400);
  },
};
