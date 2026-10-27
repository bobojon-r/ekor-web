/** Приглашения «Предложить работу» с бэкенда: клиент видит отправленные, мастер — полученные */
import { http } from '../http';
import { ref } from '../ref';
import { cacheMasterBrief, cityKey, l10n, nm, WHEN, type TaskPublicOut } from '../remote';
import type { Invite, InviteStatus } from '../invites';
import { digits, reasonId } from './common';

type InviteOut = {
  id: number; status: 'sent' | 'accepted' | 'declined' | 'confirmed' | 'cancelled' | 'expired'; role: 'client' | 'master'; created_at: string;
  task: TaskPublicOut & { address: string | null; client_phone: string | null };
  master: Parameters<typeof cacheMasterBrief>[0]; client_name: string; price: number | null; inspect: boolean;
  when: 'as_requested' | 'tomorrow' | 'in_chat' | null; message: string | null; decline_reason: { code: string } | null; order_id: number | null;
};

const OFFER_WHEN = ['as_requested', 'tomorrow', 'in_chat'] as const;
const DECLINE = ['busy', 'far', 'not_my_profile', 'budget'];

function toInvite(x: InviteOut): Invite {
  cacheMasterBrief(x.master);
  const k = x.task;
  const st: InviteStatus = x.status === 'expired' ? 'cancelled' : k.status === 'open' && x.status !== 'confirmed' ? 'public' : x.status;
  return {
    id: x.id,
    masterId: x.master.id,
    clientName: x.client_name,
    title: k.title,
    desc: k.description ?? '',
    when: WHEN[k.when],
    budget: k.budget_mode === 'sum' ? (k.budget_max ?? k.budget_min) : null,
    region: cityKey(k.city) ?? 'dushanbe',
    district: nm(k.district),
    category: l10n(k.subcategory ?? k.category),
    status: st,
    createdAt: x.created_at,
    contacts: x.status === 'confirmed' && (k.address || k.client_phone) ? { address: k.address ?? '', phone: digits(k.client_phone) } : null,
    offer: x.status !== 'sent' && x.message !== null ? { price: x.inspect ? null : x.price, when: Math.max(0, OFFER_WHEN.indexOf(x.when ?? 'as_requested')), msg: x.message } : undefined,
    declineReason: x.decline_reason ? Math.max(0, DECLINE.indexOf(x.decline_reason.code)) : undefined,
  };
}

const one = (p: Promise<InviteOut>) => p.then(toInvite);

export const realInvites = {
  /** Роль — по текущему экрану: кабинет мастера или клиента */
  list: async (role: 'client' | 'master' = 'client') => (await http<{ items: InviteOut[] }>('/me/invites', { query: { role, limit: 50 } })).items.map(toInvite),
  get: async (id: number) => {
    try {
      return await one(http<InviteOut>(`/invites/${id}`));
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
  async create(d: Omit<Invite, 'id' | 'status' | 'createdAt' | 'contacts'> & { categoryKey?: string }) {
    const cat = ref.cat(d.categoryKey) ?? ref.allCats().find((c) => c.name.ru === d.category.ru) ?? ref.cat('other');
    const parent = cat?.parentId ? ref.catById(cat.parentId) : cat;
    const district = ref.get()?.districts[d.region]?.find((x) => x.name.ru === d.district || x.name.tj === d.district);
    return one(
      http<InviteOut>('/invites', {
        method: 'POST',
        body: {
          master_id: d.masterId,
          task: {
            category_id: parent?.id, subcategory_id: cat?.parentId ? cat.id : null, title: d.title, description: d.desc, photo_ids: [], mode: 'site',
            city_id: ref.city(d.region)?.id ?? null, district_id: district?.id ?? null, address: null,
            when: (['today', 'tomorrow', 'week', 'flexible'] as const)[d.when] ?? 'flexible', date: null, time_of_day: null,
            budget_mode: d.budget === null ? 'negotiable' : 'sum', budget_min: null, budget_max: d.budget,
          },
        },
      }),
    );
  },
  accept: (id: number, o: NonNullable<Invite['offer']>) =>
    one(http(`/invites/${id}/accept`, { method: 'POST', body: { price: o.price, inspect: o.price === null, when: OFFER_WHEN[o.when] ?? 'as_requested', message: o.msg } })),
  decline: async (id: number, reason: number) => one(http(`/invites/${id}/decline`, { method: 'POST', body: { reason_id: await reasonId('invite_decline', reason), comment: null } })),
  confirm: async (id: number) => (await http(`/invites/${id}/confirm`, { method: 'POST' }), realInvites.get(id)),
  /** «Сделать публичным» — действие над заданием приглашения */
  makePublic: async (id: number) => {
    const inv = await http<InviteOut>(`/invites/${id}`);
    await http(`/tasks/${inv.task.id}/make-public`, { method: 'POST' });
    return realInvites.get(id);
  },
  cancel: (id: number) => one(http(`/invites/${id}/cancel`, { method: 'POST' })),
};
