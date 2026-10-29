'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { adminApi } from '../data/api';
import type { AuditV } from '../data/types';
import { downloadCsv, num } from '../core';
import { cx, Head, Loading, Pill, SearchBox, SelectChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

const COLS = '96px 110px 140px 150px minmax(0,1fr)';
const QUICK = ['user.block', 'chat.view', 'limits.*'];

/** 12 — аудит-лог: записи нельзя изменить или удалить */
export function Audit() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditV[] | null>(null);
  const [q, setQ] = useState('');
  // «В аудите» из реестра: /admin/audit?object=T-48120
  useEffect(() => {
    const o = new URLSearchParams(location.search).get('object');
    if (o) setQ(o);
  }, []);
  const [qDeb, setQDeb] = useState('');
  const [action, setAction] = useState('');
  const [who, setWho] = useState('all');
  const [period, setPeriod] = useState('today');
  const [selKey, setSelKey] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    setRows(null);
    adminApi.audit({ action, objectId: qDeb, days: period === 'today' ? 1 : +period }).then(setRows, (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  }, [action, qDeb, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => (rows ?? []).filter((a) => who === 'all' || a.who === who), [rows, who]);
  const cur = view.find((a) => a.key === selKey) ?? view[0] ?? null;
  const people = [...new Set((rows ?? []).map((a) => a.who))];
  const actions = [...new Set((rows ?? []).map((a) => a.action))];
  const idx = cur ? view.indexOf(cur) : -1;
  useHotkeys(cur ? { j: () => view[idx + 1] && setSelKey(view[idx + 1].key), k: () => idx > 0 && setSelKey(view[idx - 1].key) } : {});

  const diffKeys = cur ? [...new Set([...Object.keys(cur.old ?? {}), ...Object.keys(cur.next ?? {})])] : [];

  return (
    <>
      <Head title={L.audit.auditLog}>
        <span className={s.muted}>{rows ? L.audit.zapisey(period === 'today' ? L.audit.segodnya : period === '7' ? L.audit._7Dney : L.audit._30Dney, num(view.length)) : ''}</span>
        <span className={s.grow} />
        <SearchBox value={q} onChange={setQ} placeholder={L.audit.idObekta} slash />
        <button
          type="button"
          className={s.hbtn}
          disabled={!view.length}
          onClick={() => {
            // С бэкендом — серверная выгрузка (до 50 000 строк, сама пишется в аудит); в демо — из таблицы
            const url = adminApi.auditCsvUrl({ action, objectId: qDeb, days: period === 'today' ? 1 : +period });
            if (url) window.location.href = url;
            else downloadCsv('ekor-audit.csv', [[L.audit.vremya, L.audit.sotrudnik, L.audit.deystvie, L.audit.obekt, L.audit.detali], ...view.map((a) => [a.time, a.who, a.action, a.obj, a.details])]);
          }}
        >
          <Download size={15} aria-hidden />
          CSV
        </button>
      </Head>
      <div className={s.filters}>
        <SelectChip label="" value={period} onChange={setPeriod} options={[['today', L.audit.segodnya2], ['7', L.audit._7Dney], ['30', L.audit._30Dney]]} />
        <SelectChip label={L.audit.sotrudnik} value={who} onChange={setWho} options={[['all', L.audit.vse], ...people.map((p): [string, string] => [p, p])]} />
        <SelectChip label={L.audit.deystvie} value={QUICK.includes(action) || !action ? '' : action} onChange={setAction} options={[['', L.audit.vse], ...actions.map((a): [string, string] => [a, a])]} />
        {QUICK.map((a) => (
          <button key={a} type="button" aria-pressed={action === a} className={cx(s.chip, action === a ? s.chipOn : s.chipLight)} onClick={() => setAction(action === a ? '' : a)}>
            {a}
          </button>
        ))}
      </div>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 400px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
              <span>{L.audit.vremya}</span>
              <span>{L.audit.sotrudnik}</span>
              <span>{L.audit.deystvie}</span>
              <span>{L.audit.obekt}</span>
              <span>{L.audit.detali}</span>
            </div>
            <div className={s.scroll}>
              {view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{L.audit.zapiseyNet}</div>}
              {view.map((a) => (
                <div key={a.key} role="button" tabIndex={0} onClick={() => setSelKey(a.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(a.key)} className={cx(s.row, cur?.key === a.key && s.rowOn)} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
                  <span className={s.id} title={a.date}>{period === 'today' ? a.time : `${a.date ?? ''} ${a.time.slice(0, 5)}`}</span>
                  <span className={s.cell}>{a.who}</span>
                  <span>
                    <Pill mono tone={a.tone}>
                      {a.action}
                    </Pill>
                  </span>
                  <span className={s.cell} style={{ font: "500 12px 'JetBrains Mono', monospace", color: '#2647D9' }}>
                    {a.obj}
                  </span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {a.details}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {cur ? (
            <div className={s.panelBody} style={{ gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Pill mono tone={cur.tone}>
                  {cur.action}
                </Pill>
                <span className={s.metaLine}>
                  {cur.evt} · {cur.time}
                </span>
              </div>
              <div className={s.kv} style={{ gridTemplateColumns: '100px 1fr', gap: '6px 10px' }}>
                <span>{L.audit.sotrudnik}</span>
                <span style={{ fontWeight: 400 }}>{cur.who}</span>
                <span>{L.audit.obekt}</span>
                <span style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{cur.obj}</span>
                <span>{L.audit.osnovanie}</span>
                <span style={{ fontWeight: 400 }}>{cur.comment || '—'}</span>
                {(cur.ip || cur.device) && (
                  <>
                    <span>{L.audit.ipUstroystvo}</span>
                    <span style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{[cur.ip, cur.device].filter(Boolean).join(' · ')}</span>
                  </>
                )}
              </div>
              {diffKeys.length > 0 && (
                <div style={{ border: '1px solid #E1E6EC', borderRadius: 8, overflow: 'hidden', font: "500 12px/1.7 'JetBrains Mono', monospace" }}>
                  <div className={s.label} style={{ display: 'block', padding: '6px 12px', background: '#F7F9FB', borderBottom: '1px solid #E1E6EC' }}>
                    {L.audit.byloStalo}
                  </div>
                  {diffKeys.map((k) => (
                    <div key={k}>
                      {cur.old && k in cur.old && <div style={{ padding: '4px 12px', background: '#FFF1EF', color: '#A5281B' }}>− {k}: {JSON.stringify(cur.old[k])}</div>}
                      {cur.next && k in cur.next && <div style={{ padding: '4px 12px', background: '#F1FAF7', color: '#0B6E5E' }}>+ {k}: {JSON.stringify(cur.next[k])}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className={s.alertInfo}>
                <Lock size={15} aria-hidden />
                <span>{L.audit.zapisiNelzyaIzmenitIli}</span>
              </div>
            </div>
          ) : (
            <div className={s.loading}>{L.audit.vyberiteZapis}</div>
          )}
        </div>
      )}
    </>
  );
}
