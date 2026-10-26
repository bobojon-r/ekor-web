/**
 * Задания клиента (кабинет). Мок в localStorage; с бэкендом — /me/tasks.
 * Статусы — общий словарь lib/status.ts.
 */
import type { CatalogCategory, RegionKey } from './types';

export type ClientTaskStatus = 'review' | 'open' | 'chosen' | 'wait' | 'dispute' | 'done' | 'rejected' | 'cancelled' | 'expired';

export type TaskResponse = {
  id: string;
  masterId?: number;
  name: string;
  rating: number;
  reviews: number;
  verified: boolean;
  years: number;
  price: number | null; // null — после осмотра
  term: number; // 0 сегодня · 1 завтра · 2 за 2–3 дня
  createdAt: string;
  msg: string;
};

export type ChosenMaster = { name: string; masterId?: number; rating: number; reviews: number; verified: boolean; category: CatalogCategory | 'other'; price: number | null; phone: string };

export type ClientTask = {
  id: number;
  title: string;
  category: CatalogCategory | 'other';
  status: ClientTaskStatus;
  createdAt: string;
  region: RegionKey;
  district: string;
  /** Адрес хранит сервер; мастеру открывается только после выбора */
  address?: string;
  budget: string | null; // «80–150», «до 300», «от 300»
  when: number;
  newResponses?: number;
  unread?: number;
  responses?: TaskResponse[];
  master?: ChosenMaster;
  review?: { stars: number; text: string; date: string; reply?: string };
  rejectReason?: string;
};

const KEY = 'ekor_client_tasks';
const delay = <T,>(v: T, ms = 600) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const ADDR = 'ул. Айни 48, кв. 17, 5 этаж';

const SEED: ClientTask[] = [
  { id: 1, title: 'Заменить 3 розетки и выключатель в спальне', category: 'electric', status: 'open', createdAt: ago(25), region: 'dushanbe', district: 'Сино', address: ADDR, budget: '80–150', when: 1, newResponses: 3,
    responses: [
      { id: 'a', masterId: 1, name: 'Фаррух Назаров', rating: 4.9, reviews: 37, verified: true, years: 9, price: 120, term: 1, createdAt: ago(15), msg: 'Здравствуйте! Сделаю завтра вечером, свой инструмент. Проверю всю линию, если розетка искрит — возможно, проблема в проводке. Гарантия 6 месяцев.' },
      { id: 'b', name: 'Абдулло Хасанов', rating: 4.6, reviews: 8, verified: false, years: 5, price: 90, term: 0, createdAt: ago(10), msg: 'Могу сегодня после 18:00. Цена за всё, включая выключатель.' },
      { id: 'c', name: 'Комил Наимов', rating: 0, reviews: 0, verified: false, years: 2, price: null, term: 2, createdAt: ago(4), msg: 'Добрый день, назову точную цену на месте, обычно 30 смн за точку.' },
    ] },
  { id: 2, title: 'Установить смеситель на кухне', category: 'plumbing', status: 'chosen', createdAt: ago(1440), region: 'dushanbe', district: 'Сино', address: ADDR, budget: '150–250', when: 0, unread: 2,
    master: { name: 'Джамшед Раджабов', masterId: 7, rating: 4.4, reviews: 19, verified: false, category: 'plumbing', price: 200, phone: '904317705' } },
  { id: 3, title: 'Ремонт кондиционера Samsung, не охлаждает', category: 'appliances', status: 'wait', createdAt: ago(3 * 1440), region: 'dushanbe', district: 'Сино', address: ADDR, budget: 'до 300', when: 0,
    master: { name: 'Сухроб Алиев', masterId: 2, rating: 4.6, reviews: 14, verified: false, category: 'appliances', price: 250, phone: '938801462' } },
  { id: 4, title: 'Повесить 2 люстры и 4 бра в новой квартире', category: 'electric', status: 'review', createdAt: ago(12), region: 'dushanbe', district: 'Сино', budget: null, when: 2 },
  { id: 5, title: 'Генеральная уборка 3-комнатной квартиры перед Наврузом', category: 'cleaning', status: 'done', createdAt: ago(210 * 1440), region: 'dushanbe', district: 'Сино', budget: 'от 300', when: 2,
    master: { name: 'Нигина Юсупова', masterId: 3, rating: 4.8, reviews: 9, verified: false, category: 'cleaning', price: 350, phone: '926154009' },
    review: { stars: 5, text: 'Всё отмыли до блеска, даже люстру. Пришли вдвоём, справились за 5 часов.', date: 'март 2026', reply: 'Спасибо, Мавзуна! Будем рады снова помочь.' } },
  { id: 6, title: 'Куплю диван б/у недорого', category: 'other', status: 'rejected', createdAt: ago(2 * 1440), region: 'dushanbe', district: 'Сино', budget: null, when: 3,
    rejectReason: 'Это объявление о покупке, а не заказ услуги. Измените описание — например, «Перетянуть диван» — или используйте доску объявлений.' },
];

function read(): ClientTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : SEED;
  } catch {
    return SEED;
  }
}
function write(list: ClientTask[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
function patch(id: number, fn: (k: ClientTask) => ClientTask) {
  const list = read().map((k) => (k.id === id ? fn(k) : k));
  write(list);
  return delay(list);
}

const ARCHIVE: ClientTaskStatus[] = ['done', 'cancelled', 'expired'];
export const isArchived = (k: ClientTask) => ARCHIVE.includes(k.status) && !(k.status === 'done' && !k.review);

export const clientTasks = {
  list: () => delay(read(), 450),
  add: (k: Omit<ClientTask, 'id' | 'createdAt' | 'status'>) => {
    const list = read();
    const task: ClientTask = { ...k, id: Math.max(0, ...list.map((x) => x.id)) + 1, createdAt: new Date().toISOString(), status: 'review' };
    write([task, ...list]);
    return task;
  },
  markSeen: (id: number) => patch(id, (k) => ({ ...k, newResponses: 0 })),
  /** Выбор мастера: мастеру открываются адрес и телефон, остальным — уведомление */
  choose: (id: number, respId: string) =>
    patch(id, (k) => {
      const r = k.responses?.find((x) => x.id === respId);
      if (!r) return k;
      return { ...k, status: 'chosen', newResponses: 0, master: { name: r.name, masterId: r.masterId, rating: r.rating, reviews: r.reviews, verified: r.verified, category: k.category, price: r.price, phone: '935551247' } };
    }),
  cancelChoice: (id: number, _reason: number, _note: string) => patch(id, (k) => ({ ...k, status: 'open', master: undefined })),
  /** Демо: мастер отметил «работа выполнена» */
  demoMasterDone: (id: number) => patch(id, (k) => ({ ...k, status: 'wait' })),
  confirmDone: (id: number) => patch(id, (k) => ({ ...k, status: 'done' })),
  problem: (id: number, _reason: number, _note: string) => patch(id, (k) => ({ ...k, status: 'dispute' })),
  review: (id: number, stars: number, text: string, date: string) => patch(id, (k) => ({ ...k, review: { stars, text, date } })),
};
