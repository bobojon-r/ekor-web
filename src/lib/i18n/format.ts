import type { L10n, Lang } from './types';

export function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

/** «1 500» — пробел (неразрывный узкий) в тысячах */
export function num(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** «4,8» */
export function rating(n: number) {
  return n.toFixed(1).replace('.', ',');
}

export function pick(v: L10n, lang: Lang) {
  return v[lang];
}

const CUR = 'смн';

/** Деньги: «до 1 500 смн», «от 80 смн», «120 смн» или «Договорная» */
export function money(lang: Lang, amount: number | null | undefined, prefix?: 'from' | 'upto') {
  if (amount == null) return lang === 'tj' ? 'Бо мувофиқа' : 'Договорная';
  const p = prefix === 'from' ? (lang === 'tj' ? 'аз ' : 'от ') : prefix === 'upto' ? (lang === 'tj' ? 'то ' : 'до ') : '';
  return `${p}${num(amount)} ${CUR}`;
}

export function countReviews(lang: Lang, n: number) {
  return lang === 'tj' ? `${n} шарҳ` : `${n} ${plural(n, 'отзыв', 'отзыва', 'отзывов')}`;
}

export function countMasters(lang: Lang, n: number) {
  return lang === 'tj' ? `${n} усто` : `${n} ${plural(n, 'мастер', 'мастера', 'мастеров')}`;
}

export function countResponses(lang: Lang, n: number) {
  if (n === 0) return lang === 'tj' ? 'Ҳоло ҷавоб нест' : 'Ещё нет откликов';
  return lang === 'tj' ? `${n} ҷавоб` : `${n} ${plural(n, 'отклик', 'отклика', 'откликов')}`;
}

/** «35 мин назад», «2 ч назад», «3 дн. назад» */
export function ago(lang: Lang, iso: string, now = Date.now()) {
  const min = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 60) return lang === 'tj' ? `${min} дақ пеш` : `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === 'tj' ? `${h} соат пеш` : `${h} ч назад`;
  const d = Math.round(h / 24);
  return lang === 'tj' ? `${d} рӯз пеш` : `${d} дн. назад`;
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

/** Телефон по маске 2-3-2-2: «93 555 12 34» */
export function phoneMask(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}
