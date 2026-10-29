/**
 * Слой данных. NEXT_PUBLIC_API=real — бэкенд (remote.ts, справочники — ref.ts),
 * иначе моки с задержкой сети. Сигнатуры одинаковые, экраны не знают, откуда данные.
 */
import type { L10n } from '../i18n';
import { addMockTask } from './clientTasks';
import { realClientTasks } from './real/clientTasks';
import { CATEGORY_TREE, DISTRICTS, FEATURED, FEED, FILTER_CATS, fresh, TASK_CATEGORIES, HOME_REVIEWS, HOME_TASKS, MASTERS, MASTER_REVIEWS, REGIONS } from './data';
import { ref, uiLang } from './ref';
import { remote } from './remote';
import { upload } from './real/common';
import { realAuth } from './real/auth';
import type { CatalogCategory, CategoryNode, FeaturedCategory, FeedTask, Master, Region, RegionKey } from './types';

export * from './types';
export { invites, type Invite, type InviteStatus } from './invites';
export { proposals, DAILY_LIMIT } from './proposals';
export { notifications, type Notif, type NotifRole, type NotifType, type NotifAct } from './notifications';
export { loadChats, saveChats, newMsgId, transmit, MAX_TRIES, type ChatRole, type ChatStatus, type Msg, type SysKey, type Thread } from './chats';
export { masterProfile, type MasterProfileData } from './masterProfile';
export { masterCabinet, type MasterOrder, type MasterProp, type MasterReview, type OrderStatus, type PropStatus } from './masterCabinet';
export { clientTasks, isArchived, type ClientTask, type ClientTaskStatus, type TaskResponse } from './clientTasks';

export type VerifyReq = { id: number; status: string; comment: string | null; decision_comment: string | null; created_at: string; resolved_at: string | null };
export type MyDispute = {
  id: number; status: 'open' | 'resolved'; resolution: 'done' | 'not_done' | 'partial' | null; deadline: string | null; terms_deadline: string | null; moderator_comment: string | null;
  requests: { id: number; text: string; created_at: string; answer: string | null; answered_at: string | null }[];
};
const MOCK_REPORT: [string, string, string][] = [
  ['fraud', 'Подозрение на мошенничество', 'Гумони қаллобӣ'], ['spam', 'Спам, реклама, ссылки', 'Спам, реклама, пайвандҳо'], ['insult', 'Оскорбления или угрозы', 'Таҳқир ё таҳдид'], ['other', 'Другое', 'Дигар'],
];
const delay = <T,>(v: T, ms = 450) => new Promise<T>((r) => setTimeout(() => r(v), ms));

/**
 * SMS-шлюз. Пока не подключён (NEXT_PUBLIC_SMS_ENABLED не 'true') — тестовый режим:
 * SMS не отправляются, для входа подходит TEST_OTP, и на экранах видна плашка с кодом.
 */
export const SMS_ENABLED = process.env.NEXT_PUBLIC_SMS_ENABLED === 'true';
export const IS_MOCK = !SMS_ENABLED;
export const TEST_OTP = process.env.NEXT_PUBLIC_TEST_OTP || '123456';
export { USE_API } from './flags';
import { USE_API } from './flags';
export { ApiError, apiErrorText, http } from './http';
import { http } from './http';
import type { ReasonKind } from './real/common';
export { realtime, type RtEvent } from './realtime';
export { uiLang } from './ref';
export { reasonId } from './real/common';
export { realAuth } from './real/auth';

export type TaskCat = { k: string; i: string; ru: string; tj: string; p: number | null; sr: readonly string[]; st: readonly string[]; er: readonly string[]; et: readonly string[] };

/** Префиксы операторов Таджикистана */
const OPERATORS = ['00', '01', '10', '11', '12', '20', '50', '55', '70', '77', '88', '90', '91', '92', '93', '94', '98', '99'];

export const api = {
  auth: {
    validPhone: (p: string): 'len' | 'op' | null => (p.length < 9 ? 'len' : OPERATORS.includes(p.slice(0, 2)) ? null : 'op'),
    sendCode: (phone: string): Promise<{ phone: string; resendIn: number; tries: number; error?: string }> =>
      USE_API ? realAuth.sendCode(phone) : delay({ phone, resendIn: 60, tries: 3 }, 700),
    /** ok:false — неверный код; name:null — новый пользователь, спросим имя */
    verify: (phone: string, code: string): Promise<{ ok: boolean; name: string | null; master?: boolean; error?: string }> =>
      USE_API ? realAuth.verify(phone, code) : delay(code === TEST_OTP ? { ok: true, name: null } : { ok: false, name: null }, 600),
    /** Имя нового пользователя — сохраняем до перехода дальше, чтобы не спрашивать снова */
    saveName: (name: string): Promise<void> => (USE_API ? realAuth.updateMe({ name }).then(() => undefined) : delay(undefined, 200)),
    /** Смена номера в настройках */
    changePhoneSend: (phone: string): Promise<{ error?: string }> => (USE_API ? realAuth.changePhoneSend(phone) : delay({}, 700)),
    changePhoneConfirm: (phone: string, code: string): Promise<{ ok: boolean; error?: string }> =>
      USE_API ? realAuth.changePhoneConfirm(phone, code) : delay({ ok: code === TEST_OTP }, 600),
  },

  regions(): Region[] {
    const R = ref.get();
    return R ? R.cities.map((c) => ({ key: c.key as RegionKey, name: c.name, sub: c.sub, masters: c.masters })) : REGIONS;
  },
  region(k: RegionKey): Region {
    const all = api.regions();
    return all.find((r) => r.key === k) ?? all[0];
  },
  featuredCategories(): FeaturedCategory[] {
    const R = ref.get();
    if (!R) return FEATURED;
    return R.cats.map((c) => ({ key: c.key, icon: c.icon, name: c.name, masters: c.masters, synonyms: c.children.map((k) => `${k.key} ${k.name.ru} ${k.name.tj}`).join(' ') }));
  },
  districts(r: RegionKey): string[] {
    const R = ref.get();
    return R ? (R.districts[r] ?? []).map((d) => d.name[uiLang()]) : (DISTRICTS[r] ?? []);
  },
  taskCategories(): readonly TaskCat[] {
    const R = ref.get();
    if (!R) return TASK_CATEGORIES;
    return R.cats.map((c) => {
      const mock = TASK_CATEGORIES.find((x) => x.k === c.key);
      return { k: c.key, i: c.icon, ru: c.name.ru, tj: c.name.tj, p: c.priceFrom, sr: c.children.map((k) => k.name.ru), st: c.children.map((k) => k.name.tj), er: mock?.er ?? [], et: mock?.et ?? [] };
    });
  },
  categoryTree(): CategoryNode[] {
    const R = ref.get();
    if (!R) return CATEGORY_TREE;
    return R.cats.map((c) => ({ key: c.key, icon: c.icon, name: c.name, professions: c.children.map((k) => ({ name: k.name, masters: k.masters, synonyms: k.key })) }));
  },
  /** Чипы фильтра по категориям в каталоге и ленте */
  filterCats(): { k: CatalogCategory; name: L10n }[] {
    const R = ref.get();
    return R ? R.cats.filter((c) => c.key !== 'other').map((c) => ({ k: c.key, name: c.name })) : FILTER_CATS;
  },
  catName(k: CatalogCategory): L10n | null {
    return ref.cat(k)?.name ?? FILTER_CATS.find((x) => x.k === k)?.name ?? null;
  },

  async home(region: RegionKey) {
    if (USE_API) return remote.home(region);
    const local = MASTERS.filter((m) => m.region === region);
    const online = MASTERS.filter((m) => m.online);
    const near = (x: { region?: RegionKey; online?: boolean }) => x.region === region || !!x.online;
    return delay(
      {
        localCount: local.length,
        masters: [...local, ...online],
        tasks: [...HOME_TASKS.filter(near), ...HOME_TASKS.filter((t) => !near(t))].map(fresh),
        reviews: [...HOME_REVIEWS.filter(near), ...HOME_REVIEWS.filter((r) => !near(r))].slice(0, 3),
      },
      700,
    );
  },

  /** Лента открытых заданий для мастеров */
  feed: (q: FeedQuery) => (USE_API ? remote.feed(q) : delay(filterFeed(q))),
  feedTask: (id: number) => (USE_API ? remote.feedTask(id) : delay(mockTask(id), 300)),
  feedTaskSync: (id: number): FeedTask | null => (USE_API ? remote.feedTaskSync(id) : mockTask(id)),

  tasks: {
    /** Создание → статус «На проверке» (модерация до 30 мин) */
    /** Создание → статус «На проверке» (модерация до 30 мин); задание появляется в кабинете */
    create: (d: Parameters<typeof realClientTasks.create>[0], files: Blob[] = []) => {
      if (USE_API) return realClientTasks.create(d, files);
      const budget = d.bmode === 'neg' ? null : d.bmin && d.bmax ? `${d.bmin}–${d.bmax}` : d.bmin ? `от ${d.bmin}` : d.bmax ? `до ${d.bmax}` : null;
      const task = addMockTask({ title: d.title, category: (d.cat ?? 'other') as CatalogCategory, region: d.region, district: d.district ?? '', budget, when: d.when ?? 3 });
      return delay(task, 700);
    },
  },

  async masters(q: MastersQuery) {
    if (USE_API) return remote.masters(q);
    return delay(filterMasters(q));
  },

  /** Короткая карточка мастера без задержки — для подписей в списках (с бэкендом — из уже загруженных) */
  revealPhone: (id: number): Promise<string> => (USE_API ? remote.revealPhone(id) : delay(MASTERS.find((x) => x.id === id)?.phone ?? '', 300)),

  masterSync: (id: number): Master | null => (USE_API ? remote.masterSync(id) : (MASTERS.find((x) => x.id === id) ?? null)),

  async master(id: number) {
    if (USE_API) return remote.master(id);
    const m = MASTERS.find((x) => x.id === id) ?? null;
    return delay(m ? { master: m, reviews: m.reviews ? MASTER_REVIEWS : [] } : null, 300);
  },

  /** Счётчик для кнопки «Показать N» — до применения фильтров */
  mastersCount: (q: MastersQuery): Promise<number> => (USE_API ? remote.mastersCount(q) : delay(filterMasters(q).length, 150)),

  /** Причины из справочника бэкенда (жалобы, отмены); в моках — типовой набор */
  async reasons(kind: ReasonKind): Promise<{ id: number; code: string; label: L10n }[]> {
    if (!USE_API) return delay(MOCK_REPORT.map((x, i) => ({ id: i + 1, code: x[0], label: { ru: x[1], tj: x[2] } })), 150);
    const l = await http<{ id: number; code: string; text_ru: string; text_tj: string | null }[]>('/reasons', { query: { kind } });
    return l.map((r) => ({ id: r.id, code: r.code, label: { ru: r.text_ru, tj: r.text_tj ?? r.text_ru } }));
  },
  /** Жалоба модератору: на задание, профиль мастера или отзыв (у отзыва — свой эндпоинт) */
  async complain(subject: 'task' | 'master_profile' | 'review', id: number, reasonId: number, comment: string | null): Promise<void> {
    if (!USE_API) return delay(undefined, 400);
    if (subject === 'review') await http(`/reviews/${id}/complaint`, { method: 'POST', body: { reason_id: reasonId, comment } });
    else await http('/complaints', { method: 'POST', body: { subject_type: subject, subject_id: id, reason_id: reasonId, comment } });
  },
  /** Спор по заказу: решение модератора и его запросы стороне (ответить можно на неотвеченные) */
  dispute: (id: number) => http<MyDispute>(`/disputes/${id}`),
  answerDispute: (id: number, requestId: number, text: string) => http(`/disputes/${id}/requests/${requestId}/answer`, { method: 'POST', body: { text, photo_ids: [] } }),
  /** Запрос отметки «Проверен»: последний запрос (null — не запрашивал) и новый — с комментарием и фото документа */
  verifyRequest: () => http<VerifyReq | null>('/me/master-profile/verify-request'),
  requestVerify: (comment: string | null, photoIds: number[]) => http<VerifyReq>('/me/master-profile/verify-request', { method: 'POST', body: { comment, photo_ids: photoIds } }),
  /** Ключи категорий по запросу (синонимы, опечатки, TJ и латиница) — подкатегория и её родитель */
  searchCategories: (q: string) =>
    http<{ key: string; parent: { key: string } | null }[]>('/categories/search', { query: { q } }).then((l) => [...new Set(l.flatMap((c) => [c.key, ...(c.parent ? [c.parent.key] : [])]))]),
  /** Язык в профиле — для SMS и push на нужном языке (только для вошедших) */
  saveLang: (lang: 'ru' | 'tj') => (USE_API && realAuth.me() ? realAuth.updateMe({ lang }).then(() => undefined, () => undefined) : Promise.resolve()),

  /** Сколько мастеров нашлось бы в других городах по тем же фильтрам (для пустого состояния) */
  async mastersElsewhere(q: MastersQuery): Promise<{ region: Region; n: number }[]> {
    if (USE_API) return remote.mastersElsewhere(q);
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

const mockTask = (id: number) => {
  const k = FEED.find((x) => x.id === id);
  return k ? fresh(k) : null;
};

function filterFeed(q: FeedQuery): FeedTask[] {
  const list = FEED.map(fresh).filter((k) => (q.online ? k.online : k.region === q.region || k.online) && (!q.category || k.category === q.category));
  if (!q.sort || q.sort === 'new') list.sort((a, b) => Number(!!a.online) - Number(!!b.online) || +new Date(b.createdAt) - +new Date(a.createdAt));
  if (q.sort === 'few') list.sort((a, b) => a.responses - b.responses);
  if (q.sort === 'high') list.sort((a, b) => (b.bmax || b.bmin || 0) - (a.bmax || a.bmin || 0));
  return list;
}

/** Загрузка фото (портфолио, задание, чат): с бэкендом — POST /uploads, в моках — имитация */
export function uploadPhoto(kind: Parameters<typeof upload>[0], file: Blob): Promise<{ id: number; url: string }> {
  return USE_API ? upload(kind, file) : delay({ id: Date.now() + Math.round(Math.random() * 1000), url: '' }, 900);
}
