'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Info, LogOut, Monitor, WifiOff } from 'lucide-react';
import { ToastCtx, useToast } from '@/components/ui';
import { adminApi } from './data/api';
import type { Counts, Me } from './data/types';
import { canSee, hhmm, NAV, ROLE_NAME, section, type Role, type SectionKey } from './core';
import { alertNew, cx, Head, Loading, NoAccess } from './ui';
import s from './Admin.module.css';
import { L } from './i18n';

type Ctx = { me: Me; counts: Counts; refreshCounts: () => void };
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

/** Обратимое действие: уведомление с «Отменить»; commit выполнится, если за ms не отменили */
type Undo = (text: ReactNode, commit: () => void, undo: () => void, ms?: number) => void;
const UndoCtx = createContext<Undo>((_t, commit) => commit());
export const useUndo = () => useContext(UndoCtx);

type Note = { id: number; text: ReactNode; icon: 'check' | 'info'; undo?: () => void };

/** Уведомления админки (ТЗ §4): внизу справа, 4 с, у обратимых — «Отменить» */
function AdminToasts({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<Note | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<null | (() => void)>(null);
  const show = useCallback((text: ReactNode, icon: 'check' | 'info' = 'check') => {
    clearTimeout(timer.current);
    setNote({ id: Date.now(), text, icon });
    timer.current = setTimeout(() => setNote(null), 4000);
  }, []);
  const undoable = useCallback<Undo>((text, commit, undo, ms = 5000) => {
    // Новое обратимое действие подтверждает предыдущее сразу
    pending.current?.();
    clearTimeout(timer.current);
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      pending.current = null;
      setNote((n) => (n?.undo ? null : n));
      commit();
    };
    pending.current = fire;
    setNote({ id: Date.now(), text, icon: 'check', undo: () => ((done = true), (pending.current = null), clearTimeout(timer.current), setNote(null), undo()) });
    timer.current = setTimeout(fire, ms);
  }, []);
  // Уход со страницы — не теряем отложенное действие
  useEffect(() => {
    const flush = () => pending.current?.();
    addEventListener('pagehide', flush);
    return () => (removeEventListener('pagehide', flush), flush());
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      <UndoCtx.Provider value={undoable}>
        {children}
        <div className={s.toastHost} aria-live="polite">
          {note && (
            <div key={note.id} className={s.toast}>
              {note.icon === 'info' ? <Info size={16} aria-hidden /> : <Check size={16} aria-hidden />}
              <span className={s.grow}>{note.text}</span>
              {note.undo && (
                <button type="button" className={s.toastUndo} onClick={note.undo}>
                  {L.adminShell.otmenit}
                </button>
              )}
            </div>
          )}
        </div>
      </UndoCtx.Provider>
    </ToastCtx.Provider>
  );
}

const DEMO_ROLE = 'ekor_admin_role';
/** Профиль сотрудника из прошлого ответа /admin/me — показываем сразу, проверяем сессию в фоне */
const ME_CACHE = 'ekor_admin_me';
const COUNT_KEY: Partial<Record<SectionKey, keyof Counts>> = { tasks: 'tasks', masters: 'masters', disputes: 'disputes', reviews: 'reviews', chats: 'chats' };
const EMPTY: Counts = { tasks: 0, masters: 0, disputes: 0, reviews: 0, chats: 0, tasksLate: 0, disputesHot: '' };

/**
 * Каркас админки: отдельный вход сотрудника (почта + пароль, сессия 12 ч в cookie),
 * меню 216px по роли со счётчиками очередей (обновление раз в 30 с).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isLogin = path.startsWith('/admin/login');
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (isLogin) return;
    // Демо: роль переключается параметром ?role=moderator|senior|admin
    let demoRole: Role = 'senior';
    try {
      const q = new URLSearchParams(location.search).get('role') as Role | null;
      if (q && ['moderator', 'senior', 'admin'].includes(q)) localStorage.setItem(DEMO_ROLE, q);
      demoRole = (localStorage.getItem(DEMO_ROLE) as Role) || 'senior';
    } catch {}
    let cached: Me | null = null;
    try {
      cached = JSON.parse(localStorage.getItem(ME_CACHE) || 'null');
    } catch {}
    if (cached) (setMe(cached), setState('ok'));
    else setState('loading');
    adminApi.me(demoRole).then(
      (m) => {
        if (!m) {
          try {
            localStorage.removeItem(ME_CACHE);
          } catch {}
          return router.replace(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        }
        try {
          localStorage.setItem(ME_CACHE, JSON.stringify(m));
        } catch {}
        setMe(m);
        setState('ok');
      },
      () => !cached && setState('error'),
    );
  }, [isLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Сессия 12 ч без продления: по истечении — на вход с возвратом на тот же адрес
  useEffect(() => {
    if (!me?.expiresAt) return;
    const left = +new Date(me.expiresAt) - Date.now();
    const id = setTimeout(() => router.replace(`/admin/login?next=${encodeURIComponent(location.pathname)}`), Math.max(0, Math.min(left, 2 ** 31 - 1)));
    return () => clearTimeout(id);
  }, [me?.expiresAt, router]);

  // Нет связи с сервером: плашка над разделом; «Повторить» перезагружает данные раздела (формы в модалках не трогаем)
  const [offline, setOffline] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const h = (e: Event) => setOffline(!(e as CustomEvent<boolean>).detail);
    addEventListener('ekor-admin-net', h);
    return () => removeEventListener('ekor-admin-net', h);
  }, []);

  // Новое в очередях заданий и профилей — звук и уведомление (если сотрудник включил на экране пустой очереди)
  const prev = useRef<Counts | null>(null);
  const refreshCounts = useCallback(() => {
    if (me)
      adminApi.counts(me.role).then((c) => {
        const p = prev.current;
        if (p && (c.tasks > p.tasks || c.masters > p.masters)) alertNew(c.tasks > p.tasks ? L.adminShell.novyeZadaniyaNaProverke(c.tasks) : L.adminShell.novyeProfiliNaProverke(c.masters));
        prev.current = c;
        setCounts(c);
      }, () => {});
  }, [me]);
  useEffect(() => {
    if (state !== 'ok') return;
    refreshCounts();
    const id = setInterval(refreshCounts, 30000);
    return () => clearInterval(id);
  }, [state, refreshCounts]);

  const mobile = (
    <div className={s.mobile}>
      <Monitor size={40} color="#2647D9" aria-hidden />
      <h1>{L.adminShell.adminkaTolkoNaKompyutere}</h1>
      <p>{L.adminShell.otkroyteEkorAdminNa}</p>
      <Link href="/">{L.adminShell.naGlavnuyu}</Link>
    </div>
  );

  if (isLogin) return <>{children}</>;

  if (state !== 'ok' || !me)
    return (
      <>
        {mobile}
        <div className={s.root} style={{ gridTemplateColumns: '1fr' }}>
          {state === 'loading' ? (
            <Loading />
          ) : (
            <div className={s.center} style={{ background: '#F7F9FB' }}>
              <div className={s.denied}>
                <span className={s.h20}>{L.adminShell.serverNeOtvetil}</span>
                <span className={s.lead}>{L.adminShell.obnoviteStranitsuCherezMinutu}</span>
                <button type="button" className={cx(s.deniedBtn, s.deniedBtnBlue)} style={{ width: '100%' }} onClick={() => location.reload()}>
                  {L.adminShell.obnovit}
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );

  const active = activeKey(path);
  const logout = async () => {
    try {
      localStorage.removeItem(ME_CACHE);
    } catch {}
    await adminApi.logout();
    router.replace('/admin/login');
  };
  return (
    <AdminCtx.Provider value={{ me, counts: counts ?? EMPTY, refreshCounts }}>
      <AdminToasts>
      {mobile}
      <div className={s.root}>
        <nav className={s.nav} aria-label={L.adminShell.razdelyAdminki}>
          <div className={s.brand}>
            <span className={s.brandName}>eKor</span>
            <span className={s.brandTag}>ADMIN</span>
          </div>
          {NAV.map(([group, items]) => {
            const vis = items.filter((it) => canSee(it.key, me.role));
            if (!vis.length) return null;
            return (
              <div key={group} className={s.navGroup}>
                <span className={s.navGroupT}>{group}</span>
                {vis.map((it) => {
                  const on = it.key === active;
                  const I = it.icon;
                  const k = COUNT_KEY[it.key];
                  const n = k && counts ? counts[k] : 0;
                  // Есть просроченные — счётчик красный
                  const late = it.key === 'tasks' ? !!counts?.tasksLate : it.danger;
                  return (
                    <Link key={it.key} href={it.href} className={cx(s.navItem, on && s.navOn)} aria-current={on ? 'page' : undefined}>
                      <I size={16} color={on ? '#fff' : '#8A96A6'} aria-hidden />
                      <span className={s.grow} style={{ whiteSpace: 'nowrap' }}>
                        {it.label}
                      </span>
                      {!!n && <span className={cx(s.navCount, late && !on && s.navDanger)}>{n}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <div className={s.who}>
            <span className={s.whoName}>{me.name}</span>
            <span className={s.whoMeta}>{me.meta}</span>
            <button type="button" className={s.whoOut} onClick={logout}>
              <LogOut size={12} aria-hidden style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {L.adminShell.vyyti}
            </button>
          </div>
        </nav>
        <main className={s.main}>
          {offline && (
            <div className={s.netBar} role="alert">
              <WifiOff size={15} aria-hidden />
              <span className={s.grow}>{L.adminShell.netSvyaziSServerom}</span>
              <button type="button" onClick={() => (setRetry((n) => n + 1), refreshCounts())}>
                {L.adminShell.povtorit}
              </button>
            </div>
          )}
          <div key={retry} className={s.main} style={{ flex: 1 }}>
            {children}
          </div>
        </main>
      </div>
      </AdminToasts>
    </AdminCtx.Provider>
  );
}

function activeKey(path: string): SectionKey {
  const order: [string, SectionKey][] = [
    ['/admin/moderation/tasks', 'tasks'], ['/admin/moderation/masters', 'masters'], ['/admin/disputes', 'disputes'], ['/admin/reviews', 'reviews'], ['/admin/tasks', 'allTasks'], ['/admin/masters', 'allMasters'],
    ['/admin/users', 'users'], ['/admin/complaints', 'chats'], ['/admin/dictionaries', 'dicts'], ['/admin/limits', 'limits'], ['/admin/templates', 'templates'], ['/admin/staff', 'staff'], ['/admin/audit', 'audit'],
  ];
  return order.find(([p]) => path.startsWith(p))?.[1] ?? 'dashboard';
}

/**
 * Раздел с проверкой роли: прямой переход в закрытый раздел → экран 14,
 * данные раздела не запрашиваются (дети не монтируются).
 */
export function Section({ k, children }: { k: SectionKey; children: ReactNode }) {
  const { me } = useAdmin();
  const toast = useToast();
  const [at] = useState(() => hhmm(new Date().toISOString()));
  if (canSee(k, me.role)) return <>{children}</>;
  const sec = section(k);
  const need = sec.roles.length === 1 ? 'admin' : L.adminShell.seniorModeratorIAdmin;
  return (
    <>
      <Head title={sec.title} />
      <NoAccess need={need} roleText={`${ROLE_NAME[me.role]}${me.meta.includes('·') ? ` (${me.meta.split('·')[1].trim()})` : ''}`} at={at} onRequest={() => toast(L.adminShell.zaprosOtpravlenAdministratoru)} />
    </>
  );
}
