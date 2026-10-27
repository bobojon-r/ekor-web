/**
 * Чаты: открываются, когда клиент выбирает мастера. Мок в localStorage; с бэкендом — WebSocket + REST.
 * Исходящие: очередь, автоповтор; после 3 неудачных попыток — «Не отправлено · Повторить».
 */
export type ChatRole = 'client' | 'master';
export type ChatStatus = 'chosen' | 'work' | 'wait' | 'done';
export type SysKey = 'chosenC' | 'chosenM' | 'markedDone' | 'confirmed' | 'started' | 'cancelledC' | 'declinedM' | 'dispute' | 'disputeDone' | 'disputeNotDone' | 'disputePartial';
export type Msg =
  | { id: string; f: 'sys'; k: SysKey }
  | { id: string; f: 'me' | 'them'; x?: string; photo?: string; t: string | { ru: string; tj: string }; state?: 'sending' | 'failed'; tries?: number };
export type Thread = {
  id: string;
  name: string;
  prof: { ru: string; tj: string };
  task: string;
  st: ChatStatus;
  unread: number;
  price: string;
  when: { ru: string; tj: string };
  district: string;
  addr: string;
  href: string;
  blocked?: boolean;
  msgs: Msg[];
  /** Бэкенд: заказ чата (действия «Я приступил», «Подтвердить») и только чтение */
  orderId?: number;
  readOnly?: boolean;
};

const KEY = 'ekor_chats';
const w = (ru: string, tj: string) => ({ ru, tj });
let n = 0;
const id = () => `m${Date.now().toString(36)}${n++}`;
const sys = (k: SysKey): Msg => ({ id: id(), f: 'sys', k });
const msg = (f: 'me' | 'them', x: string, t: string | { ru: string; tj: string }): Msg => ({ id: id(), f, x, t });

const SEED: Record<ChatRole, Thread[]> = {
  client: [
    { id: 'c1', name: 'Фаррух Назаров', prof: w('Электрик', 'Барқчӣ'), task: 'Заменить 3 розетки и выключатель', st: 'chosen', unread: 2, price: '100 смн', when: w('Сегодня, 15:00', 'Имрӯз, 15:00'), district: 'Сино', addr: 'ул. Айни 48, кв. 17', href: '/client/tasks/1',
      msgs: [sys('chosenC'), msg('them', 'Здравствуйте! Видел задание. Могу сегодня в 15:00, подходит?', '14:02'), msg('me', 'Да, подходит. Розетки Legrand, купила сама.', '14:05'), msg('them', 'Отлично. Возьму подрозетники на всякий случай.', '14:06'), msg('them', 'Выезжаю в 14:30, буду к 15:00.', '14:20')] },
    { id: 'c2', name: 'Шерзод Каримов', prof: w('Плиточник', 'Сафолчин'), task: 'Плитка в ванной, 6 м²', st: 'wait', unread: 1, price: '330 смн', when: w('Вчера', 'Дирӯз'), district: 'Фирдавсӣ', addr: 'ул. Бохтар 12, кв. 3', href: '/client',
      msgs: [msg('them', 'Плитку уложил, завтра затирка.', w('вчера', 'дирӯз')), sys('markedDone'), msg('them', 'Всё готово. Затирку можно мыть через сутки.', '18:40')] },
    { id: 'c3', name: 'Гулнора Саидова', prof: w('Уборка', 'Тозакунӣ'), task: 'Генеральная уборка, 3 комнаты', st: 'done', unread: 0, price: '450 смн', when: w('12 окт', '12 окт'), district: 'Сино', addr: '', href: '/client',
      msgs: [msg('them', 'Спасибо, что выбрали нас! Если что — пишите.', w('12 окт', '12 окт')), sys('confirmed')] },
  ],
  master: [
    { id: 'm1', name: 'Мадина Р.', prof: w('Клиент', 'Мизоҷ'), task: 'Заменить 3 розетки и выключатель', st: 'chosen', unread: 1, price: '100 смн', when: w('Сегодня, 15:00', 'Имрӯз, 15:00'), district: 'Сино', addr: 'ул. Айни 48, кв. 17, подъезд 2, этаж 4', href: '/master/orders',
      msgs: [sys('chosenM'), msg('me', 'Здравствуйте! Видел задание. Могу сегодня в 15:00, подходит?', '14:02'), msg('them', 'Да, подходит. Розетки Legrand, купила сама.', '14:05')] },
    { id: 'm2', name: 'Бахтиёр С.', prof: w('Клиент', 'Мизоҷ'), task: 'Собрать шкаф-купе 2 м', st: 'work', unread: 0, price: '350 смн', when: w('Вчера', 'Дирӯз'), district: 'Исмоили Сомонӣ', addr: 'пр. Рудаки 105, кв. 40', href: '/master/orders',
      msgs: [msg('them', 'Двери купе привезут к обеду.', '11:15'), msg('me', 'Хорошо, корпус соберу до них.', '11:20')] },
    { id: 'm3', name: 'Нигина А.', prof: w('Клиент', 'Мизоҷ'), task: 'Установить электросчётчик', st: 'wait', unread: 0, price: '150 смн', when: w('20 окт', '20 окт'), district: 'Фирдавсӣ', addr: '', href: '/master/orders',
      msgs: [msg('me', 'Счётчик установил, пломбу поставят из Барқи Тоҷик.', w('20 окт', '20 окт')), sys('markedDone')] },
  ],
};

export function loadChats(): Record<ChatRole, Thread[]> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : SEED;
  } catch {
    return SEED;
  }
}
export function saveChats(v: Record<ChatRole, Thread[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}
export const newMsgId = id;

/** «Отправка» на сервер: без сети — ошибка (клиент поставит в очередь и повторит) */
export function transmit(): Promise<boolean> {
  return new Promise((r) => setTimeout(() => r(typeof navigator === 'undefined' || navigator.onLine), 600));
}
export const MAX_TRIES = 3;
