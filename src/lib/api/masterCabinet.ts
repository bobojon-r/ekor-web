/**
 * Кабинет мастера: заказы, отклики, отзывы. Мок в localStorage; с бэкендом — /me/master/*.
 * Адрес и телефон клиента приходят только для заказов «Вас выбрали» и «В работе».
 */
import { USE_API } from './flags';
import { realMasterCabinet } from './real/master';

export type OrderStatus = 'chosen' | 'work' | 'wait' | 'done' | 'cancelled';
export type PropStatus = 'sent' | 'viewed' | 'rejected' | 'withdrawn';

export type MasterOrder = { id: number; title: string; client: string; district: string; when: { ru: string; tj: string }; price: number; status: OrderStatus; contacts?: { address: string; phone: string }; chatId?: number };
export type MasterProp = { id: number; taskId?: number; title: string; district: string; when: { ru: string; tj: string }; price: number | null; msg: string; status: PropStatus; ago: { ru: string; tj: string }; responses: number; edited?: boolean };
export type MasterReview = { id: number; name: string; stars: number; text: string; date: string; task: string; reply: string | null };
type Store = { orders: MasterOrder[]; props: MasterProp[]; reviews: MasterReview[] };

const KEY = 'ekor_master_cabinet';
const delay = <T,>(v: T, ms = 500) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const w = (ru: string, tj: string) => ({ ru, tj });

const SEED: Store = {
  orders: [
    { id: 11, title: 'Заменить 3 розетки и выключатель', client: 'Мадина Р.', district: 'Сино', when: w('Сегодня, 15:00', 'Имрӯз, 15:00'), price: 100, status: 'chosen', contacts: { address: 'ул. Айни 48, кв. 17, подъезд 2, этаж 4', phone: '907712213' } },
    { id: 12, title: 'Собрать шкаф-купе 2 м', client: 'Бахтиёр С.', district: 'Исмоили Сомонӣ', when: w('Вчера', 'Дирӯз'), price: 350, status: 'work', contacts: { address: 'пр. Рудаки 105, кв. 40', phone: '934100855' } },
    { id: 13, title: 'Установить электросчётчик', client: 'Нигина А.', district: 'Фирдавсӣ', when: w('20 окт', '20 окт'), price: 150, status: 'wait' },
    { id: 14, title: 'Повесить 4 светильника', client: 'Фирӯза К.', district: 'Шоҳмансур', when: w('17 окт', '17 окт'), price: 200, status: 'done' },
  ],
  props: [
    { id: 1, title: 'Повесить люстру и 2 бра', district: 'Сино', when: w('Завтра, вечер', 'Пагоҳ, бегоҳ'), price: 120, msg: 'Сделаю за час, свой перфоратор и стремянка.', status: 'viewed', ago: w('2 ч назад', '2 соат пеш'), responses: 4 },
    { id: 2, title: 'Не работает половина розеток на кухне', district: 'Фирдавсӣ', when: w('Сегодня', 'Имрӯз'), price: null, msg: 'Скорее всего автомат или скрутка в коробке. Приеду, проверю тестером.', status: 'sent', ago: w('35 мин назад', '35 дақ пеш'), responses: 2 },
    { id: 3, title: 'Провести свет на балкон', district: 'Шоҳмансур', when: w('На этой неделе', 'Дар ин ҳафта'), price: 300, msg: 'Кабель в гофре, розетка и светильник. Материалы по чеку.', status: 'rejected', ago: w('вчера', 'дирӯз'), responses: 6 },
  ],
  reviews: [
    { id: 21, name: 'Фирӯза К.', stars: 5, text: 'Пришёл вовремя, всё аккуратно, убрал за собой. Рекомендую.', date: '18 окт', task: 'Повесить 4 светильника', reply: null },
    { id: 22, name: 'Сухроб Д.', stars: 4, text: 'Работу сделал хорошо, но опоздал на полчаса и не предупредил.', date: '2 окт', task: 'Замена проводки в ванной', reply: null },
    { id: 23, name: 'Малика Н.', stars: 5, text: 'Быстро нашёл проблему с автоматом, объяснил, что было не так.', date: '14 сен', task: 'Выбивает автомат', reply: 'Спасибо, Малика! Обращайтесь.' },
  ],
};

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
function mutate(fn: (s: Store) => Store) {
  const next = fn(read());
  write(next);
  return delay(next);
}
const upd = <K extends 'orders' | 'props' | 'reviews'>(s: Store, k: K, id: number, p: Partial<Store[K][number]>): Store => ({ ...s, [k]: (s[k] as { id: number }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) });

const mockMasterCabinet = {
  load: () => delay(read(), 450),
  remind: (_id: number) => delay(read(), 300),
  start: (id: number) => mutate((s) => upd(s, 'orders', id, { status: 'work' })),
  /** «Работа выполнена» → клиент подтверждает; контакты скрываются из списка активных */
  done: (id: number) => mutate((s) => upd(s, 'orders', id, { status: 'wait', contacts: undefined })),
  decline: (id: number, _reason: number) => mutate((s) => upd(s, 'orders', id, { status: 'cancelled', contacts: undefined })),
  editProp: (id: number, price: number | null, msg: string) => mutate((s) => upd(s, 'props', id, { price, msg, edited: true })),
  withdraw: (id: number) => mutate((s) => upd(s, 'props', id, { status: 'withdrawn' })),
  reply: (id: number, text: string) => mutate((s) => upd(s, 'reviews', id, { reply: text })),
};

export const masterCabinet: typeof mockMasterCabinet = USE_API ? realMasterCabinet : mockMasterCabinet;
