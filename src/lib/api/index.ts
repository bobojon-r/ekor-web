/**
 * Слой данных. Сейчас — моки с задержкой сети; при подключении бэкенда
 * заменить тела функций на fetch к API (контракт — backend/README.md), сигнатуры сохранить.
 */
import { clientTasks } from './clientTasks';
import { CATEGORY_TREE, DISTRICTS, FEATURED, FEED, TASK_CATEGORIES, HOME_REVIEWS, HOME_TASKS, MASTERS, MASTER_REVIEWS, REGIONS } from './data';
import type { CatalogCategory, FeedTask, Master, RegionKey } from './types';

export * from './types';
export { invites, type Invite, type InviteStatus } from './invites';
export { proposals, DAILY_LIMIT } from './proposals';
export { masterCabinet, type MasterOrder, type MasterProp, type MasterReview, type OrderStatus, type PropStatus } from './masterCabinet';
export { clientTasks, isArchived, type ClientTask, type ClientTaskStatus, type TaskResponse } from './clientTasks';

const delay = <T,>(v: T, ms = 450) => new Promise<T>((r) => setTimeout(() => r(v), ms));

/** Пока true — показываем демо-подсказки (код 123456). Уберётся с подключением API */
export const IS_MOCK = true;

/** Префиксы операторов Таджикистана */
const OPERATORS = ['00', '01', '10', '11', '12', '20', '50', '55', '70', '77', '88', '90', '91', '92', '93', '94', '98', '99'];

export const api = {
  auth: {
    validPhone: (p: string): 'len' | 'op' | null => (p.length < 9 ? 'len' : OPERATORS.includes(p.slice(0, 2)) ? null : 'op'),
    sendCode: (phone: string) => delay({ phone, resendIn: 60, tries: 3 }, 700),
    /** ok:false — неверный код; name:null — новый пользователь, спросим имя */
    verify: (_phone: string, code: string) => delay(code === '123456' ? { ok: true as const, name: null as string | null } : { ok: false as const, name: null }, 600),
  },

  regions: () => REGIONS,
  region: (k: RegionKey) => REGIONS.find((r) => r.key === k)!,
  featuredCategories: () => FEATURED,
  districts: (r: RegionKey) => DISTRICTS[r] ?? [],
  taskCategories: () => TASK_CATEGORIES,
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

  /** Лента открытых заданий для мастеров */
  feed: (q: FeedQuery) => delay(filterFeed(q)),
  feedTask: (id: number) => delay(FEED.find((k) => k.id === id) ?? null, 300),
  feedTaskSync: (id: number) => FEED.find((k) => k.id === id) ?? null,

  tasks: {
    /** Создание → статус «На проверке» (модерация до 30 мин) */
    /** Создание → статус «На проверке» (модерация до 30 мин); задание появляется в кабинете */
    create: (d: { title: string; cat: string | null; region: RegionKey; district: string | null; bmode: 'sum' | 'neg'; bmin: string; bmax: string; when: number | null }) => {
      const budget = d.bmode === 'neg' ? null : d.bmin && d.bmax ? `${d.bmin}–${d.bmax}` : d.bmin ? `от ${d.bmin}` : d.bmax ? `до ${d.bmax}` : null;
      const task = clientTasks.add({ title: d.title, category: (d.cat ?? 'other') as CatalogCategory, region: d.region, district: d.district ?? '', budget, when: d.when ?? 3 });
      return delay(task, 700);
    },
  },

  async masters(q: MastersQuery) {
    return delay(filterMasters(q));
  },

  /** Короткая карточка мастера без задержки — для подписей в списках */
  masterSync: (id: number) => MASTERS.find((x) => x.id === id) ?? null,

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

export type FeedQuery = { region: RegionKey; online?: boolean; category?: CatalogCategory | null; sort?: 'new' | 'few' | 'high' };

function filterFeed(q: FeedQuery): FeedTask[] {
  const list = FEED.filter((k) => (q.online ? k.online : k.region === q.region || k.online) && (!q.category || k.category === q.category));
  if (!q.sort || q.sort === 'new') list.sort((a, b) => Number(!!a.online) - Number(!!b.online) || +new Date(b.createdAt) - +new Date(a.createdAt));
  if (q.sort === 'few') list.sort((a, b) => a.responses - b.responses);
  if (q.sort === 'high') list.sort((a, b) => (b.bmax || b.bmin || 0) - (a.bmax || a.bmin || 0));
  return list;
}
