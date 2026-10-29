/** Админка: разделы, права ролей, цвета статусов, форматирование (только RU) */
import {
  BadgeCheck, ClipboardCheck, HardHat, History, ListChecks, LayoutDashboard, MapPin, MessageSquareText, MessageSquareWarning, MessagesSquare, Scale, ShieldCheck, SlidersHorizontal, Users,
  type LucideIcon,
} from 'lucide-react';
import { L } from './i18n';

export type Role = 'moderator' | 'senior' | 'admin';
export type SectionKey = 'dashboard' | 'tasks' | 'masters' | 'disputes' | 'reviews' | 'allTasks' | 'allMasters' | 'users' | 'chats' | 'dicts' | 'limits' | 'templates' | 'staff' | 'audit';

type Section = { key: SectionKey; href: string; icon: LucideIcon; label: string; title: string; roles: Role[]; danger?: boolean };
const ALL: Role[] = ['moderator', 'senior', 'admin'];
const SENIOR: Role[] = ['senior', 'admin'];
const ADMIN: Role[] = ['admin'];

/** Меню строится по роли (AdminNav.dc.html): moderator — очереди и реестры своих регионов, пользователи и аудит */
export const NAV: [string, Section[]][] = [
  [L.core.obzor, [{ key: 'dashboard', href: '/admin', icon: LayoutDashboard, label: L.core.dashbord, title: L.core.dashbord, roles: ALL }]],
  [
    L.core.moderatsiya,
    [
      { key: 'tasks', href: '/admin/moderation/tasks', icon: ClipboardCheck, label: L.core.zadaniya, title: L.core.moderatsiyaZadaniya, roles: ALL },
      { key: 'masters', href: '/admin/moderation/masters', icon: BadgeCheck, label: L.core.profili, title: L.core.moderatsiyaProfiliMasterov, roles: ALL },
      { key: 'disputes', href: '/admin/disputes', icon: Scale, label: L.core.spory, title: L.core.spory, roles: SENIOR, danger: true },
      { key: 'reviews', href: '/admin/reviews', icon: MessageSquareWarning, label: L.core.otzyvyIZhaloby, title: L.core.otzyvyIZhaloby, roles: SENIOR },
    ],
  ],
  [
    L.core.katalog,
    [
      { key: 'allTasks', href: '/admin/tasks', icon: ListChecks, label: L.core.vseZadaniya, title: L.core.vseZadaniya, roles: ALL },
      { key: 'allMasters', href: '/admin/masters', icon: HardHat, label: L.core.vseMastera, title: L.core.vseMastera, roles: ALL },
      { key: 'users', href: '/admin/users', icon: Users, label: L.core.polzovateli, title: L.core.polzovateli, roles: ALL },
      { key: 'chats', href: '/admin/complaints', icon: MessagesSquare, label: L.core.chatyPoZhalobam, title: L.core.chatyPoZhalobam, roles: SENIOR },
    ],
  ],
  [
    L.core.nastroyki,
    [
      { key: 'dicts', href: '/admin/dictionaries', icon: MapPin, label: L.core.spravochniki, title: L.core.spravochniki, roles: ADMIN },
      { key: 'limits', href: '/admin/limits', icon: SlidersHorizontal, label: L.core.limityINastroyki, title: L.core.limityINastroyki, roles: ADMIN },
      { key: 'templates', href: '/admin/templates', icon: MessageSquareText, label: L.core.shablonySms, title: L.core.shablonyUvedomleniy, roles: ADMIN },
      { key: 'staff', href: '/admin/staff', icon: ShieldCheck, label: L.core.sotrudnikiIRoli, title: L.core.sotrudnikiIRoli, roles: ADMIN },
      // ТЗ §6 и бэкенд: аудит — senior и admin (в макете меню модератора пункт был, сервер отвечает 403)
      { key: 'audit', href: '/admin/audit', icon: History, label: L.core.auditLog, title: L.core.auditLog, roles: SENIOR },
    ],
  ],
];
export const SECTIONS = NAV.flatMap(([, s]) => s);
export const section = (k: SectionKey) => SECTIONS.find((s) => s.key === k)!;
export const canSee = (k: SectionKey, r: Role) => section(k).roles.includes(r);
export const ROLE_NAME: Record<Role, string> = { moderator: 'moderator', senior: 'senior_moderator', admin: 'admin' };
export const roleFromApi = (r: string | null | undefined): Role | null => (r === 'admin' ? 'admin' : r === 'senior_moderator' || r === 'senior' ? 'senior' : r === 'moderator' ? 'moderator' : null);

/** Цвета статусов из дизайна: [фон, текст] */
export const ST = {
  ok: ['#E3F4F0', '#0B6E5E'], warn: ['#FBEBDA', '#8A4B0D'], bad: ['#FBE3E0', '#A5281B'], info: ['#EAEEFC', '#1F3BB8'], grey: ['#EEF1F4', '#3B4756'], dark: ['#0F1B2A', '#fff'],
} as const;
export type Tone = keyof typeof ST;

/** Автофлаги заданий: ключ API → подпись и тон */
export const FLAGS: Record<string, [string, Tone]> = {
  contacts: [L.core.kontakty, 'bad'], phone: [L.core.kontakty, 'bad'], payment: [L.core.predoplata, 'bad'], prepayment: [L.core.predoplata, 'bad'], payment_talk: [L.core.predoplata, 'bad'],
  link: [L.core.ssylka, 'bad'], links: [L.core.ssylka, 'bad'], new: [L.core.novyy, 'info'], new_author: [L.core.novyy, 'info'], repeat: [L.core.povtor, 'warn'], duplicate: [L.core.povtor, 'warn'],
};
export const FLAG_TEXT: Record<string, string> = {
  [L.core.kontakty]: L.core.telefonVTeksteUdalite,
  [L.core.predoplata]: L.core.prosbaOPredoplateChastaya,
  [L.core.ssylka]: L.core.ssylkaIliMessendzherV,
};
export const flagOf = (k: string): [string, Tone] => FLAGS[k] ?? [k, 'grey'];

/** Контакт в тексте подсвечиваем: телефон, ссылка, @ник, номер карты */
const CONTACT =
  /(\+?992[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b|\b\d{4}[\s•*]+[\d•*\s]{6,}\d{4}\b|https?:\/\/\S+|t\.me\/\S*|\b[\w-]+\.(?:com|tj|ru|me)\/?\S*|@\w{3,}|(?:telegram|whatsapp|телеграм|ватсап)\s*@?\w*|предоплат\S*[^.,]*)/i;
export function splitContact(text: string) {
  const m = text.match(CONTACT);
  return m && m.index !== undefined ? { pre: text.slice(0, m.index), hl: m[0], post: text.slice(m.index + m[0].length) } : { pre: text, hl: '', post: '' };
}

const MON = [L.core.yanv, L.core.fev, L.core.mar, L.core.apr, L.core.maya, L.core.iyun, L.core.iyul, L.core.avg, L.core.sen, L.core.okt, L.core.noya, L.core.dek];
const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const hhmmss = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
export const dayMon = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};
export const dayMonTime = (iso: string) => `${dayMon(iso)}, ${hhmm(iso)}`;
export const num = (n: number) => n.toLocaleString('ru-RU');

/** «9 мин назад», «2 ч назад», «1 д назад» */
export function agoText(min: number) {
  if (min < 60) return L.core.minNazad(Math.max(1, Math.round(min)));
  if (min < 1440) return L.core.chNazad(Math.round(min / 60));
  return L.core.dNazad(Math.round(min / 1440));
}
/** «2 ч», «5 мин», «вчера», «3 д» — последний вход */
export function seenText(iso: string | null | undefined) {
  if (!iso) return '—';
  const min = (Date.now() - +new Date(iso)) / 60000;
  if (min < 2) return L.core.seychas;
  if (min < 60) return L.core.min(Math.round(min));
  if (min < 1440) return L.core.ch(Math.round(min / 60));
  if (min < 2880) return L.core.vchera;
  return L.core.d(Math.round(min / 1440));
}

/**
 * SLA на строке очереди: оставшееся время; ≤ 5 мин — оранжевый, просрочено — красный «+N м».
 * unit 'm' — минуты (задания), 'h' — часы (профили).
 */
export function sla(leftMin: number, unit: 'm' | 'h' = 'm') {
  const v = unit === 'h' ? Math.round(leftMin / 60) : Math.round(leftMin);
  const u = unit === 'h' ? L.core.ch2 : L.core.m;
  if (leftMin < 0) return { text: `+${Math.abs(v) || 1}${u}`, color: '#B03A2E' };
  const hot = unit === 'h' ? leftMin <= 4 * 60 : leftMin <= 5;
  return { text: `${v}${u}`, color: hot ? '#8A4B0D' : '#0F1B2A' };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/** CSV из строк таблицы — выгрузка в браузере */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
