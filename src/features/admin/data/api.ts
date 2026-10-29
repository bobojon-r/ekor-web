/**
 * Данные админки. NEXT_PUBLIC_API=real — /api/admin/* (доступ только сотрудникам),
 * иначе демо из дизайна (изменения живут до перезагрузки страницы).
 */
import { USE_API } from '@/lib/api';
import { adminHttp as http, adminUrl, csrf } from './http';
import { ref } from '@/lib/api/ref';
import { agoText, dayMon, dayMonTime, flagOf, hhmm, hhmmss, num, roleFromApi, seenText, type Role, type Tone } from '../core';
import * as demo from './demo';
import type {
  AuditV, CatNode, ChatMsg, CityNode, ComplaintV, Counts, Dash, DisputeV, HistoryV, LimitEffect, LimitV, Lock, MasterCard, MasterQ, MasterRegCard, MasterRegRow, Me, Reason, ReviewV, SessionV, StaffV, TaskQ, TaskRegCard, TaskRegRow, TimelineItem, TplCard, TplRow, TplText, UserCard, UserV,
} from './types';
import { L } from '../i18n';

const wait = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));
/* ======================= типы ответов API ======================= */
type Ref = { id: number; name_ru: string; name_tj: string };
type Party = { id: number; name: string | null; phone: string };
type LockOut = { staff_id: number; staff_name: string | null; expires_at: string; mine: boolean };
type Match = { field: string; start: number; end: number; flag: string };
type QueuePage<T> = { items: T[]; total: number; overdue: number };
type QueueTask = {
  id: number; title: string; description: string; address: string | null; category: Ref; subcategory: Ref | null; mode: 'site' | 'online'; city: Ref | null; district: Ref | null; when: string; date: string | null;
  budget_mode: string; budget_min: number | null; budget_max: number | null; photos: { upload_id: number; url: string }[]; author: { id: number; name: string | null; phone: string; registered_at: string; tasks_count: number };
  flags: string[]; matches: Match[]; submitted_at: string | null; sla_deadline: string | null; overdue: boolean; lock: LockOut | null;
};
type QueueMaster = {
  id: number; type: 'new' | 'changes' | 'verify_request'; name: string | null; phone: string; city: Ref | null; works_online: boolean; about: string | null; experience: string | null;
  professions: { category: Ref; price_from: number | null; negotiable: boolean; status: string }[]; services: { title?: string; price?: number | null }[]; portfolio: { upload_id: number; url: string }[];
  avatar_url: string | null; flags: string[]; matches: Match[]; submitted_at: string | null; sla_deadline: string | null; overdue: boolean; lock: LockOut | null;
  changes: { field: string; label: string; before: string | string[] | null; after: string | string[] | null }[] | null; verified: boolean;
  verify_request: { id: number; comment: string | null; photos: { upload_id: number; url: string }[]; created_at: string } | null;
};
type RegPage<T> = { items: T[]; next_cursor: string | null; total: number; counts_by_status: Record<string, number> };
type TaskRow = {
  id: number; title: string; status: string; category: Ref; city: Ref | null; district: Ref | null; client: Party; budget_mode: string; budget_min: number | null; budget_max: number | null;
  responses_count: number; views_count: number; flags: string[]; created_at: string; published_at: string | null;
};
type MasterRow = { id: number; name: string | null; phone: string; status: string; city: Ref | null; headline: Ref | null; verified: boolean; accepting_orders: boolean; rating_avg: number | null; reviews_count: number; completed_orders_count: number; created_at: string; last_seen_at: string | null };
type StatsOut = {
  date_from: string; date_to: string; computed_at: string | null;
  kpi: { tasks_created: number; response_24h_rate: number | null; choice_rate: number | null; completion_rate: number | null; masters_approved: number; moderation_median_minutes: number | null };
  funnel: { step: string; count: number }[];
  daily: { day: string; created: number; published: number; responded_24h: number; chosen: number; done: number; masters_approved: number }[];
  by_city: { city_id: number | null; name_ru: string; created: number; published: number; chosen: number; done: number; response_24h_rate: number | null; choice_rate: number | null; completion_rate: number | null; first_response_median_minutes: number | null }[];
  deficit: { city_id: number | null; city_name_ru: string; category_id: number; category_name_ru: string; published: number; without_response_24h: number; share: number }[];
  queues: { queue: string; count: number; overdue: number | null; oldest_at: string | null }[];
};
type ReasonRef = { id: number; code: string; text_ru: string };
type DisputeRow = {
  id: number; order_id: number; task_id: number; task_title: string; client: Party; master: Party; reason: ReasonRef | null; text: string | null; status: 'open' | 'resolved'; resolution: string | null;
  deadline: string | null; overdue: boolean; unanswered_requests: number; system: boolean; created_at: string; lock: LockOut | null;
};
type DisputeCard = DisputeRow & {
  photos: string[]; price: number | null; chat_id: number | null; moderator_comment: string | null; terms_deadline: string | null; resolved_at: string | null;
  requests: { id: number; to_side: 'client' | 'master'; text: string; staff_name: string | null; created_at: string; answer: string | null; answer_photos: string[]; answered_at: string | null }[];
  timeline: { at: string; event: string; note: string | null }[];
};
type ChatRow = { id: number; sender_id: number | null; sender_side: 'client' | 'master' | 'system'; type: string; body: string | null; system_code: string | null; photo_url: string | null; flags: string[]; hidden: boolean; created_at: string };
type ReviewRow = {
  id: number; order_id: number; task_title: string; author: Party; master: Party; rating: number; text: string; status: 'published' | 'review' | 'hidden'; flags: string[]; complaints_count: number;
  complaints: { id: number; reason_ru: string; comment: string | null; created_at: string }[]; hide_reason: string | null; reply_text: string | null; created_at: string;
};
type UserRow = { id: number; name: string | null; phone: string; city: Ref | null; is_client: boolean; is_master: boolean; master_status: string | null; status: 'active' | 'blocked'; blocked_until: string | null; complaints_count: number; created_at: string; last_seen_at: string | null };
type UserDetail = UserRow & {
  block_reason: string | null; lang: string; tasks_count: number; orders_as_client: number; orders_as_master: number; reviews_written: number;
  signals: { tasks_rejected: number; complaints_against: number; payment_talk_messages: number; card_numbers_in_chats: number };
  sanctions: { id: number; type: 'warn' | 'block'; duration: string | null; until: string | null; reason_ru: string | null; comment: string | null; staff_name: string | null; created_at: string; lifted_at: string | null; lifted_by: string | null; active: boolean }[];
};
type ComplaintRow = {
  id: number; reporter: Party; target_type: string; target_id: number; target_preview: string | null; order_id: number | null; reason: ReasonRef | null; text: string | null; status: 'new' | 'resolved';
  resolution: string | null; resolved_by: string | null; has_chat: boolean; created_at: string;
};
type LimitOut = { key: string; title: string; unit: string; group: string; value: number; default: number; min: number; max: number; version: number; reason: string | null; updated_by: string | null; updated_at: string | null };
type LimitsResult = { applied: boolean; effects: { key: string; title: string; old: number; new: number; effect: string; affected: number | null }[]; limits: LimitOut[] };
type ReasonAdmin = { id: number; kind: string; code: string; text_ru: string; text_tj: string | null; user_message_ru: string | null; requires_comment: boolean; sort: number; hidden: boolean; system: boolean };
type CategoryAdmin = {
  id: number; parent_id: number | null; key: string; name_ru: string; name_tj: string; icon: string | null; synonyms: string[]; allows_online: boolean; photo_required: boolean; price_per_hour: boolean;
  typical_price_from: number | null; is_other: boolean; sort: number; hidden: boolean; masters_count: number; open_tasks_count: number;
};
type CityAdmin = { id: number; region_id: number; key: string; name_ru: string; name_tj: string; synonyms: string[]; sort: number; hidden: boolean; districts_count: number };
type DistrictAdmin = { id: number; city_id: number; name_ru: string; name_tj: string; synonyms: string[]; near: boolean; sort: number; hidden: boolean; neighbor_ids: number[] };
type CityRef = { id: number; name_ru: string };
type StaffOut = { id: number; email: string; name: string; contact_phone: string | null; role: string; region_cities: CityRef[]; status: 'active' | 'disabled'; created_at: string; last_login_at: string | null; locked_until: string | null };
type MeOut = StaffOut & { permissions: string[]; session_expires_at: string };
type SessionOut = { id: string; created_at: string; expires_at: string; ip: string | null; user_agent: string | null; city: string | null; revoked_at: string | null; current: boolean };
type AuditRow = { id: number; at: string; staff_id: number | null; staff_name: string | null; action: string; object_type: string; object_id: number | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; basis: string | null; ip: string | null; user_agent: string | null };
type Page<T> = { items: T[]; next_cursor: string | null };
type OwnProfile = {
  status: string; professions: { category_id: number; name_ru: string; price_from: number | null; negotiable: boolean; status: string }[]; city: { name_ru: string } | null; works_online: boolean;
  districts: { name_ru: string }[]; experience: string | null; about: string | null; portfolio: { url: string }[]; avatar_url: string | null; verified: boolean; services: { title: string; price: number | null }[]; accepting_orders: boolean;
};
type MasterCardOut = {
  profile: OwnProfile; phone: string; registered_at: string;
  metrics: { rating_avg: number | null; reviews_count: number; orders_total: number; orders_done: number; completion_rate: number | null; declines_after_choice: number; median_response_minutes: number | null; responses_today: number; responses_limit: number };
  recent_orders: { id: number; task_title: string; client: Party; master: Party; status: string; price: number | null; created_at: string }[]; complaints_30d: { id: number; reason_ru: string; comment: string | null; status: string; created_at: string }[];
};
type TaskCardOut = {
  task: { id: number; status: string; title: string; description: string; address: string | null; budget_mode: string; budget_min: number | null; budget_max: number | null; when: string; date: string | null };
  client: Party; client_registered_at: string; complaints_count: number;
  responses: { master: Party; price: number | null; inspect: boolean; term: string; status: string; edited: boolean }[];
  orders: { id: number; master: Party; status: string; price: number | null; chat_id: number | null; created_at: string }[];
  events: { at: string; kind: string; action: string; actor: string | null; comment: string | null }[];
};

/* ======================= помощники ======================= */
const phoneFmt = (p: string) => {
  const d = p.replace(/\D/g, '').slice(-9);
  return d.length === 9 ? `+992 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : p;
};
const minutesSince = (iso: string | null | undefined) => (iso ? Math.max(0, (Date.now() - +new Date(iso)) / 60000) : 0);
const EXP: Record<string, string> = { lt1: L.api.opytDo1Goda, '1_3': L.api.opyt13Goda, '3_10': L.api.opyt310Let, gt10: L.api.opytBolshe10Let };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const ACT_TONE = (a: string): Tone => (/reject|block|hide|suspend/.test(a) ? 'bad' : /approve|resolve|verify|unblock|restore/.test(a) ? 'ok' : /edit|update|warn|limits/.test(a) ? 'warn' : 'info');
const OBJ_PREFIX: Record<string, string> = { task: 'T-', master: 'M-', master_profile: 'M-', user: 'U-', review: 'R-', dispute: 'D-', order: 'O-', chat: 'O-', complaint: 'C-' };
const objId = (t: string, id: number | null) => (id == null ? t : OBJ_PREFIX[t] ? `${OBJ_PREFIX[t]}${id}` : `${t}:${id}`);

const short = (n: string) => {
  const [a, b] = n.split(' ');
  return b ? `${a} ${b[0]}.` : a;
};

/* ======================= демо-хранилище (живёт до перезагрузки) ======================= */
const mem = {
  tasks: [...demo.demoTasks], masters: [...demo.demoMasters], disputes: demo.demoDisputes.map((d) => ({ ...d })), reviews: demo.demoReviews.map((r) => ({ ...r })),
  users: demo.demoUsers.map((u) => ({ ...u })), complaints: demo.demoComplaints.map((c) => ({ ...c })), cats: demo.demoCats(), limits: demo.demoLimits.map((l) => ({ ...l })),
  history: [...demo.demoLimitHistory], staff: demo.demoStaff.map((s) => ({ ...s })), audit: [...demo.demoAudit], approvedToday: 86, rejected: [] as TaskQ[],
};
const log = (who: string, action: string, obj: string, details: string) => {
  const d = new Date();
  mem.audit.unshift({ key: Date.now(), time: hhmmss(d.toISOString()), who, action, obj, details, tone: ACT_TONE(action), evt: `evt_${Date.now().toString(16).slice(-6)}`, comment: details || null, old: null, next: null });
};

/* ======================= API ======================= */
export const adminApi = {
  /** Текущий сотрудник: с бэкендом — GET /admin/me (сессия в cookie); в демо — роль из ?role= после демо-входа */
  async me(demoRole: Role): Promise<Me | null> {
    if (!USE_API) return wait(demoAuthed() ? demo.demoMe(demoRole) : null, 0);
    try {
      const m = await http<MeOut>('/admin/me', { noRedirect: true });
      const role = roleFromApi(m.role);
      if (!role) return null;
      const regions = m.region_cities.map((c) => c.name_ru).join(', ');
      return { role, name: m.name, meta: [m.role, regions].filter(Boolean).join(' · '), userId: m.id, email: m.email, permissions: m.permissions, expiresAt: m.session_expires_at };
    } catch (e) {
      if ((e as { status?: number }).status === 401) return null;
      throw e;
    }
  },
  /** Вход по почте и паролю. Ошибка — ApiError: 401 invalid_credentials {attempts_left}, 423 locked {until} */
  async login(email: string, password: string) {
    if (!USE_API) {
      // Демо: пароль «wrong» — неверный (5 попыток → блок 15 мин), любой другой — вход
      const st = demoLock();
      if (st.until > Date.now()) throw Object.assign(new Error('locked'), { status: 423, code: 'locked', details: { until: new Date(st.until).toISOString() } });
      if (password === 'wrong') {
        const n = st.fails + 1;
        demoLock({ fails: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 15 * 60000 : 0 });
        if (n >= 5) throw Object.assign(new Error('locked'), { status: 423, code: 'locked', details: { until: new Date(Date.now() + 15 * 60000).toISOString() } });
        throw Object.assign(new Error(L.api.nevernayaPochtaIliParol), { status: 401, code: 'invalid_credentials', details: { attempts_left: 5 - n } });
      }
      demoLock({ fails: 0, until: 0 });
      try {
        localStorage.setItem(DEMO_AUTH, '1');
      } catch {}
      return wait(null, 300);
    }
    const r = await http<{ csrf_token: string }>('/admin/auth/login', { method: 'POST', body: { email: email.trim(), password }, noRedirect: true });
    csrf.set(r.csrf_token);
  },
  async logout() {
    if (!USE_API) {
      try {
        localStorage.removeItem(DEMO_AUTH);
      } catch {}
      return;
    }
    await http('/admin/auth/logout', { method: 'POST', noRedirect: true }).catch(() => {});
    csrf.set(null);
    dictDenied = false;
  },

  /** Счётчики меню; moderator не видит споры, отзывы и жалобы — их не запрашиваем (иначе 403) */
  async counts(role: Role = 'admin'): Promise<Counts> {
    if (!USE_API) return wait({ ...demo.demoCounts, tasks: mem.tasks.length, masters: mem.masters.filter((m) => m.type === L.api.novyy || m.type === L.api.povtorno).length, disputes: mem.disputes.filter((d) => d.open).length, reviews: mem.reviews.filter((r) => r.status === 'review').length, chats: mem.complaints.filter((c) => c.open).length }, 0);
    const senior = role !== 'moderator';
    const [t, m, d, r, c] = await Promise.all([
      http<QueuePage<QueueTask>>('/admin/moderation/tasks', { query: { limit: 1 } }).catch(() => null),
      http<QueuePage<QueueMaster>>('/admin/moderation/masters', { query: { limit: 1 } }).catch(() => null),
      senior ? http<DisputeRow[]>('/admin/disputes', { query: { status: 'open', limit: 100 } }).catch(() => [] as DisputeRow[]) : ([] as DisputeRow[]),
      senior ? http<ReviewRow[]>('/admin/reviews', { query: { status: 'review', limit: 100 } }).catch(() => [] as ReviewRow[]) : ([] as ReviewRow[]),
      senior ? http<ComplaintRow[]>('/admin/complaints', { query: { status: 'new', limit: 100 } }).catch(() => [] as ComplaintRow[]) : ([] as ComplaintRow[]),
    ]);
    // «Горит» — до дедлайна спора 6 ч и меньше или уже просрочен
    const hot = d.map((x) => hoursLeft(x.deadline)).filter((h): h is number => h != null && h <= 6);
    return {
      tasks: t?.total ?? 0, tasksLate: t?.overdue ?? 0, masters: m?.total ?? 0, disputes: d.length,
      disputesHot: hot.length ? L.api.goritCh(hot.length, Math.max(0, Math.min(...hot))) : L.api.vNorme, reviews: r.length, chats: c.length,
    };
  },

  /* ---------- 01 Дашборд ---------- */
  /** Период — даты Душанбе (YYYY-MM-DD) включительно */
  async dashboard(range: { from: string; to: string }, cityId: number | null, catId: number | null = null): Promise<Dash> {
    if (!USE_API) return wait(demo.demoDash);
    const st = await http<StatsOut>('/admin/stats', { query: { from: range.from, to: range.to, city: cityId, category: catId } });
    const k = st.kpi;
    const step = (n: string) => st.funnel.find((f) => f.step === n)?.count ?? 0;
    const P = step('published');
    const rate = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);
    const fmtD = (iso: string) => dayMon(`${iso}T12:00:00`);
    return {
      period: st.date_from === st.date_to ? fmtD(st.date_from) : `${fmtD(st.date_from)} – ${fmtD(st.date_to)}`,
      kpis: [
        [L.api.novyeZadaniya, num(k.tasks_created), L.api.opublikovano(num(P)), true], [L.api.otklikZa24Ch, rate(k.response_24h_rate), L.api.sOtklikomVsego(pct(step('responded'), P)), true],
        [L.api.vyborMastera, rate(k.choice_rate), L.api.zadaniy(num(step('chosen'))), true], [L.api.zaversheno, rate(k.completion_rate), L.api.zakazov(num(step('done'))), true],
        [L.api.novyeMastera, num(k.masters_approved), L.api.odobrenoZaPeriod, true],
        [L.api.medianaModeratsii, k.moderation_median_minutes != null ? L.api.min(Math.round(k.moderation_median_minutes)) : '—', L.api.norma30Min, (k.moderation_median_minutes ?? 0) <= 30],
      ],
      funnel: [
        [L.api.opublikovano2, P, ''], [L.api.sOtklikom, step('responded'), `${pct(step('responded'), P)}%`], [L.api.masterVybran, step('chosen'), `${pct(step('chosen'), step('responded'))}%`],
        [L.api.zaversheno, step('done'), `${pct(step('done'), step('chosen'))}%`], [L.api.sOtzyvom, step('reviewed'), `${pct(step('reviewed'), step('done'))}%`],
      ],
      bars: st.daily.slice(-14).map((d) => ({ d: +d.day.slice(8), v: d.created })),
      cities: st.by_city.map((c): Dash['cities'][number] => [
        c.name_ru, num(c.created), num(ref.cityById(c.city_id ?? -1)?.masters ?? 0), rate(c.response_24h_rate), rate(c.choice_rate), rate(c.completion_rate), c.first_response_median_minutes != null ? L.api.min(Math.round(c.first_response_median_minutes)) : '—',
      ]),
      deficit: st.deficit.slice(0, 6).map((x): [string, string, number] => [x.category_name_ru, x.city_name_ru, Math.round(x.share * 100)]),
    };
  },

  /* ---------- 02 Модерация заданий ---------- */
  async tasks(tab: 'queue' | 'rejected' | 'approved'): Promise<TaskQ[]> {
    if (!USE_API) return wait(tab === 'queue' ? mem.tasks : tab === 'rejected' ? mem.rejected : []);
    if (tab === 'queue') {
      const q = await http<QueuePage<QueueTask>>('/admin/moderation/tasks', { query: { limit: 100 } });
      return q.items.map((x) => ({
        key: String(x.id), id: `T-${x.id}`, title: x.title, cat: (x.subcategory ?? x.category).name_ru, city: placeText(x.mode, x.city, x.district),
        author: x.author.name ?? `#${x.author.id}`, authorMeta: [phoneFmt(x.author.phone), `${x.author.tasks_count} ${plural(x.author.tasks_count, L.api.zadanie, L.api.zadaniya, L.api.zadaniy2)}`, L.api.s(dayMon(x.author.registered_at), new Date(x.author.registered_at).getFullYear())].join(' · '),
        budget: budgetText(x.budget_mode, x.budget_min, x.budget_max), when: whenText(x.when, x.date), ageMin: minutesSince(x.submitted_at), slaLeft: x.sla_deadline ? (+new Date(x.sla_deadline) - Date.now()) / 60000 : null,
        flags: [...new Set(x.flags.map((f) => flagOf(f)[0]))], text: x.description, photos: x.photos.map((p) => p.url), lock: lockOf(x.lock), address: x.address, authorId: x.author.id,
        marks: x.matches.filter((m) => m.field === 'description').map((m): [number, number] => [m.start, m.end]),
      }));
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const p = await http<RegPage<TaskRow>>('/admin/tasks', { query: tab === 'rejected' ? { status: 'rejected', limit: 100 } : { status: 'open', from: today.toISOString(), limit: 100 } });
    return p.items.map((t) => ({
      key: String(t.id), id: `T-${t.id}`, title: t.title, cat: t.category.name_ru, city: [t.city?.name_ru, t.district?.name_ru].filter(Boolean).join(', ') || L.api.onlayn, author: t.client.name ?? `#${t.client.id}`, authorMeta: t.client.phone,
      budget: budgetText(t.budget_mode, t.budget_min, t.budget_max), when: '—', ageMin: minutesSince(t.created_at), slaLeft: null, flags: t.flags.map((f) => flagOf(f)[0]), text: '', photos: [],
    }));
  },
  async approvedToday() {
    if (!USE_API) return mem.approvedToday;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (await http<RegPage<TaskRow>>('/admin/tasks', { query: { status: 'open', from: today.toISOString(), limit: 1 } })).total;
  },
  taskReasons: () => (USE_API ? adminApi.reasons('task_reject') : Promise.resolve(demo.demoTaskReasons)),
  /** Причины по виду: справочник админки (admin), для остальных ролей — публичный /reasons */
  async reasons(kind: string): Promise<Reason[]> {
    if (!USE_API) return wait(kind === 'master_reject' ? demo.demoMasterReasons : demo.demoTaskReasons);
    const l = await reasonList(kind).catch(() => [] as ReasonAdmin[]);
    return l.filter((r) => !r.hidden).map((r) => ({ id: r.id, code: r.code, label: r.text_ru, needComment: r.requires_comment ?? r.code.startsWith('other'), kind }));
  },
  /** Взять карточку в работу на 10 мин: другие модераторы увидят «Смотрит …». 409 locked_by_other — уже смотрит другой */
  async lockTask(t: TaskQ): Promise<Lock | null> {
    if (!USE_API) return null;
    return lockOf(await http<LockOut>(`/admin/tasks/${t.key}/lock`, { method: 'POST' }));
  },
  async moderateTask(t: TaskQ, ok: boolean, reason?: Reason, comment?: string) {
    if (!USE_API) {
      mem.tasks = mem.tasks.filter((x) => x.key !== t.key);
      if (ok) mem.approvedToday++;
      else mem.rejected.unshift(t);
      log(L.api.vy, ok ? 'task.approve' : 'task.reject', t.id, ok ? '' : L.api.prichina(reason?.label));
      return wait(null, 200);
    }
    if (ok) return http(`/admin/tasks/${t.key}/approve`, { method: 'POST' });
    return http(`/admin/tasks/${t.key}/reject`, { method: 'POST', body: { reason_id: reason!.id, comment: comment || null } });
  },
  /** Массовое решение: сервер отвечает по каждому заданию; возвращаем ключи прошедших и число ошибок */
  async bulkTasks(list: TaskQ[], ok: boolean, reason?: Reason, comment?: string): Promise<{ done: string[]; failed: number }> {
    if (!USE_API) {
      for (const t of list) await adminApi.moderateTask(t, ok, reason, comment);
      return { done: list.map((t) => t.key), failed: 0 };
    }
    const r = await http<{ results: { id: number; ok: boolean }[]; succeeded: number; failed: number }>('/admin/tasks/bulk', {
      method: 'POST', body: { ids: list.map((t) => +t.key), action: ok ? 'approve' : 'reject', reason_id: ok ? null : reason!.id, comment: comment || null },
    });
    return { done: r.results.filter((x) => x.ok).map((x) => String(x.id)), failed: r.failed };
  },
  /** Правка модератором (автор увидит «изменено модератором»), затем одобрение */
  async editTask(t: TaskQ, f: { title: string; text: string; address: string | null }, note: string) {
    if (!USE_API) return adminApi.moderateTask({ ...t, title: f.title, text: f.text }, true);
    const r = await http<{ status: string }>(`/admin/tasks/${t.key}/edit`, {
      method: 'POST', body: { title: f.title !== t.title ? f.title : null, description: f.text !== t.text ? f.text : null, address: f.address !== (t.address ?? null) ? f.address : null, note },
    });
    if (r.status === 'review') await http(`/admin/tasks/${t.key}/approve`, { method: 'POST' });
  },

  /* ---------- 03 Профили мастеров ---------- */
  async masters(): Promise<MasterQ[]> {
    if (!USE_API) return wait(mem.masters);
    const q = await http<QueuePage<QueueMaster>>('/admin/moderation/masters', { query: { limit: 100 } });
    return q.items.map((x) => {
      queueMasters.set(x.id, x);
      const again = x.flags.includes('repeat');
      return {
        key: String(x.id), id: `M-${x.id}`, userId: x.id, name: x.name ?? `#${x.id}`, cats: x.professions.map((p) => p.category.name_ru).join(', ') || '—', city: x.city?.name_ru ?? (x.works_online ? L.api.onlayn : '—'),
        agoMin: minutesSince(x.submitted_at), slaLeft: x.sla_deadline ? (+new Date(x.sla_deadline) - Date.now()) / 60000 : 24 * 60,
        type: x.type === 'verify_request' ? L.api.proveren : x.type === 'changes' ? L.api.izmeneniya : again ? L.api.povtorno : L.api.novyy, tone: x.type === 'verify_request' ? 'ok' : x.type === 'changes' ? 'grey' : again ? 'warn' : 'info', kind: 'master', lock: lockOf(x.lock), flags: x.flags.map((f) => flagOf(f)[0]),
      } satisfies MasterQ;
    });
  },
  async masterCard(q: MasterQ): Promise<MasterCard> {
    if (!USE_API) return wait(demo.demoMasterCard(q), 120);
    const x = queueMasters.get(q.userId);
    if (!x) throw new Error(L.api.profilUzheProverenObnovite);
    const about = x.about ?? '';
    const contacts = x.flags.some((f) => f === 'contacts' || f === 'link' || f === 'payment');
    const prices = [
      ...x.professions.map((p) => `${p.category.name_ru}${p.status === 'review' ? L.api.novaya : ''} — ${p.negotiable || !p.price_from ? L.api.dogovornaya : L.api.otSmn(p.price_from)}`),
      ...x.services.slice(0, 3).map((sv) => `${sv.title ?? L.api.usluga} — ${sv.price ? L.api.smn(sv.price) : L.api.dogovornaya}`),
    ].join(' · ');
    return {
      name: q.name, sub: [x.professions.map((p) => p.category.name_ru).join(', '), x.experience ? EXP[x.experience] : ''].filter(Boolean).join(' · '), meta: L.api.podano(q.id, phoneFmt(x.phone), agoText(q.agoMin)),
      avatar: x.avatar_url ?? undefined, city: [x.city?.name_ru, x.works_online ? L.api.onlayn2 : ''].filter(Boolean).join(' · ') || '—', prices: prices || '—', about: about || '—', phone: x.phone,
      photos: x.portfolio.map((p) => p.url), verified: x.verified, marks: x.matches.filter((m) => m.field === 'about').map((m): [number, number] => [m.start, m.end]),
      changes: (x.changes ?? []).map((c) => ({ label: c.label, before: changeText(c.before), after: changeText(c.after) })),
      verifyReq: x.verify_request && { comment: x.verify_request.comment, photos: x.verify_request.photos.map((p) => p.url), meta: L.api.zapros(agoText(minutesSince(x.verify_request.created_at))) },
      checklist: [
        [L.api.fotoLitsoVidnoBez, x.avatar_url ? 2 : 0, x.avatar_url ? L.api.proverteFoto : L.api.fotoNet], [L.api.imyaPohozheNaNastoyaschee, /\S+\s+\S+/.test(q.name) ? 1 : 2, ''],
        [L.api.kategoriiSootvetstvuyutOpytuI, x.portfolio.length ? 2 : 0, x.portfolio.length ? '' : L.api.portfolioPusto], [L.api.opisanieBezKontaktovI, contacts ? 0 : 1, contacts ? L.api.avtodetektorKontaktyVO : ''],
        [L.api.tsenyVRazumnyhPredelah, 2, ''], [L.api.portfolioSvoiRaboty, x.portfolio.length ? 2 : 0, x.portfolio.length ? L.api.proveritFoto(x.portfolio.length) : L.api.netFoto],
      ],
    };
  },
  masterReasons: () => (USE_API ? adminApi.reasons('master_reject') : Promise.resolve(demo.demoMasterReasons)),
  async lockMaster(q: MasterQ): Promise<Lock | null> {
    if (!USE_API) return null;
    return lockOf(await http<LockOut>(`/admin/masters/${q.userId}/lock`, { method: 'POST' }));
  },
  async moderateMaster(q: MasterQ, ok: boolean, reason?: Reason, comment?: string) {
    if (!USE_API) {
      mem.masters = mem.masters.filter((x) => x.key !== q.key);
      log(L.api.vy, ok ? 'master.approve' : 'master.reject', q.id, ok ? '' : L.api.prichina(reason?.label));
      return wait(null, 200);
    }
    if (ok) return http(`/admin/masters/${q.userId}/approve`, { method: 'POST' });
    return http(`/admin/masters/${q.userId}/reject`, { method: 'POST', body: { reason_id: reason!.id, comment: comment || null } });
  },
  /** «Вернуть на правки»: профиль уходит мастеру с комментарием, без отказа */
  async returnMaster(q: MasterQ, comment: string) {
    if (!USE_API) return adminApi.moderateMaster(q, false, { id: 0, code: 'return', label: L.api.naPravki }, comment);
    return http(`/admin/masters/${q.userId}/return`, { method: 'POST', body: { comment } });
  },
  /** Отказ на запрос «Проверен»: основание уходит мастеру */
  declineVerify: (q: MasterQ, basis: string) =>
    USE_API ? http(`/admin/masters/${q.userId}/verify-decline`, { method: 'POST', body: { basis } }) : wait(log(L.api.vy, 'master.verify_decline', q.id, basis), 150),
  verifyMaster: (q: MasterQ, verified: boolean, comment: string) =>
    USE_API ? http(`/admin/masters/${q.userId}/${verified ? 'verify' : 'unverify'}`, { method: 'POST', body: { basis: comment } }) : wait(log(L.api.vy, 'master.verify', q.id, comment), 150),

  /* ---------- 04 Споры ---------- */
  async disputes(): Promise<DisputeV[]> {
    if (!USE_API) return wait(mem.disputes);
    const [o, r] = await Promise.all([
      http<DisputeRow[]>('/admin/disputes', { query: { status: 'open', limit: 100 } }),
      http<DisputeRow[]>('/admin/disputes', { query: { status: 'resolved', limit: 50 } }),
    ]);
    return [...o, ...r].map(toDispute);
  },
  /** Карточка спора: фото, запросы сторонам, хронология (каждое открытие — в аудит) */
  async disputeCard(d: DisputeV): Promise<{ d: DisputeV; timeline: TimelineItem[] }> {
    if (!USE_API) return wait({ d, timeline: demo.demoTimeline }, 100);
    const c = await http<DisputeCard>(`/admin/disputes/${d.key}`);
    const v = toDispute(c);
    return {
      d: {
        ...v, photos: c.photos, chatId: c.chat_id, price: c.price != null ? L.api.smn(num(c.price)) : undefined, comment: c.moderator_comment, termsDeadline: c.terms_deadline,
        requests: c.requests.map((q) => ({
          id: q.id, to: q.to_side, text: q.text, meta: `${q.staff_name ?? L.api.moderator} · ${dayMonTime(q.created_at)}`, answer: q.answer, answerMeta: q.answered_at ? dayMonTime(q.answered_at) : '', photos: q.answer_photos,
        })),
      },
      timeline: c.timeline.map((e): TimelineItem => { const [t, col] = DISPUTE_EV[e.event] ?? [e.event, '#D9822B']; return [e.note ? `${t} · ${e.note}` : t, dayMonTime(e.at), col]; }),
    };
  },
  async lockDispute(d: DisputeV): Promise<Lock | null> {
    if (!USE_API) return null;
    return lockOf(await http<LockOut>(`/admin/disputes/${d.key}/lock`, { method: 'POST' }));
  },
  /** Запрос стороне: ответ придёт в карточку спора; пока не ответили — спор во вкладке «Ждут ответа» */
  async requestDispute(d: DisputeV, side: 'client' | 'master', text: string) {
    if (!USE_API) return wait((Object.assign(mem.disputes.find((x) => x.key === d.key)!, { waiting: true }), log(L.api.vy, 'dispute.request', d.id, `${side === 'client' ? L.api.klientu : L.api.masteru}: ${text}`)));
    return http(`/admin/disputes/${d.key}/request`, { method: 'POST', body: { to_side: side, text } });
  },
  async resolveDispute(d: DisputeV, res: 'done' | 'not_done' | 'partial', comment: string, termsDeadline: string | null = null) {
    if (!USE_API) {
      const x = mem.disputes.find((y) => y.key === d.key)!;
      Object.assign(x, { open: false, tone: 'grey', slaH: null, resolution: res, status: L.api.reshen({ done: L.api.vypolneno, not_done: L.api.neVypolneno, partial: L.api.chastichno }[res]) });
      log(L.api.vy, 'dispute.resolve', d.id, L.api.reshenie(x.status.slice(7)));
      return wait(null);
    }
    return http(`/admin/disputes/${d.key}/resolve`, { method: 'POST', body: { resolution: res, comment, terms_deadline: termsDeadline, acknowledged: true } });
  },

  /* ---------- 05 Отзывы ---------- */
  async reviews(tab: 'review' | 'all' | 'hidden'): Promise<ReviewV[]> {
    if (!USE_API) return wait(mem.reviews.filter((r) => (tab === 'all' ? r.status !== 'hidden' : r.status === tab)));
    const l = await http<ReviewRow[]>('/admin/reviews', { query: { status: tab === 'all' ? 'published' : tab, limit: 100 } });
    return l.map((r) => ({
      key: r.id, id: `R-${r.id}`, rating: r.rating, text: r.text, master: short(r.master.name ?? L.api.master(r.master.id)),
      reason: r.hide_reason ?? (r.flags.length ? REVIEW_FLAG[r.flags[0]] ?? r.flags[0] : r.complaints_count ? L.api.zhaloby : '—'),
      tone: (r.flags.length || r.complaints_count >= 2 ? 'bad' : r.complaints_count ? 'warn' : 'grey') as Tone, complaints: r.complaints_count, order: `O-${r.order_id} · ${r.task_title}`, date: dayMon(r.created_at),
      author: r.author.name ?? L.api.klient(r.author.id), reply: r.reply_text, complaintList: r.complaints.map((c): [string, string] => [c.comment ? `${c.reason_ru}: «${c.comment}»` : c.reason_ru, dayMon(c.created_at)]),
      status: r.status, hideReason: r.hide_reason,
    }));
  },
  hideReasons: () => (USE_API ? adminApi.reasons('review_hide') : Promise.resolve([L.api.oskorbleniya, L.api.neOtnositsyaKZakazu, L.api.kontaktyReklama, L.api.personalnyeDannye].map((label, i) => ({ id: i + 1, code: `r${i}`, label })))),
  async hideReview(r: ReviewV, reason: Reason, comment = '') {
    if (!USE_API) return wait((Object.assign(mem.reviews.find((x) => x.key === r.key)!, { status: 'hidden', hideReason: reason.label }), log(L.api.vy, 'review.hide', r.id, L.api.prichina(reason.label.toLowerCase()))));
    return http(`/admin/reviews/${r.key}/hide`, { method: 'POST', body: { reason_id: reason.id, comment: comment || null } });
  },
  async keepReview(r: ReviewV) {
    if (!USE_API) return wait((Object.assign(mem.reviews.find((x) => x.key === r.key)!, { status: 'published', complaints: 0, tone: 'grey', reason: '—' }), log(L.api.vy, 'review.restore', r.id, L.api.zhalobyOtkloneny)));
    return http(`/admin/reviews/${r.key}/keep`, { method: 'POST' });
  },

  /* ---------- 06 Пользователи ---------- */
  async users(f: { q: string; role: string; status: string; complaints: boolean; city: string }): Promise<{ items: UserV[]; total: number; masters: number }> {
    if (!USE_API) {
      const ql = f.q.trim().toLowerCase().replace(/\s/g, '');
      const items = mem.users.filter(
        (u) =>
          (!ql || `${u.id}${u.name}${u.phone}`.toLowerCase().replace(/\s/g, '').includes(ql)) && (f.role === 'all' || u.role === f.role || u.role === L.api.oba) &&
          (f.status === 'all' || (f.status === 'blocked' ? u.blocked : !u.blocked)) && (!f.complaints || u.complaints > 0) && (f.city === 'all' || u.city === f.city),
      );
      return wait({ items, total: 48210, masters: 3904 });
    }
    const cityId = f.city === 'all' ? null : (ref.get()?.cities.find((c) => c.name.ru === f.city)?.id ?? null);
    const p = await http<RegPage<UserRow>>('/admin/users', {
      query: { q: f.q.trim().replace(/^U-/i, '') || null, role: f.role === L.api.klient2 ? 'client' : f.role === L.api.master2 ? 'master' : null, status: f.status === 'all' ? null : f.status, city_id: cityId, with_complaints: f.complaints, limit: 100 },
    });
    const items = p.items.map(toUser);
    return { items, total: p.total, masters: items.filter((u) => u.role !== L.api.klient2).length };
  },
  async user(u: UserV): Promise<UserCard> {
    if (!USE_API) return wait(demo.demoUserCard(u), 100);
    const d = await http<UserDetail>(`/admin/users/${u.key}`);
    const since = new Date(d.created_at);
    const sg = d.signals;
    return {
      ...u, ...toUser(d), blockReason: d.block_reason, activeTasks: d.tasks_count, phoneFull: phoneFmt(d.phone),
      stats: [[String(d.tasks_count), L.api.zadaniya, false], [String(d.orders_as_client + d.orders_as_master), L.api.zakazy, false], [String(d.complaints_count), L.api.zhaloby2, d.complaints_count >= 3], [L.api.s2([L.api.yanvarya, L.api.fevralya, L.api.marta, L.api.aprelya, L.api.maya, L.api.iyunya, L.api.iyulya, L.api.avgusta, L.api.sentyabrya, L.api.oktyabrya, L.api.noyabrya, L.api.dekabrya][since.getMonth()]), L.api.naEkor, false]],
      signals:
        [sg.tasks_rejected && L.api.otklonenoZadaniy(sg.tasks_rejected), sg.complaints_against && L.api.zhalobNaPolzovatelya(sg.complaints_against), sg.payment_talk_messages && L.api.soobscheniyOPredoplate(sg.payment_talk_messages), sg.card_numbers_in_chats && L.api.nomerovKartVChatah(sg.card_numbers_in_chats)]
          .filter(Boolean)
          .join(' · ') || L.api.signalovNet,
      sanctions: d.sanctions.map((x) => ({
        warn: x.type === 'warn', active: x.active,
        text: `${x.type === 'warn' ? L.api.preduprezhdenie : L.api.blokirovka(DURATION[x.duration ?? ''] ?? '').trim()}${x.reason_ru ? ` · ${x.reason_ru}` : ''}${x.comment ? ` — ${x.comment}` : ''}`,
        meta: [dayMonTime(x.created_at), x.staff_name, x.lifted_at ? L.api.snyata(dayMon(x.lifted_at), x.lifted_by ? ` · ${x.lifted_by}` : '') : ''].filter(Boolean).join(' · '),
      })),
    };
  },
  blockReasons: () => (USE_API ? adminApi.reasons('user_block') : Promise.resolve([L.api.moshennichestvoPredoplata, L.api.oskorbleniyaIUgrozy, L.api.spamIReklama, L.api.feykovyyProfil, L.api.obhodPravilPlatformy].map((label, i) => ({ id: i + 47, code: `b${i}`, label })))),
  async block(u: UserV, reason: Reason, days: number | null, comment: string, last4: string | null = null) {
    if (!USE_API) {
      Object.assign(mem.users.find((x) => x.key === u.key)!, { blocked: true, status: days ? L.api.blokDn(days) : L.api.navsegda, tone: days ? 'bad' : 'dark' });
      log(L.api.vy, 'user.block', u.id, `${days ? L.api.dn(days) : L.api.navsegda2} · ${reason.label.toLowerCase()}`);
      return wait(null);
    }
    const duration = days === 1 ? '24h' : days === 7 ? '7d' : days === 30 ? '30d' : 'forever';
    return http(`/admin/users/${u.key}/block`, { method: 'POST', body: { reason_id: reason.id, duration, comment: comment || null, confirm_last4: last4 } });
  },
  async unblock(u: UserV, comment: string) {
    if (!USE_API) return wait((Object.assign(mem.users.find((x) => x.key === u.key)!, { blocked: false, status: L.api.aktiven, tone: 'ok' }), log(L.api.vy, 'user.unblock', u.id, comment)));
    return http(`/admin/users/${u.key}/unblock`, { method: 'POST', body: { comment } });
  },
  /** Предупреждение: пользователь получит уведомление, запись — в истории санкций */
  async warn(userId: number, reason: Reason | null, comment: string) {
    if (!USE_API) return wait(log(L.api.vy, 'user.warn', `U-${userId}`, comment));
    return http(`/admin/users/${userId}/warn`, { method: 'POST', body: { reason_id: reason?.id ?? null, comment } });
  },

  /* ---------- 07 Жалобы и переписка ---------- */
  async complaints(): Promise<ComplaintV[]> {
    if (!USE_API) return wait(mem.complaints);
    const [o, r] = await Promise.all([
      http<ComplaintRow[]>('/admin/complaints', { query: { status: 'new', limit: 100 } }),
      http<ComplaintRow[]>('/admin/complaints', { query: { status: 'resolved', limit: 50 } }),
    ]);
    return [...o, ...r].map((c) => {
      const open = c.status === 'new';
      const [what, side] = TARGET[c.target_type] ?? [c.target_type, ''];
      return {
        key: c.id, id: `C-${c.id}`, title: c.reason?.text_ru ?? L.api.zhaloba, order: c.order_id ? L.api.zakazO(what, c.order_id) : `${what} #${c.target_id}`,
        status: open ? L.api.novaya2 : L.api.reshena(c.resolved_by ? ` · ${short(c.resolved_by)}` : ''), tone: open ? 'info' : 'grey', open, chatId: c.has_chat ? c.id : null,
        text: c.text ? `«${c.text}»` : '', from: L.api.ot(c.reporter.name ?? `#${c.reporter.id}`), date: dayMonTime(c.created_at), who: '', detector: [],
        subject: side, subjectUserId: c.target_type === 'user' || c.target_type === 'master_profile' ? c.target_id : undefined, targetType: c.target_type, hasChat: c.has_chat, preview: c.target_preview,
      } satisfies ComplaintV;
    });
  },
  async chat(c: ComplaintV): Promise<{ msgs: ChatMsg[]; detector: string[] }> {
    if (!USE_API) return wait({ msgs: demo.demoChat, detector: c.detector }, 120);
    // Отрицательный ключ — переписка по спору (основание — спор)
    const rows = c.key < 0 ? await http<ChatRow[]>(`/admin/disputes/${-c.key}/chat`) : c.hasChat ? await http<ChatRow[]>(`/admin/complaints/${c.key}/chat`) : [];
    const flags = new Map<string, number>();
    rows.forEach((m) => m.flags.forEach((f) => flags.set(f, (flags.get(f) ?? 0) + 1)));
    return {
      msgs: rows.map((m) => ({
        id: m.id, hidden: m.hidden, photo: m.photo_url, sys: m.sender_side === 'system', who: m.sender_side === 'client' ? L.api.klient2 : m.sender_side === 'master' ? L.api.master2 : '',
        text: m.body ?? (m.photo_url ? L.api.foto : (SYS_MSG[m.system_code ?? ''] ?? m.system_code ?? '')), time: m.sender_side === 'system' ? dayMon(m.created_at) : hhmm(m.created_at), flag: m.flags.length > 0,
      })),
      detector: [...flags].map(([f, n]) => { const l = CHAT_FLAG[f] ?? f; return n > 1 ? `${l} × ${n}` : l; }),
    };
  },
  async resolveComplaint(c: ComplaintV, resolution: string) {
    if (!USE_API) return wait((Object.assign(mem.complaints.find((x) => x.key === c.key)!, { open: false, status: L.api.reshena2, tone: 'grey' }), log(L.api.vy, 'complaint.resolve', c.id, resolution)));
    return http(`/admin/complaints/${c.key}/resolve`, { method: 'POST', body: { resolution } });
  },
  /** Скрыть сообщения в чате (номер карты, оскорбления) — стороны видят «Сообщение скрыто модератором» */
  async hideMessages(ids: number[], basis: string) {
    if (!USE_API) return wait(log(L.api.vy, 'message.hide', L.api.soobsch(ids.length), basis));
    return http('/admin/messages/hide', { method: 'POST', body: { ids, basis } });
  },

  /* ---------- 08 Справочники ---------- */
  async categories(): Promise<CatNode[]> {
    if (!USE_API) return wait(mem.cats);
    const l = await http<CategoryAdmin[]>('/admin/dictionaries/categories');
    return l
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({
        id: c.id, key: c.key, ru: c.name_ru, tj: c.name_tj, parentId: c.parent_id, icon: c.icon ?? l.find((p) => p.id === c.parent_id)?.icon ?? 'Wrench', masters: c.masters_count, hidden: c.hidden, aliases: c.synonyms,
        online: c.allows_online, photoRequired: c.photo_required, perHour: c.price_per_hour, sort: c.sort, openTasks: c.open_tasks_count, priceFrom: c.typical_price_from,
      }));
  },
  async saveCategory(c: CatNode, isNew: boolean) {
    if (!USE_API) {
      if (isNew) mem.cats.push({ ...c, id: Date.now() });
      else Object.assign(mem.cats.find((x) => x.id === c.id)!, c);
      log(L.api.vy, 'dict.update', `category:${c.id}`, isNew ? L.api.novayaKategoriya : L.api.izmenenaKategoriya);
      return wait(null);
    }
    const body = {
      name_ru: c.ru, name_tj: c.tj, icon: c.icon, synonyms: c.aliases, allows_online: c.online, photo_required: c.photoRequired ?? false, price_per_hour: c.perHour ?? false, hidden: c.hidden,
      typical_price_from: c.priceFrom ?? null, sort: c.sort ?? 0,
    };
    if (isNew) return http('/admin/dictionaries/categories', { method: 'POST', body: { ...body, parent_id: c.parentId, key: c.key } });
    return http(`/admin/dictionaries/categories/${c.id}`, { method: 'PATCH', body });
  },
  /** Порядок категорий после перетаскивания: PATCH sort только у сдвинутых */
  async sortCategories(ids: number[], prev: CatNode[]) {
    if (!USE_API) return wait(null);
    await Promise.all(ids.map((id, i) => (prev.find((c) => c.id === id)?.sort !== i ? http(`/admin/dictionaries/categories/${id}`, { method: 'PATCH', body: { sort: i } }) : null)));
  },
  async cities(): Promise<CityNode[]> {
    if (!USE_API) return wait(demo.demoCities);
    const [regions, cities, districts] = await Promise.all([
      http<{ id: number; name_ru: string }[]>('/admin/dictionaries/regions'), http<CityAdmin[]>('/admin/dictionaries/cities'), http<DistrictAdmin[]>('/admin/dictionaries/districts'),
    ]);
    return cities
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({
        id: c.id, ru: c.name_ru, tj: c.name_tj, region: regions.find((r) => r.id === c.region_id)?.name_ru ?? '', masters: ref.cityById(c.id)?.masters ?? 0, hidden: c.hidden,
        districts: districts.filter((d) => d.city_id === c.id).sort((a, b) => a.sort - b.sort).map((d) => ({ id: d.id, ru: d.name_ru, tj: d.name_tj, near: d.near, neighbors: d.neighbor_ids, hidden: d.hidden })),
      }));
  },
  async saveCity(id: number, ru: string, tj: string) {
    if (!USE_API) return wait(log(L.api.vy, 'dict.update', `city:${id}`, `${ru} / ${tj}`));
    return http(`/admin/dictionaries/cities/${id}`, { method: 'PATCH', body: { name_ru: ru, name_tj: tj } });
  },
  async saveDistrict(id: number, p: { ru?: string; tj?: string; near?: boolean; neighbors?: number[]; hidden?: boolean }) {
    if (!USE_API) return wait(log(L.api.vy, 'dict.update', `district:${id}`, Object.keys(p).join(', ')));
    return http(`/admin/dictionaries/districts/${id}`, { method: 'PATCH', body: { name_ru: p.ru ?? null, name_tj: p.tj ?? null, near: p.near ?? null, neighbor_ids: p.neighbors ?? null, hidden: p.hidden ?? null } });
  },
  async rejectReasons(kind: string): Promise<Reason[]> {
    if (!USE_API) return wait(kind === 'task_reject' ? demo.demoRejectReasons : demo.demoMasterReasons);
    const l = await reasonList(kind);
    return l.sort((a, b) => a.sort - b.sort).map((r) => ({ id: r.id, code: r.code, label: r.text_ru, text: r.user_message_ru ?? undefined, needComment: r.requires_comment, hidden: r.hidden, system: r.system, kind: r.kind }));
  },
  async saveReason(id: number, ru: string, p: { hidden?: boolean; text?: string } = {}) {
    if (!USE_API) return wait(log(L.api.vy, 'dict.update', `reason:${id}`, ru));
    return http(`/admin/dictionaries/reasons/${id}`, { method: 'PATCH', body: { text_ru: ru, ...(p.hidden !== undefined && { hidden: p.hidden }), ...(p.text !== undefined && { user_message_ru: p.text }) } });
  },
  async createReason(kind: string, ru: string, text: string) {
    if (!USE_API) return wait(log(L.api.vy, 'dict.create', `reason:${kind}`, ru));
    return http('/admin/dictionaries/reasons', { method: 'POST', body: { kind, code: `custom_${Date.now().toString(36)}`, text_ru: ru, text_tj: null, user_message_ru: text || null, user_message_tj: null, requires_comment: false, sort: 99, hidden: false } });
  },

  /* ---------- 09 Лимиты ---------- */
  async limits(): Promise<LimitV[]> {
    if (!USE_API) return wait(mem.limits.map((l) => ({ ...l })));
    return (await http<LimitOut[]>('/admin/limits')).map(toLimit);
  },
  async limitHistory(): Promise<HistoryV[]> {
    if (!USE_API) return wait(mem.history);
    const h = await http<{ items: { at: string; key: string; title: string | null; old: number | null; new: number | null; reason: string | null; staff_name: string | null }[] }>('/admin/limits/history', { query: { limit: 30 } });
    return h.items.map((r): HistoryV => [`${r.title ?? r.key}: ${r.old ?? '—'} → ${r.new ?? '—'}${r.reason ? ` · ${r.reason}` : ''}`, `${dayMonTime(r.at)} · ${r.staff_name ?? '—'}`, false]);
  },
  /**
   * Сохранение лимитов. dryRun — сервер считает последствия (сколько заданий/мастеров затронет) и ничего не меняет.
   * 409 version_conflict — лимит успели изменить, перечитайте.
   */
  async saveLimits(rows: { key: string; value: number; version?: number; label: string; prev: number }[], comment: string, dryRun = false): Promise<LimitEffect[]> {
    if (!USE_API) {
      if (dryRun) return wait(rows.map((r) => ({ label: r.label, old: r.prev, next: r.value, effect: L.api.primenitsyaKNovymDeystviyam, affected: null })), 150);
      mem.limits.forEach((l) => { const r = rows.find((x) => x.key === l.key); if (r) l.value = r.value; });
      rows.forEach((r) => mem.history.unshift([`${r.label}: ${r.prev} → ${r.value}`, L.api.seychasVy, false]));
      log(L.api.vy, 'limits.update', rows.map((r) => r.key).join(', '), comment);
      return wait([]);
    }
    const r = await http<LimitsResult>('/admin/limits', { method: 'PUT', query: { dry_run: dryRun }, body: { changes: rows.map((x) => ({ key: x.key, value: x.value, version: x.version ?? null })), reason: comment } });
    return r.effects.map((e) => ({ label: e.title, old: e.old, next: e.new, effect: e.effect, affected: e.affected }));
  },

  /* ---------- 10 Шаблоны уведомлений ---------- */
  async templates(): Promise<TplRow[]> {
    if (!USE_API) return wait(demo.demoTemplates.map((t) => ({ code: t.code, title: t.title, ch: t.ch.map((c) => (c === 'SMS' ? 'sms' : 'push')), custom: [] })));
    const l = await http<{ code: string; name: string; channels: TplRow['ch']; custom: string[] }[]>('/admin/templates');
    return l.map((t) => ({ code: t.code, title: t.name, ch: t.channels, custom: t.custom }));
  },
  async template(code: string): Promise<TplCard> {
    if (!USE_API) {
      const t = demo.demoTemplates.find((x) => x.code === code)!;
      const ch = t.ch.map((c): TplText['ch'] => (c === 'SMS' ? 'sms' : 'push'));
      const SAMPLE: Record<string, string> = { code: '482917', minutes: '5', app: 'eKor', name: L.api.farruhN, task: L.api.zamenit3Rozetki, reason: L.api.netFotoRabot, price: '120', result: L.api.vypolneno, text: L.api.vyezzhayuV1430 };
      return wait({
        code, title: t.title, ch, vars: t.vars.map((v) => v.slice(1, -1)).map((name) => ({ name, max: SAMPLE[name]?.length ?? 10, sample: SAMPLE[name] ?? name })),
        texts: ch.flatMap((c) => (['ru', 'tj'] as const).map((lang) => ({ ch: c, lang, title: null, body: t[lang], custom: false, defBody: t[lang], preview: '', version: 0, sms: null }))),
      });
    }
    const t = await http<{ code: string; name: string; channels: TplRow['ch']; vars: { name: string; max_len: number; sample: string }[]; texts: TplTextOut[] }>(`/admin/templates/${code}`);
    return { code: t.code, title: t.name, ch: t.channels, vars: t.vars.map((v) => ({ name: v.name, max: v.max_len, sample: v.sample })), texts: t.texts.map(toTplText) };
  },
  async saveTemplate(code: string, x: TplText): Promise<TplCard> {
    if (!USE_API) return (log(L.api.vy, 'template.update', code, `${x.ch}/${x.lang}`), adminApi.template(code));
    const t = await http<{ code: string; name: string; channels: TplRow['ch']; vars: { name: string; max_len: number; sample: string }[]; texts: TplTextOut[] }>(`/admin/templates/${code}`, {
      method: 'PUT', body: { channel: x.ch, lang: x.lang, title: x.title, body: x.body, version: x.version },
    });
    return { code: t.code, title: t.name, ch: t.channels, vars: t.vars.map((v) => ({ name: v.name, max: v.max_len, sample: v.sample })), texts: t.texts.map(toTplText) };
  },
  /** Тестовая отправка на свой номер: сервер возвращает итоговый текст и число SMS-сегментов */
  async testTemplate(code: string, phone: string, x: TplText) {
    if (!USE_API) return wait({ sent_to: phone, text: x.body, sms: { segments: 1 } });
    return http<{ sent_to: string; text: string; sms: { segments: number } }>(`/admin/templates/${code}/test`, { method: 'POST', body: { phone, channel: x.ch, lang: x.lang, title: x.title, body: x.body } });
  },

  /* ---------- 11, 20–22 Сотрудники ---------- */
  async staff(): Promise<StaffV[]> {
    if (!USE_API) return wait(mem.staff);
    return (await http<StaffOut[]>('/admin/staff')).map(toStaff);
  },
  async emailAvailable(email: string): Promise<boolean> {
    if (!USE_API) return wait(!mem.staff.some((s) => s.email.toLowerCase() === email.trim().toLowerCase()), 150);
    return (await http<{ available: boolean }>('/admin/staff/email-available', { query: { email: email.trim() } })).available;
  },
  async createStaff(f: { name: string; email: string; password: string; phone: string; role: string; regionIds: number[] }) {
    if (!USE_API) {
      mem.staff.push({ id: Date.now() % 100000, name: f.name, email: f.email, phone: f.phone, role: f.role, regionIds: f.regionIds, regions: cityNames(f.regionIds), status: L.api.aktiven, tone: 'ok', seen: '—', active: true, created: L.api.segodnya });
      demo.demoNoDecisions.add(mem.staff[mem.staff.length - 1].id);
      log(L.api.vy, 'staff.create', f.email, L.api.rol(f.role));
      return wait(null);
    }
    return http('/admin/staff', { method: 'POST', body: { name: f.name.trim(), email: f.email.trim(), password: f.password, contact_phone: f.phone.trim() || null, role: f.role, region_city_ids: f.regionIds } });
  },
  async patchStaff(s: StaffV, p: { name?: string; phone?: string; role?: string; regionIds?: number[]; active?: boolean }) {
    if (!USE_API) {
      Object.assign(mem.staff.find((x) => x.id === s.id)!, {
        ...(p.name && { name: p.name }), ...(p.role && { role: p.role }), ...(p.regionIds && { regionIds: p.regionIds, regions: cityNames(p.regionIds) }),
        ...(p.active !== undefined && { active: p.active, status: p.active ? L.api.aktiven : L.api.otklyuchen, tone: p.active ? 'ok' : 'grey' }),
      });
      log(L.api.vy, 'staff.update', s.email, Object.keys(p).join(', '));
      return wait(null);
    }
    return http(`/admin/staff/${s.id}`, {
      method: 'PATCH',
      body: { name: p.name ?? null, contact_phone: p.phone?.trim() || null, role: p.role ?? null, region_city_ids: p.regionIds ?? null, status: p.active === undefined ? null : p.active ? 'active' : 'disabled' },
    });
  },
  async setPassword(s: StaffV, password: string) {
    if (!USE_API) return wait(log(L.api.vy, 'staff.password', s.email, L.api.zadanNovyyParol));
    return http(`/admin/staff/${s.id}/password`, { method: 'POST', body: { password } });
  },
  async sessions(s: StaffV): Promise<SessionV[]> {
    if (!USE_API) return wait(s.active ? demo.demoSessions : [], 150);
    return (await http<SessionOut[]>(`/admin/staff/${s.id}/sessions`)).map((x) => ({
      id: x.id, device: uaShort(x.user_agent), where: [x.city, x.ip].filter(Boolean).join(' · '), when: x.current ? L.api.seychas : seenText(x.created_at), current: x.current, revoked: !!x.revoked_at,
    }));
  },
  async revokeSessions(s: StaffV) {
    if (!USE_API) return wait(log(L.api.vy, 'staff.sessions', s.email, L.api.vseSeansyZaversheny));
    return http(`/admin/staff/${s.id}/sessions`, { method: 'DELETE' });
  },
  /** 409 has_decisions — удалить нельзя, только отключить */
  async deleteStaff(s: StaffV) {
    if (!USE_API) {
      if (!demo.demoNoDecisions.has(s.id)) throw Object.assign(new Error('has_decisions'), { status: 409, code: 'has_decisions' });
      mem.staff = mem.staff.filter((x) => x.id !== s.id);
      log(L.api.vy, 'staff.delete', s.email, '');
      return wait(null);
    }
    return http(`/admin/staff/${s.id}`, { method: 'DELETE' });
  },

  /* ---------- 23 Все задания ---------- */
  async allTasks(f: { status: string; cityId: number | null; categoryId: number | null; flags: boolean; q?: string; days?: number | null; cursor?: string | null }): Promise<{ items: TaskRegRow[]; next: string | null; total: number | null; counts: Record<string, number> | null }> {
    if (!USE_API) {
      const st = f.status === 'all' ? null : TASK_TAB[f.status];
      const ql = (f.q ?? '').trim().toLowerCase();
      const items = demo.demoAllTasks.filter((r) => (!st || st.includes(r.status)) && (!ql || `${r.id} ${r.title} ${r.client}`.toLowerCase().includes(ql)));
      return wait({ items, next: null, total: null, counts: null });
    }
    const p = await http<RegPage<TaskRow>>('/admin/tasks', { query: { ...taskQuery(f), cursor: f.cursor ?? null, limit: 50 } });
    return {
      next: p.next_cursor, total: p.total, counts: p.counts_by_status,
      items: p.items.map((x) => {
        const [status, tone] = TASK_ST[x.status] ?? [x.status, 'grey'];
        return {
          key: x.id, id: `T-${x.id}`, title: x.title, sub: [x.category.name_ru, [x.city?.name_ru, x.district?.name_ru].filter(Boolean).join(', ') || L.api.onlayn].join(' · '), client: x.client.name ?? `#${x.client.id}`, clientId: x.client.id,
          budget: budgetText(x.budget_mode, x.budget_min, x.budget_max), responses: x.responses_count, status, tone, created: whenShort(x.published_at ?? x.created_at), flags: x.flags.map((g) => flagOf(g)[0]),
        };
      }),
    };
  },
  tasksCsvUrl: (f: { status: string; cityId: number | null; categoryId: number | null; flags: boolean; q?: string; days?: number | null }) => (USE_API ? adminUrl('/admin/tasks.csv', taskQuery(f)) : null),
  async taskCard(r: TaskRegRow): Promise<TaskRegCard> {
    if (!USE_API) return wait(demo.demoTaskCard(r), 120);
    const d = await http<TaskCardOut>(`/admin/tasks/${r.key}`);
    const k = d.task;
    const order = d.orders[d.orders.length - 1];
    const chosen = d.responses.find((x) => x.status === 'chosen');
    return {
      id: r.id, key: r.key, status: r.status, tone: r.tone, title: k.title, sub: [r.sub, budgetText(k.budget_mode, k.budget_min, k.budget_max), whenText(k.when, k.date)].join(' · '),
      client: L.api.uS(d.client.name ?? L.api.klient2, d.client.id, dayMon(d.client_registered_at), new Date(d.client_registered_at).getFullYear()), clientId: d.client.id,
      phone: phoneFmt(d.client.phone), address: k.address ?? '—', master: chosen ? `${chosen.master.name ?? ''} · M-${chosen.master.id}` : order ? `${order.master.name ?? ''} · M-${order.master.id}` : '—',
      masterId: chosen?.master.id ?? order?.master.id ?? null,
      order: order ? `O-${order.id} · ${ORDER_ST[order.status] ?? order.status}${order.price ? L.api.smn2(num(order.price)) : ''} · ${dayMon(order.created_at)}` : '—',
      flags: d.complaints_count ? L.api.zhalob(d.complaints_count) : L.api.net,
      responses: d.responses.map((x) => ({
        name: x.master.name ?? `M-${x.master.id}`, price: x.inspect ? L.api.posleOsmotra : x.price ? L.api.smn(num(x.price)) : '—',
        state: x.status === 'chosen' ? L.api.vybran : x.status === 'withdrawn' ? L.api.otozvan : x.status === 'rejected' || x.status === 'closed' ? L.api.zakryt : L.api.zhdet, chosen: x.status === 'chosen',
      })),
      history: d.events.map((h): [string, string] => [dayMonTime(h.at).replace(',', ''), [eventText(h.action), h.actor, h.comment].filter(Boolean).join(' · ')]),
      canUnpublish: k.status === 'open',
    };
  },
  async unpublishTask(key: number, reason: Reason, comment: string) {
    if (!USE_API) return wait(log(L.api.vy, 'task.unpublish', `T-${key}`, L.api.prichina(reason.label)));
    return http(`/admin/tasks/${key}/unpublish`, { method: 'POST', body: { reason_id: reason.id, comment: comment || null } });
  },

  /* ---------- 24 Все мастера ---------- */
  async allMasters(f: { q: string; status: string; cityId?: number | null; categoryId?: number | null; verified?: boolean | null; accepting?: boolean | null; ratingMin?: number | null; cursor?: string | null }): Promise<{ items: MasterRegRow[]; next: string | null; total: number | null; counts: Record<string, number> | null }> {
    if (!USE_API) {
      const ql = f.q.trim().toLowerCase();
      const st = f.status === 'all' ? null : MASTER_TAB[f.status];
      return wait({ items: demo.demoAllMasters.filter((m) => (!st || m.status === st) && (!ql || `${m.name} ${m.id}`.toLowerCase().includes(ql))), next: null, total: null, counts: null });
    }
    const p = await http<RegPage<MasterRow>>('/admin/masters', { query: { ...masterQuery(f), cursor: f.cursor ?? null, limit: 50 } });
    return {
      next: p.next_cursor, total: p.total, counts: p.counts_by_status,
      items: p.items.map((u): MasterRegRow => {
        const [status, tone] = MASTER_ST[u.status] ?? [u.status, 'grey'];
        return {
          key: u.id, id: `M-${u.id}`, name: u.name ?? `#${u.id}`, profs: u.headline?.name_ru ?? '', city: u.city?.name_ru ?? L.api.onlayn, rating: u.rating_avg != null ? `${u.rating_avg.toFixed(1).replace('.', ',')} · ${u.reviews_count}` : '—',
          orders: String(u.completed_orders_count), status, tone, verified: u.verified, seen: u.last_seen_at ? seenText(u.last_seen_at) : '—',
        };
      }),
    };
  },
  mastersCsvUrl: (f: { q: string; status: string; cityId?: number | null; categoryId?: number | null; verified?: boolean | null; accepting?: boolean | null; ratingMin?: number | null }) => (USE_API ? adminUrl('/admin/masters.csv', masterQuery(f)) : null),
  async masterRegCard(m: MasterRegRow): Promise<MasterRegCard> {
    if (!USE_API) return wait(demo.demoMasterRegCard(m), 120);
    const d = await http<MasterCardOut>(`/admin/masters/${m.key}`);
    const p = d.profile;
    const x = d.metrics;
    const prices = p.professions.map((y) => `${y.name_ru} — ${y.negotiable || !y.price_from ? L.api.dogovornaya : L.api.otSmn(y.price_from)}`).join(' · ');
    const MST = MASTER_ST[p.status] ?? [m.status, m.tone];
    return {
      key: m.key, id: m.id, name: m.name, status: MST[0], tone: MST[1], verified: p.verified, suspended: p.status === 'suspended',
      sub: [m.id, p.professions.map((y) => y.name_ru).join(', ')].filter(Boolean).join(' · '),
      stats: [
        [x.rating_avg != null ? x.rating_avg.toFixed(1).replace('.', ',') : '—', L.api.reyting(x.reviews_count)], [String(x.orders_total), L.api.zakazov2],
        [x.completion_rate != null ? `${Math.round(x.completion_rate * 100)}%` : '—', L.api.zaversheno2], [x.median_response_minutes != null ? L.api.min(Math.round(x.median_response_minutes)) : '—', L.api.doOtklika],
      ],
      rows: [
        [L.api.telefon, phoneFmt(d.phone)], [L.api.gorod, [p.city?.name_ru, p.districts.map((y) => y.name_ru).join(', ')].filter(Boolean).join(' · ') || (p.works_online ? L.api.onlayn : '—')], [L.api.tseny, prices || '—'],
        [L.api.proveren2, p.verified ? L.api.da : '—'], [L.api.priemZakazov, p.accepting_orders ? L.api.vklyuchen : L.api.vyklyuchen], [L.api.otklikiSegodnya, L.api.iz(x.responses_today, x.responses_limit)],
        [L.api.otkazyPosleVybora, String(x.declines_after_choice)], [L.api.naEkor2, L.api.s(dayMon(d.registered_at), new Date(d.registered_at).getFullYear())],
      ],
      orders: d.recent_orders.map((o): [string, string, string] => [`O-${o.id} · ${o.task_title} · ${o.client.name ?? L.api.klient3}`, `${ORDER_ST[o.status] ?? o.status}${o.price ? L.api.smn2(num(o.price)) : ''}`, dayMon(o.created_at)]),
      warn: d.complaints_30d.length ? L.api.zhalobZa30Dney(d.complaints_30d.length, d.complaints_30d.map((c) => c.reason_ru).join(', ')) : null,
    };
  },
  async suspendMaster(key: number, on: boolean, comment: string) {
    if (!USE_API) return wait(log(L.api.vy, on ? 'master.suspend' : 'master.unsuspend', `M-${key}`, comment));
    return http(`/admin/masters/${key}/${on ? 'suspend' : 'unsuspend'}`, { method: 'POST', body: { comment } });
  },
  async unverifyMaster(key: number, comment: string) {
    if (!USE_API) return wait(log(L.api.vy, 'master.verify', `M-${key}`, L.api.snyatProveren(comment)));
    return http(`/admin/masters/${key}/unverify`, { method: 'POST', body: { basis: comment } });
  },

  /* ---------- 12 Аудит ---------- */
  async audit(f: { action: string; objectId: string; days: number; staffId?: number | null }): Promise<AuditV[]> {
    if (!USE_API) {
      const q = f.objectId.trim().toLowerCase();
      return wait(mem.audit.filter((a) => (!f.action || (f.action.endsWith('*') ? a.action.startsWith(f.action.slice(0, -1)) : a.action === f.action)) && (!q || a.obj.toLowerCase().includes(q))));
    }
    const p = await http<Page<AuditRow>>('/admin/audit', { query: auditQuery(f, 100) });
    return p.items
      .filter((a) => !f.action.endsWith('*') || a.action.startsWith(f.action.slice(0, -1)))
      .map((a) => ({
        key: a.id, time: hhmmss(a.at), date: dayMon(a.at), who: a.staff_name ? short(a.staff_name) : L.api.sistema, action: a.action, obj: objId(a.object_type, a.object_id),
        details: a.basis ?? (a.after ? Object.entries(a.after).map(([k, v]) => `${a.before?.[k] !== undefined ? `${String(a.before[k])} → ` : ''}${String(v)}${Object.keys(a.after!).length > 1 ? ` (${k})` : ''}`).join(', ') : ''),
        tone: ACT_TONE(a.action), evt: `evt_${a.id.toString(16)}`, comment: a.basis, old: a.before, next: a.after, ip: a.ip, device: uaShort(a.user_agent),
      }));
  },
  /** Ссылка на выгрузку CSV с теми же фильтрами (сервер сам пишет выгрузку в аудит) */
  auditCsvUrl: (f: { action: string; objectId: string; days: number; staffId?: number | null }) => (USE_API ? adminUrl('/admin/audit.csv', auditQuery(f)) : null),
};

/* ---------- преобразования ответов ---------- */
/**
 * Причины: справочник админки читает только admin; остальным — публичный /reasons
 * (там нет user_block и review_hide — для senior и moderator список будет пустым, нужен доступ на бэкенде).
 */
let dictDenied = false;
async function reasonList(kind: string): Promise<ReasonAdmin[]> {
  if (!dictDenied)
    try {
      return await http<ReasonAdmin[]>('/admin/dictionaries/reasons', { query: { kind } });
    } catch (e) {
      if ((e as { status?: number }).status !== 403) throw e;
      dictDenied = true;
    }
  return http<ReasonAdmin[]>('/reasons', { query: { kind } });
}
const queueMasters = new Map<number, QueueMaster>();
const changeText = (v: string | string[] | null) => (v == null || (Array.isArray(v) && !v.length) ? '—' : Array.isArray(v) ? v.join(', ') : v || '—');
const plural = (n: number, one: string, few: string, many: string) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
const lockOf = (l: LockOut | null | undefined): Lock | null => (l ? { name: short(l.staff_name ?? L.api.drugoyModerator), mine: l.mine } : null);
const hoursLeft = (iso: string | null) => (iso ? Math.floor((+new Date(iso) - Date.now()) / 36e5) : null);
const placeText = (mode: string, city: Ref | null, district: Ref | null) => (mode === 'online' ? L.api.onlayn : [city?.name_ru, district?.name_ru].filter(Boolean).join(', ') || '—');
function budgetText(mode: string, min: number | null, max: number | null) {
  if (mode !== 'sum' || (!min && !max)) return L.api.dogovornaya2;
  if (min && max && min !== max) return L.api.smn3(num(min), num(max));
  return max && !min ? L.api.doSmn(num(max)) : L.api.smn(num((min ?? max)!));
}
const WHEN: Record<string, string> = { today: L.api.segodnya2, tomorrow: L.api.zavtra, week: L.api.naEtoyNedele, flexible: L.api.neSrochno };
const whenText = (w: string, date: string | null) => (w === 'date' && date ? dayMon(date) : (WHEN[w] ?? w));
const ORDER_ST: Record<string, string> = { active: L.api.vRabote, work: L.api.vRabote, wait: L.api.zhdetPodtverzhdeniya, done: L.api.zavershen, dispute: L.api.spor, cancelled: L.api.otmenen, declined: L.api.otkazMastera };
const DURATION: Record<string, string> = { '24h': L.api.na24Ch, '7d': L.api.na7Dney, '30d': L.api.na30Dney, forever: L.api.navsegda2 };
const TARGET: Record<string, [string, string]> = {
  user: [L.api.polzovatel, L.api.polzovatel], task: [L.api.zadanie2, L.api.klientAvtorZadaniya], master_profile: [L.api.profilMastera, L.api.master2], chat: [L.api.chat, ''], message: [L.api.soobschenie, ''], review: [L.api.otzyv, L.api.klientAvtorOtzyva],
};
const REVIEW_FLAG: Record<string, string> = { insult: L.api.oskorbleniya, contacts: L.api.kontakty, fake: L.api.nakrutka };
const CHAT_FLAG: Record<string, string> = { card: L.api.nomerKarty, card_number: L.api.nomerKarty, payment: L.api.predoplata, payment_talk: L.api.predoplata, contacts: L.api.kontakty, phone: L.api.telefon, link: L.api.ssylka, insult: L.api.oskorbleniya };
const SYS_MSG: Record<string, string> = {
  chosen: L.api.klientVybralMastera, started: L.api.masterNachalRabotu, marked_done: L.api.masterRabotaVypolnena, confirmed: L.api.klientPodtverdilVypolnenie, dispute_opened: L.api.otkrytSpor,
  cancelled_by_client: L.api.klientOtmenilVybor, declined_by_master: L.api.masterOtkazalsya, dispute_resolved: L.api.sporReshen,
};
const DISPUTE_EV: Record<string, [string, string]> = {
  chosen: [L.api.klientVybralMastera, '#2647D9'], started: [L.api.masterNachalRabotu, '#2647D9'], marked_done: [L.api.masterRabotaVypolnena, '#2647D9'], confirmed: [L.api.klientPodtverdilVypolnenie, '#0B6E5E'],
  opened: [L.api.otkrytSpor, '#B03A2E'], dispute_opened: [L.api.klientEstProblemaOtkryt, '#B03A2E'], request: [L.api.zaprosStorone, '#D9822B'], answer: [L.api.otvetStorony, '#2647D9'],
  resolved: [L.api.sporReshen, '#0B6E5E'], cancelled_by_client: [L.api.klientOtmenilVybor, '#9AA5B4'], declined_by_master: [L.api.masterOtkazalsya, '#9AA5B4'],
};
/** «—→review», «approve» → понятный текст истории задания */
function eventText(a: string) {
  const m = a.match(/^(.*)→(.*)$/);
  if (m) return `${TASK_ST[m[2]]?.[0] ?? m[2]}`;
  return ({ approve: L.api.odobrenoModeratorom, reject: L.api.otklonenoModeratorom, edit: L.api.ispravlenoModeratorom, unpublish: L.api.snyatoSPublikatsii } as Record<string, string>)[a.replace(/^task\./, '')] ?? a;
}
function toDispute(d: DisputeRow): DisputeV {
  const open = d.status === 'open';
  const RES: Record<string, string> = { done: L.api.vypolneno, not_done: L.api.neVypolneno, partial: L.api.chastichno };
  const cn = d.client.name ?? L.api.klient(d.client.id);
  const mn = d.master.name ?? L.api.master(d.master.id);
  const left = hoursLeft(d.deadline);
  return {
    key: d.id, id: `D-${d.id}`, title: d.task_title, who: `${short(cn)} ↔ ${short(mn)}`, status: open ? (d.unanswered_requests ? L.api.zhdetOtveta : L.api.otkryt) : L.api.reshen(RES[d.resolution ?? ''] ?? d.resolution),
    tone: open ? (d.overdue ? 'bad' : d.unanswered_requests ? 'warn' : 'bad') : 'grey', slaH: open ? Math.max(0, left ?? 24) : null, order: `O-${d.order_id}`, open, waiting: d.unanswered_requests > 0,
    chatId: null, clientName: cn, masterName: mn, clientId: d.client.id, masterId: d.master.id, resolution: d.resolution ?? undefined, lock: lockOf(d.lock), unanswered: d.unanswered_requests,
    client: { title: L.api.klient4(cn), text: [d.reason?.text_ru, d.text].filter(Boolean).join('. '), meta: `${phoneFmt(d.client.phone)} · ${dayMonTime(d.created_at)}` },
    master: { title: L.api.master3(mn), text: L.api.pozitsiyaMasteraVPerepiske, meta: phoneFmt(d.master.phone) }, photos: [],
  };
}
function toUser(u: UserRow): UserV {
  const blocked = u.status === 'blocked';
  const days = u.blocked_until ? Math.ceil((+new Date(u.blocked_until) - Date.now()) / 864e5) : null;
  return {
    key: u.id, id: `U-${u.id}`, name: u.name ?? L.api.bezImeni(u.id), phone: phoneFmt(u.phone), role: u.is_client && u.is_master ? L.api.oba : u.is_master ? L.api.master2 : L.api.klient2, city: u.city?.name_ru ?? '—',
    status: blocked ? (days == null ? L.api.navsegda : L.api.blokDn(days)) : u.master_status === 'review' ? L.api.proverka : L.api.aktiven, tone: blocked ? (days == null ? 'dark' : 'bad') : u.master_status === 'review' ? 'warn' : 'ok',
    complaints: u.complaints_count, seen: seenText(u.last_seen_at), blocked,
  };
}
const LIMIT_GROUP: Record<string, string> = { tasks: L.api.zadaniya2, responses: L.api.otklikiIPriglasheniya, reviews: L.api.otzyvy, otp: L.api.vhodPoSms, moderation: L.api.moderatsiyaSla };
const LIMIT_UNIT: Record<string, string> = { count: L.api.sht, seconds: L.api.sek, minutes: L.api.min2, hours: L.api.ch, days: L.api.dney };
const toLimit = (x: LimitOut): LimitV => ({ key: x.key, group: LIMIT_GROUP[x.group] ?? x.group, label: x.title, value: x.value, unit: LIMIT_UNIT[x.unit] ?? x.unit, version: x.version, min: x.min, max: x.max, def: x.default });
type TplTextOut = { channel: TplText['ch']; lang: 'ru' | 'tj'; title: string | null; body: string; custom: boolean; default_body: string; preview: string; sms: { max_length: number; encoding: string; segments: number } | null; version: number };
const toTplText = (t: TplTextOut): TplText => ({
  ch: t.channel, lang: t.lang, title: t.title, body: t.body, custom: t.custom, defBody: t.default_body, preview: t.preview, version: t.version,
  sms: t.sms ? { max: t.sms.max_length, segments: t.sms.segments, ucs2: t.sms.encoding === 'ucs2' } : null,
});
function periodFrom(days: number | null | undefined) {
  if (!days) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}
const taskQuery = (f: { status: string; cityId: number | null; categoryId: number | null; flags: boolean; q?: string; days?: number | null }) => ({
  status: f.status === 'all' ? null : f.status, city_id: f.cityId, category_id: f.categoryId, flagged: f.flags, q: f.q?.trim().replace(/^T-/i, '') || null, from: periodFrom(f.days),
});
const masterQuery = (f: { q: string; status: string; cityId?: number | null; categoryId?: number | null; verified?: boolean | null; accepting?: boolean | null; ratingMin?: number | null }) => ({
  sort: 'orders', status: f.status === 'all' ? null : f.status, q: f.q.trim().replace(/^M-/i, '') || null, city_id: f.cityId ?? null, category_id: f.categoryId ?? null, verified: f.verified ?? null, accepting: f.accepting ?? null, rating_min: f.ratingMin ?? null,
});

/* ---------- помощники админки ---------- */
const DEMO_AUTH = 'ekor_admin_demo_auth';
const DEMO_LOCK = 'ekor_admin_demo_lock';
function demoAuthed() {
  try {
    return localStorage.getItem(DEMO_AUTH) === '1';
  } catch {
    return false;
  }
}
function demoLock(v?: { fails: number; until: number }): { fails: number; until: number } {
  try {
    if (v) localStorage.setItem(DEMO_LOCK, JSON.stringify(v));
    return JSON.parse(localStorage.getItem(DEMO_LOCK) || '{"fails":0,"until":0}');
  } catch {
    return { fails: 0, until: 0 };
  }
}
const toStaff = (x: StaffOut): StaffV => ({
  id: x.id, name: x.name, email: x.email, phone: x.contact_phone ?? '', role: x.role, regionIds: x.region_cities.map((c) => c.id),
  regions: x.region_cities.length ? x.region_cities.map((c) => c.name_ru).join(', ') : L.api.vse, status: x.status === 'active' ? L.api.aktiven : L.api.otklyuchen, tone: x.status === 'active' ? 'ok' : 'grey',
  seen: seenText(x.last_login_at), active: x.status === 'active', created: dayMon(x.created_at),
});
const cityNames = (ids: number[]) => (ids.length ? ids.map((id) => ref.cityById(id)?.name.ru ?? demo.demoCities.find((c) => c.id === id)?.ru ?? `#${id}`).join(', ') : L.api.vse);
function uaShort(ua: string | null | undefined) {
  if (!ua) return L.api.ustroystvo;
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : L.api.brauzer;
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [b, os].filter(Boolean).join(' · ');
}
/** «14:29» сегодня, «вчера», иначе «25 окт» */
function whenShort(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (+d >= +today) return hhmmss(iso).slice(0, 5);
  if (+d >= +today - 864e5) return L.api.vchera;
  return dayMon(iso);
}
function auditQuery(f: { action: string; objectId: string; days: number; staffId?: number | null }, limit?: number) {
  const id = f.objectId.replace(/\D/g, '');
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (f.days - 1));
  return { action: f.action && !f.action.endsWith('*') ? f.action : null, object_id: id ? +id : null, staff_id: f.staffId ?? null, from: from.toISOString(), limit };
}
/** Статусы заданий бэкенда → подпись и тон реестра */
const TASK_ST: Record<string, [string, Tone]> = {
  draft: [L.api.chernovik, 'grey'], review: [L.api.naProverke, 'warn'], open: [L.api.otkryto, 'info'], chosen: [L.api.masterVybran, 'info'], work: [L.api.vRabote2, 'info'], wait: [L.api.zhdetPodtverzhdeniya2, 'warn'],
  dispute: [L.api.spor2, 'bad'], done: [L.api.zaversheno, 'ok'], closed: [L.api.zakryto, 'grey'], rejected: [L.api.otkloneno, 'bad'], expired: [L.api.srokIstek, 'grey'], cancelled: [L.api.otmeneno, 'grey'], declined: [L.api.otkazMastera2, 'grey'],
};
/** Вкладки реестра заданий (демо) */
const TASK_TAB: Record<string, string[]> = { review: [L.api.naProverke], open: [L.api.otkryto], chosen: [L.api.masterVybran, L.api.vRabote2, L.api.zhdetPodtverzhdeniya2], dispute: [L.api.spor2], done: [L.api.zaversheno], closed: [L.api.srokIstek, L.api.otmeneno, L.api.otkloneno, L.api.zakryto] };
const MASTER_ST: Record<string, [string, Tone]> = { approved: [L.api.odobren, 'ok'], review: [L.api.naProverke, 'warn'], rejected: [L.api.otklonen, 'bad'], suspended: [L.api.priostanovlen, 'grey'], draft: [L.api.chernovik, 'grey'], blocked: [L.api.zablokirovan, 'dark'] };
const MASTER_TAB: Record<string, string> = { approved: L.api.odobren, review: L.api.naProverke, rejected: L.api.otklonen, suspended: L.api.priostanovlen };
