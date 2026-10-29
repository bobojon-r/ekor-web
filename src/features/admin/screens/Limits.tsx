'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, SlidersHorizontal } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { adminApi } from '../data/api';
import type { HistoryV, LimitEffect, LimitV } from '../data/types';
import { cx, Head, Label, Loading, Modal, Pill } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? L.limits.nesohranennoeIzmenenie : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? L.limits.nesohranennyhIzmeneniya : L.limits.nesohranennyhIzmeneniy);

/** 09 — лимиты (admin); 15 — подтверждение с основанием */
export function Limits() {
  const toast = useToast();
  const [rows, setRows] = useState<LimitV[] | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [hist, setHist] = useState<HistoryV[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [effects, setEffects] = useState<LimitEffect[] | null>(null);

  const load = () =>
    Promise.all([adminApi.limits(), adminApi.limitHistory()]).then(
      ([l, h]) => (setRows(l), setVals(Object.fromEntries(l.map((x) => [x.key, String(x.value)]))), setHist(h)),
      (e) => (setRows([]), toast(apiErrorText(e, 'ru'))),
    );
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = useMemo(() => (rows ?? []).filter((r) => vals[r.key] !== undefined && vals[r.key] !== '' && +vals[r.key] !== r.value), [rows, vals]);
  const outOf = (r: LimitV) => vals[r.key] === '' || !(+vals[r.key] >= (r.min ?? 0)) || (r.max != null && +vals[r.key] > r.max);
  const invalid = (rows ?? []).some(outOf);
  const payload = () =>
    changes.map((r) => ({
      key: r.key,
      value: +vals[r.key],
      version: r.version,
      label: r.label,
      prev: r.value,
    }));

  // Уход со страницы с несохранёнными изменениями — подтверждение браузера
  useEffect(() => {
    if (!changes.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [changes.length]);

  /** «Сохранить…» — сначала dry_run: сервер считает, что изменится, и ничего не сохраняет */
  const preview = async () => {
    setBusy(true);
    try {
      setEffects(await adminApi.saveLimits(payload(), L.limits.predprosmotr, true));
      setConfirm(true);
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const groups = useMemo(() => {
    const m = new Map<string, LimitV[]>();
    (rows ?? []).forEach((r) => m.set(r.group, [...(m.get(r.group) ?? []), r]));
    return [...m];
  }, [rows]);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.saveLimits(payload(), why.trim());
      setConfirm(false);
      setWhy('');
      toast(L.limits.limitySohranenyPrimenyatsyaV);
      await load();
    } catch (e) {
      // 409 — кто-то успел изменить лимит: перечитываем значения
      if ((e as { status?: number }).status === 409) {
        toast(L.limits.limityUspeliIzmenitZnacheniya);
        setConfirm(false);
        await load();
      } else toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };

  return (
    <>
      <Head title={L.limits.limityINastroyki}>
        <Pill big tone="dark">
          admin
        </Pill>
        <span className={s.grow} />
        <span className={s.muted}>{L.limits.deystvuetDlyaVsehGorodov}</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
          <div
            style={{
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              alignContent: 'start',
              overflowY: 'auto',
              background: '#F7F9FB',
            }}
          >
            {groups.map(([g, items]) => (
              <div
                key={g}
                style={{
                  background: '#fff',
                  border: '1px solid #E1E6EC',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    fontSize: 14,
                    fontWeight: 700,
                    borderBottom: '1px solid #EEF1F4',
                  }}
                >
                  {g}
                </div>
                {items.map((i) => {
                  const ch = changes.includes(i);
                  return (
                    <label
                      key={i.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) 80px 64px',
                        gap: 10,
                        alignItems: 'center',
                        padding: '8px 14px',
                        borderBottom: '1px solid #EEF1F4',
                        background: ch ? '#F7F9FF' : '#fff',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        <span>{i.label}</span>
                        {ch && (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#2647D9',
                              fontWeight: 600,
                            }}
                          >
                            {L.limits.bylo} {i.value}
                          </span>
                        )}
                        {outOf(i) && i.min != null && (
                          <span style={{ fontSize: 11, color: '#A5281B' }}>
                            {L.limits.ot} {i.min} {L.limits.do} {i.max}
                          </span>
                        )}
                      </div>
                      <input
                        inputMode="numeric"
                        value={vals[i.key] ?? ''}
                        onChange={(e) =>
                          setVals({
                            ...vals,
                            [i.key]: e.target.value.replace(/\D/g, '').slice(0, 6),
                          })
                        }
                        className={cx(outOf(i) && s.invalid)}
                        title={i.min != null ? L.limits.otDoPoUmolchaniyu(i.min, i.max, i.def) : undefined}
                        style={{
                          height: 32,
                          borderRadius: 7,
                          border: `1.5px solid ${ch ? '#2647D9' : '#C9D1DB'}`,
                          background: '#fff',
                          textAlign: 'right',
                          padding: '0 10px',
                          font: "600 13px 'JetBrains Mono', monospace",
                          width: '100%',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                      <span className={s.muted}>{i.unit}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div
            style={{
              borderLeft: '1px solid #E1E6EC',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div className={s.panelBody} style={{ gap: 12 }}>
              <Label>{L.limits.istoriyaIzmeneniy}</Label>
              {[...changes.map((r): HistoryV => [`${r.label}: ${r.value} → ${vals[r.key]}`, L.limits.chernovikVy, true]), ...hist].map(([t, d, draft], i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      marginTop: 5,
                      borderRadius: '50%',
                      background: draft ? '#2647D9' : '#9AA5B4',
                      flex: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ lineHeight: 1.4 }}>{t}</span>
                    <span className={s.muted} style={{ fontSize: 12 }}>
                      {d}
                    </span>
                  </div>
                </div>
              ))}
              {!changes.length && !hist.length && <span className={s.muted}>{L.limits.izmeneniyEscheNeBylo}</span>}
              <div className={s.alertInfo} style={{ marginTop: 6 }}>
                <Lock size={15} aria-hidden />
                <span>{L.limits.novyeLimityPrimenyayutsyaK}</span>
              </div>
            </div>
            <div
              style={{
                padding: '14px 18px',
                borderTop: '1px solid #E1E6EC',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: '#fff',
              }}
            >
              <span className={s.fieldT}>{changes.length ? `${changes.length} ${plural(changes.length)}` : L.limits.izmeneniyNet}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={s.btn} style={{ flex: 1 }} disabled={!changes.length} onClick={() => setVals(Object.fromEntries(rows.map((x) => [x.key, String(x.value)])))}>
                  {L.limits.sbrosit}
                </button>
                <button type="button" className={cx(s.btn, s.btnBlue)} style={{ flex: 1.4 }} disabled={!changes.length || invalid || busy} onClick={preview}>
                  {L.limits.sohranit}
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
          title={L.limits.sohranitLimitov(changes.length, changes.length === 1 ? L.limits.izmenenie : changes.length < 5 ? L.limits.izmeneniya : L.limits.izmeneniy)}
          sub={L.limits.primenyaetsyaKoVsemGorodam}
          okText={L.limits.sohranitIzmeneniya}
          okDisabled={why.trim().length < 10}
          busy={busy}
          onClose={() => setConfirm(false)}
          onOk={save}
        >
          <div
            style={{
              border: '1px solid #E1E6EC',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              className={s.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 70px 70px',
                gap: 8,
                padding: '8px 12px',
                background: '#F7F9FB',
              }}
            >
              <span>{L.limits.parametr}</span>
              <span className={s.right}>{L.limits.bylo2}</span>
              <span className={s.right}>{L.limits.stanet}</span>
            </div>
            {changes.map((r) => (
              <div
                key={r.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 70px 70px',
                  gap: 8,
                  padding: '9px 12px',
                  borderTop: '1px solid #EEF1F4',
                }}
              >
                <span>{r.label}</span>
                <span className={cx(s.right, s.mono)} style={{ color: '#5B6878' }}>
                  {r.value} {r.unit === L.limits.min ? L.limits.min : ''}
                </span>
                <span className={cx(s.right, s.mono)} style={{ fontWeight: 600 }}>
                  {vals[r.key]} {r.unit === L.limits.min ? L.limits.min : ''}
                </span>
              </div>
            ))}
          </div>
          <div className={s.bullets}>
            <b>{L.limits.chtoIzmenitsya}</b>
            {effects?.length ? (
              effects.map((x) => (
                <span key={x.label}>
                  · {x.label}: {x.effect}
                  {x.affected != null ? L.limits.zatronet(x.affected) : ''}
                </span>
              ))
            ) : (
              <>
                <span>{L.limits.novyeZnacheniyaDeystvuyutDlya}</span>
                <span>{L.limits.uzheOtpravlennyeOtklikiOtkrytye}</span>
              </>
            )}
          </div>
          <div className={s.col4}>
            <span className={s.fieldT}>
              {L.limits.osnovanie} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={why} onChange={(e) => setWhy(e.target.value.slice(0, 500))} placeholder={L.limits.pochemuMenyaemLimityOt} autoFocus />
            <span className={s.muted}>{L.limits.popadetVAuditLog}</span>
          </div>
        </Modal>
      )}
    </>
  );
}
