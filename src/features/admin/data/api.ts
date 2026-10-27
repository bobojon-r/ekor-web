/**
 * Данные админки. NEXT_PUBLIC_API=real — /api/admin/* (доступ только сотрудникам),
 * иначе демо из дизайна (изменения живут до перезагрузки страницы).
 */
import { http, USE_API } from '@/lib/api';
import { ref } from '@/lib/api/ref';
import { agoText, dayMon, dayMonTime, flagOf, hhmmss, num, roleFromApi, seenText, type Role, type Tone } from '../core';
import * as demo from './demo';
import type {
  AuditV, CatNode, ChatMsg, CityNode, ComplaintV, Counts, Dash, DisputeV, HistoryV, LimitV, MasterCard, MasterQ, Me, Reason, ReviewV, StaffV, TaskQ, TimelineItem, UserCard, UserV,
} from './types';

const wait = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));
type Page<T> = { items: T[]; next_cursor: string | null };

/* ======================= типы ответов API ======================= */
type QueueItem = {
  type: 'task' | 'master' | 'profession'; id: number; title: string; city_ru: string | null; author_id: number; author_name: string | null; category: string | null;
  budget: string | null; text: string; flags: string[]; photos: string[]; submitted_at: string | null; age_minutes: number; sla_minutes: number; overdue: boolean; profession_id: number | null;
};
type TaskRow = { id: number; title: string; status: string; category_ru: string; city_ru: string | null; district_ru: string | null; client_id: number; responses_count: number; flags: string[]; created_at: string; published_at: string | null };
type Funnel = {
  tasks_published: number; tasks_with_response: number; tasks_with_response_24h: number; tasks_chosen: number; orders_done: number; reviews: number;
  moderation_median_minutes: number | null; masters_registered: number; masters_approved: number;
};
type DisputeRow = { id: number; order_id: number; task_title: string; client_id: number; master_id: number; reason_ru: string; text: string | null; photos: string[]; status: 'open' | 'resolved'; resolution: string | null; moderator_comment: string | null; chat_id: number | null; created_at: string; age_hours: number };
type ChatRow = { id: number; sender_id: number | null; type: string; body: string | null; system_code: string | null; flags: string[]; created_at: string };
type ReviewRow = { id: number; order_id: number; author_id: number; master_id: number; rating: number; text: string; status: string; complaints_count: number; hide_reason: string | null; reply_text: string | null; created_at: string };
type UserRow = { id: number; name: string | null; phone: string; city_ru: string | null; is_client: boolean; is_master: boolean; master_status: string | null; status: 'active' | 'blocked'; blocked_until: string | null; created_at: string; last_seen_at: string | null; complaints_count: number };
type UserDetail = UserRow & { block_reason: string | null; tasks_count: number; orders_as_client: number; orders_as_master: number; reviews_written: number; disputes_count: number; staff_role: string | null };
type ComplaintRow = { id: number; reporter_id: number; subject_type: string; subject_id: number; reason_ru: string; comment: string | null; status: string; resolution: string | null; created_at: string };
type LimitOut = { key: string; title: string; value: number; default: number };
type StaffOut = { user_id: number; name: string | null; phone: string; role: string; region_ids: number[]; active: boolean };
type AuditRow = { id: number; at: string; actor_id: number | null; actor_name: string | null; action: string; object_type: string; object_id: number | null; old: Record<string, unknown> | null; new: Record<string, unknown> | null; comment: string | null };
type OwnProfile = {
  status: string; professions: { category_id: number; name_ru: string; price_from: number | null; negotiable: boolean; status: string }[]; city: { name_ru: string } | null;
  districts: { name_ru: string }[]; experience: string | null; about: string | null; portfolio: { url: string }[]; avatar_url: string | null; verified: boolean; services: { title: string; price: number | null }[];
};

/* ======================= помощники ======================= */
const phoneFmt = (p: string) => {
  const d = p.replace(/\D/g, '').slice(-9);
  return d.length === 9 ? `+992 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : p;
};
const minutesSince = (iso: string | null | undefined) => (iso ? Math.max(0, (Date.now() - +new Date(iso)) / 60000) : 0);
const EXP: Record<string, string> = { lt1: 'опыт до 1 года', '1_3': 'опыт 1–3 года', '3_10': 'опыт 3–10 лет', gt10: 'опыт больше 10 лет' };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const ACT_TONE = (a: string): Tone => (/reject|block|hide|suspend/.test(a) ? 'bad' : /approve|resolve|verify|unblock|restore/.test(a) ? 'ok' : /edit|update|warn|limits/.test(a) ? 'warn' : 'info');
const OBJ_PREFIX: Record<string, string> = { task: 'T-', master: 'M-', master_profile: 'M-', user: 'U-', review: 'R-', dispute: 'D-', order: 'O-', chat: 'O-', complaint: 'C-' };
const objId = (t: string, id: number | null) => (id == null ? t : OBJ_PREFIX[t] ? `${OBJ_PREFIX[t]}${id}` : `${t}:${id}`);

/** Имена мастеров берём из публичного профиля (без записи в аудит) */
const masterNames = new Map<number, Promise<string>>();
const masterName = (id: number) => {
  if (!masterNames.has(id)) masterNames.set(id, http<{ name: string | null }>(`/masters/${id}`).then((m) => m.name ?? `Мастер #${id}`, () => `Мастер #${id}`));
  return masterNames.get(id)!;
};
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
  /** Роль сотрудника: с бэкендом — staff_role из карточки пользователя; без — из ?role= (демо) */
  async me(userId: number | null, name: string, demoRole: Role): Promise<Me | null> {
    if (!USE_API) return wait(demo.demoMe(demoRole), 0);
    if (!userId) return null;
    const u = await http<UserDetail>(`/admin/users/${userId}`);
    const role = roleFromApi(u.staff_role);
    if (!role) return null;
    const staff = role === 'admin' ? await http<StaffOut[]>('/admin/staff').catch(() => []) : [];
    const mine = staff.find((x) => x.user_id === userId);
    const regions = mine?.region_ids.map((id) => ref.cityById(id)?.name.ru).filter(Boolean).join(', ');
    return { role, name: u.name ?? name, meta: [u.staff_role, regions].filter(Boolean).join(' · '), userId };
  },

  async counts(): Promise<Counts> {
    if (!USE_API) return wait({ ...demo.demoCounts, tasks: mem.tasks.length, masters: mem.masters.filter((m) => m.type === 'Новый' || m.type === 'Повторно').length, disputes: mem.disputes.filter((d) => d.open).length, reviews: mem.reviews.filter((r) => r.status === 'review').length, chats: mem.complaints.filter((c) => c.open).length }, 0);
    const [q, d, r, c] = await Promise.all([
      http<QueueItem[]>('/admin/queue', { query: { type: 'all' } }).catch(() => [] as QueueItem[]),
      http<Page<DisputeRow>>('/admin/disputes', { query: { status: 'open', limit: 100 } }).catch(() => ({ items: [] as DisputeRow[] })),
      http<Page<ReviewRow>>('/admin/reviews', { query: { status: 'review', limit: 100 } }).catch(() => ({ items: [] as ReviewRow[] })),
      http<Page<ComplaintRow>>('/admin/complaints', { query: { status: 'open', subject_type: 'chat', limit: 100 } }).catch(() => ({ items: [] as ComplaintRow[] })),
    ]);
    const tasks = q.filter((x) => x.type === 'task');
    const hot = d.items.filter((x) => x.age_hours >= 19);
    return {
      tasks: tasks.length, tasksLate: tasks.filter((x) => x.overdue).length, masters: q.length - tasks.length, disputes: d.items.length,
      disputesHot: hot.length ? `${hot.length} горит · ${Math.max(0, 24 - Math.max(...hot.map((x) => x.age_hours)))} ч` : 'в норме', reviews: r.items.length, chats: c.items.length,
    };
  },

  /* ---------- 01 Дашборд ---------- */
  async dashboard(days: number, cityId: number | null, catId: number | null = null): Promise<Dash> {
    if (!USE_API) return wait(demo.demoDash);
    const [f, rows, noResp] = await Promise.all([
      http<Funnel>('/admin/stats/funnel', { query: { days, city_id: cityId, category_id: catId } }),
      http<Page<TaskRow>>('/admin/tasks', { query: { city_id: cityId, category_id: catId, limit: 200 } }).catch(() => ({ items: [] as TaskRow[] })),
      http<Page<TaskRow>>('/admin/tasks', { query: { city_id: cityId, category_id: catId, no_responses_24h: true, limit: 200 } }).catch(() => ({ items: [] as TaskRow[] })),
    ]);
    const cities = ref.get()?.cities ?? [];
    const byCity = cityId ? [] : await Promise.all(cities.map((c) => http<Funnel>('/admin/stats/funnel', { query: { days, city_id: c.id, category_id: catId } }).catch(() => null)));
    // Новые задания по дням — 14 последних дней по дате публикации
    const day0 = new Date();
    day0.setHours(0, 0, 0, 0);
    const bars = Array.from({ length: 14 }, (_, i) => {
      const from = +day0 - (13 - i) * 864e5;
      return { d: new Date(from).getDate(), v: rows.items.filter((t) => { const at = +new Date(t.published_at ?? t.created_at); return at >= from && at < from + 864e5; }).length };
    });
    // Дефицит: доля заданий без отклика за 24 ч по категории и городу
    const all = new Map<string, number>();
    rows.items.forEach((t) => all.set(`${t.category_ru}|${t.city_ru ?? 'Онлайн'}`, (all.get(`${t.category_ru}|${t.city_ru ?? 'Онлайн'}`) ?? 0) + 1));
    const miss = new Map<string, number>();
    noResp.items.forEach((t) => miss.set(`${t.category_ru}|${t.city_ru ?? 'Онлайн'}`, (miss.get(`${t.category_ru}|${t.city_ru ?? 'Онлайн'}`) ?? 0) + 1));
    const deficit = [...miss].map(([k, n]): [string, string, number] => { const [c, city] = k.split('|'); return [c, city, pct(n, all.get(k) ?? n)]; }).sort((a, b) => b[2] - a[2]).slice(0, 6);
    const P = f.tasks_published;
    const fmtD = (d: Date) => `${d.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()]}`;
    return {
      period: days === 1 ? 'сегодня' : `${fmtD(new Date(Date.now() - (days - 1) * 864e5))} – ${fmtD(new Date())}`,
      kpis: [
        ['Новые задания', num(P), `за ${days === 1 ? 'сегодня' : `${days} дней`}`, true], ['Отклик за 24 ч', `${pct(f.tasks_with_response_24h, P)}%`, `с откликом всего ${pct(f.tasks_with_response, P)}%`, true],
        ['Выбор мастера', `${pct(f.tasks_chosen, P)}%`, `${num(f.tasks_chosen)} заданий`, true], ['Завершено', `${pct(f.orders_done, P)}%`, `${num(f.orders_done)} заказов`, true],
        ['Новые мастера', num(f.masters_registered), `одобрено ${num(f.masters_approved)}`, true],
        ['Медиана модерации', f.moderation_median_minutes != null ? `${Math.round(f.moderation_median_minutes)} мин` : '—', 'норма 30 мин', (f.moderation_median_minutes ?? 0) <= 30],
      ],
      funnel: [['Опубликовано', P, ''], ['С откликом', f.tasks_with_response, `${pct(f.tasks_with_response, P)}%`], ['Мастер выбран', f.tasks_chosen, `${pct(f.tasks_chosen, f.tasks_with_response)}%`], ['Завершено', f.orders_done, `${pct(f.orders_done, f.tasks_chosen)}%`], ['С отзывом', f.reviews, `${pct(f.reviews, f.orders_done)}%`]],
      bars,
      cities: cities.flatMap((c, i) => {
        const x = byCity[i];
        return x ? [[c.name.ru, num(x.tasks_published), num(c.masters), `${pct(x.tasks_with_response_24h, x.tasks_published)}%`, `${pct(x.tasks_chosen, x.tasks_published)}%`, `${pct(x.orders_done, x.tasks_published)}%`, '—'] as Dash['cities'][number]] : [];
      }),
      deficit,
    };
  },

  /* ---------- 02 Модерация заданий ---------- */
  async tasks(tab: 'queue' | 'rejected' | 'approved'): Promise<TaskQ[]> {
    if (!USE_API) return wait(tab === 'queue' ? mem.tasks : tab === 'rejected' ? mem.rejected : []);
    if (tab === 'queue') {
      const q = await http<QueueItem[]>('/admin/queue', { query: { type: 'task' } });
      return q.map((x) => ({
        key: String(x.id), id: `T-${x.id}`, title: x.title, cat: x.category ?? '—', city: x.city_ru ?? 'Онлайн', author: x.author_name ?? `#${x.author_id}`, authorMeta: `автор #${x.author_id}`,
        budget: x.budget ?? 'Договорная', when: '—', ageMin: x.age_minutes, slaLeft: x.sla_minutes - x.age_minutes, flags: x.flags.map((f) => flagOf(f)[0]), text: x.text, photos: x.photos,
      }));
    }
    const p = await http<Page<TaskRow>>('/admin/tasks', { query: { status: tab === 'rejected' ? 'rejected' : 'open', limit: 100 } });
    const today = new Date().setHours(0, 0, 0, 0);
    return p.items
      .filter((t) => tab === 'rejected' || +new Date(t.published_at ?? 0) >= today)
      .map((t) => ({
        key: String(t.id), id: `T-${t.id}`, title: t.title, cat: t.category_ru, city: [t.city_ru, t.district_ru].filter(Boolean).join(', ') || 'Онлайн', author: `#${t.client_id}`, authorMeta: '',
        budget: '—', when: '—', ageMin: minutesSince(t.created_at), slaLeft: null, flags: t.flags.map((f) => flagOf(f)[0]), text: '', photos: [],
      }));
  },
  approvedToday: async () => (USE_API ? (await adminApi.tasks('approved')).length : mem.approvedToday),
  async taskReasons(): Promise<Reason[]> {
    if (!USE_API) return demo.demoTaskReasons;
    const l = await http<{ id: number; code: string; text_ru: string }[]>('/reasons', { query: { kind: 'task_reject' } });
    return l.map((r) => ({ id: r.id, code: r.code, label: r.text_ru }));
  },
  async moderateTask(t: TaskQ, ok: boolean, reason?: Reason, comment?: string) {
    if (!USE_API) {
      mem.tasks = mem.tasks.filter((x) => x.key !== t.key);
      if (ok) mem.approvedToday++;
      else mem.rejected.unshift(t);
      log('Вы', ok ? 'task.approve' : 'task.reject', t.id, ok ? '' : `причина: ${reason?.label}`);
      return wait(null, 200);
    }
    if (ok) return http(`/admin/tasks/${t.key}/approve`, { method: 'POST' });
    return http(`/admin/tasks/${t.key}/reject`, { method: 'POST', body: { reason_id: reason!.id, comment: comment || null } });
  },

  /* ---------- 03 Профили мастеров ---------- */
  async masters(): Promise<MasterQ[]> {
    if (!USE_API) return wait(mem.masters);
    const q = await http<QueueItem[]>('/admin/queue', { query: { type: 'all' } });
    return q
      .filter((x) => x.type !== 'task')
      .map((x) => ({
        key: `${x.type}:${x.id}:${x.profession_id ?? ''}`, id: `M-${x.author_id}`, userId: x.author_id, name: x.author_name ?? `#${x.author_id}`, cats: x.category ?? x.title, city: x.city_ru ?? 'Онлайн',
        agoMin: x.age_minutes, slaLeft: x.sla_minutes - x.age_minutes, type: x.type === 'profession' ? 'Изменения' : x.flags.includes('resubmit') ? 'Повторно' : 'Новый',
        tone: x.type === 'profession' ? 'grey' : x.flags.includes('resubmit') ? 'warn' : 'info', kind: x.type === 'profession' ? 'profession' : 'master', professionId: x.profession_id ?? undefined,
      }));
  },
  async masterCard(q: MasterQ): Promise<MasterCard> {
    if (!USE_API) return wait(demo.demoMasterCard(q), 120);
    const p = await http<OwnProfile>(`/admin/masters/${q.userId}/profile`);
    const about = p.about ?? '';
    const contacts = /(\+?992|\b\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b|t\.me|telegram|whatsapp|instagram|@\w{3,}|https?:)/i.test(about);
    const prices = [...p.professions.map((x) => `${x.name_ru} — ${x.negotiable || !x.price_from ? 'договорная' : `от ${x.price_from} смн`}`), ...p.services.slice(0, 3).map((x) => `${x.title} — ${x.price ? `${x.price} смн` : 'договорная'}`)].join(' · ');
    return {
      name: q.name, sub: [p.professions.map((x) => x.name_ru).join(', '), p.experience ? EXP[p.experience] : ''].filter(Boolean).join(' · '), meta: `${q.id} · подано ${agoText(q.agoMin)}`,
      avatar: p.avatar_url ?? undefined, city: [p.city?.name_ru, p.districts.map((d) => d.name_ru).join(', ')].filter(Boolean).join(' · ') || 'Онлайн', prices: prices || '—', about: about || '—',
      photos: p.portfolio.map((x) => x.url), verified: p.verified,
      checklist: [
        ['Фото — лицо видно, без логотипов и текста', p.avatar_url ? 2 : 0, p.avatar_url ? 'проверьте фото' : 'фото нет'], ['Имя похоже на настоящее', /\S+\s+\S+/.test(q.name) ? 1 : 2, ''],
        ['Категории соответствуют опыту и портфолио', p.portfolio.length ? 2 : 0, p.portfolio.length ? '' : 'портфолио пусто'], ['Описание без контактов и ссылок', contacts ? 0 : 1, contacts ? 'контакты в «О себе»' : ''],
        ['Цены в разумных пределах по городу', 2, ''], ['Портфолио — свои работы', p.portfolio.length ? 2 : 0, p.portfolio.length ? `проверить ${p.portfolio.length} фото` : 'нет фото'],
      ],
    };
  },
  async masterReasons(): Promise<Reason[]> {
    if (!USE_API) return demo.demoMasterReasons;
    const l = await http<{ id: number; code: string; text_ru: string }[]>('/reasons', { query: { kind: 'master_reject' } });
    return l.map((r) => ({ id: r.id, code: r.code, label: r.text_ru }));
  },
  async moderateMaster(q: MasterQ, ok: boolean, reason?: Reason, comment?: string) {
    if (!USE_API) {
      mem.masters = mem.masters.filter((x) => x.key !== q.key);
      log('Вы', ok ? 'master.approve' : 'master.reject', q.id, ok ? '' : `причина: ${reason?.label}`);
      return wait(null, 200);
    }
    if (q.kind === 'profession') return http(`/admin/masters/${q.userId}/professions/${q.professionId}/${ok ? 'approve' : 'reject'}`, { method: 'POST' });
    if (ok) return http(`/admin/masters/${q.userId}/approve`, { method: 'POST' });
    return http(`/admin/masters/${q.userId}/reject`, { method: 'POST', body: { reason_id: reason!.id, comment: comment || null } });
  },
  verifyMaster: (q: MasterQ, verified: boolean, comment: string) =>
    USE_API ? http(`/admin/masters/${q.userId}/verify`, { method: 'POST', body: { verified, comment } }) : wait(log('Вы', 'master.verify', q.id, comment), 150),

  /* ---------- 04 Споры ---------- */
  async disputes(): Promise<DisputeV[]> {
    if (!USE_API) return wait(mem.disputes);
    const [o, r] = await Promise.all([
      http<Page<DisputeRow>>('/admin/disputes', { query: { status: 'open', limit: 50 } }),
      http<Page<DisputeRow>>('/admin/disputes', { query: { status: 'resolved', limit: 50 } }),
    ]);
    const RES: Record<string, string> = { done: 'выполнено', not_done: 'не выполнено', partial: 'частично' };
    return Promise.all(
      [...o.items, ...r.items].map(async (d) => {
        const m = short(await masterName(d.master_id));
        const open = d.status === 'open';
        return {
          key: d.id, id: `D-${d.id}`, title: d.task_title, who: `Клиент #${d.client_id} ↔ ${m}`, status: open ? 'Открыт' : `Решён: ${RES[d.resolution ?? ''] ?? d.resolution}`, tone: open ? 'bad' : 'grey',
          slaH: open ? Math.max(0, 24 - d.age_hours) : null, order: `O-${d.order_id}`, open, waiting: false, chatId: d.chat_id, clientName: `Клиент #${d.client_id}`, masterName: m, resolution: d.resolution ?? undefined,
          client: { title: `Клиент · #${d.client_id}`, text: [d.reason_ru, d.text].filter(Boolean).join('. '), meta: `${d.photos.length} фото · ${dayMonTime(d.created_at)}` },
          master: null, photos: d.photos,
        } satisfies DisputeV;
      }),
    );
  },
  async timeline(d: DisputeV): Promise<TimelineItem[]> {
    if (!USE_API) return wait(demo.demoTimeline, 100);
    if (!d.chatId) return [];
    const msgs = await http<ChatRow[]>(`/admin/chats/${d.chatId}/messages`);
    const SYS: Record<string, [string, string]> = {
      chosen: ['Клиент выбрал мастера', '#2647D9'], started: ['Мастер начал работу', '#2647D9'], marked_done: ['Мастер: «Работа выполнена»', '#2647D9'], confirmed: ['Клиент подтвердил выполнение', '#0B6E5E'],
      dispute_opened: ['Клиент: «Есть проблема» — открыт спор', '#B03A2E'], cancelled_by_client: ['Клиент отменил выбор', '#9AA5B4'], declined_by_master: ['Мастер отказался', '#9AA5B4'],
    };
    return msgs.filter((m) => m.type === 'system').map((m) => { const [t, c] = SYS[m.system_code ?? ''] ?? [m.system_code ?? 'Событие', '#D9822B']; return [t, dayMonTime(m.created_at), c]; });
  },
  async resolveDispute(d: DisputeV, res: 'done' | 'not_done' | 'partial', comment: string) {
    if (!USE_API) {
      const x = mem.disputes.find((y) => y.key === d.key)!;
      Object.assign(x, { open: false, tone: 'grey', slaH: null, resolution: res, status: `Решён: ${{ done: 'выполнено', not_done: 'не выполнено', partial: 'частично' }[res]}` });
      log('Вы', 'dispute.resolve', d.id, `решение: ${x.status.slice(7)}`);
      return wait(null);
    }
    return http(`/admin/disputes/${d.key}/resolve`, { method: 'POST', body: { resolution: res, comment } });
  },

  /* ---------- 05 Отзывы ---------- */
  async reviews(tab: 'review' | 'all' | 'hidden'): Promise<ReviewV[]> {
    if (!USE_API) return wait(mem.reviews.filter((r) => (tab === 'all' ? r.status !== 'hidden' : r.status === tab)));
    const p = await http<Page<ReviewRow>>('/admin/reviews', { query: { status: tab === 'all' ? 'published' : tab, limit: 100 } });
    return Promise.all(
      p.items.map(async (r) => ({
        key: r.id, id: `R-${r.id}`, rating: r.rating, text: r.text, master: short(await masterName(r.master_id)), reason: r.hide_reason ?? (r.complaints_count ? 'Жалобы' : '—'),
        tone: (r.complaints_count >= 2 ? 'bad' : r.complaints_count ? 'warn' : 'grey') as Tone, complaints: r.complaints_count, order: `O-${r.order_id}`, date: dayMon(r.created_at),
        author: `Клиент #${r.author_id}`, reply: r.reply_text, complaintList: [], status: (r.status === 'hidden' ? 'hidden' : r.status === 'review' ? 'review' : 'published') as ReviewV['status'], hideReason: r.hide_reason,
      })),
    );
  },
  async hideReview(r: ReviewV, reason: string) {
    if (!USE_API) return wait((Object.assign(mem.reviews.find((x) => x.key === r.key)!, { status: 'hidden', hideReason: reason }), log('Вы', 'review.hide', r.id, `причина: ${reason.toLowerCase()}`)));
    return http(`/admin/reviews/${r.key}/hide`, { method: 'POST', body: { reason } });
  },
  async keepReview(r: ReviewV) {
    if (!USE_API) return wait((Object.assign(mem.reviews.find((x) => x.key === r.key)!, { status: 'published', complaints: 0, tone: 'grey', reason: '—' }), log('Вы', 'review.restore', r.id, 'жалобы отклонены')));
    return http(`/admin/reviews/${r.key}/restore`, { method: 'POST' });
  },

  /* ---------- 06 Пользователи ---------- */
  async users(f: { q: string; role: string; status: string; complaints: boolean; city: string }): Promise<{ items: UserV[]; total: number; masters: number }> {
    if (!USE_API) {
      const ql = f.q.trim().toLowerCase().replace(/\s/g, '');
      const items = mem.users.filter(
        (u) =>
          (!ql || `${u.id}${u.name}${u.phone}`.toLowerCase().replace(/\s/g, '').includes(ql)) && (f.role === 'all' || u.role === f.role || u.role === 'Оба') &&
          (f.status === 'all' || (f.status === 'blocked' ? u.blocked : !u.blocked)) && (!f.complaints || u.complaints > 0) && (f.city === 'all' || u.city === f.city),
      );
      return wait({ items, total: 48210, masters: 3904 });
    }
    const p = await http<Page<UserRow>>('/admin/users', { query: { q: f.q.trim() || null, role: f.role === 'Клиент' ? 'client' : f.role === 'Мастер' ? 'master' : null, status: f.status === 'all' ? null : f.status, limit: 100 } });
    const items = p.items
      .filter((u) => (!f.complaints || u.complaints_count > 0) && (f.city === 'all' || u.city_ru === f.city))
      .map((u): UserV => {
        const blocked = u.status === 'blocked';
        const days = u.blocked_until ? Math.ceil((+new Date(u.blocked_until) - Date.now()) / 864e5) : null;
        return {
          key: u.id, id: `U-${u.id}`, name: u.name ?? `Аноним ${u.id}`, phone: phoneFmt(u.phone), role: u.is_client && u.is_master ? 'Оба' : u.is_master ? 'Мастер' : 'Клиент', city: u.city_ru ?? 'Онлайн',
          status: blocked ? (days == null ? 'Навсегда' : `Блок ${days} дн`) : u.master_status === 'review' ? 'Проверка' : 'Активен', tone: blocked ? (days == null ? 'dark' : 'bad') : u.master_status === 'review' ? 'warn' : 'ok',
          complaints: u.complaints_count, seen: seenText(u.last_seen_at), blocked,
        };
      });
    return { items, total: items.length, masters: items.filter((u) => u.role !== 'Клиент').length };
  },
  async user(u: UserV): Promise<UserCard> {
    if (!USE_API) return wait(demo.demoUserCard(u), 100);
    const d = await http<UserDetail>(`/admin/users/${u.key}`);
    const since = new Date(d.created_at);
    return {
      ...u, blockReason: d.block_reason, activeTasks: d.tasks_count,
      stats: [[String(d.tasks_count), 'задания', false], [String(d.orders_as_client + d.orders_as_master), 'завершено', false], [String(d.complaints_count), 'жалобы', d.complaints_count >= 3], [`с ${['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][since.getMonth()]}`, 'на eKor', false]],
      signals: [d.disputes_count && `споров: ${d.disputes_count}`, d.reviews_written && `отзывов: ${d.reviews_written}`, d.block_reason && `прошлая блокировка: ${d.block_reason}`].filter(Boolean).join(' · ') || 'Сигналов нет',
    };
  },
  async block(u: UserV, reason: string, days: number | null, comment: string) {
    if (!USE_API) {
      Object.assign(mem.users.find((x) => x.key === u.key)!, { blocked: true, status: days ? `Блок ${days} дн` : 'Навсегда', tone: days ? 'bad' : 'dark' });
      log('Вы', 'user.block', u.id, `${days ? `${days} дн` : 'навсегда'} · ${reason.toLowerCase()}`);
      return wait(null);
    }
    return http(`/admin/users/${u.key}/block`, { method: 'POST', body: { reason: [reason, comment].filter(Boolean).join(' — '), days } });
  },
  async unblock(u: UserV, comment: string) {
    if (!USE_API) return wait((Object.assign(mem.users.find((x) => x.key === u.key)!, { blocked: false, status: 'Активен', tone: 'ok' }), log('Вы', 'user.unblock', u.id, comment)));
    return http(`/admin/users/${u.key}/unblock`, { method: 'POST', body: { comment } });
  },

  /* ---------- 07 Чаты по жалобам ---------- */
  async complaints(): Promise<ComplaintV[]> {
    if (!USE_API) return wait(mem.complaints);
    const [o, r] = await Promise.all([
      http<Page<ComplaintRow>>('/admin/complaints', { query: { status: 'open', subject_type: 'chat', limit: 50 } }),
      http<Page<ComplaintRow>>('/admin/complaints', { query: { status: 'resolved', subject_type: 'chat', limit: 50 } }),
    ]);
    return [...o.items, ...r.items].map((c) => ({
      key: c.id, id: `C-${c.id}`, title: c.reason_ru, order: `Чат #${c.subject_id}`, status: c.status === 'open' ? 'Новая' : 'Решена', tone: c.status === 'open' ? 'info' : 'grey', open: c.status === 'open',
      chatId: c.subject_id, text: c.comment ? `«${c.comment}»` : '', from: `От пользователя #${c.reporter_id}`, date: dayMonTime(c.created_at), who: '', detector: [], subject: '',
    }));
  },
  async chat(c: ComplaintV): Promise<{ msgs: ChatMsg[]; detector: string[] }> {
    if (!USE_API) return wait({ msgs: demo.demoChat, detector: c.detector }, 120);
    if (!c.chatId) return { msgs: [], detector: [] };
    const rows = await http<ChatRow[]>(`/admin/chats/${c.chatId}/messages`);
    // Сторона: первая реплика в чате — мастер (после выбора пишет первым) — точнее, по заявителю: он клиент или мастер
    const reporter = +c.from.replace(/\D/g, '') || null;
    const flags = new Map<string, number>();
    rows.forEach((m) => m.flags.forEach((f) => flags.set(f, (flags.get(f) ?? 0) + 1)));
    return {
      msgs: rows.map((m) => ({
        sys: m.type === 'system', who: m.type === 'system' ? '' : m.sender_id === reporter ? 'Клиент' : 'Мастер', text: m.body ?? m.system_code ?? '', time: m.type === 'system' ? dayMon(m.created_at) : dayMonTime(m.created_at).split(', ')[1], flag: m.flags.length > 0,
      })),
      detector: [...flags].map(([f, n]) => (n > 1 ? `${f} × ${n}` : f)),
    };
  },
  async resolveComplaint(c: ComplaintV, resolution: string) {
    if (!USE_API) return wait((Object.assign(mem.complaints.find((x) => x.key === c.key)!, { open: false, status: 'Решена', tone: 'grey' }), log('Вы', 'complaint.resolve', c.id, resolution)));
    return http(`/admin/complaints/${c.key}/resolve`, { method: 'POST', body: { resolution } });
  },

  /* ---------- 08 Справочники ---------- */
  async categories(): Promise<CatNode[]> {
    if (!USE_API) return wait(mem.cats);
    const tree = await http<{ id: number; key: string; name_ru: string; name_tj: string; icon: string | null; allows_online: boolean; masters_count: number; children: { id: number; key: string; name_ru: string; name_tj: string; masters_count: number }[] }[]>('/categories');
    return tree.flatMap((c) => [
      { id: c.id, key: c.key, ru: c.name_ru, tj: c.name_tj, parentId: null, icon: c.icon ?? 'Wrench', masters: c.masters_count, hidden: false, aliases: [], online: c.allows_online },
      ...c.children.map((k) => ({ id: k.id, key: k.key, ru: k.name_ru, tj: k.name_tj, parentId: c.id, icon: c.icon ?? 'Wrench', masters: k.masters_count, hidden: false, aliases: [], online: c.allows_online })),
    ]);
  },
  async saveCategory(c: CatNode, isNew: boolean) {
    if (!USE_API) {
      if (isNew) mem.cats.push({ ...c, id: Date.now() });
      else Object.assign(mem.cats.find((x) => x.id === c.id)!, c);
      log('Вы', 'dict.update', `category:${c.id}`, isNew ? 'новая категория' : 'изменена категория');
      return wait(null);
    }
    const body = { name_ru: c.ru, name_tj: c.tj, icon: c.icon, aliases: c.aliases, allows_online: c.online, active: !c.hidden };
    if (isNew) return http('/admin/categories', { method: 'POST', body: { ...body, parent_id: c.parentId, key: c.key, typical_price_from: null, sort: 0 } });
    return http(`/admin/categories/${c.id}`, { method: 'PATCH', body });
  },
  async cities(): Promise<CityNode[]> {
    if (!USE_API) return wait(demo.demoCities);
    const R = ref.get();
    return (R?.cities ?? []).map((c) => ({ id: c.id, ru: c.name.ru, tj: c.name.tj, region: c.sub.ru, masters: c.masters, districts: (R?.districts[c.key] ?? []).map((d) => ({ id: d.id, ru: d.name.ru, tj: d.name.tj, near: d.near })) }));
  },
  async saveCity(id: number, ru: string, tj: string) {
    if (!USE_API) return wait(log('Вы', 'dict.update', `city:${id}`, `${ru} / ${tj}`));
    return http(`/admin/cities/${id}`, { method: 'PATCH', body: { name_ru: ru, name_tj: tj } });
  },
  async rejectReasons(kind: 'task_reject' | 'master_reject'): Promise<Reason[]> {
    if (!USE_API) return wait(kind === 'task_reject' ? demo.demoRejectReasons : demo.demoMasterReasons);
    const l = await http<{ id: number; code: string; text_ru: string }[]>('/reasons', { query: { kind } });
    return l.map((r) => ({ id: r.id, code: r.code, label: r.text_ru }));
  },
  async saveReason(id: number, ru: string) {
    if (!USE_API) return wait(log('Вы', 'dict.update', `reason:${id}`, ru));
    return http(`/admin/reasons/${id}`, { method: 'PATCH', body: { text_ru: ru } });
  },

  /* ---------- 09 Лимиты ---------- */
  async limits(): Promise<LimitV[]> {
    if (!USE_API) return wait(mem.limits.map((l) => ({ ...l })));
    const l = await http<LimitOut[]>('/admin/limits');
    return l.map((x) => ({ key: x.key, group: limitGroup(x.key), label: x.title, value: x.value, unit: limitUnit(x.key) }));
  },
  async limitHistory(): Promise<HistoryV[]> {
    if (!USE_API) return wait(mem.history);
    const a = await http<Page<AuditRow>>('/admin/audit', { query: { action: 'limits.update', limit: 20 } }).catch(() => ({ items: [] as AuditRow[] }));
    return a.items.flatMap((r) =>
      Object.keys(r.new ?? {}).map((k): [string, string, boolean] => [`${k}: ${String(r.old?.[k] ?? '—')} → ${String(r.new?.[k])}`, `${dayMon(r.at)} · ${r.actor_name ?? '—'}`, false]),
    );
  },
  async saveLimits(values: Record<string, number>, prev: Record<string, number>, labels: Record<string, string>, comment: string) {
    if (!USE_API) {
      mem.limits.forEach((l) => l.key in values && (l.value = values[l.key]));
      Object.keys(values).forEach((k) => mem.history.unshift([`${labels[k]}: ${prev[k]} → ${values[k]}`, `сейчас · вы`, false]));
      log('Вы', 'limits.update', Object.keys(values).join(', '), comment);
      return wait(null);
    }
    // Основание пишет в аудит сервер; передаём его вместе со значениями
    return http('/admin/limits', { method: 'PUT', body: { values, comment } });
  },

  /* ---------- 11 Сотрудники ---------- */
  async staff(): Promise<StaffV[]> {
    if (!USE_API) return wait(mem.staff);
    const l = await http<StaffOut[]>('/admin/staff');
    return l.map((x) => ({
      userId: x.user_id, name: x.name ?? phoneFmt(x.phone), phone: phoneFmt(x.phone), role: x.role, regionIds: x.region_ids,
      regions: x.region_ids.length ? x.region_ids.map((id) => ref.cityById(id)?.name.ru ?? `#${id}`).join(', ') : 'Все', status: x.active ? 'Активен' : 'Отключён', tone: x.active ? 'ok' : 'grey', decisions: '—', seen: '—', active: x.active,
    }));
  },
  async inviteStaff(phone: string, role: string, regionIds: number[]) {
    if (!USE_API) {
      mem.staff.push({ userId: Date.now(), name: phone, phone, role, regionIds, regions: regionIds.map((id) => demo.demoCities.find((c) => c.id === id)?.ru).join(', ') || 'Все', status: 'Приглашён', tone: 'warn', decisions: '—', seen: '—', active: true });
      log('Вы', 'staff.invite', phone, `роль ${role}`);
      return wait(null);
    }
    return http('/admin/staff', { method: 'POST', body: { phone, role, region_ids: regionIds } });
  },
  async patchStaff(s: StaffV, p: { role?: string; regionIds?: number[]; active?: boolean }) {
    if (!USE_API) {
      Object.assign(mem.staff.find((x) => x.userId === s.userId)!, { ...(p.role && { role: p.role }), ...(p.active !== undefined && { active: p.active, status: p.active ? 'Активен' : 'Отключён', tone: p.active ? 'ok' : 'grey' }) });
      log('Вы', 'staff.update', s.name, JSON.stringify(p));
      return wait(null);
    }
    return http(`/admin/staff/${s.userId}`, { method: 'PATCH', body: { role: p.role ?? null, region_ids: p.regionIds ?? null, active: p.active ?? null } });
  },

  /* ---------- 12 Аудит ---------- */
  async audit(f: { action: string; objectId: string }): Promise<AuditV[]> {
    if (!USE_API) {
      const q = f.objectId.trim().toLowerCase();
      return wait(mem.audit.filter((a) => (!f.action || (f.action.endsWith('*') ? a.action.startsWith(f.action.slice(0, -1)) : a.action === f.action)) && (!q || a.obj.toLowerCase().includes(q))));
    }
    const id = f.objectId.replace(/\D/g, '');
    const p = await http<Page<AuditRow>>('/admin/audit', { query: { action: f.action && !f.action.endsWith('*') ? f.action : null, object_id: id ? +id : null, limit: 200 } });
    return p.items
      .filter((a) => !f.action.endsWith('*') || a.action.startsWith(f.action.slice(0, -1)))
      .map((a) => ({
        key: a.id, time: hhmmss(a.at), who: a.actor_name ? short(a.actor_name) : 'Система', action: a.action, obj: objId(a.object_type, a.object_id),
        details: a.comment ?? (a.new ? Object.entries(a.new).map(([k, v]) => `${a.old?.[k] !== undefined ? `${String(a.old[k])} → ` : ''}${String(v)}${Object.keys(a.new!).length > 1 ? ` (${k})` : ''}`).join(', ') : ''),
        tone: ACT_TONE(a.action), evt: `evt_${a.id.toString(16)}`, comment: a.comment, old: a.old, next: a.new,
      }));
  },
};

/** Лимиты бэкенда: группа и единица по ключу */
function limitGroup(k: string) {
  if (/response/.test(k)) return 'Отклики';
  if (/invite/.test(k)) return 'Приглашения';
  if (/sla|moderation/.test(k)) return 'Модерация (SLA)';
  if (/otp|sms|login|code/.test(k)) return 'Вход по SMS';
  if (/review|complaint/.test(k)) return 'Отзывы';
  if (/task|photo|desc|title/.test(k)) return 'Задания';
  return 'Прочее';
}
function limitUnit(k: string) {
  if (/minutes?$|_min$/.test(k)) return 'мин';
  if (/hours?$|_h$/.test(k)) return 'ч';
  if (/days?$/.test(k)) return 'дней';
  if (/seconds?$|_sec$/.test(k)) return 'сек';
  if (/len|chars|desc|title/.test(k)) return 'симв.';
  return 'шт';
}
