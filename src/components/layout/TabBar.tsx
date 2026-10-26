'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, House, MessageCircle, Search, User } from 'lucide-react';
import { useDict } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useSession } from '@/lib/session/SessionProvider';
import { useChatUnread } from '@/lib/hooks/useChatUnread';
import s from './Layout.module.css';

/** Нижнее меню 64px, 5 пунктов, подписи обязательны */
export function TabBar({ chatBadge }: { chatBadge?: number }) {
  const c = useDict(common);
  const path = usePathname();
  const { user } = useSession();
  const stored = useChatUnread();
  const badge = user ? (chatBadge ?? stored) : 0;
  const profile = !user ? '/login' : user.activeRole === 'master' ? '/master' : '/client';
  const items = [
    { href: '/', icon: House, match: (p: string) => p === '/' },
    { href: '/masters', icon: Search, match: (p: string) => p.startsWith('/masters') || p.startsWith('/categories') },
    { href: '/tasks', icon: ClipboardList, match: (p: string) => p.startsWith('/tasks') && p !== '/tasks/new' },
    { href: '/chats', icon: MessageCircle, match: (p: string) => p.startsWith('/chats') },
    { href: profile, icon: User, match: (p: string) => ['/client', '/master', '/login', '/notifications'].some((x) => p.startsWith(x)) },
  ];
  return (
    <nav className={`${s.tabbar} mob-only`}>
      {items.map((it, i) => {
        const on = it.match(path);
        const Ico = it.icon;
        return (
          <Link key={i} href={it.href} className={[s.tab, on && s.tabOn].filter(Boolean).join(' ')} aria-current={on ? 'page' : undefined}>
            <span className={s.tabIco}>
              <Ico size={22} aria-hidden />
              {i === 3 && badge > 0 && <span className={s.tabBadge}>{badge}</span>}
            </span>
            {c.nav[i]}
          </Link>
        );
      })}
    </nav>
  );
}
