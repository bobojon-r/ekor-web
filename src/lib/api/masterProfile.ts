/**
 * Профиль мастера (онбординг, редактор, настройки). Мок в localStorage; с бэкендом — /me/master/profile.
 * status: review — на модерации (до 24 ч), approved — в каталоге и может откликаться.
 */
export type MasterProfileData = {
  status: 'review' | 'approved';
  profs: string[];
  city: string;
  areas: string[];
  online: boolean;
  prices: Record<string, number | null>; // null — договорная
  exp: number;
  about: string;
  showPhone: boolean;
  langs?: string[];
  avatar?: boolean;
  /** Портфолио: id фото (файлы хранит сервер) */
  photos?: number[];
  /** Профессии, добавленные после одобрения и ждущие модерации */
  pendingProfs?: string[];
  /** Настройки мастера */
  accepting?: boolean;
  freeToday?: boolean;
  notifyTasks?: boolean;
  notifyChat?: boolean;
  channel?: 'sms' | 'tg';
};

const KEY = 'ekor_master_profile';
const delay = <T,>(v: T, ms = 1100) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const masterProfile = {
  get(): MasterProfileData | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  submit(p: Omit<MasterProfileData, 'status'>) {
    const v: MasterProfileData = { ...p, status: 'review' };
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
    return delay(v);
  },
  /** Сохранение из редактора. Новая профессия уходит на модерацию, цены и тексты — сразу */
  save(p: MasterProfileData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
    return delay(p, 600);
  },
  /** Мгновенное сохранение переключателя в настройках */
  patch(p: Partial<MasterProfileData>) {
    const cur = masterProfile.get();
    if (!cur) return null;
    const v = { ...cur, ...p };
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
    return v;
  },
  /** Демо: модератор одобрил */
  approve() {
    const cur = masterProfile.get();
    if (!cur) return null;
    const v = { ...cur, status: 'approved' as const };
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
    return v;
  },
};
