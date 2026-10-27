'use client';

/**
 * Чаты с бэкенда: список GET /chats, сообщения по открытому чату, отправка через REST
 * с client_msg_id (повтор не создаёт дубль), входящие — по WebSocket.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { http, MAX_TRIES, realtime, reasonId, uiLang, uploadPhoto, type ChatRole, type Msg, type SysKey, type Thread } from '@/lib/api';

type MessageOut = { id: number; type: 'text' | 'photo' | 'system'; mine: boolean; body: string | null; system_code: string | null; photo_url: string | null; client_msg_id: string | null; created_at: string };
type ChatItem = {
  id: number; order_id: number | null; role: ChatRole; counterpart: { name: string; subtitle_ru: string; subtitle_tj: string }; task_title: string; order_status: string | null;
  price: number | null; inspect: boolean; term: string | null; district_ru: string | null; district_tj: string | null; address: string | null; unread_count: number;
  last_message: MessageOut | null; read_only: boolean; blocked: boolean;
};

const ST: Record<string, Thread['st']> = { chosen: 'chosen', work: 'work', wait: 'wait', dispute: 'wait', done: 'done', cancelled: 'done', declined: 'done' };
const TERM: Record<string, { ru: string; tj: string }> = {
  today: { ru: 'Сегодня', tj: 'Имрӯз' }, tomorrow: { ru: 'Завтра', tj: 'Фардо' }, '2_3_days': { ru: 'За 2–3 дня', tj: 'Дар 2–3 рӯз' }, discuss: { ru: 'Обсудим', tj: 'Гуфтугӯ мекунем' },
};
const SYS = (code: string, role: ChatRole): SysKey =>
  (({ chosen: role === 'client' ? 'chosenC' : 'chosenM', started: 'started', marked_done: 'markedDone', confirmed: 'confirmed', cancelled_by_client: 'cancelledC', declined_by_master: 'declinedM', dispute_opened: 'dispute', dispute_done: 'disputeDone', dispute_not_done: 'disputeNotDone', dispute_partial: 'disputePartial' }) as Record<string, SysKey>)[code] ?? 'started';

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const toMsg = (m: MessageOut, role: ChatRole): Msg =>
  m.type === 'system' ? { id: String(m.id), f: 'sys', k: SYS(m.system_code ?? '', role) } : { id: String(m.id), f: m.mine ? 'me' : 'them', x: m.body ?? undefined, photo: m.photo_url ?? undefined, t: hhmm(m.created_at) };

function toThread(c: ChatItem, msgs: Msg[] | undefined): Thread {
  const lang = uiLang();
  return {
    id: String(c.id), name: c.counterpart.name, prof: { ru: c.counterpart.subtitle_ru, tj: c.counterpart.subtitle_tj }, task: c.task_title, st: ST[c.order_status ?? 'chosen'] ?? 'chosen',
    unread: c.unread_count, price: c.inspect ? (lang === 'tj' ? 'Пас аз дидан' : 'После осмотра') : c.price ? `${c.price} смн` : '—',
    when: TERM[c.term ?? ''] ?? { ru: '—', tj: '—' }, district: (lang === 'tj' ? c.district_tj : c.district_ru) ?? '', addr: c.address ?? '',
    href: c.role === 'client' ? '/client' : '/master/orders', blocked: c.blocked, readOnly: c.read_only, orderId: c.order_id ?? undefined,
    msgs: msgs ?? (c.last_message ? [toMsg(c.last_message, c.role)] : []),
  };
}

export function useRealChats(role: ChatRole, openId?: string, enabled = true) {
  const [items, setItems] = useState<ChatItem[] | null>(null);
  const [msgs, setMsgs] = useState<Record<string, Msg[]>>({});
  const [typing, setTyping] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const out = useRef<Record<string, { tid: string; body: { x?: string; file?: Blob } }>>({});
  const typingT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadList = useCallback(() => http<{ items: ChatItem[] }>('/chats').then((r) => setItems(r.items), () => setItems((x) => x ?? [])), []);
  const loadMsgs = useCallback(
    (tid: string) =>
      http<{ items: MessageOut[] }>(`/chats/${tid}/messages`, { query: { limit: 50 } }).then(
        (r) => setMsgs((m) => ({ ...m, [tid]: [...r.items].sort((a, b) => a.id - b.id).map((x) => toMsg(x, role)).concat((m[tid] ?? []).filter((x) => x.f === 'me' && x.state)) })),
        () => {},
      ),
    [role],
  );

  useEffect(() => {
    if (enabled) loadList();
    setOnline(navigator.onLine);
  }, [loadList, enabled]);

  const threads = items?.filter((c) => c.role === role).map((c) => toThread(c, msgs[String(c.id)])) ?? null;
  const selId = openId ?? threads?.[0]?.id;
  useEffect(() => {
    if (selId && enabled) loadMsgs(selId);
  }, [selId, loadMsgs, enabled]);

  // Входящие по WebSocket; после переподключения — перезапрос
  const selRef = useRef(selId);
  selRef.current = selId;
  useEffect(
    () =>
      realtime.on((e) => {
        if (e.type === 'reconnected') return void (loadList(), selRef.current && loadMsgs(selRef.current));
        if (!('chat_id' in e)) return;
        const tid = String(e.chat_id);
        if (e.type === 'chat.typing') {
          setTyping(tid);
          clearTimeout(typingT.current);
          typingT.current = setTimeout(() => setTyping(null), 4000);
        } else if (e.type === 'chat.message') {
          setTyping(null);
          const m = toMsg(e.message as unknown as MessageOut, role);
          setMsgs((all) => (all[tid] ? { ...all, [tid]: all[tid].some((x) => x.id === m.id) ? all[tid] : [...all[tid], m] } : all));
          setItems((l) => l?.map((c) => (String(c.id) === tid ? { ...c, last_message: e.message as unknown as MessageOut, unread_count: tid === selRef.current ? 0 : c.unread_count + 1 } : c)) ?? l);
          if (tid === selRef.current) http(`/chats/${tid}/read`, { method: 'POST', body: { up_to_id: +m.id } }).catch(() => {});
        } else if (e.type === 'chat.system') {
          loadList();
          loadMsgs(tid);
        }
      }),
    [role, loadList, loadMsgs],
  );

  const patchMsg = (tid: string, mid: string, p: Partial<Msg> | ((m: Msg) => Msg)) =>
    setMsgs((all) => ({ ...all, [tid]: (all[tid] ?? []).map((m) => (m.id === mid ? (typeof p === 'function' ? p(m) : ({ ...m, ...p } as Msg)) : m)) }));

  const deliver = async (mid: string, tries: number) => {
    const job = out.current[mid];
    if (!job) return;
    try {
      const photo = job.body.file ? await uploadPhoto('chat_photo', job.body.file) : null;
      const r = await http<MessageOut>(`/chats/${job.tid}/messages`, { method: 'POST', body: { client_msg_id: mid, body: job.body.x ?? null, photo_id: photo?.id ?? null } });
      delete out.current[mid];
      patchMsg(job.tid, mid, () => toMsg(r, role));
    } catch {
      const n = tries + 1;
      if (n >= MAX_TRIES || !navigator.onLine) patchMsg(job.tid, mid, { state: navigator.onLine ? 'failed' : 'sending', tries: n } as Partial<Msg>);
      else setTimeout(() => deliver(mid, n), 2000);
    }
  };

  // Сеть вернулась — досылаем очередь
  useEffect(() => {
    const on = () => {
      setOnline(true);
      Object.keys(out.current).forEach((mid) => deliver(mid, 0));
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  });

  const send = (tid: string, body: { x?: string; photo?: string; file?: Blob }) => {
    const mid = crypto.randomUUID();
    out.current[mid] = { tid, body: { x: body.x, file: body.file } };
    setMsgs((all) => ({ ...all, [tid]: [...(all[tid] ?? []), { id: mid, f: 'me', x: body.x, photo: body.photo, t: hhmm(new Date().toISOString()), state: 'sending', tries: 0 }] }));
    deliver(mid, 0);
  };
  const retry = (tid: string, mid: string) => {
    patchMsg(tid, mid, { state: 'sending', tries: 0 } as Partial<Msg>);
    deliver(mid, 0);
  };
  /** Прочтение и блокировка — на сервере, остальное в чатах меняется через заказ */
  const patchThread = (tid: string, fn: (c: Thread) => Partial<Thread>) => {
    const cur = threads?.find((c) => c.id === tid);
    if (!cur) return;
    const p = fn(cur);
    if (p.unread === 0) {
      const last = [...(msgs[tid] ?? [])].reverse().find((m) => /^\d+$/.test(m.id));
      http(`/chats/${tid}/read`, { method: 'POST', body: { up_to_id: last ? +last.id : null } }).catch(() => {});
      setItems((l) => l?.map((c) => (String(c.id) === tid ? { ...c, unread_count: 0 } : c)) ?? l);
    }
  };
  const orderAct = async (c: Thread, kind: 'start' | 'done' | 'confirm') => {
    await http(`/orders/${c.orderId}/${kind}`, { method: 'POST' });
    await Promise.all([loadList(), loadMsgs(c.id)]);
  };
  const report = async (tid: string, reason: number, block: boolean) => {
    await http(`/chats/${tid}/report`, { method: 'POST', body: { reason_id: await reasonId('chat_report', reason), comment: null, block } });
    if (block) loadList();
  };
  const typingPing = (tid: string) => realtime.typing(+tid);

  return { threads, typing, online, send, retry, patchThread, orderAct, report, typingPing };
}
