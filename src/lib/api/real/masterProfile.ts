/** Профиль мастера с бэкенда: анкета, редактор, настройки (/me/master-profile) */
import { http } from '../http';
import { ref, uiLang } from '../ref';
import type { NR } from '../remote';
import type { MasterProfileData } from '../masterProfile';

type Own = {
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'suspended';
  professions: { category_id: number; price_from: number | null; negotiable: boolean; status: 'review' | 'approved' }[];
  city: NR | null; districts: (NR & { near: boolean })[]; works_online: boolean; experience: (typeof EXP)[number] | null; about: string | null;
  languages: string[]; services: { title: string; price: number | null }[]; portfolio: { upload_id: number; url: string; caption: string | null }[];
  avatar_url: string | null; verified: boolean; show_phone: boolean; accepting_orders: boolean; available_today: boolean; notify_new_tasks: boolean; notify_chat: boolean; notify_channel: 'sms' | 'push';
};

const EXP = ['lt1', '1_3', '3_10', 'gt10'] as const;
/** Сырой ответ — чтобы при сохранении не потерять услуги и подписи к фото */
let last: Own | null = null;

const key = (id: number) => ref.catById(id)?.key ?? String(id);
const dName = (d: NR) => (uiLang() === 'tj' ? d.name_tj : d.name_ru);

function toData(o: Own): MasterProfileData {
  last = o;
  const approved = o.status === 'approved';
  return {
    status: approved ? 'approved' : 'review',
    profs: o.professions.map((p) => key(p.category_id)),
    pendingProfs: approved ? o.professions.filter((p) => p.status === 'review').map((p) => key(p.category_id)) : [],
    city: o.city?.name_ru ?? '',
    areas: o.districts.map(dName),
    online: o.works_online,
    prices: Object.fromEntries(o.professions.map((p) => [key(p.category_id), p.negotiable ? null : p.price_from])),
    exp: o.experience ? EXP.indexOf(o.experience) : 0,
    about: o.about ?? '',
    showPhone: o.show_phone,
    langs: o.languages,
    verified: o.verified,
    avatar: !!o.avatar_url,
    avatarUrl: o.avatar_url ?? undefined,
    photos: o.portfolio.map((x) => x.upload_id),
    photoUrls: o.portfolio.map((x) => x.url),
    accepting: o.accepting_orders,
    freeToday: o.available_today,
    notifyTasks: o.notify_new_tasks,
    notifyChat: o.notify_chat,
    channel: o.notify_channel === 'push' ? 'tg' : 'sms',
  };
}

function cityOf(name: string) {
  return ref.get()?.cities.find((c) => c.name.ru === name || c.name.tj === name || c.key === name);
}
function districtIds(city: string, areas: string[]) {
  const c = cityOf(city);
  const list = (c && ref.get()?.districts[c.key]) || [];
  return areas.flatMap((a) => list.filter((d) => d.name.ru === a || d.name.tj === a).map((d) => d.id));
}

function body(p: Omit<MasterProfileData, 'status'>) {
  const captions = new Map(last?.portfolio.map((x) => [x.upload_id, x.caption]) ?? []);
  return {
    professions: p.profs.flatMap((k) => {
      const c = ref.cat(k);
      return c ? [{ category_id: c.id, price_from: p.prices[k] ?? null, negotiable: p.prices[k] == null }] : [];
    }),
    city_id: cityOf(p.city)?.id ?? null,
    district_ids: districtIds(p.city, p.areas),
    works_online: p.online,
    experience: EXP[p.exp] ?? null,
    about: p.about || null,
    languages: (p.langs ?? ['ru', 'tj']).filter((l) => l === 'ru' || l === 'tj'),
    show_phone: p.showPhone,
    services: last?.services ?? [],
    portfolio: p.photos ? p.photos.map((id) => ({ upload_id: id, caption: captions.get(id) ?? null })) : null,
  };
}

const SETTINGS: Partial<Record<keyof MasterProfileData, string>> = {
  accepting: 'accepting_orders', freeToday: 'available_today', online: 'works_online', showPhone: 'show_phone', notifyTasks: 'notify_new_tasks', notifyChat: 'notify_chat',
};

export const realMasterProfile = {
  /** null — анкеты нет или это черновик: показываем онбординг */
  async load(): Promise<MasterProfileData | null> {
    try {
      const o = await http<Own>('/me/master-profile');
      return o.status === 'draft' && !o.professions.length ? (last = o, null) : toData(o);
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
  async submit(p: Omit<MasterProfileData, 'status'>) {
    await http<Own>('/me/master-profile', { method: 'PUT', body: body(p) });
    return toData(await http<Own>('/me/master-profile/submit', { method: 'POST', body: { agree: true } }));
  },
  async save(p: MasterProfileData) {
    return toData(await http<Own>('/me/master-profile', { method: 'PUT', body: body(p) }));
  },
  /** Переключатели настроек — PATCH /settings; профессии и тексты — полное сохранение */
  async patch(cur: MasterProfileData, x: Partial<MasterProfileData>) {
    const next = { ...cur, ...x };
    if (Object.keys(x).some((k) => ['profs', 'prices', 'about', 'exp', 'langs', 'photos', 'city'].includes(k))) return realMasterProfile.save(next);
    const b: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) if (SETTINGS[k as keyof MasterProfileData]) b[SETTINGS[k as keyof MasterProfileData]!] = v;
    if (x.areas) b.district_ids = districtIds(next.city, x.areas);
    if (x.channel) b.notify_channel = x.channel === 'tg' ? 'push' : 'sms';
    return toData(await http<Own>('/me/master-profile/settings', { method: 'PATCH', body: b }));
  },
  async setAvatar(file: Blob) {
    const fd = new FormData();
    fd.append('kind', 'avatar');
    fd.append('file', file);
    const u = await http<{ id: number }>('/uploads', { method: 'POST', form: fd });
    await http('/me/avatar', { method: 'PUT', body: { upload_id: u.id } });
  },
};
