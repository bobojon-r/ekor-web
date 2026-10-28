'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { invites } from '@/lib/api';
import { ago, money, useDict, useLang } from '@/lib/i18n';
import { useLoad } from '@/lib/hooks/useLoad';
import { AppBar, SideNav, SiteHeader, TabBar } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { useRequireMaster } from '@/lib/session/SessionProvider';
import { inviteDict } from './i18n';
import { masterSide } from './InviteViews';
import s from './Invite.module.css';

/** Входящие приглашения мастера */
export function MasterInvitesList() {
  const t = useDict(inviteDict);
  const { lang } = useLang();
  const allowed = useRequireMaster('/master/invites');
  const { data } = useLoad(() => invites.list('master'), []);
  const list = (data ?? []).slice().sort((a, b) => Number(b.status === 'sent') - Number(a.status === 'sent') || +new Date(b.createdAt) - +new Date(a.createdAt));
  if (!allowed) return <div className={s.page} />;
  return (
    <div className={s.page}>
      <SiteHeader max={1360} />
      <AppBar title={t.side[1]} back="/master" />
      <main className={s.cabinet}>
        <div className="desk-only">
          <SideNav items={masterSide(t)} />
        </div>
        <div className={s.main}>
          <div className={s.mCol}>
            {data && list.length === 0 && <EmptyState icon={<Mail size={32} aria-hidden />} title={t.noInvites} text={t.noInvitesB} />}
            {list.map((inv) => (
              <Link key={inv.id} href={`/master/invites/${inv.id}`} className={s.listRow}>
                <span className={s.badgeRow}>
                  <span className={s.badge} style={{ background: inv.status === 'sent' ? 'var(--brand-100)' : 'var(--surface-50)', color: inv.status === 'sent' ? 'var(--brand-700)' : 'var(--ink-500)' }}>
                    {t.st[inv.status]}
                  </span>
                  <span className={s.muted13}>{ago(lang, inv.createdAt)}</span>
                </span>
                <span className={s.taskTitle}>{inv.title}</span>
                <span className={s.muted13}>
                  {inv.clientName} · {inv.district} · {money(lang, inv.budget, 'upto')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <TabBar />
    </div>
  );
}
