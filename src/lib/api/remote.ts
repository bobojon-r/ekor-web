/**
 * Реальный бэкенд (NEXT_PUBLIC_API=real): запросы + адаптеры ответов API к типам экранов.
 * Сигнатуры совпадают с моками в index.ts.
 */
import type { L10n } from '../i18n';
import type { StatusCode } from '../status';
import { http } from './http';
import { ref, uiLang } from './ref';
import type { CatalogCategory, FeedTask, HomeReview, Master, RegionKey, Review, TaskSummary } from './types';
import type { FeedQuery, MastersQuery } from './index';

export type NR = { id: number; name_ru: string; name_tj: string };
export type MasterCardOut = {
  id: number; name: string | null; avatar_url: string | null; headline: NR | null; city: NR | null; district: NR | null; works_online: boolean;
  rating_avg: number | null; reviews_count: number; completed_orders_count: number; verified: boolean; available_today: boolean; price_from: number | null;
  experience: 'lt1' | '1_3' | '3_10' | 'gt10' | null;
};
type MasterPublicOut = MasterCardOut & {
  about: string | null; services: { title: string; price: number | null }[]; portfolio: { url: string; caption: string | null }[];
  districts: (NR & { near: boolean })[]; languages: string[]; has_phone: boolean;
};
type CatalogPage = { items: MasterCardOut[]; total: number; next_cursor: string | null; other_cities: { city: NR; count: number }[]; online_count: number | null };
export type TaskCardOut = {
  id: number; status: string; title: string; category: NR; subcategory: NR | null; mode: 'site' | 'online'; city: NR | null; district: NR | null;
  when: 'today' | 'tomorrow' | 'date' | 'week' | 'flexible'; time_of_day: 'morning' | 'day' | 'evening' | null; budget_mode: 'sum' | 'negotiable';
  budget_min: number | null; budget_max: number | null; photos_count: number; responses_count: number; views_count: number; published_at: string | null; match: boolean | null;
};
export type TaskPublicOut = TaskCardOut & { description: string | null; client: { name: string; member_since_year: number; completed_tasks: number } | null };
type ReviewOut = { id: number; author_name: string; rating: number; text: string | null; created_at: string; reply_text: string | null };
type LatestReviewOut = ReviewOut & { master_name: string; master_headline_ru: string; master_headline_tj: string };

export const nm = (x: NR | null | undefined) => (x ? (uiLang() === 'tj' ? x.name_tj : x.name_ru) : '');
export const l10n = (x: NR | null | undefined): L10n => ({ ru: x?.name_ru ?? '', tj: x?.name_tj ?? '' });
export const cityKey = (x: NR | null | undefined) => ref.cityById(x?.id)?.key as RegionKey | undefined;
export const catKey = (x: NR | null | undefined) => (ref.catById(x?.id)?.key ?? 'other') as CatalogCategory;
export const YEARS = { lt1: 0, '1_3': 1, '3_10': 3, gt10: 10 } as const;

/* ---------- мастера ---------- */

const masters = new Map<number, Master>();

function toMaster(m: MasterCardOut, full?: MasterPublicOut): Master {
  const v: Master = {
    id: m.id,
    name: m.name ?? '',
    avatarUrl: m.avatar_url ?? undefined,
    profession: l10n(m.headline),
    category: catKey(m.headline),
    region: cityKey(m.city),
    district: nm(m.district),
    online: m.works_online,
    rating: m.rating_avg ?? 0,
    reviews: m.reviews_count,
    priceFrom: m.price_from,
    verified: m.verified,
    available: m.available_today,
    years: m.experience ? YEARS[m.experience] : 0,
    works: m.completed_orders_count,
    langs: (full?.languages ?? []) as Master['langs'],
    areas: full?.districts.map(nm) ?? [],
    bio: full?.about ?? '',
    services: full?.services.map((x) => ({ name: x.title, price: x.price })) ?? [],
    portfolio: full?.portfolio.map((x) => x.caption ?? '') ?? [],
    portfolioImg: full?.portfolio.map((x) => x.url),
    hasPhone: full?.has_phone,
  };
  masters.set(v.id, { ...masters.get(v.id), ...v });
  return v;
}

function catalogQuery(q: MastersQuery, limit: number) {
  return {
    city_id: q.onlineOnly ? null : ref.city(q.region)?.id,
    online: !!q.onlineOnly,
    category_id: ref.cat(q.category)?.id,
    q: q.q?.trim(),
    price_max: q.priceMax || null,
    rating_min: q.ratingMin || null,
    available: !!q.availableOnly,
    sort: q.sort === 'rev' ? 'reviews' : q.sort === 'act' ? 'available' : 'rel',
    limit,
  };
}

const toReview = (r: ReviewOut): Review => {
  const d = new Date(r.created_at);
  return { author: r.author_name, month: d.getMonth(), year: d.getFullYear(), stars: r.rating, text: r.text ?? '', reply: r.reply_text };
};

/* ---------- задания ---------- */

export const WHEN = { today: 0, tomorrow: 1, date: 2, week: 2, flexible: 3 } as const;
export const TOD = { morning: 0, day: 1, evening: 2 } as const;
const tasks = new Map<number, FeedTask>();

function toFeedTask(k: TaskCardOut | TaskPublicOut): FeedTask {
  const full = 'description' in k ? k : null;
  const prev = tasks.get(k.id);
  const v: FeedTask = {
    id: k.id,
    category: catKey(k.subcategory ?? k.category),
    title: k.title,
    region: cityKey(k.city),
    district: nm(k.district),
    online: k.mode === 'online',
    bmin: k.budget_mode === 'sum' ? k.budget_min : null,
    bmax: k.budget_mode === 'sum' ? k.budget_max : null,
    when: WHEN[k.when],
    tod: k.time_of_day ? TOD[k.time_of_day] : null,
    responses: k.responses_count,
    createdAt: k.published_at ?? new Date().toISOString(),
    views: k.views_count,
    photos: k.photos_count,
    status: k.status === 'chosen' ? 'chosen' : 'open',
    client: full?.client?.name ?? prev?.client ?? '',
    clientSince: full?.client?.member_since_year ?? prev?.clientSince ?? 0,
    clientDone: full?.client?.completed_tasks ?? prev?.clientDone ?? 0,
    match: k.match ?? undefined,
    desc: full ? (full.description ?? '') : (prev?.desc ?? ''),
    full: !!full || !!prev?.full,
  };
  tasks.set(v.id, v);
  return v;
}

const toSummary = (k: TaskCardOut): TaskSummary => ({
  id: k.id,
  title: k.title,
  region: cityKey(k.city),
  district: nm(k.district),
  online: k.mode === 'online',
  budget: k.budget_max ?? k.budget_min,
  responses: k.responses_count,
  createdAt: k.published_at ?? new Date().toISOString(),
  status: k.status as StatusCode,
});

/* ---------- публичный API ---------- */

export const remote = {
  async home(region: RegionKey) {
    const city_id = ref.city(region)?.id;
    const [m, f, r] = await Promise.all([
      http<CatalogPage>('/masters', { query: { city_id, limit: 8 } }),
      http<{ items: TaskCardOut[] }>('/feed', { query: { city_id, limit: 6 } }),
      http<LatestReviewOut[]>('/reviews/latest', { query: { city_id, limit: 3 } }),
    ]);
    const now = Date.now();
    return {
      localCount: ref.city(region)?.masters ?? m.total,
      masters: m.items.map((x) => toMaster(x)),
      tasks: f.items.map(toSummary),
      reviews: r.map(
        (x): HomeReview => ({
          author: x.author_name, master: x.master_name, profession: { ru: x.master_headline_ru, tj: x.master_headline_tj }, region,
          stars: x.rating, text: x.text ?? '', daysAgo: Math.max(0, Math.round((now - +new Date(x.created_at)) / 864e5)),
        }),
      ),
    };
  },

  async masters(q: MastersQuery) {
    const p = await http<CatalogPage>('/masters', { query: catalogQuery(q, 50) });
    return p.items.map((x) => toMaster(x));
  },
  async mastersCount(q: MastersQuery) {
    return (await http<CatalogPage>('/masters', { query: catalogQuery(q, 1) })).total;
  },
  /** Где ещё есть мастера по тем же фильтрам — для пустого состояния */
  async mastersElsewhere(q: MastersQuery) {
    const p = await http<CatalogPage>('/masters', { query: catalogQuery(q, 1) });
    return p.other_cities.flatMap((o) => {
      const c = ref.cityById(o.city.id);
      return c ? [{ region: { key: c.key as RegionKey, name: c.name, sub: c.sub, masters: c.masters }, n: o.count }] : [];
    });
  },
  masterSync: (id: number) => masters.get(id) ?? null,
  async master(id: number) {
    try {
      const [m, r] = await Promise.all([http<MasterPublicOut>(`/masters/${id}`), http<{ items: ReviewOut[] }>(`/masters/${id}/reviews`, { query: { limit: 20 } })]);
      return { master: toMaster(m, m), reviews: r.items.map(toReview) };
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },

  async feed(q: FeedQuery) {
    const sort = q.sort === 'few' ? 'few_responses' : q.sort === 'high' ? 'budget' : 'new';
    const p = await http<{ items: TaskCardOut[] }>('/feed', { query: { city_id: q.online ? null : ref.city(q.region)?.id, online: !!q.online, category_id: ref.cat(q.category)?.id, sort, limit: 50 } });
    return p.items.map(toFeedTask);
  },
  feedTaskSync: (id: number) => tasks.get(id) ?? null,
  /** «Показать телефон» — только вошедшим и если мастер разрешил */
  revealPhone: async (id: number) => (await http<{ phone: string }>(`/masters/${id}/phone`, { method: 'POST' })).phone.replace(/\D/g, '').slice(-9),
  async feedTask(id: number) {
    try {
      return toFeedTask(await http<TaskPublicOut>(`/tasks/${id}`));
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
};

/** Краткая карточка мастера из других ответов (приглашения, отклики) — для masterSync */
export function cacheMasterBrief(b: { id: number; name: string | null; headline_ru: string | null; headline_tj: string | null; rating_avg: number | null; reviews_count: number; completed_orders_count: number; verified: boolean; experience: keyof typeof YEARS | null }) {
  if (masters.has(b.id)) return;
  masters.set(b.id, {
    id: b.id, name: b.name ?? '', profession: { ru: b.headline_ru ?? '', tj: b.headline_tj ?? '' }, category: 'other', rating: b.rating_avg ?? 0, reviews: b.reviews_count,
    priceFrom: null, verified: b.verified, available: false, years: b.experience ? YEARS[b.experience] : 0, works: b.completed_orders_count, langs: [], areas: [], bio: '', services: [], portfolio: [],
  });
}
