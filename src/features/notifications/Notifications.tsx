'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck, Bell, BellOff, Check, ChevronLeft, CircleAlert, CircleCheck, CircleMinus, ClipboardCheck, ClipboardList, MessageCircle, MessageSquare,
  MessageSquareText, PartyPopper, Reply, Settings, Star, type LucideIcon,
} from 'lucide-react';
import { apiErrorText, notifications, type Notif, type NotifRole, type NotifType } from '@/lib/api';
import { useDict, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { SiteHeader, TabBar } from '@/components/layout';
import { useToast } from '@/components/ui';
import { notifDict } from './i18n';
import s from './Notifications.module.css';

type T = (typeof notifDict)['ru'];
const ICON: Record<NotifType, [LucideIcon, string, string]> = {
  resp: [MessageSquareText, 'var(--brand-100)', 'var(--brand-600)'], wait: [ClipboardCheck, 'var(--warn-100)', 'var(--warn-800)'], msg: [MessageCircle, 'var(--brand-100)', 'var(--brand-600)'],
  ok: [CircleCheck, 'var(--success-100)', 'var(--success-700)'], rej: [CircleAlert, 'var(--danger-100)', 'var(--danger-700)'], reply: [Reply, 'var(--line-100)', 'var(--ink-700)'],
  chosen: [PartyPopper, 'var(--success-100)', 'var(--success-700)'], task: [ClipboardList, 'var(--brand-100)', 'var(--brand-600)'], review: [Star, 'var(--warn-100)', 'var(--warn-600)'],
  lost: [CircleMinus, 'var(--line-100)', 'var(--ink-500)'], approved: [BadgeCheck, 'var(--success-100)', 'var(--success-700)'],
};
const FIX_HREF = '/client/tasks/6';

/** Уведомления текущей роли с подпиской на изменения (страница и колокольчик в шапке) */
export function useNotifs() {
  const { user } = useSession();
  const role: NotifRole = user?.activeRole === 'master' ? 'master' : 'client';
  const [list, setList] = useState<Notif[] | null>(null);
  useEffect(() => {
    const load = () => setList(notifications.read()[role]);
    const off = notifications.subscribe(load);
    load();
    return () => {
      off();
    };
  }, [role]);
  return { role, list, unread: (list ?? []).filter((n) => n.unread).length };
}

function useAct(role: NotifRole) {
  const t = useDict(notifDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  return (n: Notif, e: MouseEvent) => {
    e.stopPropagation();
    if (n.act === 'done') return;
    if (n.act === 'confirm') {
      if (n.orderId) {
        notifications.confirmOrder(n.orderId).then(
          () => (notifications.patch(role, n.id, { act: 'done', unread: false }), toast(t.tConfirmed)),
          (err) => toast(apiErrorText(err, lang)),
        );
        return;
      }
      notifications.patch(role, n.id, { act: 'done', unread: false });
      return toast(t.tConfirmed);
    }
    notifications.patch(role, n.id, { unread: false });
    const href = n.act === 'fix' && !n.href ? FIX_HREF : n.href;
    if (href) router.push(href);
  };
}

function Item({ n, t, lang, small, onAct, onRead }: { n: Notif; t: T; lang: 'ru' | 'tj'; small?: boolean; onAct: (e: MouseEvent) => void; onRead: () => void }) {
  const [I, bg, fg] = ICON[n.type];
  const done = n.act === 'done';
  const primary = n.act === 'confirm' || n.act === 'respond' || n.act === 'compare';
  return (
    <div role="button" tabIndex={0} onClick={onRead} onKeyDown={(e) => e.key === 'Enter' && onRead()} className={[small ? s.itemSm : s.item, n.unread && s.unread].filter(Boolean).join(' ')}>
      <span className={small ? s.icoSm : s.ico} style={{ background: bg }}>
        <I size={small ? 17 : 20} color={fg} aria-hidden />
      </span>
      <div className={s.body}>
        <div className={s.head}>
          <span className={small ? s.titleSm : s.title} style={{ fontWeight: n.unread ? 600 : 500 }}>
            {n.title[lang]}
          </span>
          <span className={s.time}>{n.time[lang]}</span>
        </div>
        <span className={small ? s.textSm : s.text}>{n.body[lang]}</span>
        {!small && n.act && (
          <button type="button" onClick={onAct} className={done ? s.actDone : primary ? s.actPrimary : s.actSecondary}>
            {done && <Check size={16} aria-hidden />}
            {n.act === 'done' ? t.confirmed : t.act[n.act]}
          </button>
        )}
      </div>
      {n.unread && <span className={s.dot} aria-label="unread" />}
    </div>
  );
}

export function NotificationsView() {
  const t = useDict(notifDict);
  const { lang } = useLang();
  const router = useRouter();
  const { user, ready } = useSession();
  const { role, list, unread } = useNotifs();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const act = useAct(role);

  useEffect(() => {
    if (ready && !user) router.replace('/login?next=/notifications');
  }, [ready, user, router]);
  if (!list) return <div className={s.page} />;

  const shown = filter === 'unread' ? list.filter((n) => n.unread) : list;
  const groups = ([0, 1, 2] as const).map((g) => ({ label: t.groups[g], items: shown.filter((n) => n.g === g) })).filter((g) => g.items.length);
  const settingsHref = role === 'master' ? '/master/settings' : '/client/settings';

  const filters = (
    <div className={s.filters}>
      {(['all', 'unread'] as const).map((f, i) => (
        <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={[s.filter, filter === f && s.filterOn].filter(Boolean).join(' ')}>
          {i === 1 && unread ? `${t.filters[1]} · ${unread}` : t.filters[i]}
        </button>
      ))}
    </div>
  );
  const readAll = (
    <button type="button" className={s.readAll} disabled={!unread} onClick={() => notifications.readAll(role)}>
      {t.readAll}
    </button>
  );
  const content = (
    <>
      {groups.length === 0 && (
        <div className={s.empty}>
          <BellOff size={32} color="var(--disabled-fg)" aria-hidden />
          <span className={s.emptyT}>{t.emptyT}</span>
          <span className={s.emptyB}>{t.emptyB}</span>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label}>
          <div className={s.groupLabel}>{g.label}</div>
          <div className={s.group}>
            {g.items.map((n) => (
              <Item key={n.id} n={n} t={t} lang={lang} onAct={(e) => act(n, e)} onRead={() => n.unread && notifications.patch(role, n.id, { unread: false })} />
            ))}
          </div>
        </section>
      ))}
      <div className={s.sms}>
        <MessageSquare size={18} aria-hidden className={s.noShrink} />
        <span>{t.smsNote}</span>
      </div>
      <Link href={settingsHref} className={s.configure}>
        <Settings size={18} aria-hidden />
        {t.configure}
      </Link>
    </>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1280} />
      <div className="mob-only">
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <button type="button" className={s.iconBtn} aria-label="back" onClick={() => router.back()}>
              <ChevronLeft size={24} aria-hidden />
            </button>
            <h1 className={s.mTitle}>{t.title}</h1>
            {readAll}
          </div>
          {filters}
        </div>
        <div className={s.mBody}>{content}</div>
        <TabBar />
      </div>
      <div className={`${s.dWrap} desk-only`}>
        <div className={s.dHead}>
          <h1 className={s.dTitle}>{t.title}</h1>
          {filters}
          <span className={s.grow} />
          {readAll}
        </div>
        <div className={s.dBody}>{content}</div>
      </div>
    </div>
  );
}

/** Колокольчик в шапке десктопа: счётчик и панель последних 4 уведомлений */
export function BellPanel() {
  const t = useDict(notifDict);
  const { lang } = useLang();
  const { role, list, unread } = useNotifs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: globalThis.MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  return (
    <div className={s.bellWrap} ref={ref}>
      <button type="button" aria-label={t.title} aria-expanded={open} onClick={() => setOpen(!open)} className={[s.bell, open && s.bellOn].filter(Boolean).join(' ')}>
        <Bell size={20} aria-hidden />
        {unread > 0 && <span className={s.bellCount}>{unread}</span>}
      </button>
      {open && (
        <div className={s.panel} role="dialog" aria-label={t.title}>
          <div className={s.panelHead}>
            <span className={s.panelT}>{t.title}</span>
            <button type="button" className={s.readAllSm} disabled={!unread} onClick={() => notifications.readAll(role)}>
              {t.readAll}
            </button>
          </div>
          {(list ?? []).slice(0, 4).map((n) => (
            <Item key={n.id} n={n} t={t} lang={lang} small onAct={() => {}} onRead={() => n.unread && notifications.patch(role, n.id, { unread: false })} />
          ))}
          <Link href="/notifications" className={s.panelAll} onClick={() => setOpen(false)}>
            {lang === 'tj' ? 'Ҳамаи огоҳиномаҳо' : 'Все уведомления'}
          </Link>
        </div>
      )}
    </div>
  );
}
