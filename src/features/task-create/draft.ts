import type { RegionKey } from '@/lib/api';

export type Draft = {
  cat: string | null;
  sub: number | null;
  title: string;
  desc: string;
  mode: 'site' | 'online';
  region: RegionKey;
  district: string | null;
  addr: string;
  when: number | null; // 0 сегодня · 1 завтра · 2 дата · 3 не срочно
  date: string;
  tod: number | null;
  bmode: 'sum' | 'neg';
  bmin: string;
  bmax: string;
};

export const EMPTY: Draft = {
  cat: null, sub: null, title: '', desc: '', mode: 'site', region: 'dushanbe', district: null, addr: '',
  when: null, date: '', tod: null, bmode: 'sum', bmin: '', bmax: '',
};

const KEY = 'ekor_task_draft';
const TTL = 7 * 24 * 3600 * 1000;

/** Черновик живёт в браузере 7 дней — введённое не теряется при закрытии вкладки и входе по SMS */
export function loadDraft(): { draft: Draft; step: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (Date.now() - v.at > TTL) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { draft: { ...EMPTY, ...v.draft }, step: v.step ?? 1 };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft, step: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ draft, step, at: Date.now() }));
  } catch {}
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export type Errors = Partial<Record<'cat' | 'title' | 'desc' | 'district' | 'when' | 'budget', string>>;

export function validate(step: number, d: Draft): Errors {
  const e: Errors = {};
  if (step === 1) {
    if (!d.cat) e.cat = 'cat';
    const l = d.title.trim().length;
    if (l < 10 || l > 120) e.title = 'title';
  }
  if (step === 2 && d.desc.trim().length < 30) e.desc = 'desc';
  if (step === 3) {
    if (d.mode === 'site' && !d.district) e.district = 'district';
    if (d.when === null) e.when = 'w';
    else if (d.when === 2 && !d.date) e.when = 'd';
  }
  if (step === 4 && d.bmode === 'sum') {
    if (!d.bmin && !d.bmax) e.budget = 'e';
    else if (d.bmin && d.bmax && +d.bmax < +d.bmin) e.budget = 'r';
  }
  return e;
}
