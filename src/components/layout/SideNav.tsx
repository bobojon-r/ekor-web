'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { maskPhone, useSession } from '@/lib/session/SessionProvider';
import { Avatar } from '@/components/ui';
import { useChatUnread } from '@/lib/hooks/useChatUnread';
import s from './Layout.module.css';

export type SideItem = { href: string; label: string; icon: LucideIcon; count?: number; exact?: boolean };

/** Левое меню кабинета 232px (десктоп) */
export function SideNav({ items, footer }: { items: SideItem[]; footer?: ReactNode }) {
  const path = usePathname();
  const { user } = useSession();
  const chats = useChatUnread();
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
          const count = it.href === '/chats' ? chats : it.count;
          return (
            <Link key={it.href} href={it.href} className={[s.sideItem, on && s.sideOn].filter(Boolean).join(' ')} aria-current={on ? 'page' : undefined}>
              <Ico size={18} aria-hidden />
              <span className={s.grow}>{it.label}</span>
              {!!count && <span className={s.sideCount}>{count}</span>}
            </Link>
          );
        })}
      </nav>
      {footer}
    </aside>
  );
}
