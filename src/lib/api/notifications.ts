/**
 * Уведомления: лента событий клиента и мастера. Мок в localStorage; с бэкендом — /me/notifications + push.
 * g: 0 сегодня · 1 вчера · 2 раньше. Важное дублируется по SMS.
 */
import { USE_API } from './flags';
import { realNotifications } from './real/notifications';

export type NotifRole = 'client' | 'master';
export type NotifType = 'resp' | 'wait' | 'msg' | 'ok' | 'rej' | 'reply' | 'chosen' | 'task' | 'review' | 'lost' | 'approved';
export type NotifAct = 'compare' | 'confirm' | 'chat' | 'fix' | 'respond' | 'reply' | 'done';
export type Notif = { id: number; g: 0 | 1 | 2; type: NotifType; unread: boolean; time: L; title: L; body: L; act?: NotifAct; href?: string; orderId?: number };
type L = { ru: string; tj: string };
const w = (ru: string, tj: string): L => ({ ru, tj });

const SEED: Record<NotifRole, Notif[]> = {
    client: [
      { id: 1, g: 0, type: 'resp', unread: true, time: w('5 мин', '5 дақ'), title: w('Новый отклик: Фаррух Назаров', 'Ҷавоби нав: Фаррух Назаров'), body: w('«Заменить 3 розетки» · 100 смн. Всего откликов: 3', '«Заменить 3 розетки» · 100 смн. Ҳамагӣ ҷавобҳо: 3'), act: 'compare', href: '/client/tasks/1' },
      { id: 2, g: 0, type: 'wait', unread: true, time: w('1 ч', '1 соат'), title: w('Мастер отметил работу выполненной', 'Усто корро иҷрошуда қайд кард'), body: w('«Плитка в ванной» — проверьте результат и подтвердите', '«Плитка дар ҳаммом» — натиҷаро санҷед ва тасдиқ кунед'), act: 'confirm' },
      { id: 4, g: 1, type: 'ok', unread: false, time: w('10:12', '10:12'), title: w('Задание опубликовано', 'Супориш нашр шуд'), body: w('Модератор проверил «Заменить 3 розетки». Мастера уже видят его', 'Модератор «Заменить 3 розетки»-ро санҷид. Устоҳо онро мебинанд') },
      { id: 5, g: 1, type: 'rej', unread: true, time: w('09:40', '09:40'), title: w('Задание отклонено', 'Супориш рад шуд'), body: w('В описании «Ремонт стиральной машины» указан телефон. Уберите контакты и отправьте снова', 'Дар тавсифи «Ремонт стиральной машины» телефон ҳаст. Тамосҳоро бардоред ва боз фиристед'), act: 'fix' },
      { id: 6, g: 2, type: 'reply', unread: false, time: w('3 дн', '3 рӯз'), title: w('Мастер ответил на ваш отзыв', 'Усто ба шарҳи шумо ҷавоб дод'), body: w('Гулнора Саидова: «Спасибо! Будем рады помочь снова»', 'Гулнора Саидова: «Спасибо! Будем рады помочь снова»') }],
    master: [
      { id: 11, g: 0, type: 'chosen', unread: true, time: w('10 мин', '10 дақ'), title: w('Вас выбрали!', 'Шуморо интихоб карданд!'), body: w('Мадина Р. — «Заменить 3 розетки». Адрес и телефон открыты', 'Мадина Р. — «Заменить 3 розетки». Суроға ва телефон кушода шуданд'), href: '/master/orders' },
      { id: 12, g: 0, type: 'task', unread: true, time: w('30 мин', '30 дақ'), title: w('Новое задание в Сино', 'Супориши нав дар Сино'), body: w('«Повесить люстру и 2 бра» · до 150 смн · завтра вечером', '«Повесить люстру и 2 бра» · то 150 смн · пагоҳ бегоҳ'), act: 'respond', href: '/tasks' },
      { id: 13, g: 1, type: 'review', unread: true, time: w('18:05', '18:05'), title: w('Новый отзыв ★★★★★', 'Шарҳи нав ★★★★★'), body: w('Фирӯза К.: «Пришёл вовремя, всё аккуратно, убрал за собой»', 'Фирӯза К.: «Пришёл вовремя, всё аккуратно, убрал за собой»'), act: 'reply', href: '/master/reviews' },
      { id: 14, g: 1, type: 'ok', unread: false, time: w('17:50', '17:50'), title: w('Клиент подтвердил выполнение', 'Мизоҷ иҷроро тасдиқ кард'), body: w('«Повесить 4 светильника» · заказ завершён', '«Повесить 4 светильника» · фармоиш анҷом ёфт') },
      { id: 15, g: 2, type: 'lost', unread: false, time: w('3 дн', '3 рӯз'), title: w('Клиент выбрал другого мастера', 'Мизоҷ устои дигарро интихоб кард'), body: w('«Провести свет на балкон» · задание закрыто', '«Провести свет на балкон» · супориш баста шуд') },
      { id: 16, g: 2, type: 'approved', unread: false, time: w('5 дн', '5 рӯз'), title: w('Профиль одобрен', 'Профил тасдиқ шуд'), body: w('Вы в каталоге и можете откликаться на задания', 'Шумо дар каталог ҳастед ва ба супоришҳо ҷавоб дода метавонед') }]
  };

const KEY = 'ekor_notifications';
type Store = Record<NotifRole, Notif[]>;
const listeners = new Set<() => void>();

const mockNotifications = {
  confirmOrder: (_orderId: number) => Promise.resolve(),
  read(): Store {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : SEED;
    } catch {
      return SEED;
    }
  },
  write(s: Store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    listeners.forEach((f) => f());
  },
  patch(role: NotifRole, id: number, p: Partial<Notif>) {
    const s = mockNotifications.read();
    mockNotifications.write({ ...s, [role]: s[role].map((n) => (n.id === id ? { ...n, ...p } : n)) });
  },
  readAll(role: NotifRole) {
    const s = mockNotifications.read();
    mockNotifications.write({ ...s, [role]: s[role].map((n) => ({ ...n, unread: false })) });
  },
  /** Подписка: шапка и страница обновляются вместе */
  subscribe(f: () => void): () => void {
    listeners.add(f);
    return () => void listeners.delete(f);
  },
};

export const notifications: typeof mockNotifications = USE_API ? realNotifications : mockNotifications;
