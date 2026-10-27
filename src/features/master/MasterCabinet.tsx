'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Briefcase, ChevronRight, CircleCheck, CircleMinus, ClipboardList, Clock, Info, LockOpen, Mail, MessageCircle, Phone, Send, Settings, Star,
} from 'lucide-react';
import {
  api, apiErrorText, invites, masterCabinet, proposals, type Invite, type MasterOrder, type MasterProp, type MasterReview, type OrderStatus, type PropStatus,
} from '@/lib/api';
import { initials, num, phoneMask, useDict, useLang } from '@/lib/i18n';
import { useRequireMaster } from '@/lib/session/SessionProvider';
import { SideNav, SiteHeader, TabBar, type SideItem } from '@/components/layout';
import { Button, LangSwitch, RadioCard, Sheet, useToast } from '@/components/ui';
import { masterDict } from './i18n';
import s from './Master.module.css';

type T = (typeof masterDict)['ru'];
export type MasterTab = 'props' | 'orders' | 'reviews';
type Modal = null | { type: 'done' | 'decline'; id: number } | { type: 'withdraw'; prop: MasterProp };

const OST: Record<OrderStatus, [string, string]> = {
  chosen: ['var(--brand-100)', 'var(--brand-700)'], work: ['var(--success-100)', 'var(--success-700)'], wait: ['var(--warn-100)', 'var(--warn-800)'],
  done: ['var(--ink-900)', 'var(--white)'], cancelled: ['var(--surface-50)', 'var(--ink-400)'],
};
const PST: Record<PropStatus, [string, string]> = {
  sent: ['var(--line-100)', 'var(--ink-700)'], viewed: ['var(--success-100)', 'var(--success-700)'], rejected: ['var(--surface-50)', 'var(--ink-400)'], withdrawn: ['var(--surface-50)', 'var(--ink-400)'],
};
const ROUTE: Record<MasterTab, string> = { props: '/master/responses', orders: '/master/orders', reviews: '/master/reviews' };

/** Отклики из ленты заданий (proposals) показываем вместе с историей кабинета */
function feedProps(lang: 'ru' | 'tj'): MasterProp[] {
  const st = proposals.state();
  return Object.entries(st.sent).flatMap(([id, p]) => {
    const k = api.feedTaskSync(+id);
    if (!k) return [];
    const when = ['Сегодня', 'Завтра', 'За 2–3 дня', 'Обсудим'];
    const whenTj = ['Имрӯз', 'Фардо', 'Дар 2–3 рӯз', 'Гуфтугӯ мекунем'];
    return [{ id: 1000 + k.id, taskId: k.id, title: k.title, district: k.district ?? (lang === 'tj' ? 'Онлайн' : 'Онлайн'), when: { ru: when[p.term], tj: whenTj[p.term] }, price: p.price, msg: p.msg, status: 'sent' as const, ago: { ru: 'сегодня', tj: 'имрӯз' }, responses: k.responses + 1 }];
  });
}

export function masterSideItems(t: T, counts: number[], inviteCount: number): SideItem[] {
  return [
    { href: '/tasks', label: t.feed, icon: ClipboardList },
    { href: '/master/invites', label: t.invites, icon: Mail, count: inviteCount },
    { href: ROUTE.props, label: t.side[0], icon: Send, count: counts[0] },
    { href: ROUTE.orders, label: t.side[1], icon: Briefcase, count: counts[1] },
    { href: ROUTE.reviews, label: t.side[2], icon: Star, count: counts[2] },
    { href: '/master/settings', label: t.settings, icon: Settings },
  ];
}

export function MasterCabinet({ tab }: { tab: MasterTab }) {
  const t = useDict(masterDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const allowed = useRequireMaster(ROUTE[tab]);
  const [data, setData] = useState<{ orders: MasterOrder[]; props: MasterProp[]; reviews: MasterReview[] } | null>(null);
  const [feed, setFeed] = useState<MasterProp[]>([]);
  const [newInvites, setNewInvites] = useState<Invite[]>([]);
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => {
    masterCabinet.load().then(setData);
    invites.list('master').then((l) => setNewInvites(l.filter((x) => x.status === 'sent')));
    setFeed(feedProps(lang));
  }, [lang]);

  if (!allowed) return <div className={s.page} />;
  const orders = data?.orders ?? [];
  const props = [...feed, ...(data?.props ?? [])];
  const reviews = data?.reviews ?? [];
  const counts = [
    props.filter((p) => p.status === 'sent' || p.status === 'viewed').length,
    orders.filter((o) => o.status !== 'done' && o.status !== 'cancelled').length,
    reviews.filter((r) => !r.reply).length,
  ];
  const tabs: MasterTab[] = ['props', 'orders', 'reviews'];
  const ti = tabs.indexOf(tab);

  const run = async (p: Promise<{ orders: MasterOrder[]; props: MasterProp[]; reviews: MasterReview[] }>, msg?: string) => {
    try {
      setData(await p);
      if (msg) toast(msg);
    } catch (e) {
      toast(apiErrorText(e, lang));
    }
  };

  const content = (desktop: boolean) => (
    <>
      {tab === 'orders' && (
        <>
          {newInvites[0] && (
            <Link href={`/master/invites/${newInvites[0].id}`} className={s.invBanner}>
              <Mail size={22} color="var(--brand-600)" aria-hidden className={s.noShrink} />
              <span className={s.invText}>
                <span className={s.invT}>{t.invBannerT}</span>
                <span className={s.invB}>
                  {newInvites[0].clientName} · «{newInvites[0].title}» · {lang === 'tj' ? 'дар давоми 24 соат ҷавоб диҳед' : 'ответьте в течение 24 часов'}
                </span>
              </span>
              <ChevronRight size={20} color="var(--ink-500)" aria-hidden />
            </Link>
          )}
          <div className={desktop ? s.grid2 : s.col}>
            {!data && [1, 2, 3].map((i) => <div key={i} className={s.sk} />)}
            {orders.map((o) => (
              <OrderCard key={o.id} o={o} t={t} lang={lang} desktop={desktop} onStart={() => run(masterCabinet.start(o.id), t.tStart)} onDone={() => setModal({ type: 'done', id: o.id })} onDecline={() => setModal({ type: 'decline', id: o.id })} onRemind={() => run(masterCabinet.remind(o.id), t.tRemind)} onReview={() => router.push(ROUTE.reviews)} />
            ))}
          </div>
          <div className={s.noPay}>
            <Info size={18} aria-hidden className={s.noShrink} />
            <span>{t.noPay}</span>
          </div>
        </>
      )}
      {tab === 'props' && (
        <div className={desktop ? s.grid2 : s.col}>
          {!data && [1, 2].map((i) => <div key={i} className={s.sk} />)}
          {props.map((p) => (
            <PropCard
              key={p.id}
              p={p}
              t={t}
              lang={lang}
              onSave={async (price, msg) => {
                if (p.taskId) {
                  await proposals.send(p.taskId, { price, term: 1, msg });
                  setFeed(feedProps(lang));
                  toast(t.tEdited);
                } else run(masterCabinet.editProp(p.id, price, msg), t.tEdited);
              }}
              onWithdraw={() => setModal({ type: 'withdraw', prop: p })}
            />
          ))}
        </div>
      )}
      {tab === 'reviews' && (
        <div className={s.col}>
          <div className={s.ratingCard}>
            <div className={s.ratingRow}>
              <span className={s.ratingNum}>4,8</span>
              <div className={s.ratingSide}>
                <span className={s.ratingStars}>★★★★★</span>
                <span className={s.muted14}>{t.ratingN}</span>
              </div>
            </div>
            <div className={s.rule}>{t.rule}</div>
          </div>
          <div className={desktop ? s.grid2 : s.col}>
            {reviews.map((r) => (
              <ReviewCard key={r.id} r={r} t={t} onReply={(text) => run(masterCabinet.reply(r.id, text), t.tReply)} onComplain={() => toast(lang === 'tj' ? 'Шикоят ба модератор фиристода шуд' : 'Жалоба отправлена модератору', 'info')} />
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1280} />

      <div className="mob-only">
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <h1 className={s.mTitle}>{t.title}</h1>
            <LangSwitch />
          </div>
          <div className={s.tabs} role="tablist">
            {tabs.map((k, i) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => router.replace(ROUTE[k], { scroll: false })} className={[s.tab, tab === k && s.tabOn].filter(Boolean).join(' ')}>
                {t.tabs[i]}
                {counts[i] > 0 && <span className={s.tabCount}>{counts[i]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className={s.mBody}>{content(false)}</div>
        <TabBar />
      </div>

      <div className={`${s.dWrap} desk-only`}>
        <SideNav items={masterSideItems(t, counts, newInvites.length)} />
        <div className={s.dMain}>
          <div className={s.dHead}>
            <h1 className={s.dTitle}>{t.tabs[ti]}</h1>
            <span className={s.muted15}>{t.sub[tab]}</span>
          </div>
          {content(true)}
        </div>
      </div>

      {modal && (
        <ActionModal
          modal={modal}
          t={t}
          orders={orders}
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            const m = modal;
            if (m.type !== 'withdraw') {
              if (m.type === 'done') await run(masterCabinet.done(m.id), t.tDone);
              else await run(masterCabinet.decline(m.id, reason!), t.tDecl);
            } else if (m.prop.taskId) {
              await proposals.withdraw(m.prop.taskId);
              setFeed(feedProps(lang));
              toast(t.tWd);
            } else await run(masterCabinet.withdraw(m.prop.id), t.tWd);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function OrderCard({ o, t, lang, desktop, onStart, onDone, onDecline, onRemind, onReview }: { o: MasterOrder; t: T; lang: 'ru' | 'tj'; desktop: boolean; onStart: () => void; onDone: () => void; onDecline: () => void; onRemind: () => void; onReview: () => void }) {
  const unlocked = (o.status === 'chosen' || o.status === 'work') && !!o.contacts;
  const label = o.status === 'cancelled' ? t.ostC : t.ost[o.status];
  const next = o.status === 'cancelled' ? t.onextC : t.onext[o.status];
  const NextI = o.status === 'cancelled' ? CircleMinus : o.status === 'done' ? CircleCheck : o.status === 'wait' ? Clock : ArrowRight;
  const nextColor = o.status === 'wait' ? 'var(--warn-800)' : o.status === 'done' ? 'var(--success-700)' : o.status === 'cancelled' ? 'var(--ink-500)' : 'var(--brand-600)';
  const primary = o.status === 'chosen' ? { label: t.start, fn: onStart } : o.status === 'work' ? { label: t.doneBtn, fn: onDone } : null;
  const secondary = o.status === 'wait' ? { label: t.remind, fn: onRemind } : o.status === 'done' ? { label: t.seeReview, fn: onReview } : null;
  return (
    <div className={s.card} style={{ borderColor: o.status === 'chosen' ? 'var(--brand-300)' : undefined, opacity: o.status === 'cancelled' ? 0.75 : 1 }}>
      <div className={s.cardTop}>
        <span className={s.badge} style={{ background: OST[o.status][0], color: OST[o.status][1] }}>
          {label}
        </span>
        <span className={s.grow} />
        <span className={s.muted13}>{o.when[lang]}</span>
      </div>
      <div className={desktop ? s.titleD : s.titleM}>{o.title}</div>
      <div className={s.meta}>
        {o.client} · {o.district} · {num(o.price)} {t.cur}
      </div>
      <div className={s.next} style={{ color: o.status === 'done' || o.status === 'cancelled' ? 'var(--ink-500)' : 'var(--ink-900)' }}>
        <NextI size={18} color={nextColor} aria-hidden className={s.noShrink} />
        <span>{next}</span>
      </div>
      {unlocked && (
        <div className={s.contacts}>
          <span className={s.contactsNote}>
            <LockOpen size={16} aria-hidden />
            {t.addrNote}
          </span>
          <span className={s.addr}>{o.contacts!.address}</span>
          <a href={`tel:+992${o.contacts!.phone}`} className={s.phone}>
            +992 {phoneMask(o.contacts!.phone)}
          </a>
        </div>
      )}
      {o.status !== 'cancelled' && (
        <div className={desktop ? s.actsD : s.actsM}>
          {primary && (
            <Button size={desktop ? 'sm' : 'md'} className={desktop ? undefined : s.full} onClick={primary.fn}>
              {primary.label}
            </Button>
          )}
          {unlocked && !desktop && (
            <a href={`tel:+992${o.contacts!.phone}`} className={s.secBtn}>
              <Phone size={18} color="var(--brand-600)" aria-hidden />
              {t.call}
            </a>
          )}
          <Link href={o.chatId ? `/chats/${o.chatId}` : '/chats'} className={s.secBtn}>
            <MessageCircle size={18} color="var(--brand-600)" aria-hidden />
            {t.chat}
          </Link>
          {secondary && (
            <button type="button" className={s.secBtn} onClick={secondary.fn}>
              {secondary.label}
            </button>
          )}
          {unlocked && (
            <button type="button" className={desktop ? s.declD : s.declM} onClick={onDecline}>
              {t.decline}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PropCard({ p, t, lang, onSave, onWithdraw }: { p: MasterProp; t: T; lang: 'ru' | 'tj'; onSave: (price: number | null, msg: string) => Promise<void>; onWithdraw: () => void }) {
  const [edit, setEdit] = useState<null | { price: string; inspect: boolean; msg: string; err: '' | 'price' | 'msg' }>(null);
  const active = p.status === 'sent' || p.status === 'viewed';
  const label = t.pst[p.status];
  const save = async () => {
    if (!edit) return;
    if (!edit.inspect && !(+edit.price > 0)) return setEdit({ ...edit, err: 'price' });
    if (edit.msg.trim().length < 20) return setEdit({ ...edit, err: 'msg' });
    await onSave(edit.inspect ? null : +edit.price, edit.msg.trim());
    setEdit(null);
  };
  return (
    <div className={s.card} style={{ opacity: active ? 1 : 0.7 }}>
      <div className={s.cardTop}>
        <span className={s.badge} style={{ background: PST[p.status][0], color: PST[p.status][1] }}>
          {label}
        </span>
        {p.edited && <span className={s.muted13}>{lang === 'tj' ? 'тағйир дода шуд' : 'изменено'}</span>}
        <span className={s.grow} />
        <span className={s.muted13}>{p.ago[lang]}</span>
      </div>
      {p.taskId ? (
        <Link href={`/tasks/${p.taskId}`} className={s.titleLink}>
          {p.title}
        </Link>
      ) : (
        <div className={s.titleM}>{p.title}</div>
      )}
      <div className={s.meta}>
        {p.district} · {p.when[lang]} · {t.respN(p.responses)}
      </div>
      <div className={s.priceRow}>
        <span className={s.muted14}>{t.yourPrice}</span>
        <b>{p.price === null ? t.afterInspect : `${num(p.price)} ${t.cur}`}</b>
      </div>
      <div className={s.msg}>«{p.msg}»</div>
      <div className={s.pnext} style={{ color: p.status === 'viewed' ? 'var(--success-700)' : 'var(--ink-500)' }}>
        {t.pnext[p.status]}
      </div>
      {edit && (
        <div className={s.editBox}>
          <div className={s.editRow}>
            <label className={[s.editPrice, edit.inspect && s.off, edit.err === 'price' && s.invalid].filter(Boolean).join(' ')}>
              <input value={edit.inspect ? '' : edit.price} disabled={edit.inspect} inputMode="numeric" placeholder={t.yourPrice} onChange={(e) => setEdit({ ...edit, price: e.target.value.replace(/\D/g, '').slice(0, 5), err: '' })} className={s.editInput} />
              <span className={s.muted14}>смн</span>
            </label>
            <button type="button" aria-pressed={edit.inspect} onClick={() => setEdit({ ...edit, inspect: !edit.inspect, err: '' })} className={[s.inspect, edit.inspect && s.on].filter(Boolean).join(' ')}>
              {t.afterInspect}
            </button>
          </div>
          <textarea value={edit.msg} rows={3} onChange={(e) => setEdit({ ...edit, msg: e.target.value.slice(0, 1000), err: '' })} className={[s.textarea, edit.err === 'msg' && s.invalid].filter(Boolean).join(' ')} />
          {edit.err && <span className={s.err}>{edit.err === 'msg' ? t.errEMsg : t.errEPrice}</span>}
          <div className={s.row}>
            <Button variant="secondary" size="sm" className={s.flex1} onClick={() => setEdit(null)}>
              {t.cancel}
            </Button>
            <Button size="sm" className={s.flex1} onClick={save}>
              {t.saveE}
            </Button>
          </div>
          <span className={s.note}>{t.editNote}</span>
        </div>
      )}
      {active && !edit && (
        <div className={s.row}>
          <Button variant="secondary" size="sm" className={s.flex1} onClick={() => setEdit({ price: p.price === null ? '' : String(p.price), inspect: p.price === null, msg: p.msg, err: '' })}>
            {t.edit}
          </Button>
          <Button variant="danger-outline" size="sm" className={s.flex1} onClick={onWithdraw}>
            {t.withdraw}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ r, t, onReply, onComplain }: { r: MasterReview; t: T; onReply: (text: string) => Promise<void>; onComplain: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState(false);
  return (
    <div className={s.card}>
      <div className={s.revHead}>
        <span className={s.revAv}>{initials(r.name)}</span>
        <div className={s.revWho}>
          <span className={s.revName}>{r.name}</span>
          <span className={s.muted13}>{r.date}</span>
        </div>
        <span className={s.revStars}>{'★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)}</span>
      </div>
      <div className={s.muted13}>
        {t.order}: {r.task}
      </div>
      <div className={s.revText}>{r.text}</div>
      {r.reply && (
        <div className={s.reply}>
          <span className={s.replyT}>{t.yourReply}</span>
          <span className={s.replyText}>{r.reply}</span>
        </div>
      )}
      {open && (
        <div className={s.replyForm}>
          <textarea value={text} rows={3} placeholder={t.replyPh} onChange={(e) => (setText(e.target.value.slice(0, 500)), setErr(false))} className={[s.textarea, err && s.invalid].filter(Boolean).join(' ')} />
          <div className={s.msgRow}>
            <span className={s.err}>{err ? t.errReply : ''}</span>
            <span className={s.muted13}>{text.trim().length} / 500</span>
          </div>
          <div className={s.row}>
            <Button variant="secondary" size="sm" className={s.flex1} onClick={() => setOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              size="sm"
              className={s.flex1}
              onClick={async () => {
                if (text.trim().length < 10) return setErr(true);
                await onReply(text.trim());
                setOpen(false);
              }}
            >
              {t.publish}
            </Button>
          </div>
        </div>
      )}
      {!r.reply && !open && (
        <div className={s.row}>
          <Button variant="secondary" size="xs" onClick={() => setOpen(true)}>
            {t.reply}
          </Button>
          <button type="button" className={s.complain} onClick={onComplain}>
            {t.complain}
          </button>
        </div>
      )}
    </div>
  );
}

function ActionModal({ modal, t, orders, onClose, onConfirm }: { modal: NonNullable<Modal>; t: T; orders: MasterOrder[]; onClose: () => void; onConfirm: (reason: number | null) => Promise<void> }) {
  const [reason, setReason] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDecl = modal.type === 'decline';
  const isDone = modal.type === 'done';
  const title = modal.type === 'withdraw' ? modal.prop.title : orders.find((o) => o.id === modal.id)?.title ?? '';
  const bullets = isDecl ? t.mDeclB : isDone ? t.mDoneB : t.mWdB;
  return (
    <Sheet open onClose={onClose} width={480}>
      <div className={s.modal}>
        <div className={s.modalH}>{isDecl ? t.mDeclH : isDone ? t.mDoneH : t.mWdH}</div>
        <div className={s.muted15}>{title}</div>
        <div className={s.bullets}>
          {bullets.map((b) => (
            <div key={b} className={s.bullet}>
              <span className={s.dot} />
              <span>{b}</span>
            </div>
          ))}
        </div>
        {isDecl && (
          <div className={s.reasons}>
            <span className={s.reasonL}>{t.reasonL}</span>
            {t.declR.map((l, i) => (
              <RadioCard key={l} tone="danger" selected={reason === i} onClick={() => (setReason(i), setErr(false))}>
                {l}
              </RadioCard>
            ))}
            {err && <span className={s.err}>{t.errReason}</span>}
          </div>
        )}
        <Button
          size="lg"
          block
          variant={isDone ? 'primary' : 'danger'}
          busy={busy}
          className={s.mt4}
          onClick={async () => {
            if (isDecl && reason === null) return setErr(true);
            setBusy(true);
            await onConfirm(reason);
          }}
        >
          {isDecl ? t.mDeclOk : isDone ? t.mDoneOk : t.mWdOk}
        </Button>
        <Button variant="secondary" size="lg" block onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </Sheet>
  );
}
