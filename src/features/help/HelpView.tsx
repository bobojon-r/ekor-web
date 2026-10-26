'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronUp, FileText, LifeBuoy, MessageCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useDict, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { SiteHeader, TabBar } from '@/components/layout';
import { DOCS, FAQ, helpDict } from './i18n';
import s from './Help.module.css';

type Tab = 'help' | 'rules' | 'privacy';
const TABS: Tab[] = ['help', 'rules', 'privacy'];
const ICONS = [LifeBuoy, FileText, ShieldCheck];
const SUPPORT = 'https://t.me/ekor_support';

/** Вкладка — в адресе: /help, /help#rules, /help#privacy (на них ссылаются подвал и настройки) */
function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>('help');
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1) as Tab;
      setTab(TABS.includes(h) ? h : 'help');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const set = (t: Tab) => {
    history.replaceState(null, '', t === 'help' ? location.pathname : `#${t}`);
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  return [tab, set];
}

export function HelpView() {
  const t = useDict(helpDict);
  const { lang } = useLang();
  const { user } = useSession();
  const [tab, setTab] = useHashTab();
  const [role, setRole] = useState<'client' | 'master'>('client');
  const [openQ, setOpenQ] = useState<number | null>(0);
  useEffect(() => {
    if (user?.activeRole === 'master') setRole('master');
  }, [user?.activeRole]);
  const tj = lang === 'tj';
  const ti = TABS.indexOf(tab);
  const doc = tab !== 'help' ? DOCS[tab] : null;

  const roles = (
    <div className={s.roles}>
      {(['client', 'master'] as const).map((r, i) => (
        <button key={r} type="button" aria-pressed={role === r} onClick={() => (setRole(r), setOpenQ(0))} className={[s.role, role === r && s.roleOn].filter(Boolean).join(' ')}>
          {t.roles[i]}
        </button>
      ))}
    </div>
  );
  const faq = (
    <div className={s.faq}>
      {FAQ[role].map((f, i) => {
        const open = openQ === i;
        return (
          <div key={i} className={s.q}>
            <button type="button" aria-expanded={open} className={s.qBtn} onClick={() => setOpenQ(open ? null : i)}>
              <span className={s.grow}>{tj ? f[2] : f[0]}</span>
              {open ? <ChevronUp size={20} color="var(--ink-400)" aria-hidden /> : <ChevronDown size={20} color="var(--ink-400)" aria-hidden />}
            </button>
            {open && <div className={s.a}>{tj ? f[3] : f[1]}</div>}
          </div>
        );
      })}
    </div>
  );
  const support = (
    <div className={s.support}>
      <span className={s.supportT}>{t.stillQ}</span>
      <span className={s.muted14}>{t.supportSub}</span>
      <a href={SUPPORT} target="_blank" rel="noreferrer" className={s.supportBtn}>
        <MessageCircle size={18} aria-hidden />
        {t.writeSupport}
      </a>
    </div>
  );
  const scam = (
    <div className={s.scam}>
      <TriangleAlert size={18} aria-hidden className={s.noShrink} />
      <span>{t.scam}</span>
    </div>
  );
  const docView = doc && (
    <>
      <div className={s.docHead}>
        <h1 className={s.docH}>{tj ? t.long[ti] : doc[0]}</h1>
        <span className={s.muted13}>{t.version}</span>
      </div>
      {tj && t.tjDocNote && <div className={s.tjNote}>{t.tjDocNote}</div>}
      {doc[1].map(([h, b]) => (
        <section key={h} className={s.sec}>
          <h2 className={s.secH}>{h}</h2>
          <p className={s.secB}>{b}</p>
        </section>
      ))}
    </>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1280} />

      <div className="mob-only">
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <Link href="/" aria-label="back" className={s.iconBtn}>
              <ChevronLeft size={24} aria-hidden />
            </Link>
            <span className={s.mTitle}>{t.title}</span>
          </div>
          <div className={s.tabs} role="tablist">
            {TABS.map((k, i) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={[s.tab, tab === k && s.tabOn].filter(Boolean).join(' ')}>
                {t.tabs[i]}
              </button>
            ))}
          </div>
        </div>
        <div className={s.mBody}>
          {tab === 'help' ? (
            <>
              {roles}
              {faq}
              {support}
              {scam}
            </>
          ) : (
            docView
          )}
        </div>
        <TabBar />
      </div>

      <div className={`${s.dWrap} desk-only`}>
        <nav className={s.side}>
          {TABS.map((k, i) => {
            const I = ICONS[i];
            return (
              <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)} className={[s.sideItem, tab === k && s.sideOn].filter(Boolean).join(' ')}>
                <I size={18} aria-hidden />
                {t.long[i]}
              </button>
            );
          })}
        </nav>
        <div className={s.dMain}>
          {tab === 'help' ? (
            <>
              <div className={s.dHelpHead}>
                <h1 className={s.dH}>{t.helpH}</h1>
                {roles}
              </div>
              {faq}
              <div className={s.grid2}>
                {support}
                {scam}
              </div>
            </>
          ) : (
            docView
          )}
        </div>
      </div>
    </div>
  );
}
