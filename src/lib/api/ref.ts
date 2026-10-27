/**
 * Справочники бэкенда: города, районы, категории. Грузятся на сервере в layout (кэш 5 мин)
 * и передаются в браузер, поэтому синхронные api.regions()/categoryTree() работают и при SSR.
 */
import type { L10n } from '../i18n';
import { API_ORIGIN } from './http';

export type RefCity = { id: number; key: string; name: L10n; sub: L10n; masters: number };
export type RefDistrict = { id: number; name: L10n; near: boolean };
export type RefCat = { id: number; key: string; parentId: number | null; icon: string; name: L10n; masters: number; online: boolean; priceFrom: number | null; children: RefCat[] };
export type RefData = { cities: RefCity[]; districts: Record<string, RefDistrict[]>; cats: RefCat[] };

type N = { id: number; key?: string; name_ru: string; name_tj: string };
const l10n = (x: N): L10n => ({ ru: x.name_ru, tj: x.name_tj });

let REF: RefData | null = null;

/** Язык интерфейса для однострочных подписей (районы); на сервере — русский */
export const uiLang = (): 'ru' | 'tj' => (typeof document !== 'undefined' && document.documentElement.lang === 'tg' ? 'tj' : 'ru');

export const ref = {
  get: () => REF,
  set: (d: RefData | null) => void (d && (REF = d)),
  city: (key: string) => REF?.cities.find((c) => c.key === key),
  cityById: (id: number | undefined) => REF?.cities.find((c) => c.id === id),
  /** Все категории плоским списком (родители и профессии) */
  allCats: () => REF?.cats.flatMap((c) => [c, ...c.children]) ?? [],
  cat: (key: string | null | undefined) => (key ? ref.allCats().find((c) => c.key === key) : undefined),
  catById: (id: number | undefined) => ref.allCats().find((c) => c.id === id),
};

export async function fetchRef(): Promise<RefData | null> {
  const get = async <T,>(p: string): Promise<T> => {
    const r = await fetch(`${API_ORIGIN}/api${p}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`${p} ${r.status}`);
    return r.json();
  };
  try {
    const [cities, cats] = await Promise.all([
      get<(N & { key: string; region: N; masters_count: number })[]>('/cities'),
      get<(N & { key: string; icon: string; allows_online: boolean; typical_price_from: number | null; masters_count: number; children: (N & { key: string; parent_id: number; masters_count: number })[] })[]>('/categories'),
    ]);
    const ds = await Promise.all(cities.map((c) => get<(N & { near: boolean })[]>(`/cities/${c.id}/districts?with_near=true`).catch(() => [])));
    return {
      cities: cities.map((c) => ({
        id: c.id, key: c.key, name: l10n(c), masters: c.masters_count,
        sub: c.region.key === c.key ? { ru: 'Столица', tj: 'Пойтахт' } : l10n(c.region),
      })),
      districts: Object.fromEntries(cities.map((c, i) => [c.key, ds[i].map((d) => ({ id: d.id, name: l10n(d), near: d.near }))])),
      cats: cats.map((c) => ({
        id: c.id, key: c.key, parentId: null, icon: c.icon, name: l10n(c), masters: c.masters_count, online: c.allows_online, priceFrom: c.typical_price_from,
        children: c.children.map((k) => ({ id: k.id, key: k.key, parentId: c.id, icon: c.icon, name: l10n(k), masters: k.masters_count, online: c.allows_online, priceFrom: null, children: [] })),
      })),
    };
  } catch (e) {
    console.error('[ref] backend unavailable:', (e as Error).message);
    return null;
  }
}
