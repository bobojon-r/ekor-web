'use client';

import Link from 'next/link';
import { useDict } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import s from './Layout.module.css';

export function Footer({ max = 1200 }: { max?: number }) {
  const c = useDict(common);
  return (
    <>
      <div className={`${s.footMob} mob-only`}>
        <Link href="/help">{c.f1}</Link>
        <Link href="/help">{c.f2}</Link>
        <Link href="/help#rules">{c.f3}</Link>
        <Link href="/help#privacy">{c.f4}</Link>
        <span className={s.full}>© 2026 eKor</span>
      </div>
      <footer className={`${s.foot} desk-only`}>
        <div className={s.footIn} style={{ maxWidth: max }}>
          <span className={s.footLogo}>eKor</span>
          <Link href="/help">{c.f1}</Link>
          <Link href="/help">{c.f2}</Link>
          <Link href="/help#rules">{c.f3}</Link>
          <Link href="/help#privacy">{c.f4}</Link>
          <span className={s.copy}>© 2026 eKor</span>
        </div>
      </footer>
    </>
  );
}
