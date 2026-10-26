/**
 * Слой данных. Сейчас — моки с задержкой сети; при подключении бэкенда
 * заменить тела функций на fetch к API (контракт — backend/README.md), сигнатуры сохранить.
 */
import { CATEGORY_TREE, FEATURED, HOME_REVIEWS, HOME_TASKS, MASTERS, MASTER_REVIEWS, REGIONS } from './data';
import type { CatalogCategory, Master, RegionKey } from './types';

export * from './types';

const delay = <T,>(v: T, ms = 450) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const api = {
  regions: () => REGIONS,
  region: (k: RegionKey) => REGIONS.find((r) => r.key === k)!,
  featuredCategories: () => FEATURED,
  categoryTree: () => CATEGORY_TREE,

  async home(region: RegionKey) {
    const local = MASTERS.filter((m) => m.region === region);
    const online = MASTERS.filter((m) => m.online);
    const near = (x: { region?: RegionKey; online?: boolean }) => x.region === region || !!x.online;
    return delay(
      {
        localCount: local.length,
        masters: [...local, ...online],
        tasks: [...HOME_TASKS.filter(near), ...HOME_TASKS.filter((t) => !near(t))],
        reviews: [...HOME_REVIEWS.filter(near), ...HOME_REVIEWS.filter((r) => !near(r))].slice(0, 3),
      },
      700,
    );
  },

  async masters(q: MastersQuery) {
    return delay(filterMasters(q));
  },

  async master(id: number) {
    const m = MASTERS.find((x) => x.id === id) ?? null;
    return delay(m ? { master: m, reviews: m.reviews ? MASTER_REVIEWS : [] } : null, 300);
  },

  /** Счётчик для кнопки «Показать N» — до применения фильтров */
  mastersCount: (q: MastersQuery) => filterMasters(q).length,

  /** Сколько мастеров нашлось бы в других городах по тем же фильтрам (для пустого состояния) */
  mastersElsewhere(q: MastersQuery) {
    return REGIONS.map((r) => ({ region: r, n: filterMasters({ ...q, region: r.key }).filter((m) => !m.online).length })).filter((x) => x.region.key !== q.region && x.n > 0);
  },
};

export type MastersQuery = {
  region: RegionKey;
  q?: string;
  category?: CatalogCategory | null;
  priceMax?: number;
  ratingMin?: number;
  onlineOnly?: boolean;
  availableOnly?: boolean;
  sort?: 'rel' | 'rev' | 'act';
};

function filterMasters(f: MastersQuery): Master[] {
  const ql = (f.q ?? '').trim().toLowerCase();
  const r = MASTERS.filter(
    (x) =>
      (f.onlineOnly ? x.online : x.region === f.region || x.online) &&
      (!f.category || x.category === f.category) &&
      (!f.priceMax || (x.priceFrom !== null && x.priceFrom <= f.priceMax)) &&
      (!f.ratingMin || (x.reviews > 0 && x.rating >= f.ratingMin)) &&
      (!f.availableOnly || x.available) &&
      (!ql || `${x.name} ${x.profession.ru} ${x.profession.tj} ${x.bio}`.toLowerCase().includes(ql)),
  );
  const score = (x: Master) => (x.online ? -1 : 0) + (x.verified ? 1 : 0) + (x.available ? 1 : 0) + (x.reviews ? (x.rating * Math.log(1 + x.reviews)) / 4 : 0);
  if (!f.sort || f.sort === 'rel') r.sort((a, b) => score(b) - score(a));
  if (f.sort === 'rev') r.sort((a, b) => b.reviews - a.reviews);
  if (f.sort === 'act') r.sort((a, b) => Number(b.available) - Number(a.available) || b.reviews - a.reviews);
  return r;
}
