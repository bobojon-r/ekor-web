'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, SlidersHorizontal } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { adminApi } from '../data/api';
import type { HistoryV, LimitV } from '../data/types';
import { cx, Head, Label, Loading, Modal, Pill } from '../ui';
import s from '../Admin.module.css';

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'несохранённое изменение' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'несохранённых изменения' : 'несохранённых изменений');

/** 09 — лимиты (admin); 15 — подтверждение с основанием */
export function Limits() {
  const toast = useToast();
  const [rows, setRows] = useState<LimitV[] | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [hist, setHist] = useState<HistoryV[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([adminApi.limits(), adminApi.limitHistory()]).then(
      ([l, h]) => (setRows(l), setVals(Object.fromEntries(l.map((x) => [x.key, String(x.value)]))), setHist(h)),
      (e) => (setRows([]), toast(apiErrorText(e, 'ru'))),
    );
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = useMemo(() => (rows ?? []).filter((r) => vals[r.key] !== undefined && vals[r.key] !== '' && +vals[r.key] !== r.value), [rows, vals]);
  const invalid = (rows ?? []).some((r) => vals[r.key] === '' || !(+vals[r.key] >= 0));
  const groups = useMemo(() => {
    const m = new Map<string, LimitV[]>();
    (rows ?? []).forEach((r) => m.set(r.group, [...(m.get(r.group) ?? []), r]));
    return [...m];
  }, [rows]);

  const save = async () => {
    setBusy(true);
    try {
      const values = Object.fromEntries(changes.map((r) => [r.key, +vals[r.key]]));
      await adminApi.saveLimits(values, Object.fromEntries(changes.map((r) => [r.key, r.value])), Object.fromEntries(changes.map((r) => [r.key, r.label])), why.trim());
      setConfirm(false);
      setWhy('');
      toast('Лимиты сохранены. Применятся в течение 5 минут');
      await load();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };

  return (
    <>
      <Head title="Лимиты и настройки">
        <Pill big tone="dark">
          admin
        </Pill>
        <span className={s.grow} />
        <span className={s.muted}>Действует для всех городов. Переопределение по городу — в следующей версии.</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start', overflowY: 'auto', background: '#F7F9FB' }}>
            {groups.map(([g, items]) => (
              <div key={g} style={{ background: '#fff', border: '1px solid #E1E6EC', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #EEF1F4' }}>{g}</div>
                {items.map((i) => {
                  const ch = changes.includes(i);
                  return (
                    <label key={i.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 80px 64px', gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #EEF1F4', background: ch ? '#F7F9FF' : '#fff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span>{i.label}</span>
                        {ch && <span style={{ fontSize: 11, color: '#2647D9', fontWeight: 600 }}>было {i.value}</span>}
                      </div>
                      <input
                        inputMode="numeric"
                        value={vals[i.key] ?? ''}
                        onChange={(e) => setVals({ ...vals, [i.key]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        className={cx(vals[i.key] === '' && s.invalid)}
                        style={{ height: 32, borderRadius: 7, border: `1.5px solid ${ch ? '#2647D9' : '#C9D1DB'}`, background: '#fff', textAlign: 'right', padding: '0 10px', font: "600 13px 'JetBrains Mono', monospace", width: '100%', boxSizing: 'border-box', outline: 'none' }}
                      />
                      <span className={s.muted}>{i.unit}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ borderLeft: '1px solid #E1E6EC', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={s.panelBody} style={{ gap: 12 }}>
              <Label>История изменений</Label>
              {[...changes.map((r): HistoryV => [`${r.label}: ${r.value} → ${vals[r.key]}`, 'черновик · вы', true]), ...hist].map(([t, d, draft], i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 8, height: 8, marginTop: 5, borderRadius: '50%', background: draft ? '#2647D9' : '#9AA5B4', flex: 'none' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ lineHeight: 1.4 }}>{t}</span>
                    <span className={s.muted} style={{ fontSize: 12 }}>
                      {d}
                    </span>
                  </div>
                </div>
              ))}
              {!changes.length && !hist.length && <span className={s.muted}>Изменений ещё не было</span>}
              <div className={s.alertInfo} style={{ marginTop: 6 }}>
                <Lock size={15} aria-hidden />
                <span>Новые лимиты применяются к новым действиям. Уже отправленные отклики и открытые задания не меняются.</span>
              </div>
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid #E1E6EC', display: 'flex', flexDirection: 'column', gap: 8, background: '#fff' }}>
              <span className={s.fieldT}>{changes.length ? `${changes.length} ${plural(changes.length)}` : 'Изменений нет'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={s.btn} style={{ flex: 1 }} disabled={!changes.length} onClick={() => setVals(Object.fromEntries(rows.map((x) => [x.key, String(x.value)])))}>
                  Сбросить
                </button>
                <button type="button" className={cx(s.btn, s.btnBlue)} style={{ flex: 1.4 }} disabled={!changes.length || invalid} onClick={() => setConfirm(true)}>
                  Сохранить…
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <Modal
          icon={SlidersHorizontal}
          tone="blue"
          title={`Сохранить ${changes.length} ${changes.length === 1 ? 'изменение' : changes.length < 5 ? 'изменения' : 'изменений'} лимитов?`}
          sub="Применяется ко всем городам через 5 минут."
          okText="Сохранить изменения"
          okDisabled={why.trim().length < 10}
          busy={busy}
          onClose={() => setConfirm(false)}
          onOk={save}
        >
          <div style={{ border: '1px solid #E1E6EC', borderRadius: 8, overflow: 'hidden' }}>
            <div className={s.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 70px', gap: 8, padding: '8px 12px', background: '#F7F9FB' }}>
              <span>Параметр</span>
              <span className={s.right}>Было</span>
              <span className={s.right}>Станет</span>
            </div>
            {changes.map((r) => (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 70px', gap: 8, padding: '9px 12px', borderTop: '1px solid #EEF1F4' }}>
                <span>{r.label}</span>
                <span className={cx(s.right, s.mono)} style={{ color: '#5B6878' }}>
                  {r.value} {r.unit === 'мин' ? 'мин' : ''}
                </span>
                <span className={cx(s.right, s.mono)} style={{ fontWeight: 600 }}>
                  {vals[r.key]} {r.unit === 'мин' ? 'мин' : ''}
                </span>
              </div>
            ))}
          </div>
          <div className={s.bullets}>
            <b>Что изменится</b>
            <span>· Новые значения действуют для новых действий во всех городах</span>
            <span>· Уже отправленные отклики, открытые задания и текущие блокировки остаются по прежним правилам</span>
          </div>
          <div className={s.col4}>
            <span className={s.fieldT}>
              Основание <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={why} onChange={(e) => setWhy(e.target.value.slice(0, 500))} placeholder="Почему меняем лимиты — от 10 символов" autoFocus />
            <span className={s.muted}>Попадёт в аудит-лог и историю изменений</span>
          </div>
        </Modal>
      )}
    </>
  );
}
