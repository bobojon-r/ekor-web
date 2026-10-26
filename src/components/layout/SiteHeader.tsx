'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { BellPanel } from '@/features/notifications/Notifications';
import { useDict } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useSession } from '@/lib/session/SessionProvider';
import { ButtonLink, LangSwitch } from '@/components/ui';
import s from './Layout.module.css';

/** Десктоп-шапка 72px. max — ширина контейнера страницы (1200/1280/1360) */
export function SiteHeader({ max = 1280 }: { max?: number }) {
  const c = useDict(common);
  const path = usePathname();
  const { user } = useSession();
  const isMaster = user?.activeRole === 'master';
  const links = [
    { href: '/masters', label: c.findMaster },
    { href: '/tasks', label: c.navTasks },
    ...(!user || !user.roles.includes('master') ? [{ href: '/become-master', label: c.becomeMaster }] : []),
  ];
  return (
    <header className={`${s.header} desk-only`}>
      <div className={s.headerIn} style={{ maxWidth: max }}>
        <Link href="/" className={s.logo}>
          eKor
        </Link>
        <nav className={s.headerNav}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={[s.headerLink, isActive(path, l.href) && s.headerLinkOn].filter(Boolean).join(' ')}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={s.grow} />
        <LangSwitch />
        {user ? (
          <>
            <BellPanel />
            <Link href={isMaster ? '/master' : '/client'} className={s.me} aria-label={user.name}>
              {user.name[0]}
            </Link>
            {!isMaster && (
              <ButtonLink href="/tasks/new" size="sm">
                {c.postTask}
              </ButtonLink>
            )}
          </>
        ) : (
          <>
            <ButtonLink href="/login" variant="secondary" size="sm">
              {c.login}
            </ButtonLink>
            <ButtonLink href="/tasks/new" size="sm" icon={<Plus size={18} aria-hidden />}>
              {c.postTask}
            </ButtonLink>
          </>
        )}
      </div>
    </header>
  );
}

/** «Разместить задание» (/tasks/new) — действие клиента, а не раздел «Задания» */
function isActive(path: string, href: string) {
  if (path === '/tasks/new') return false;
  return path === href || path.startsWith(href + '/');
}
