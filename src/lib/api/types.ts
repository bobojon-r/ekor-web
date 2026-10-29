import type { L10n } from '../i18n';
import type { StatusCode } from '../status';

/** Ключ города; с бэкендом список приходит из /cities, поэтому допускаем и новые */
export type RegionKey = 'dushanbe' | 'khujand' | 'isfara' | 'bokhtar' | 'kulob' | 'vahdat' | 'khorog' | (string & {});

export type Region = { key: RegionKey; name: L10n; sub: L10n; masters: number };

/** Плитка категории на главной */
export type FeaturedCategory = { key: string; icon: string; name: L10n; masters: number; synonyms: string };

export type Profession = { name: L10n; masters: number; synonyms: string };
export type CategoryNode = { key: string; icon: string; name: L10n; professions: Profession[] };

/** Ключ категории любого уровня; с бэкендом — из /categories */
export type CatalogCategory = 'repair' | 'plumbing' | 'electric' | 'appliances' | 'cleaning' | 'cargo' | 'tutors' | 'beauty' | 'it' | (string & {});

export type Master = {
  id: number;
  name: string;
  /** Фото профиля (публичная ссылка бэкенда) */
  avatarUrl?: string;
  profession: L10n;
  category: CatalogCategory;
  region?: RegionKey;
  district?: string;
  online?: boolean;
  rating: number;
  reviews: number;
  priceFrom: number | null;
  verified: boolean;
  available: boolean;
  years: number;
  works: number;
  /** Телефон показывается по флагу API, не вычисляется на клиенте */
  phone?: string;
  /** Мастер разрешил показывать телефон (бэкенд) */
  hasPhone?: boolean;
  langs: ('tj' | 'ru' | 'uz' | 'en')[];
  areas: string[];
  bio: string;
  services: { name: string; price: number | null }[];
  /** Подписи работ; фото — в portfolioImg с тем же индексом (с бэкенда) */
  portfolio: string[];
  portfolioImg?: string[];
};

export type Review = { author: string; month: number; year: number; stars: number; text: string; reply: string | null };

export type HomeReview = { author: string; master: string; profession: L10n; region?: RegionKey; online?: boolean; stars: number; daysAgo: number; text: string };

export type TaskSummary = {
  id: number;
  title: string;
  region?: RegionKey;
  district?: string;
  online?: boolean;
  budget: number | null;
  responses: number;
  createdAt: string;
  status: StatusCode;
};

export type Page<T> = { items: T[]; total: number };

export type FeedTask = {
  id: number;
  category: CatalogCategory;
  title: string;
  region?: RegionKey;
  district?: string;
  online?: boolean;
  bmin: number | null;
  bmax: number | null;
  when: number; // 0 сегодня · 1 завтра · 2 на этой неделе · 3 не срочно
  tod: number | null; // 0 утро · 1 день · 2 вечер
  responses: number;
  createdAt: string;
  views: number;
  photos: number;
  status: 'open' | 'chosen';
  client: string;
  clientSince: number;
  clientDone: number;
  /** Подходит мастеру по профессиям и районам — считает сервер */
  match?: boolean;
  desc: string;
  /** Загружены подробности (описание, клиент) — с бэкендом список приходит без них */
  full?: boolean;
};

export type Proposal = { price: number | null; term: number; msg: string };
