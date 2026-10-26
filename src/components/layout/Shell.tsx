import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { TabBar } from './TabBar';
import s from './Layout.module.css';

/** Обычная страница: шапка десктопа + нижнее меню мобильного */
export function Shell({ children, max = 1280, tabbar = true }: { children: ReactNode; max?: number; tabbar?: boolean }) {
  return (
    <div className={s.shell}>
      <SiteHeader max={max} />
      <main className={[s.main, tabbar && s.withTabbar].filter(Boolean).join(' ')}>{children}</main>
      {tabbar && <TabBar chatBadge={2} />}
    </div>
  );
}

export function Container({ children, max = 1280, className }: { children: ReactNode; max?: number; className?: string }) {
  return (
    <div className={[s.container, className].filter(Boolean).join(' ')} style={{ maxWidth: max }}>
      {children}
    </div>
  );
}
