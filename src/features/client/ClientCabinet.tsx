'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, Bell as BellIco, CalendarDays, ChevronLeft, CircleAlert, CircleArrowRight, CircleCheckBig, Clock, EllipsisVertical, Hourglass, Info, LockOpen, Mail,
  MapPin, MessageCircle, MessagesSquare, Phone, Plus, Send, Settings, ShieldAlert, ShieldCheck, Star, Users, Wallet, ClipboardList,
} from 'lucide-react';
import { api, apiErrorText, clientTasks, isArchived, USE_API, type ClientTask, type ClientTaskStatus, type TaskResponse } from '@/lib/api';
import { countResponses, initials, num, phoneMask, rating as fmtRating, useDict, useLang, type Lang } from '@/lib/i18n';
import { useLoad } from '@/lib/hooks/useLoad';
import { useSession } from '@/lib/session/SessionProvider';
import { SideNav, SiteHeader, TabBar, type SideItem } from '@/components/layout';
import { Button, ButtonLink, LangSwitch, Segmented, Sheet, Skeleton, useToast } from '@/components/ui';
import { clientDict } from './i18n';
import s from './Cabinet.module.css';

type T = (typeof clientDict)['ru'];
type Modal = null | { type: 'choose'; taskId: number; respId: string } | { type: 'cancel' | 'problem'; taskId: number };

const ST: Record<ClientTaskStatus, [string, string]> = {
  review: ['var(--warn-100)', 'var(--warn-800)'], open: ['var(--brand-100)', 'var(--brand-700)'], chosen: ['var(--brand-100)', 'var(--brand-700)'],
  wait: ['var(--warn-100)', 'var(--warn-800)'], dispute: ['var(--danger-100)', 'var(--danger-700)'], done: ['var(--ink-900)', 'var(--white)'],
  rejected: ['var(--danger-100)', 'var(--danger-700)'], cancelled: ['var(--surface-50)', 'var(--ink-400)'], expired: ['var(--line-100)', 'var(--ink-700)'],
};
/** Требует действия клиента — подсвечиваем рамкой */
const needsAction = (k: ClientTask) => (k.status === 'open' && !!k.responses?.length) || k.status === 'wait' || (k.status === 'done' && !k.review) || k.status === 'rejected';

export function clientSide(t: T): SideItem[] {
  return [
    { href: '/client', label: t.side[0], icon: ClipboardList, exact: true },
    { href: '/client/invites', label: t.side[1], icon: Mail },
    { href: '/chats', label: t.side[2], icon: MessagesSquare },
    { href: '/client/reviews', label: t.side[3], icon: Star },
    { href: '/notifications', label: t.side[4], icon: BellIco },
    { href: '/client/settings', label: t.side[5], icon: Settings },
  ];
}

function agoText(t: T, iso: string) {
  const min = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (min < 60) return `${min} ${t.ago.m}`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${t.ago.h}`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ${t.ago.d}`;
  return `${Math.round(d / 30)} ${t.ago.mo}`;
}

export function ClientCabinet({ selectedId }: { selectedId?: number }) {
  const t = useDict(clientDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useSession();
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [list, setList] = useState<ClientTask[] | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const load = useLoad(() => clientTasks.list(), [user?.id], !!user);

  useEffect(() => {
    if (load.data) setList(load.data);
  }, [load.data]);
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(selectedId ? `/client/tasks/${selectedId}` : '/client')}`);
  }, [ready, user, router, selectedId]);

  const tasks = list ?? [];
  const items = tasks.filter((k) => (tab === 'archive' ? isArchived(k) : !isArchived(k)));
  const deskSel = selectedId ?? items[0]?.id;
  const sel = tasks.find((k) => k.id === deskSel) ?? null;

  const apply = (next: ClientTask[]) => setList(next);
  /** Ошибка API — тост, кнопки не зависают */
  const guard =
    <A extends unknown[]>(f: (...a: A) => Promise<void>) =>
    async (...a: A) => {
      try {
        await f(...a);
      } catch (e) {
        toast(apiErrorText(e, lang));
      }
    };
  const act = {
    seen: guard(async (id: number) => apply(await clientTasks.markSeen(id))),
    choose: guard(async (id: number, respId: string) => {
      const name = tasks.find((k) => k.id === id)?.responses?.find((r) => r.id === respId)?.name ?? '';
      apply(await clientTasks.choose(id, respId));
      toast(t.tChosen(name));
    }),
    cancel: guard(async (id: number, reason: number, note: string) => {
      apply(await clientTasks.cancelChoice(id, reason, note));
      toast(t.tCancel);
    }),
    problem: guard(async (id: number, reason: number, note: string) => {
      apply(await clientTasks.problem(id, reason, note));
      toast(t.tDispute);
    }),
    demoDone: guard(async (id: number) => apply(await clientTasks.demoMasterDone(id))),
    confirm: guard(async (id: number) => apply(await clientTasks.confirmDone(id))),
    review: guard(async (id: number, stars: number, text: string) => {
      const d = new Date();
      const month = (lang === 'tj' ? ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'] : ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'])[d.getMonth()];
      apply(await clientTasks.review(id, stars, text, `${month} ${d.getFullYear()}`));
      toast(t.tSent);
    }),
  };

  const listView = (desktop: boolean) => (
    <div className={desktop ? s.dList : s.mList}>
      {!desktop && (
        <Link href="/tasks/new" className={s.newTask}>
          <Plus size={20} aria-hidden />
          {t.newTask}
        </Link>
      )}
      {!list && [1, 2, 3].map((i) => <div key={i} className={load.showSkeleton ? s.sk : `${s.sk} ${s.ph}`} />)}
      {list && items.length === 0 && (
        <div className={s.emptyArchive}>
          <span className={s.emptyT}>{t.emptyArchiveT}</span>
          <span className={s.muted14}>{t.emptyArchiveB}</span>
        </div>
      )}
      {items.map((k) => (
        <TaskRow key={k.id} k={k} t={t} lang={lang} selected={desktop && k.id === deskSel} desktop={desktop} onOpen={() => k.newResponses && act.seen(k.id)} />
      ))}
    </div>
  );

  const tabs = (
    <Segmented
      className={s.tabs}
      value={tab}
      onChange={setTab}
      options={[
        { value: 'active', label: t.tabs[0] },
        { value: 'archive', label: t.tabs[1] },
      ]}
    />
  );

  const detailProps = { t, lang, act, openModal: setModal };

  return (
    <div className={s.page}>
      <SiteHeader max={1280} />

      {/* ============ MOBILE ============ */}
      <div className="mob-only">
        {selectedId ? (
          <>
            <div className={s.mTop}>
              <button type="button" className={s.backBtn} onClick={() => router.push('/client')}>
                <ChevronLeft size={24} aria-hidden />
                {t.myTasks}
              </button>
              <span className={s.grow} />
              {sel && ['review', 'open'].includes(sel.status) && (
                <Link href={`/client/tasks/${sel.id}/manage`} className={s.iconBtn} aria-label="more">
                  <EllipsisVertical size={20} aria-hidden />
                </Link>
              )}
            </div>
            <div className={s.mDetail}>{sel ? <TaskDetail k={sel} wide={false} {...detailProps} /> : <DetailSkeleton />}</div>
          </>
        ) : (
          <>
            <div className={s.mHead}>
              <div className={s.mHeadRow}>
                <h1 className={s.mTitle}>{t.myTasks}</h1>
                <LangSwitch />
              </div>
              {tabs}
            </div>
            {listView(false)}
            <TabBar />
          </>
        )}
      </div>

      {/* ============ DESKTOP ============ */}
      <div className={`${s.dWrap} desk-only`}>
        <SideNav items={clientSide(t)} footer={<RoleCard t={t} />} />
        <div className={s.dCol}>
          <div className={s.dTabs}>{tabs}</div>
          {listView(true)}
        </div>
        <div className={s.dDetail}>{sel ? <TaskDetail k={sel} wide {...detailProps} /> : list ? null : <DetailSkeleton />}</div>
      </div>

      {modal && <ActionModal modal={modal} tasks={tasks} t={t} onClose={() => setModal(null)} act={act} />}
    </div>
  );
}

function RoleCard({ t }: { t: T }) {
  const { user, switchRole } = useSession();
  const router = useRouter();
  return (
    <div className={s.roleCard}>
      <span className={s.roleT}>{t.roleT}</span>
      <span className={s.roleB}>{t.roleB}</span>
      <button
        type="button"
        className={s.roleBtn}
        onClick={() => {
          if (user?.roles.includes('master')) {
            switchRole('master');
            router.push('/master');
          } else router.push('/become-master');
        }}
      >
        {t.roleBtn}
      </button>
    </div>
  );
}

function TaskRow({ k, t, lang, selected, desktop, onOpen }: { k: ClientTask; t: T; lang: Lang; selected: boolean; desktop: boolean; onOpen: () => void }) {
  const need = needsAction(k);
  const n = k.responses?.length ?? 0;
  const nextText =
    k.status === 'open'
      ? n
        ? `${countResponses(lang, n)} — ${t.next.open(n).split('— ')[1]}`
        : t.next.open(0)
      : ((t.next as unknown as Record<string, string>)[k.status === 'done' && !k.review ? 'doneNo' : k.status] ?? '');
  const badge = k.newResponses || k.unread || 0;
  const label = (t.st as Record<string, string>)[k.status] ?? k.status;
  return (
    <Link
      href={['expired', 'cancelled'].includes(k.status) || (k.status === 'open' && !n) ? `/client/tasks/${k.id}/manage` : `/client/tasks/${k.id}`}
      scroll={!desktop}
      onClick={onOpen}
      className={[s.row, need && s.rowNeed, selected && s.rowSel, desktop && s.rowD].filter(Boolean).join(' ')}
    >
      <span className={s.rowTop}>
        <span className={s.badge} style={{ background: ST[k.status][0], color: ST[k.status][1] }}>
          {label}
        </span>
        <span className={s.rowAgo}>{agoText(t, k.createdAt)}</span>
        {badge > 0 && <span className={s.count}>{badge}</span>}
      </span>
      <span className={s.rowTitle}>{k.title}</span>
      <span className={s.rowNext} style={{ color: need ? 'var(--brand-700)' : 'var(--ink-500)' }}>
        {need ? <CircleArrowRight size={16} aria-hidden className={s.noShrink} /> : <Clock size={16} aria-hidden className={s.noShrink} />}
        {nextText}
      </span>
    </Link>
  );
}

/* ---------------- ClientTask ---------------- */

type Act = {
  choose: (id: number, r: string) => Promise<void>;
  demoDone: (id: number) => Promise<void>;
  confirm: (id: number) => Promise<void>;
  review: (id: number, stars: number, text: string) => Promise<void>;
};

const NB: Record<string, [string, string, string, typeof Users, string]> = {
  review: ['var(--surface-50)', 'var(--line-200)', 'var(--ink-900)', Hourglass, 'var(--ink-500)'],
  open: ['var(--brand-50)', '#c9d4f7', 'var(--brand-700)', Users, 'var(--brand-600)'],
  openNo: ['var(--surface-50)', 'var(--line-200)', 'var(--ink-900)', Hourglass, 'var(--ink-500)'],
  chosen: ['var(--brand-50)', '#c9d4f7', 'var(--brand-700)', MessageCircle, 'var(--brand-600)'],
  wait: ['#fdf5ec', '#f1d3af', 'var(--warn-800)', CircleCheckBig, '#b5651d'],
  dispute: ['#fdf0ee', '#f0c4be', 'var(--danger-700)', ShieldAlert, 'var(--danger-700)'],
  done: ['#eef8f5', '#bfe3d8', 'var(--success-700)', CircleCheckBig, 'var(--success-btn)'],
  doneNo: ['#eef8f5', '#bfe3d8', 'var(--success-700)', Star, 'var(--success-btn)'],
  rejected: ['#fdf0ee', '#f0c4be', 'var(--danger-700)', CircleAlert, 'var(--danger-700)'],
};

function TaskDetail({ k, wide, t, lang, act, openModal }: { k: ClientTask; wide: boolean; t: T; lang: Lang; act: Act; openModal: (m: Modal) => void }) {
  const [sort, setSort] = useState<'price' | 'rating' | 'new'>('price');
  const [reviewing, setReviewing] = useState(false);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [err, setErr] = useState<{ stars?: true; text?: true }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReviewing(false);
    setStars(0);
    setText('');
    setErr({});
  }, [k.id]);

  const resp = useMemo(() => {
    const r = (k.responses ?? []).slice();
    if (sort === 'price') r.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    if (sort === 'rating') r.sort((a, b) => b.rating * Math.log(1 + b.reviews) - a.rating * Math.log(1 + a.reviews));
    if (sort === 'new') r.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return r;
  }, [k.responses, sort]);
  const prices = resp.filter((r) => r.price).map((r) => r.price!);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const best = resp.filter((r) => r.reviews).sort((a, b) => b.rating - a.rating)[0];
  const fast = resp.slice().sort((a, b) => a.term - b.term)[0];

  const stage = { review: 0, open: 1, chosen: 2, wait: 3, dispute: 3, done: k.review ? 5 : 4, rejected: 0, cancelled: 0, expired: 1 }[k.status];
  const nbKey = k.status === 'open' && !resp.length ? 'openNo' : k.status === 'done' && !k.review ? 'doneNo' : k.status;
  const nbText = (t.nb as Record<string, string[]>)[nbKey] ?? ['', ''];
  const nb = NB[nbKey] ?? NB.review;
  const NbIcon = nb[3];
  const price = (p: number | null) => (p === null ? t.afterInspect : `${num(p)} ${t.cur}`);
  const catLabel = (t.cats as Record<string, string>)[k.category] ?? (lang === 'tj' ? 'Дигар' : 'Другое');
  const isReviewing = reviewing && k.status === 'done' && !k.review;

  const submitReview = async () => {
    const e: typeof err = {};
    if (!stars) e.stars = true;
    if (text.trim().length < 10) e.text = true;
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    await act.review(k.id, stars, text.trim());
    setBusy(false);
    setReviewing(false);
  };

  const actions =
    k.status === 'wait' ? (
      <div className={s.nbActions}>
        <Button size="md" className={s.nbBtn} onClick={async () => (await act.confirm(k.id), setReviewing(true))}>
          {t.confirmDone}
        </Button>
        <Button variant="danger-outline" size="md" className={s.nbBtn} onClick={() => openModal({ type: 'problem', taskId: k.id })}>
          {t.problem}
        </Button>
      </div>
    ) : k.status === 'done' && !k.review && !reviewing ? (
      <div className={s.nbActions}>
        <Button size="md" className={s.nbBtn} onClick={() => setReviewing(true)}>
          {t.rvTitle}
        </Button>
      </div>
    ) : null;

  return (
    <div className={s.detail}>
      <div className={s.head}>
        <div className={s.headTop}>
          <span className={s.badgeLg} style={{ background: ST[k.status][0], color: ST[k.status][1] }}>
            {(t.st as Record<string, string>)[k.status] ?? k.status}
          </span>
          <span className={s.muted13}>
            {catLabel} · {agoText(t, k.createdAt)}
          </span>
        </div>
        {['open', 'review'].includes(k.status) && (
          <Link href={`/client/tasks/${k.id}/manage`} className={`${s.manage} desk-only`}>
            {lang === 'tj' ? 'Тағйир ё бекор кардан' : 'Изменить или отменить'}
          </Link>
        )}
        <h1 className={s.title} style={{ fontSize: wide ? 28 : 22 }}>
          {k.title}
        </h1>
        <div className={s.meta}>
          <span className={s.metaItem}>
            <MapPin size={16} aria-hidden />
            {k.district}, {api.region(k.region).name[lang]}
          </span>
          <span className={s.metaItem}>
            <CalendarDays size={16} aria-hidden />
            {t.when[k.when]}
          </span>
          <span className={s.metaItem}>
            <Wallet size={16} aria-hidden />
            {k.budget ? `${k.budget} ${t.cur}` : t.negotiable}
          </span>
        </div>
      </div>

      {!['rejected', 'dispute', 'cancelled'].includes(k.status) && (
        <div className={s.progress}>
          {t.prog.map((l, i) => (
            <div key={l} className={s.progItem}>
              <span className={s.progBar} style={{ background: i < stage ? 'var(--brand-600)' : i === stage ? 'var(--brand-300)' : 'var(--line-200)' }} />
              <span className={s.progLabel} style={{ color: i <= stage ? 'var(--ink-900)' : 'var(--ink-500)', fontWeight: i === stage ? 600 : 400 }}>
                {l}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={s.nb} style={{ background: nb[0], borderColor: nb[1] }}>
        <div className={s.nbRow}>
          <NbIcon size={22} color={nb[4]} aria-hidden className={s.noShrink} />
          <div className={s.nbText}>
            <span className={s.nbTitle} style={{ color: nb[2] }}>
              {nbText[0]}
            </span>
            <span className={s.nbBody}>{k.status === 'rejected' && k.rejectReason ? `${nbText[1].split(':')[0]}: ${k.rejectReason}` : nbText[1]}</span>
          </div>
        </div>
        {actions}
      </div>

      {isReviewing && (
        <div className={s.review}>
          <div className={s.reviewHead}>
            <span className={s.reviewT}>{t.rvTitle}</span>
            {k.master && <span className={s.muted14}>{t.rvSub(k.master.name)}</span>}
          </div>
          <div className={s.stars} role="radiogroup" aria-label={t.rvTitle}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={String(n)} onClick={() => (setStars(n), setErr({}))} className={[s.star, n <= stars && s.starOn].filter(Boolean).join(' ')}>
                <Star size={24} color="var(--warn-600)" fill={n <= stars ? 'var(--warn-600)' : 'none'} aria-hidden />
              </button>
            ))}
          </div>
          {stars > 0 && <span className={s.starLabel}>{t.starL[stars - 1]}</span>}
          {err.stars && <span className={s.errTight}>{t.errStars}</span>}
          <label className={s.fieldSm}>
            <span className={s.labelRow}>
              {t.rvText}
              <span className={s.countTxt}>{text.length}/1000</span>
            </span>
            <textarea value={text} onChange={(e) => (setText(e.target.value.slice(0, 1000)), setErr({}))} rows={4} placeholder={t.rvPh} className={[s.textarea, err.text && s.invalid].filter(Boolean).join(' ')} />
            {err.text && <span className={s.err}>{t.errText}</span>}
          </label>
          <span className={s.muted13}>{t.rvNote}</span>
          <Button size="lg" block busy={busy} onClick={submitReview}>
            {t.rvBtn}
          </Button>
        </div>
      )}

      {k.review && (
        <div className={s.myReview}>
          <div className={s.myReviewHead}>
            <span className={s.myReviewT}>{t.yourReview}</span>
            <span className={s.muted13}>{k.review.date}</span>
          </div>
          <span className={s.starsTxt}>{'★'.repeat(k.review.stars) + '☆'.repeat(5 - k.review.stars)}</span>
          <span className={s.reviewText}>{k.review.text}</span>
          {k.review.reply && (
            <div className={s.reply}>
              <b>{t.reply}:</b> {k.review.reply}
            </div>
          )}
        </div>
      )}

      {k.master && k.status !== 'rejected' && (
        <div className={s.master}>
          <span className={s.overline}>{t.yourMaster}</span>
          <div className={s.masterRow}>
            <span className={s.avStriped} style={{ width: 52, height: 52 }}>
              {initials(k.master.name)}
            </span>
            <div className={s.masterText}>
              <span className={s.masterName}>
                {k.master.masterId ? <Link href={`/masters/${k.master.masterId}`}>{k.master.name}</Link> : k.master.name}
                {k.master.verified && <ShieldCheck size={16} color="var(--success-btn)" aria-hidden />}
              </span>
              <span className={s.muted14}>
                {(t.cats as Record<string, string>)[k.master.category] ?? ''} · {k.master.reviews ? `★ ${fmtRating(k.master.rating)}` : t.noReviews}
              </span>
            </div>
            <div className={s.agreed}>
              <span className={s.agreedL}>{t.agreed}</span>
              <span className={s.agreedV}>{price(k.master.price)}</span>
            </div>
          </div>
          {['chosen', 'wait', 'dispute'].includes(k.status) && (
            <>
              <div className={s.contacts}>
                <span className={s.contact}>
                  <Phone size={18} color="var(--brand-600)" aria-hidden />+992 {phoneMask(k.master.phone)}
                </span>
                {k.address && (
                  <span className={s.contact}>
                    <LockOpen size={18} color="var(--success-btn)" aria-hidden className={s.noShrink} />
                    <span>{t.addrShared(k.address)}</span>
                  </span>
                )}
              </div>
              <div className={s.masterBtns}>
                <Link href={k.chatId ? `/chats/${k.chatId}` : '/chats'} className={s.chatBtn}>
                  <MessageCircle size={18} aria-hidden />
                  {t.chat}
                  {!!k.unread && <span className={s.chatCount}>{k.unread}</span>}
                </Link>
                <a href={`tel:+992${k.master.phone}`} className={s.callBtn}>
                  <Phone size={18} color="var(--brand-600)" aria-hidden />
                  {t.call}
                </a>
              </div>
            </>
          )}
          {k.status === 'chosen' && (
            <div className={s.cancelRow}>
              <button type="button" className={s.cancelLink} onClick={() => openModal({ type: 'cancel', taskId: k.id })}>
                {t.cancelChoice}
              </button>
              {!USE_API && (
                <button type="button" className={s.demoBtn} onClick={() => act.demoDone(k.id)}>
                  {t.demoDone}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {k.status === 'rejected' && (
        <div className={s.twoBtns}>
          <ButtonLink href="/tasks/new" size="md" className={s.flex1}>
            {t.editResubmit}
          </ButtonLink>
          <ButtonLink href="/help#rules" variant="secondary" size="md" className={s.flex1}>
            {t.rules}
          </ButtonLink>
        </div>
      )}
      {k.status === 'dispute' && (
        <div className={s.grid2}>
          <a href="https://t.me/ekor_support" target="_blank" rel="noreferrer" className={s.supportBtn}>
            <Send size={18} color="var(--brand-600)" aria-hidden />
            Telegram
          </a>
          <a href="tel:+992446001010" className={s.supportBtn}>
            <Phone size={18} color="var(--brand-600)" aria-hidden />
            +992 44 600 10 10
          </a>
        </div>
      )}

      {k.status === 'open' && (
        <div className={s.responses}>
          <div className={s.respHead}>
            <span className={s.respTitle}>{t.respTitle(resp.length)}</span>
            {resp.length > 1 && (
              <div className={s.sortSeg}>
                {(['price', 'rating', 'new'] as const).map((v, i) => (
                  <button key={v} type="button" aria-pressed={sort === v} onClick={() => setSort(v)} className={[s.sortBtn, sort === v && s.sortOn].filter(Boolean).join(' ')}>
                    {t.sorts[i]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {resp.length > 0 ? (
            <>
              <div className={s.summary}>
                <span>
                  {t.sum[0]}: <b>{prices.length ? `${num(minP)}–${num(maxP)} ${t.cur}` : '—'}</b>
                </span>
                <span>
                  {t.sum[1]}: <b>{best ? `${fmtRating(best.rating)} · ${best.name.split(' ')[0]}` : '—'}</b>
                </span>
                <span>
                  {t.sum[2]}: <b>{`${t.terms[fast.term].toLowerCase()} · ${fast.name.split(' ')[0]}`}</b>
                </span>
              </div>
              {resp.map((r) => (
                <ResponseCard key={r.id} r={r} t={t} best={best?.id === r.id} cheapest={!!r.price && r.price === minP && prices.length > 1} price={price(r.price)} onChoose={() => openModal({ type: 'choose', taskId: k.id, respId: r.id })} />
              ))}
            </>
          ) : (
            <div className={s.noResp}>
              <span className={s.noRespT}>{t.noRespT}</span>
              <span className={s.muted14}>{t.noRespB}</span>
            </div>
          )}
        </div>
      )}

      <div className={s.noPay}>
        <Info size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />
        <span>{t.noPay}</span>
      </div>
    </div>
  );
}

function ResponseCard({ r, t, best, cheapest, price, onChoose }: { r: TaskResponse; t: T; best: boolean; cheapest: boolean; price: string; onChoose: () => void }) {
  const badges: { label: string; bg: string; fg: string }[] = [];
  if (r.verified) badges.push({ label: t.bVerified, bg: 'var(--success-100)', fg: 'var(--success-700)' });
  if (cheapest) badges.push({ label: t.bCheap, bg: 'var(--brand-100)', fg: 'var(--brand-700)' });
  if (best) badges.push({ label: t.bTop, bg: 'var(--warn-100)', fg: 'var(--warn-800)' });
  if (!r.reviews) badges.push({ label: t.bNew, bg: 'var(--line-100)', fg: 'var(--ink-700)' });
  const ago = Math.max(1, Math.round((Date.now() - +new Date(r.createdAt)) / 60000));
  return (
    <div className={s.resp} style={{ borderColor: best ? '#f1d3af' : 'var(--line-200)' }}>
      <div className={s.respTop}>
        <span className={s.avStriped} style={{ width: 48, height: 48 }}>
          {initials(r.name)}
        </span>
        <div className={s.respWho}>
          <span className={s.masterName}>
            {r.masterId ? <Link href={`/masters/${r.masterId}`}>{r.name}</Link> : r.name}
            {r.verified && <ShieldCheck size={16} color="var(--success-btn)" aria-hidden />}
          </span>
          {r.reviews ? (
            <span className={s.rate}>
              <Star size={15} color="var(--warn-600)" fill="var(--warn-600)" aria-hidden />
              {fmtRating(r.rating)} · {t.rv(r.reviews)}
            </span>
          ) : (
            <span className={s.muted14}>{t.noReviews}</span>
          )}
          <span className={s.muted13}>{t.exp(r.years)}</span>
        </div>
        <div className={s.respPrice}>
          <span className={s.respPriceV}>{price}</span>
          <span className={s.muted13}>{t.terms[r.term]}</span>
        </div>
      </div>
      {badges.length > 0 && (
        <div className={s.badges}>
          {badges.map((b) => (
            <span key={b.label} className={s.badge} style={{ background: b.bg, color: b.fg }}>
              {b.label}
            </span>
          ))}
        </div>
      )}
      <div className={s.respMsg}>{r.msg}</div>
      <div className={s.respFoot}>
        <span className={s.muted13}>
          {ago} {t.ago.m}
        </span>
        <div className={s.respBtns}>
          {r.masterId && (
            <ButtonLink href={`/masters/${r.masterId}`} variant="secondary" size="sm">
              {t.profile}
            </ButtonLink>
          )}
          <Button size="sm" onClick={onChoose}>
            {t.choose}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ClientModal ---------------- */

function ActionModal({ modal, tasks, t, onClose, act }: { modal: NonNullable<Modal>; tasks: ClientTask[]; t: T; onClose: () => void; act: { choose: Act['choose']; cancel: (id: number, r: number, n: string) => Promise<void>; problem: (id: number, r: number, n: string) => Promise<void> } }) {
  const [reason, setReason] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const k = tasks.find((x) => x.id === modal.taskId);
  const r = modal.type === 'choose' ? k?.responses?.find((x) => x.id === modal.respId) : undefined;
  const head = modal.type === 'choose' ? t.mChooseH : modal.type === 'problem' ? t.mProblemH : t.mCancelH;
  const reasons = modal.type === 'problem' ? t.mProblemR : t.mCancelR;
  const ok = modal.type === 'choose' ? t.mChooseOk : modal.type === 'problem' ? t.mProblemOk : t.mCancelOk;

  const confirm = async () => {
    if (modal.type !== 'choose' && reason === null) return setErr(true);
    setBusy(true);
    if (modal.type === 'choose') await act.choose(modal.taskId, modal.respId);
    else if (modal.type === 'cancel') await act.cancel(modal.taskId, reason!, note);
    else await act.problem(modal.taskId, reason!, note);
    setBusy(false);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} width={520} title={head} closeLabel={t.mCancel}>
      <div className={s.modal}>
        {modal.type === 'choose' && r && (
          <>
            <div className={s.chooseCard}>
              <span className={s.avStriped} style={{ width: 48, height: 48 }}>
                {initials(r.name)}
              </span>
              <div className={s.respWho}>
                <span className={s.masterName}>{r.name}</span>
                <span className={s.muted14}>{t.terms[r.term]}</span>
              </div>
              <span className={s.respPriceV}>{r.price === null ? t.afterInspect : `${num(r.price)} ${t.cur}`}</span>
            </div>
            <div className={s.bullets}>
              {t.mBullets.map((b, i) => {
                const I = [LockOpen, Bell, MessageCircle][i];
                return (
                  <div key={b} className={s.bullet}>
                    <I size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />
                    <span>{b}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {modal.type !== 'choose' && (
          <>
            <span className={s.muted15}>{modal.type === 'problem' ? t.mProblemSub : t.mCancelSub}</span>
            <div className={s.reasons} role="radiogroup">
              {reasons.map((l, i) => (
                <button key={l} type="button" role="radio" aria-checked={reason === i} onClick={() => (setReason(i), setErr(false))} className={[s.reason, reason === i && s.reasonOn].filter(Boolean).join(' ')}>
                  <span className={s.radio}>
                    <span />
                  </span>
                  {l}
                </button>
              ))}
            </div>
            {err && <span className={s.errTight}>{t.errReason}</span>}
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder={t.notePh} className={s.textarea} />
          </>
        )}
        <div className={s.modalBtns}>
          <Button variant="secondary" size="lg" className={s.flex1} onClick={onClose}>
            {t.mCancel}
          </Button>
          <Button variant={modal.type === 'choose' ? 'primary' : 'danger'} size="lg" className={s.flex14} busy={busy} onClick={confirm}>
            {ok}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <div className={s.detail}>
      <Skeleton w="30%" />
      <Skeleton w="85%" h={26} />
      <Skeleton w="60%" light />
      <Skeleton w="100%" h={90} r={14} />
    </div>
  );
}

