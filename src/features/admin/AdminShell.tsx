'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Monitor } from 'lucide-react';
import { useToast } from '@/components/ui';
import { adminApi } from './data/api';
import type { Counts, Me } from './data/types';
import { canSee, hhmm, NAV, ROLE_NAME, section, type Role, type SectionKey } from './core';
import { cx, Head, Loading, NoAccess } from './ui';
import s from './Admin.module.css';

type Ctx = { me: Me; counts: Counts; refreshCounts: () => void };
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

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

  const refreshCounts = useCallback(() => {
    if (me) adminApi.counts(me.role).then(setCounts, () => {});
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
      <h1>Админка — только на компьютере</h1>
      <p>Откройте eKor admin на экране шире 1280 px: очереди, споры и журнал рассчитаны на десктоп.</p>
      <Link href="/">На главную</Link>
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
                <span className={s.h20}>Сервер не ответил</span>
                <span className={s.lead}>Обновите страницу через минуту.</span>
                <button type="button" className={cx(s.deniedBtn, s.deniedBtnBlue)} style={{ width: '100%' }} onClick={() => location.reload()}>
                  Обновить
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
      {mobile}
      <div className={s.root}>
        <nav className={s.nav} aria-label="Разделы админки">
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
              Выйти
            </button>
          </div>
        </nav>
        <main className={s.main}>{children}</main>
      </div>
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
  const need = sec.roles.length === 1 ? 'admin' : 'senior_moderator и admin';
  return (
    <>
      <Head title={sec.title} />
      <NoAccess need={need} roleText={`${ROLE_NAME[me.role]}${me.meta.includes('·') ? ` (${me.meta.split('·')[1].trim()})` : ''}`} at={at} onRequest={() => toast('Запрос отправлен администратору')} />
    </>
  );
}
