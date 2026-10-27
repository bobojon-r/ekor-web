'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CircleAlert, Clock, EllipsisVertical, Flag, Info, Lock, MessageCircle, Paperclip, Phone, SendHorizontal, TriangleAlert, WifiOff } from 'lucide-react';
import { apiErrorText, loadChats, MAX_TRIES, newMsgId, saveChats, transmit, USE_API, type ChatRole, type Msg, type Thread } from '@/lib/api';
import { useRealChats } from './useRealChats';
import { initials, useDict, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { SiteHeader, TabBar } from '@/components/layout';
import { Button, EmptyState, RadioCard, Sheet, useToast } from '@/components/ui';
import { chatDict } from './i18n';
import s from './Chats.module.css';

type T = (typeof chatDict)['ru'];
const ST: Record<Thread['st'], [string, string]> = {
  chosen: ['var(--brand-100)', 'var(--brand-700)'], work: ['var(--success-100)', 'var(--success-700)'], wait: ['var(--warn-100)', 'var(--warn-800)'], done: ['var(--ink-900)', 'var(--white)'],
};
const AV: [string, string][] = [['var(--brand-100)', 'var(--brand-600)'], ['var(--success-100)', 'var(--success-700)'], ['var(--warn-100)', 'var(--warn-800)']];
/** Похоже на разговор об оплате или номер карты */
const RISKY = /предоплат|переве|карт[уы]|пешпардохт|корт|\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/i;
const now = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Чаты одной роли + очередь исходящих с автоповтором */
function useChats(role: ChatRole, t: T) {
  const [all, setAll] = useState<Record<ChatRole, Thread[]> | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const allRef = useRef(all);
  allRef.current = all;

  useEffect(() => {
    setAll(loadChats());
    setOnline(navigator.onLine);
  }, []);

  const mutate = useCallback(
    (fn: (list: Thread[]) => Thread[]) =>
      setAll((cur) => {
        if (!cur) return cur;
        const next = { ...cur, [role]: fn(cur[role]) };
        saveChats(next);
        return next;
      }),
    [role],
  );
  const patchMsg = useCallback(
    (tid: string, mid: string, p: Partial<Msg> | null) =>
      mutate((list) => list.map((c) => (c.id !== tid ? c : { ...c, msgs: c.msgs.map((m) => (m.id === mid ? ({ ...m, ...p } as Msg) : m)) }))),
    [mutate],
  );

  const deliver = useCallback(
    async (tid: string, mid: string, tries: number, reply: boolean) => {
      const ok = await transmit();
      if (ok) {
        patchMsg(tid, mid, { state: undefined, tries: undefined } as Partial<Msg>);
        if (reply) {
          setTimeout(() => setTyping(tid), 700);
          setTimeout(() => {
            setTyping(null);
            mutate((list) => list.map((c) => (c.id === tid ? { ...c, msgs: [...c.msgs, { id: newMsgId(), f: 'them', x: role === 'client' ? t.replyC : t.replyM, t: now() }] } : c)));
          }, 2000);
        }
        return;
      }
      const n = tries + 1;
      if (n >= MAX_TRIES) patchMsg(tid, mid, { state: 'failed', tries: n } as Partial<Msg>);
      else {
        patchMsg(tid, mid, { tries: n } as Partial<Msg>);
        setTimeout(() => deliver(tid, mid, n, reply), 2000);
      }
    },
    [patchMsg, mutate, role, t.replyC, t.replyM],
  );

  // сеть вернулась — отправляем всё, что ждёт в очереди
  useEffect(() => {
    const on = () => {
      setOnline(true);
      allRef.current?.[role].forEach((c) => c.msgs.forEach((m) => m.f === 'me' && m.state === 'sending' && deliver(c.id, m.id, 0, false)));
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [role, deliver]);

  const send = (tid: string, body: { x?: string; photo?: string; file?: Blob }) => {
    const mid = newMsgId();
    mutate((list) => list.map((c) => (c.id === tid ? { ...c, msgs: [...c.msgs, { id: mid, f: 'me', x: body.x, photo: body.photo, t: now(), state: 'sending', tries: 0 }] } : c)));
    deliver(tid, mid, 0, true);
  };
  const retry = (tid: string, mid: string) => {
    patchMsg(tid, mid, { state: 'sending', tries: 0 } as Partial<Msg>);
    deliver(tid, mid, 0, false);
  };
  const patchThread = (tid: string, fn: (c: Thread) => Partial<Thread>) => mutate((list) => list.map((c) => (c.id === tid ? { ...c, ...fn(c) } : c)));

  return { threads: all?.[role] ?? null, typing, online, send, retry, patchThread, orderAct: undefined, report: undefined, typingPing: undefined };
}

/** Моки или бэкенд — выбирается при сборке (NEXT_PUBLIC_API) */
const useChatsImpl = USE_API ? (role: ChatRole, _t: T, openId?: string, enabled?: boolean) => useRealChats(role, openId, enabled) : (role: ChatRole, t: T) => useChats(role, t);

export function ChatsView({ openId }: { openId?: string }) {
  const t = useDict(chatDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useSession();
  const role: ChatRole = user?.activeRole === 'master' ? 'master' : 'client';
  const { threads, typing, online, send, retry, patchThread, orderAct, report, typingPing } = useChatsImpl(role, t, openId, !!user);
  const typedAt = useRef(0);
  const [draft, setDraft] = useState('');
  const [rep, setRep] = useState<null | { id: string; reason: number | null; block: boolean; err: boolean }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${openId ? `/chats/${openId}` : '/chats'}`);
  }, [ready, user, router, openId]);

  const isM = role === 'master';
  const sel = threads?.find((c) => c.id === openId) ?? threads?.[0] ?? null;
  const tx = (v: string | { ru: string; tj: string }) => (typeof v === 'string' ? v : v[lang]);
  const stl = (c: Thread) => (isM && c.st === 'chosen' ? t.stChosenM : t.st[c.st]);
  const msgText = (m: Msg) => (m.f === 'sys' ? t.sys[m.k] : m.photo ? t.photo : (m.x ?? ''));

  // прочитано при открытии
  useEffect(() => {
    const visible = !!openId || window.matchMedia('(min-width: 1024px)').matches;
    if (sel && sel.unread && visible) patchThread(sel.id, () => ({ unread: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sel?.msgs.length, typing, sel?.id]);

  if (!threads) return <div className={s.page} />;

  const act = (c: Thread) => {
    if (orderAct && c.st !== 'done') {
      const kind = isM && c.st === 'chosen' ? 'start' : isM && c.st === 'work' ? 'done' : !isM && c.st === 'wait' ? 'confirm' : null;
      if (kind)
        orderAct(c, kind).then(
          () => toast(kind === 'start' ? t.tStarted : kind === 'done' ? t.tDone : t.tConfirmed),
          (e) => toast(apiErrorText(e, lang)),
        );
      return;
    }
    if (isM && c.st === 'chosen') {
      patchThread(c.id, (x) => ({ st: 'work', msgs: [...x.msgs, { id: newMsgId(), f: 'sys', k: 'started' }] }));
      toast(t.tStarted);
    } else if (isM && c.st === 'work') {
      patchThread(c.id, (x) => ({ st: 'wait', msgs: [...x.msgs, { id: newMsgId(), f: 'sys', k: 'markedDone' }] }));
      toast(t.tDone);
    } else if (!isM && c.st === 'wait') {
      patchThread(c.id, (x) => ({ st: 'done', msgs: [...x.msgs, { id: newMsgId(), f: 'sys', k: 'confirmed' }] }));
      toast(t.tConfirmed);
    } else if (!isM && c.st === 'done') router.push(c.href);
  };
  const actLabel = (c: Thread) => (isM && c.st === 'chosen' ? t.start : isM && c.st === 'work' ? t.doneBtn : !isM && c.st === 'wait' ? t.confirm : !isM && c.st === 'done' ? t.review : null);
  const sendDraft = (c: Thread, text?: string) => {
    const x = (text ?? draft).trim();
    if (!x) return;
    send(c.id, { x });
    if (text === undefined) setDraft('');
  };

  const list = (desktop: boolean) => (
    <div className={desktop ? s.dList : s.mList}>
      {threads.length === 0 && <EmptyState icon={<MessageCircle size={32} aria-hidden />} title={t.empty} text={t.emptyB} />}
      {threads.map((c, i) => {
        const last = c.msgs[c.msgs.length - 1];
        const on = desktop && sel?.id === c.id;
        return (
          <Link key={c.id} href={`/chats/${c.id}`} scroll={false} className={[s.item, on && s.itemOn].filter(Boolean).join(' ')}>
            <span className={s.av} style={{ background: AV[i % 3][0], color: AV[i % 3][1] }}>
              {initials(c.name)}
            </span>
            <span className={s.itemBody}>
              <span className={s.itemTop}>
                <span className={s.itemName}>{c.name}</span>
                <span className={s.muted13}>{last.f !== 'sys' ? tx(last.t) : ''}</span>
              </span>
              <span className={s.itemTask}>{c.task}</span>
              <span className={s.itemLastRow}>
                <span className={s.itemLast} style={{ color: c.unread ? 'var(--ink-900)' : 'var(--ink-500)', fontWeight: c.unread ? 600 : 400 }}>
                  {last.f === 'me' ? t.you : ''}
                  {msgText(last)}
                </span>
                {c.unread > 0 && <span className={s.unread}>{c.unread}</span>}
              </span>
              <span className={s.badge} style={{ background: ST[c.st][0], color: ST[c.st][1] }}>
                {stl(c)}
              </span>
            </span>
          </Link>
        );
      })}
      <div className={s.listHint}>
        <Lock size={16} aria-hidden className={s.noShrink} />
        <span>{t.listHint}</span>
      </div>
    </div>
  );

  const thread = (c: Thread, desktop: boolean) => {
    const label = actLabel(c);
    const open = c.st !== 'done' && !c.blocked && !c.readOnly;
    const idx = threads.indexOf(c);
    const quick = isM ? t.qM : t.qC;
    return (
      <div className={desktop ? s.dThread : s.mThread}>
        <div className={s.tHead}>
          {!desktop && (
            <button type="button" className={s.iconBtn} onClick={() => router.push('/chats')} aria-label="back">
              <ChevronLeft size={24} aria-hidden />
            </button>
          )}
          <span className={s.avSm} style={{ background: AV[idx % 3][0], color: AV[idx % 3][1] }}>
            {initials(c.name)}
          </span>
          <div className={s.tHeadText}>
            <span className={s.tName}>{c.name}</span>
            <span className={s.tSub}>
              {tx(c.prof)} · {c.task}
            </span>
          </div>
          <button type="button" className={s.iconBtn} aria-label={t.call} onClick={() => toast(t.callT, 'info')}>
            <Phone size={20} color="var(--brand-600)" aria-hidden />
          </button>
          <button type="button" className={s.iconBtn} aria-label={t.complain} onClick={() => setRep({ id: c.id, reason: null, block: false, err: false })}>
            <EllipsisVertical size={20} aria-hidden />
          </button>
        </div>
        <div className={s.tStatus}>
          <div className={s.tStatusRow}>
            <span className={s.badge} style={{ background: ST[c.st][0], color: ST[c.st][1] }}>
              {stl(c)}
            </span>
            <span className={s.tNext}>{(isM ? t.nextM : t.nextC)[c.st]}</span>
          </div>
          {label && (
            <div className={s.tActs}>
              <Button size="sm" className={s.flex1} onClick={() => act(c)}>
                {label}
              </Button>
              {!isM && c.st === 'wait' && (
                <Button variant="danger-outline" size="sm" onClick={() => router.push(c.href)}>
                  {t.problem}
                </Button>
              )}
            </div>
          )}
        </div>
        <div ref={scrollRef} className={s.msgs}>
          <div className={s.noPay}>
            <Info size={16} aria-hidden className={s.noShrink} />
            <span>{t.noPay}</span>
          </div>
          {c.msgs.map((m) =>
            m.f === 'sys' ? (
              <div key={m.id} className={s.sys}>
                {t.sys[m.k]}
              </div>
            ) : (
              <Bubble key={m.id} m={m} t={t} time={tx(m.t)} onRetry={() => retry(c.id, m.id)} />
            ),
          )}
          {typing === c.id && <div className={s.typing}>{t.typing}</div>}
        </div>
        <div className={s.composer}>
          {!online && (
            <div className={s.offline}>
              <WifiOff size={16} aria-hidden className={s.noShrink} />
              <span>{t.queued}</span>
            </div>
          )}
          {RISKY.test(draft) && (
            <div className={s.warn}>
              <TriangleAlert size={18} aria-hidden className={s.noShrink} />
              <span>{t.warn}</span>
            </div>
          )}
          {open ? (
            <>
              <div className={s.quick}>
                {quick.map((q) => (
                  <button key={q} type="button" className={s.quickBtn} onClick={() => sendDraft(c, q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className={s.inputRow}>
                <button type="button" className={s.iconBtn} aria-label="attach" onClick={() => fileRef.current?.click()}>
                  <Paperclip size={20} aria-hidden />
                </button>
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value.slice(0, 2000));
                    // «печатает…» собеседнику — не чаще раза в 3 с
                    if (typingPing && Date.now() - typedAt.current > 3000) {
                      typedAt.current = Date.now();
                      typingPing(c.id);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendDraft(c))}
                  placeholder={t.ph}
                  className={s.input}
                  enterKeyHint="send"
                />
                <button type="button" aria-label={t.sendL} className={s.sendBtn} style={{ background: draft.trim() ? 'var(--brand-600)' : 'var(--brand-300)' }} onClick={() => sendDraft(c)}>
                  <SendHorizontal size={20} color="#fff" aria-hidden />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) send(c.id, { photo: URL.createObjectURL(f), file: f });
                    e.target.value = '';
                  }}
                />
              </div>
            </>
          ) : (
            <div className={s.closed}>{c.blocked ? t.blocked : t.closed}</div>
          )}
        </div>
      </div>
    );
  };

  const order = (c: Thread) => (
    <aside className={s.order}>
      <span className={s.overline}>{t.orderCard}</span>
      <span className={s.orderTitle}>{c.task}</span>
      <span className={s.badge} style={{ background: ST[c.st][0], color: ST[c.st][1] }}>
        {stl(c)}
      </span>
      <div className={s.facts}>
        <Fact k={t.price} v={c.price} />
        <Fact k={t.when} v={tx(c.when)} />
        <Fact k={t.district} v={c.district} />
        {c.addr && c.st !== 'done' && <Fact k={t.addr} v={c.addr} />}
      </div>
      <Link href={c.href} className={s.orderBtn}>
        {t.openOrder}
      </Link>
      <button type="button" className={s.complain} onClick={() => setRep({ id: c.id, reason: null, block: false, err: false })}>
        <Flag size={16} aria-hidden />
        {t.complain}
      </button>
    </aside>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1360} />

      <div className="mob-only">
        {openId && sel ? (
          thread(sel, false)
        ) : (
          <>
            <div className={s.mHead}>
              <h1 className={s.mTitle}>{t.chats}</h1>
            </div>
            {list(false)}
            <TabBar chatBadge={threads.reduce((a, c) => a + c.unread, 0)} />
          </>
        )}
      </div>

      <div className={`${s.dWrap} desk-only`}>
        <div className={s.dCol}>
          <h1 className={s.dTitle}>{t.chats}</h1>
          {list(true)}
        </div>
        {sel ? thread(sel, true) : <div />}
        {sel ? order(sel) : <div />}
      </div>

      <Sheet open={!!rep} onClose={() => setRep(null)} width={480}>
        {rep && (
          <div className={s.rep}>
            <div className={s.repH}>{t.repH}</div>
            <div className={s.muted14}>{t.repSub}</div>
            {t.reasons.map((l, i) => (
              <RadioCard key={l} tone="danger" selected={rep.reason === i} onClick={() => setRep({ ...rep, reason: i, err: false })}>
                {l}
              </RadioCard>
            ))}
            <button type="button" role="checkbox" aria-checked={rep.block} className={s.blockRow} onClick={() => setRep({ ...rep, block: !rep.block })}>
              <span className={s.cb} style={{ borderColor: rep.block ? 'var(--danger-600)' : 'var(--checkbox-off)', background: rep.block ? 'var(--danger-600)' : 'var(--white)' }}>
                {rep.block && <span className={s.cbTick}>✓</span>}
              </span>
              {t.alsoBlock}
            </button>
            {rep.err && <span className={s.err}>{t.repErr}</span>}
            <Button
              variant="danger"
              size="lg"
              block
              onClick={() => {
                if (rep.reason === null) return setRep({ ...rep, err: true });
                if (report) {
                  report(rep.id, rep.reason, rep.block).then(
                    () => toast(rep.block ? t.tRepB : t.tRep),
                    (e) => toast(apiErrorText(e, lang)),
                  );
                  return setRep(null);
                }
                if (rep.block) patchThread(rep.id, () => ({ blocked: true }));
                toast(rep.block ? t.tRepB : t.tRep);
                setRep(null);
              }}
            >
              {t.repSend}
            </Button>
            <Button variant="secondary" size="md" block onClick={() => setRep(null)}>
              {t.cancel}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className={s.fact}>
      <span className={s.muted13}>{k}</span>
      <span className={s.factV}>{v}</span>
    </div>
  );
}

function Bubble({ m, t, time, onRetry }: { m: Extract<Msg, { f: 'me' | 'them' }>; t: T; time: string; onRetry: () => void }) {
  const me = m.f === 'me';
  if (m.state === 'failed')
    return (
      <div className={s.failedWrap}>
        <div className={s.failed}>{m.photo ? <img src={m.photo} alt="" className={s.photo} /> : m.x}</div>
        <button type="button" className={s.retry} onClick={onRetry}>
          <CircleAlert size={16} aria-hidden />
          {t.failed}
        </button>
      </div>
    );
  const sending = m.state === 'sending';
  return (
    <div className={[s.bubble, me ? s.me : s.them, sending && s.pending].filter(Boolean).join(' ')}>
      {m.photo ? m.photo.startsWith('blob:') || m.photo.startsWith('http') ? <img src={m.photo} alt="" className={s.photo} /> : <span className={s.photoPh}>{m.photo}</span> : <span className={s.text}>{m.x}</span>}
      <span className={s.time}>
        {sending ? (
          <>
            <Clock size={12} aria-hidden />
            {t.sending}
          </>
        ) : (
          <>
            {time}
            {me && ' ✓✓'}
          </>
        )}
      </span>
    </div>
  );
}
