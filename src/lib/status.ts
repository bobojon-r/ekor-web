import type { L10n } from './i18n';

export type Role = 'client' | 'master';
export type StatusCode = 'review' | 'open' | 'invited' | 'chosen' | 'work' | 'wait' | 'dispute' | 'done' | 'expired' | 'cancelled' | 'draft' | 'rejected';

type Def = { client: L10n; master: L10n; bg: string; fg: string };

/** Единый словарь статусов — дизайн-система → «Статусы» */
export const STATUS: Record<StatusCode, Def> = {
  draft: { client: { ru: 'Черновик', tj: 'Сиёҳнавис' }, master: { ru: 'Черновик', tj: 'Сиёҳнавис' }, bg: 'var(--line-100)', fg: 'var(--ink-700)' },
  review: { client: { ru: 'На проверке', tj: 'Дар санҷиш' }, master: { ru: 'На проверке', tj: 'Дар санҷиш' }, bg: 'var(--warn-100)', fg: 'var(--warn-800)' },
  rejected: { client: { ru: 'Отклонено', tj: 'Рад шуд' }, master: { ru: 'Отклонено', tj: 'Рад шуд' }, bg: 'var(--danger-100)', fg: 'var(--danger-700)' },
  open: { client: { ru: 'Открыто', tj: 'Кушода' }, master: { ru: 'Открыто', tj: 'Кушода' }, bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
  invited: { client: { ru: 'Ждём ответа мастера', tj: 'Ҷавоби усторо интизорем' }, master: { ru: 'Новое приглашение', tj: 'Даъвати нав' }, bg: 'var(--warn-100)', fg: 'var(--warn-800)' },
  chosen: { client: { ru: 'Мастер выбран', tj: 'Усто интихоб шуд' }, master: { ru: 'Вас выбрали', tj: 'Шуморо интихоб карданд' }, bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
  work: { client: { ru: 'В работе', tj: 'Дар иҷро' }, master: { ru: 'В работе', tj: 'Дар иҷро' }, bg: 'var(--success-100)', fg: 'var(--success-700)' },
  wait: { client: { ru: 'Ждёт подтверждения', tj: 'Тасдиқро интизор аст' }, master: { ru: 'Ждёт подтверждения', tj: 'Тасдиқро интизор аст' }, bg: 'var(--warn-100)', fg: 'var(--warn-800)' },
  dispute: { client: { ru: 'Спор', tj: 'Баҳс' }, master: { ru: 'Спор', tj: 'Баҳс' }, bg: 'var(--danger-100)', fg: 'var(--danger-700)' },
  done: { client: { ru: 'Завершено', tj: 'Анҷом ёфт' }, master: { ru: 'Завершено', tj: 'Анҷом ёфт' }, bg: 'var(--ink-900)', fg: 'var(--white)' },
  expired: { client: { ru: 'Срок истёк', tj: 'Мӯҳлат гузашт' }, master: { ru: 'Закрыто', tj: 'Пӯшида' }, bg: 'var(--line-100)', fg: 'var(--ink-700)' },
  cancelled: { client: { ru: 'Отменено', tj: 'Бекор шуд' }, master: { ru: 'Отменено клиентом', tj: 'Мизоҷ бекор кард' }, bg: 'var(--surface-50)', fg: 'var(--ink-400)' },
};
