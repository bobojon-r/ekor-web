'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Monitor } from 'lucide-react';
import { USE_API } from '@/lib/api';
import { useSession } from '@/lib/session/SessionProvider';
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
const COUNT_KEY: Partial<Record<SectionKey, keyof Counts>> = { tasks: 'tasks', masters: 'masters', disputes: 'disputes', reviews: 'reviews', chats: 'chats' };

/** Каркас админки: меню 216px по роли, счётчики очередей (обновление раз в 30 с) */
export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, ready, signOut } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notStaff' | 'error'>('loading');
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (USE_API && !user) return router.replace(`/login?next=${encodeURIComponent(path)}`);
    // Демо: роль переключается параметром ?role=moderator|senior|admin
    let demoRole: Role = 'senior';
    try {
      const q = new URLSearchParams(location.search).get('role') as Role | null;
      if (q && ['moderator', 'senior', 'admin'].includes(q)) localStorage.setItem(DEMO_ROLE, q);
      demoRole = (localStorage.getItem(DEMO_ROLE) as Role) || 'senior';
    } catch {}
    adminApi.me(user ? +user.id : null, user?.name ?? '', demoRole).then(
      (m) => (m ? (setMe(m), setState('ok')) : setState('notStaff')),
      (e) => setState(e?.status === 403 || e?.status === 401 ? 'notStaff' : 'error'),
    );
  }, [ready, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshCounts = useCallback(() => {
    adminApi.counts().then(setCounts, () => {});
  }, []);
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
                <span className={s.h20}>{state === 'notStaff' ? 'Нет доступа к админке' : 'Сервер не ответил'}</span>
                <span className={s.lead}>
                  {state === 'notStaff' ? 'Вход в админку — только с номера сотрудника. Если вас пригласили, войдите по номеру из приглашения.' : 'Обновите страницу через минуту.'}
                </span>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <Link href="/" className={s.deniedBtn}>
                    На главную
                  </Link>
                  {state === 'notStaff' && (
                    <button type="button" className={cx(s.deniedBtn, s.deniedBtnBlue)} onClick={() => (signOut(), router.push('/login?next=/admin'))}>
                      Войти другим номером
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );

  const active = activeKey(path);
  return (
    <AdminCtx.Provider value={{ me, counts: counts ?? { tasks: 0, masters: 0, disputes: 0, reviews: 0, chats: 0, tasksLate: 0, disputesHot: '' }, refreshCounts }}>
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
                  return (
                    <Link key={it.key} href={it.href} className={cx(s.navItem, on && s.navOn)} aria-current={on ? 'page' : undefined}>
                      <I size={16} color={on ? '#fff' : '#8A96A6'} aria-hidden />
                      <span className={s.grow} style={{ whiteSpace: 'nowrap' }}>
                        {it.label}
                      </span>
                      {!!n && <span className={cx(s.navCount, it.danger && !on && s.navDanger)}>{n}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <div className={s.who}>
            <span className={s.whoName}>{me.name}</span>
            <span className={s.whoMeta}>{me.meta}</span>
            {USE_API && (
              <button type="button" className={s.whoOut} onClick={() => (signOut(), router.push('/'))}>
                Выйти
              </button>
            )}
          </div>
        </nav>
        <main className={s.main}>{children}</main>
      </div>
    </AdminCtx.Provider>
  );
}

function activeKey(path: string): SectionKey {
  const order: [string, SectionKey][] = [
    ['/admin/moderation/tasks', 'tasks'], ['/admin/moderation/masters', 'masters'], ['/admin/disputes', 'disputes'], ['/admin/reviews', 'reviews'], ['/admin/users', 'users'],
    ['/admin/complaints', 'chats'], ['/admin/dictionaries', 'dicts'], ['/admin/limits', 'limits'], ['/admin/templates', 'templates'], ['/admin/staff', 'staff'], ['/admin/audit', 'audit'],
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
