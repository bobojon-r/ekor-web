/**
 * Приглашения (ТЗ 5.1, 7.3). Мок-хранилище в localStorage, чтобы экраны клиента и мастера
 * были связаны в демо. С бэкендом — REST /invites, сигнатуры те же.
 */
import { USE_API } from './flags';
import { realInvites } from './real/invites';
import type { RegionKey } from './types';

export type InviteStatus = 'sent' | 'accepted' | 'declined' | 'confirmed' | 'cancelled' | 'public';

export type Invite = {
  id: number;
  masterId: number;
  clientName: string;
  title: string;
  desc: string;
  when: number; // 0 сегодня · 1 завтра · 2 на этой неделе · 3 не срочно
  budget: number | null;
  region: RegionKey;
  district: string;
  category: { ru: string; tj: string };
  status: InviteStatus;
  createdAt: string;
  /** Адрес и телефон клиента — приходят от API только после подтверждения мастера */
  contacts: { address: string; phone: string } | null;
  offer?: { price: number | null; when: number; msg: string };
  declineReason?: number;
};

const KEY = 'ekor_invites';
const delay = <T,>(v: T, ms = 400) => new Promise<T>((r) => setTimeout(() => r(v), ms));

const SEED: Invite[] = [
  {
    id: 1, masterId: 1, clientName: 'Мадина Р.', title: 'Заменить 3 розетки и выключатель',
    desc: 'Две розетки на кухне и одна в спальне не держат вилку, выключатель в коридоре искрит. Розетки Legrand куплены.',
    when: 0, budget: 150, region: 'dushanbe', district: 'Сино', category: { ru: 'Электрика', tj: 'Барқ' }, status: 'sent',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(), contacts: null,
  },
];

function read(): Invite[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : SEED;
  } catch {
    return SEED;
  }
}
function write(list: Invite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
function patch(id: number, p: Partial<Invite>) {
  const list = read().map((x) => (x.id === id ? { ...x, ...p } : x));
  write(list);
  return list.find((x) => x.id === id) ?? null;
}

const mockInvites = {
  list: (_role?: 'client' | 'master') => delay(read(), 300),
  get: (id: number) => delay(read().find((x) => x.id === id) ?? null),
  create: (data: Omit<Invite, 'id' | 'status' | 'createdAt' | 'contacts'> & { categoryKey?: string }) => {
    const list = read();
    const inv: Invite = { ...data, id: Math.max(0, ...list.map((x) => x.id)) + 1, status: 'sent', createdAt: new Date().toISOString(), contacts: null };
    write([...list, inv]);
    return delay(inv, 700);
  },
  // мастер
  accept: (id: number, offer: NonNullable<Invite['offer']>) => delay(patch(id, { status: 'accepted', offer })),
  decline: (id: number, reason: number) => delay(patch(id, { status: 'declined', declineReason: reason })),
  // клиент
  confirm: (id: number) => delay(patch(id, { status: 'confirmed', contacts: { address: 'ул. Айни 48, кв. 17', phone: '907712213' } })),
  makePublic: (id: number) => delay(patch(id, { status: 'public' })),
  cancel: (id: number) => delay(patch(id, { status: 'cancelled' })),
};

export const invites: typeof mockInvites = USE_API ? realInvites : mockInvites;
