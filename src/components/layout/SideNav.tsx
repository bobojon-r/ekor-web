'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { maskPhone, useSession } from '@/lib/session/SessionProvider';
import { Avatar } from '@/components/ui';
import s from './Layout.module.css';

export type SideItem = { href: string; label: string; icon: LucideIcon; count?: number; exact?: boolean };

/** Левое меню кабинета 232px (десктоп) */
export function SideNav({ items, footer }: { items: SideItem[]; footer?: ReactNode }) {
  const path = usePathname();
  const { user } = useSession();
  return (
    <aside className={s.side}>
      {user && (
        <div className={s.sideUser}>
          <Avatar name={user.name} size={44} />
          <div className={s.sideUserText}>
            <span className={s.sideName}>{user.name}</span>
            <span className={s.sidePhone}>{maskPhone(user.phone)}</span>
          </div>
        </div>
      )}
      <nav className={s.sideNav}>
        {items.map((it) => {
          const on = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + '/');
          const Ico = it.icon;
          return (
            <Link key={it.href} href={it.href} className={[s.sideItem, on && s.sideOn].filter(Boolean).join(' ')} aria-current={on ? 'page' : undefined}>
              <Ico size={18} aria-hidden />
              <span className={s.grow}>{it.label}</span>
              {!!it.count && <span className={s.sideCount}>{it.count}</span>}
            </Link>
          );
        })}
      </nav>
      {footer}
    </aside>
  );
}
