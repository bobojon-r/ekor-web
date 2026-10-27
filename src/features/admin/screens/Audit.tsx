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

const COLS = '76px 110px 140px 150px minmax(0,1fr)';
const QUICK = ['user.block', 'chat.view', 'limits.*'];

/** 12 — аудит-лог: записи нельзя изменить или удалить */
export function Audit() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditV[] | null>(null);
  const [q, setQ] = useState('');
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
    adminApi.audit({ action, objectId: qDeb }).then(setRows, (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  }, [action, qDeb]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => (rows ?? []).filter((a) => who === 'all' || a.who === who), [rows, who]);
  const cur = view.find((a) => a.key === selKey) ?? view[0] ?? null;
  const people = [...new Set((rows ?? []).map((a) => a.who))];
  const actions = [...new Set((rows ?? []).map((a) => a.action))];
  const idx = cur ? view.indexOf(cur) : -1;
  useHotkeys(cur ? { j: () => view[idx + 1] && setSelKey(view[idx + 1].key), k: () => idx > 0 && setSelKey(view[idx - 1].key) } : {});

  const diffKeys = cur ? [...new Set([...Object.keys(cur.old ?? {}), ...Object.keys(cur.next ?? {})])] : [];

  return (
    <>
      <Head title="Аудит-лог">
        <span className={s.muted}>{rows ? `${period === 'today' ? 'сегодня' : period === '7' ? '7 дней' : '30 дней'} · ${num(view.length)} записей` : ''}</span>
        <span className={s.grow} />
        <SearchBox value={q} onChange={setQ} placeholder="ID объекта" slash />
        <button type="button" className={s.hbtn} disabled={!view.length} onClick={() => downloadCsv('ekor-audit.csv', [['Время', 'Сотрудник', 'Действие', 'Объект', 'Детали'], ...view.map((a) => [a.time, a.who, a.action, a.obj, a.details])])}>
          <Download size={15} aria-hidden />
          CSV
        </button>
      </Head>
      <div className={s.filters}>
        <SelectChip label="" value={period} onChange={setPeriod} options={[['today', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней']]} />
        <SelectChip label="Сотрудник" value={who} onChange={setWho} options={[['all', 'все'], ...people.map((p): [string, string] => [p, p])]} />
        <SelectChip label="Действие" value={QUICK.includes(action) || !action ? '' : action} onChange={setAction} options={[['', 'все'], ...actions.map((a): [string, string] => [a, a])]} />
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
              <span>Время</span>
              <span>Сотрудник</span>
              <span>Действие</span>
              <span>Объект</span>
              <span>Детали</span>
            </div>
            <div className={s.scroll}>
              {view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>Записей нет</div>}
              {view.map((a) => (
                <div key={a.key} role="button" tabIndex={0} onClick={() => setSelKey(a.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(a.key)} className={cx(s.row, cur?.key === a.key && s.rowOn)} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
                  <span className={s.id}>{a.time}</span>
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
                <span>Сотрудник</span>
                <span style={{ fontWeight: 400 }}>{cur.who}</span>
                <span>Объект</span>
                <span style={{ fontWeight: 400, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{cur.obj}</span>
                <span>Основание</span>
                <span style={{ fontWeight: 400 }}>{cur.comment || '—'}</span>
              </div>
              {diffKeys.length > 0 && (
                <div style={{ border: '1px solid #E1E6EC', borderRadius: 8, overflow: 'hidden', font: "500 12px/1.7 'JetBrains Mono', monospace" }}>
                  <div className={s.label} style={{ display: 'block', padding: '6px 12px', background: '#F7F9FB', borderBottom: '1px solid #E1E6EC' }}>
                    Было → стало
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
                <span>Записи нельзя изменить или удалить. Хранение — 3 года.</span>
              </div>
            </div>
          ) : (
            <div className={s.loading}>Выберите запись</div>
          )}
        </div>
      )}
    </>
  );
}
