/** Отклики мастера. Мок в localStorage; лимит — 10 откликов в сутки (ТЗ) */
import { USE_API } from './flags';
import { realProposals } from './real/master';
import type { Proposal } from './types';

const KEY = 'ekor_proposals';
export const DAILY_LIMIT = 10;
const delay = <T,>(v: T, ms = 800) => new Promise<T>((r) => setTimeout(() => r(v), ms));

type Store = { used: number; limit?: number; sent: Record<number, Proposal> };
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

const mockProposals = {
  state: () => read(),
  load: () => delay(read(), 0),
  send: (taskId: number, p: Proposal): Promise<Store> => {
    const s = read();
    const next = { used: s.used + (s.sent[taskId] ? 0 : 1), sent: { ...s.sent, [taskId]: p } };
    write(next);
    return delay(next);
  },
  withdraw: (taskId: number): Promise<Store> => {
    const s = read();
    const sent = { ...s.sent };
    delete sent[taskId];
    const next = { ...s, sent };
    write(next);
    return delay(next, 400);
  },
};

/** state() — синхронно только в моках (кабинет мастера мешает их с историей); с бэкендом — load() */
export const proposals = USE_API ? { ...realProposals, state: (): Store => ({ used: 0, sent: {} }) } : mockProposals;
