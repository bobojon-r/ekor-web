/**
 * Профиль мастера (онбординг, редактор, настройки). Мок в localStorage; с бэкендом — /me/master/profile.
 * status: review — на модерации (до 24 ч), approved — в каталоге и может откликаться.
 */
import { USE_API } from './flags';
import { realMasterProfile } from './real/masterProfile';

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
  /** С бэкенда: ссылки на фото профиля и работ (в порядке photos) */
  avatarUrl?: string;
  photoUrls?: string[];
};

const KEY = 'ekor_master_profile';
const delay = <T,>(v: T, ms = 1100) => new Promise<T>((r) => setTimeout(() => r(v), ms));

const mockMasterProfile = {
  load: () => delay(mockMasterProfile.get(), 200),
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
    const cur = mockMasterProfile.get();
    if (!cur) return null;
    const v = { ...cur, ...p };
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
    return v;
  },
  /** Демо: модератор одобрил */
  approve() {
    const cur = mockMasterProfile.get();
    if (!cur) return null;
    const v = { ...cur, status: 'approved' as const };
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
    return v;
  },
};

/**
 * Экраны используют асинхронные load/save/submit и patchAsync (настройки).
 * С бэкендом get/approve недоступны: статус меняет модератор.
 */
export const masterProfile = {
  load: (): Promise<MasterProfileData | null> => (USE_API ? realMasterProfile.load() : mockMasterProfile.load()),
  submit: (p: Omit<MasterProfileData, 'status'>) => (USE_API ? realMasterProfile.submit(p) : mockMasterProfile.submit(p)),
  save: (p: MasterProfileData) => (USE_API ? realMasterProfile.save(p) : mockMasterProfile.save(p)),
  async patchAsync(cur: MasterProfileData, x: Partial<MasterProfileData>): Promise<MasterProfileData> {
    if (USE_API) return realMasterProfile.patch(cur, x);
    return mockMasterProfile.patch(x) ?? (await mockMasterProfile.save({ ...cur, ...x }));
  },
  setAvatar: (file: Blob) => (USE_API ? realMasterProfile.setAvatar(file) : Promise.resolve()),
  /** Демо-кнопка «Модератор одобрил» — только в моках */
  approve: () => (USE_API ? null : mockMasterProfile.approve()),
};
