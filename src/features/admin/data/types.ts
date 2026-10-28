/** Модели экранов админки — общие для демо-данных и бэкенда */
import type { Role, Tone } from '../core';

export type Me = { role: Role; name: string; meta: string; userId?: number; email?: string; permissions?: string[]; expiresAt?: string };
export type Counts = { tasks: number; masters: number; disputes: number; reviews: number; chats: number; tasksLate: number; disputesHot: string };

export type Dash = {
  period: string;
  kpis: [string, string, string, boolean][];
  funnel: [string, number, string][];
  bars: { v: number; d: number }[];
  cities: [string, string, string, string, string, string, string][];
  deficit: [string, string, number][];
};

export type TaskQ = {
  key: string; id: string; title: string; cat: string; city: string; author: string; authorMeta: string; budget: string; when: string;
  ageMin: number; slaLeft: number | null; flags: string[]; text: string; photos: string[];
  /** Кто сейчас смотрит карточку (блокировка 10 мин) и диапазоны совпадений автодетектора в тексте */
  lock?: Lock | null; marks?: [number, number][]; address?: string | null; authorId?: number;
};
export type Lock = { name: string; mine: boolean };
export type Reason = { id: number; code: string; label: string; text?: string; needComment?: boolean; hidden?: boolean; system?: boolean; kind?: string };

export type MasterQ = {
  key: string; id: string; userId: number; name: string; cats: string; city: string; agoMin: number; slaLeft: number;
  type: 'Новый' | 'Изменения' | 'Повторно' | '«Проверен»'; tone: Tone; kind: 'master' | 'profession'; professionId?: number; lock?: Lock | null; flags?: string[];
};
export type Check = [string, 0 | 1 | 2, string];
export type MasterCard = {
  name: string; sub: string; meta: string; avatar?: string; city: string; prices: string; about: string; photos: string[]; checklist: Check[]; verified: boolean;
  marks?: [number, number][]; phone?: string;
};

export type DisputeV = {
  key: number; id: string; title: string; who: string; status: string; tone: Tone; slaH: number | null; order: string; open: boolean; waiting: boolean;
  client: { title: string; text: string; meta: string }; master: { title: string; text: string; meta: string } | null; photos: string[]; chatId: number | null;
  clientName: string; masterName: string; resolution?: string;
  clientId?: number; masterId?: number; lock?: Lock | null; unanswered?: number; price?: string; comment?: string | null; termsDeadline?: string | null;
  requests?: DisputeReq[];
};
export type DisputeReq = { id: number; to: 'client' | 'master'; text: string; meta: string; answer: string | null; answerMeta: string; photos: string[] };
export type TimelineItem = [string, string, string];

export type ReviewV = {
  key: number; id: string; rating: number; text: string; master: string; reason: string; tone: Tone; complaints: number; order: string; date: string;
  author: string; reply: string | null; complaintList: [string, string][]; status: 'review' | 'published' | 'hidden'; hideReason?: string | null;
};

export type UserV = { key: number; id: string; name: string; phone: string; role: string; city: string; status: string; tone: Tone; complaints: number; seen: string; blocked: boolean };
export type UserCard = UserV & {
  stats: [string, string, boolean][]; signals: string; blockReason?: string | null; activeTasks: number;
  /** Полный номер — только в карточке (в списке маска), история санкций */
  phoneFull?: string; sanctions?: { text: string; meta: string; active: boolean; warn: boolean }[];
};

export type ComplaintV = {
  key: number; id: string; title: string; order: string; status: string; tone: Tone; open: boolean; chatId: number | null; text: string; from: string;
  date: string; who: string; detector: string[]; subject: string; subjectUserId?: number;
  targetType?: string; hasChat?: boolean; preview?: string | null;
};
export type ChatMsg = { sys: boolean; who: '' | 'Клиент' | 'Мастер'; text: string; time: string; flag: boolean; id?: number; hidden?: boolean; photo?: string | null };

export type CatNode = {
  id: number; key: string; ru: string; tj: string; parentId: number | null; icon: string; masters: number; hidden: boolean; aliases: string[]; online: boolean;
  photoRequired?: boolean; perHour?: boolean; sort?: number; openTasks?: number; priceFrom?: number | null;
};
export type DistrictNode = { id: number; ru: string; tj: string; near: boolean; neighbors?: number[]; hidden?: boolean };
export type CityNode = { id: number; ru: string; tj: string; region: string; masters: number; districts: DistrictNode[]; hidden?: boolean };

export type LimitV = { key: string; group: string; label: string; value: number; unit: string; version?: number; min?: number; max?: number; def?: number };
export type LimitEffect = { label: string; old: number; next: number; effect: string; affected: number | null };
export type HistoryV = [string, string, boolean];

export type StaffV = { id: number; name: string; email: string; phone: string; role: string; regions: string; regionIds: number[]; status: string; tone: Tone; seen: string; active: boolean; created: string };
export type SessionV = { id: string; device: string; where: string; when: string; current: boolean; revoked: boolean };
export type TaskRegRow = { key: number; id: string; title: string; sub: string; client: string; clientId: number; budget: string; responses: number; status: string; tone: Tone; created: string; flags: string[] };
export type TaskRegCard = {
  id: string; key: number; status: string; tone: Tone; title: string; sub: string; client: string; clientId: number; phone: string; address: string; master: string; masterId: number | null; order: string;
  flags: string; responses: { name: string; price: string; state: string; chosen: boolean }[]; history: [string, string][]; canUnpublish: boolean;
};
export type MasterRegRow = { key: number; id: string; name: string; profs: string; city: string; rating: string; orders: string; status: string; tone: Tone; verified: boolean; seen: string };
export type MasterRegCard = {
  key: number; id: string; name: string; status: string; tone: Tone; sub: string; stats: [string, string][]; rows: [string, string][]; orders: [string, string, string][]; warn: string | null; verified: boolean; suspended: boolean;
};

export type AuditV = {
  key: number; time: string; who: string; action: string; obj: string; details: string; tone: Tone; evt: string; comment: string | null;
  old: Record<string, unknown> | null; next: Record<string, unknown> | null; ip?: string | null; device?: string | null; date?: string;
};

export type TplRow = { code: string; title: string; ch: ('inapp' | 'push' | 'sms')[]; custom: string[] };
export type TplText = { ch: 'inapp' | 'push' | 'sms'; lang: 'ru' | 'tj'; title: string | null; body: string; custom: boolean; defBody: string; preview: string; version: number; sms: { max: number; segments: number; ucs2: boolean } | null };
export type TplCard = { code: string; title: string; ch: TplText['ch'][]; vars: { name: string; max: number; sample: string }[]; texts: TplText[] };
