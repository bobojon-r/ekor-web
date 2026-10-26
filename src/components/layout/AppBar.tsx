'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useDict } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { IconButton } from '@/components/ui';
import s from './Layout.module.css';

/** Мобильная шапка 56px: «назад», заголовок, действия */
export function AppBar({ title, back, onBack, actions, children, sticky = true }: { title?: ReactNode; back?: string | true; onBack?: () => void; actions?: ReactNode; children?: ReactNode; sticky?: boolean }) {
  const c = useDict(common);
  const router = useRouter();
  const goBack = () => {
    if (onBack) return onBack();
    if (typeof back === 'string') router.push(back);
    else router.back();
  };
  return (
    <div className={[s.appbar, sticky && s.sticky, 'mob-only'].filter(Boolean).join(' ')}>
      <div className={s.appbarRow}>
        {(back || onBack) && (
          <IconButton label={c.back} onClick={goBack} className={s.backBtn}>
            <ChevronLeft size={24} aria-hidden />
          </IconButton>
        )}
        <div className={s.appbarTitle}>{title}</div>
        {actions}
      </div>
      {children}
    </div>
  );
}
