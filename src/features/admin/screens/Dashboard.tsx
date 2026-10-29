'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { ref } from '@/lib/api/ref';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Dash } from '../data/types';
import { downloadCsv, hhmm, num, ST, type Tone } from '../core';
import { Head, Loading, Seg, SelectChip } from '../ui';
import d from './Dashboard.module.css';
import s from '../Admin.module.css';
import { L } from '../i18n';

type PeriodK = '7' | '30' | '90' | 'custom';
const PERIODS: [PeriodK, string][] = [['7', L.dashboard._7Dney], ['30', L.dashboard._30Dney], ['90', L.dashboard._90Dney], ['custom', L.dashboard.svoy]];
/** Дата по Душанбе в формате YYYY-MM-DD */
const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' }).format(d);
const daysAgo = (n: number) => day(new Date(Date.now() - n * 864e5));

export function Dashboard() {
  const { counts } = useAdmin();
  const toast = useToast();
  const [period, setPeriod] = useState<PeriodK>('7');
  const [own, setOwn] = useState({ from: daysAgo(13), to: day(new Date()) });
  const [city, setCity] = useState('all');
  const [cat, setCat] = useState('all');
  const [data, setData] = useState<Dash | null>(null);
  const [at, setAt] = useState('');

  const range = period === 'custom' ? own : { from: daysAgo(+period - 1), to: day(new Date()) };
  const badRange = period === 'custom' && (!own.from || !own.to || own.from > own.to);
  useEffect(() => {
    if (badRange) return;
    setData(null);
    adminApi.dashboard(range, city === 'all' ? null : +city, cat === 'all' ? null : +cat).then(
      (x) => (setData(x), setAt(hhmm(new Date().toISOString()))),
      () => toast(L.dashboard.serverNeOtvetil),
    );
  }, [range.from, range.to, city, cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const cities = ref.get()?.cities ?? [];
  const cats = ref.get()?.cats ?? [];
  const max = Math.max(1, ...(data?.funnel.map((f) => f[1]) ?? [1]));
  const barMax = Math.max(1, ...(data?.bars.map((b) => b.v) ?? [1]));
  const queues: [string, number, string, Tone, string][] = [
    [L.dashboard.zadaniya, counts.tasks, counts.tasksLate ? L.dashboard.prosrocheno(counts.tasksLate) : L.dashboard.vNorme, counts.tasksLate ? 'bad' : 'ok', '/admin/moderation/tasks'],
    [L.dashboard.profiliMasterov, counts.masters, L.dashboard.vNorme, 'ok', '/admin/moderation/masters'],
    [L.dashboard.spory, counts.disputes, counts.disputesHot || L.dashboard.vNorme, counts.disputesHot && counts.disputesHot !== L.dashboard.vNorme ? 'warn' : 'ok', '/admin/disputes'],
    [L.dashboard.otzyvy, counts.reviews, L.dashboard.vNorme, 'ok', '/admin/reviews'],
    [L.dashboard.chatyPoZhalobam, counts.chats, counts.chats ? L.dashboard.novaya : L.dashboard.net, counts.chats ? 'info' : 'grey', '/admin/complaints'],
  ];

  const csv = () =>
    data &&
    downloadCsv(`ekor-dashboard-${range.from}_${range.to}.csv`, [
      [L.dashboard.pokazatel, L.dashboard.znachenie, L.dashboard.kommentariy], ...data.kpis.map(([l, v, c]) => [l, v, c]), [], [L.dashboard.voronka, L.dashboard.chislo, L.dashboard.konversiya], ...data.funnel.map(([l, n, p]) => [l, n, p]),
      [], [L.dashboard.gorod, L.dashboard.zadaniya, L.dashboard.mastera, L.dashboard.otklik24ch, L.dashboard.vybor, L.dashboard.zaversh, L.dashboard._1YOtklik], ...data.cities,
    ]);

  return (
    <>
      <Head title={L.dashboard.dashbord}>
        <Seg value={period} onChange={setPeriod} items={PERIODS} />
        {period === 'custom' && (
          <>
            <input type="date" className={s.chip} aria-label={L.dashboard.s} value={own.from} max={own.to || undefined} onChange={(e) => setOwn({ ...own, from: e.target.value })} />
            <span className={s.muted}>–</span>
            <input type="date" className={s.chip} aria-label={L.dashboard.po} value={own.to} min={own.from || undefined} max={day(new Date())} onChange={(e) => setOwn({ ...own, to: e.target.value })} />
          </>
        )}
        <SelectChip label="" value={city} onChange={setCity} options={[['all', L.dashboard.vseGoroda], ...cities.map((c): [string, string] => [String(c.id), c.name.ru])]} />
        <SelectChip label="" value={cat} onChange={setCat} options={[['all', L.dashboard.vseKategorii], ...cats.map((c): [string, string] => [String(c.id), c.name.ru])]} />
        <span className={s.grow} />
        <span className={s.muted}>{data ? L.dashboard.obnovleno(data.period, at) : ''}</span>
        <button type="button" className={s.hbtn} onClick={csv} disabled={!data}>
          <Download size={15} aria-hidden />
          CSV
        </button>
      </Head>
      {!data ? (
        <Loading />
      ) : (
        <div className={d.body}>
          <div className={d.kpis}>
            {data.kpis.map(([l, v, sub, up]) => (
              <div key={l} className={d.card}>
                <span className={s.muted}>{l}</span>
                <span className={d.kpiV}>{v}</span>
                <span className={d.kpiD} style={{ color: up ? '#0B6E5E' : '#B03A2E' }}>
                  {sub}
                </span>
              </div>
            ))}
          </div>
          <div className={d.row2}>
            <div className={d.card} style={{ padding: '14px 16px', gap: 10 }}>
              <div className={d.cardHead}>
                <span className={d.cardT}>{L.dashboard.voronkaZadaniya}</span>
                <span className={s.muted}>{L.dashboard.konversiyaOtPredyduschegoShaga}</span>
              </div>
              {data.funnel.map(([l, n, p], i) => (
                <div key={l} className={d.fRow}>
                  <span style={{ color: '#3B4756' }}>{l}</span>
                  <div className={d.track}>
                    <div style={{ width: `${((n / max) * 100).toFixed(1)}%`, background: i === 0 ? '#9AAEF0' : '#2647D9' }} />
                  </div>
                  <span className={d.fNum}>{num(n)}</span>
                  <span className={d.fPct} style={{ color: p && parseInt(p) < 60 ? '#8A4B0D' : '#3B4756' }}>
                    {p}
                  </span>
                </div>
              ))}
            </div>
            <div className={d.card} style={{ padding: '14px 16px', gap: 10 }}>
              <div className={d.cardHead}>
                <span className={d.cardT}>{L.dashboard.novyeZadaniyaPoDnyam}</span>
                <span className={s.muted}>{L.dashboard.poslednie} {data.bars.length} {L.dashboard.dn}</span>
              </div>
              <div className={d.bars} style={{ gridTemplateColumns: `repeat(${Math.max(data.bars.length, 7)}, 1fr)` }}>
                {data.bars.map((b, i) => (
                  <div key={i} className={d.bar} title={`${b.d}: ${b.v}`}>
                    <div style={{ height: `${(b.v / barMax) * 100}%`, background: i >= data.bars.length - 7 ? '#2647D9' : '#C9D4F7' }} />
                    <span>{b.d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={d.card} style={{ padding: '14px 16px', gap: 6 }}>
              <span className={d.cardT} style={{ paddingBottom: 4 }}>
                {L.dashboard.ocherediSeychas}
              </span>
              {queues.map(([l, n, st, tone, href]) => (
                <Link key={l} href={href} className={d.q}>
                  <span>{l}</span>
                  <span className={d.qN}>{n}</span>
                  <span className={d.qS} style={{ background: ST[tone][0], color: ST[tone][1] }}>
                    {st}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div className={d.row3}>
            <div className={d.table}>
              <div className={d.tableT}>{L.dashboard.poGorodam}</div>
              <div className={d.cHead}>
                <span>{L.dashboard.gorod}</span>
                <span className={s.right}>{L.dashboard.zadaniya}</span>
                <span className={s.right}>{L.dashboard.mastera}</span>
                <span className={s.right}>{L.dashboard.otklik24ch}</span>
                <span className={s.right}>{L.dashboard.vybor}</span>
                <span className={s.right}>{L.dashboard.zaversh}</span>
                <span className={s.right}>{L.dashboard._1YOtklik}</span>
              </div>
              <div className={s.scroll}>
                {data.cities.map(([n, t, m, r, ch, dn, f]) => (
                  <div key={n} className={d.cRow}>
                    <b>{n}</b>
                    <span className={d.mono}>{t}</span>
                    <span className={d.mono}>{m}</span>
                    <span className={s.right} style={{ fontWeight: 600, color: parseInt(r) < 60 ? '#B03A2E' : parseInt(r) < 75 ? '#8A4B0D' : '#0B6E5E' }}>
                      {r}
                    </span>
                    <span className={s.right}>{ch}</span>
                    <span className={s.right}>{dn}</span>
                    <span className={s.right} style={{ color: '#3B4756' }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className={d.table}>
              <div className={d.tableT} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{L.dashboard.defitsitMasterov}</span>
                <span className={s.muted} style={{ fontSize: 13, fontWeight: 400 }}>
                  {L.dashboard.zadaniyBezOtklikaZa}
                </span>
              </div>
              {data.deficit.length === 0 && <div className={d.none}>{L.dashboard.vseZadaniyaPoluchiliOtklik}</div>}
              {data.deficit.map(([c, city2, p]) => (
                <div key={c + city2} className={d.def}>
                  <span className={s.cell}>
                    <b style={{ fontWeight: 600 }}>{c}</b> <span className={s.muted}>· {city2}</span>
                  </span>
                  <div className={d.track} style={{ height: 8 }}>
                    <div style={{ width: `${p}%`, background: '#D9822B' }} />
                  </div>
                  <span className={d.defP}>{p}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
