'use client';

import type { ReactNode } from 'react';
import { ShieldCheck, Star } from 'lucide-react';
import { countReviews, rating, useDict, useLang } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { STATUS, type StatusCode, type Role } from '@/lib/status';
import s from './Status.module.css';

/** Один словарь статусов; подпись зависит от роли */
export function StatusBadge({ code, role = 'client' }: { code: StatusCode; role?: Role }) {
  const { lang } = useLang();
  const st = STATUS[code];
  return (
    <span className={s.badge} style={{ background: st.bg, color: st.fg }}>
      {st[role][lang]}
    </span>
  );
}

export function Badge({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'success' | 'warn' | 'danger' | 'neutral' | 'dark' }) {
  return <span className={[s.badge, s[tone]].join(' ')}>{children}</span>;
}

/** «Проверен» — только после ручной проверки модератором */
export function VerifiedBadge({ iconOnly }: { iconOnly?: boolean }) {
  const c = useDict(common);
  if (iconOnly) return <ShieldCheck size={16} color="var(--success-btn)" aria-label={c.verified} role="img" />;
  return (
    <span className={[s.badge, s.success, s.withIcon].join(' ')}>
      <ShieldCheck size={16} aria-hidden />
      {c.verified}
    </span>
  );
}

export function AvailableDot({ children, color = 'ink' }: { children?: ReactNode; color?: 'ink' | 'success' }) {
  const c = useDict(common);
  return (
    <span className={[s.avail, color === 'success' && s.availGreen].filter(Boolean).join(' ')}>
      <span className={s.dot} />
      {children ?? c.availableToday}
    </span>
  );
}

/** Рейтинг без отзывов не показываем как «5,0» */
export function Rating({ value, reviews, extra, size = 14 }: { value: number; reviews: number; extra?: ReactNode; size?: number }) {
  const { lang } = useLang();
  const c = useDict(common);
  if (!reviews) return <span className={s.noRev}>{c.noReviews}</span>;
  return (
    <span className={s.rating} style={{ fontSize: size }}>
      <Star size={size + 1} color="var(--warn-600)" fill="var(--warn-600)" aria-hidden />
      <b>{rating(value)}</b>
      <span className={s.ratingMeta}>
        · {countReviews(lang, reviews)}
        {extra}
      </span>
    </span>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={s.stars} style={{ fontSize: size }} aria-label={`${value} / 5`}>
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

export function CountBadge({ n, tone = 'brand' }: { n: number; tone?: 'brand' | 'danger' }) {
  if (!n) return null;
  return <span className={[s.count, tone === 'danger' && s.countDanger].filter(Boolean).join(' ')}>{n > 99 ? '99+' : n}</span>;
}
