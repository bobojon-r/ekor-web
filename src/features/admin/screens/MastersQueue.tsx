'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Check, CircleHelp, TriangleAlert, UserX, X } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin, useUndo } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Check as Chk, Lock, MasterCard, MasterQ, Reason } from '../data/types';
import { agoText, sla } from '../core';
import { cx, EmptyQueue, Head, HotkeyHelp, Label, Loading, Marked, Modal, Photo, Pill, RefreshBtn, Switch, Tabs, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

const COLS = '64px minmax(0,1fr) 120px 92px 56px';
type TabK = 'new' | 'changes' | 'verify';
const inTab = (m: MasterQ, t: TabK) => (t === 'new' ? m.type === L.mastersQueue.novyy || m.type === L.mastersQueue.povtorno : t === 'changes' ? m.type === L.mastersQueue.izmeneniya : m.type === L.mastersQueue.proveren);
const CHK: Record<0 | 1 | 2, [string, typeof Check]> = {
  1: ['#E3F4F0', Check],
  0: ['#FBE3E0', X],
  2: ['#FBEBDA', CircleHelp],
};
const CHK_FG = { 1: '#0B6E5E', 0: '#A5281B', 2: '#8A4B0D' } as const;

/** 03 — профили мастеров: таблица + карточка 560px с чек-листом модератора */
export function MastersQueue() {
  const { me, refreshCounts } = useAdmin();
  const undo = useUndo();
  const toast = useToast();
  const [rows, setRows] = useState<MasterQ[] | null>(null);
  const [tab, setTab] = useState<TabK>('new');
  const [sel, setSel] = useState(0);
  const [card, setCard] = useState<MasterCard | null>(null);
  const [checks, setChecks] = useState<Chk[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [rej, setRej] = useState<null | {
    back: boolean;
    reason: Reason | null;
    comment: string;
  }>(null);
  const [ver, setVer] = useState<null | { on: boolean; comment: string; decline?: boolean }>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState<Lock | null>(null);
  const [now, setNow] = useState(Date.now());
  const loadedAt = useRef(Date.now());

  const load = () => adminApi.masters().then((r) => ((loadedAt.current = Date.now()), setRows(r)), (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  useEffect(() => {
    load();
    adminApi.masterReasons().then(setReasons, () => {});
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => (rows ?? []).filter((m) => inTab(m, tab)).sort((a, b) => a.slaLeft - b.slaLeft), [rows, tab]);
  const cur = view[Math.min(sel, view.length - 1)] ?? null;
  const elapsed = (now - loadedAt.current) / 60000;

  useEffect(() => {
    setCard(null);
    setLock(cur?.lock ?? null);
    if (!cur) return;
    let live = true;
    // Открытый профиль берётся в работу на 10 мин — у других модераторов «Смотрит …»
    if (!cur.lock || cur.lock.mine)
      adminApi.lockMaster(cur).then(
        (l) => live && l && setLock(l),
        (e) => live && (e as { code?: string }).code === 'locked_by_other' && setLock({ name: L.mastersQueue.drugoyModerator, mine: false }),
      );
    adminApi.masterCard(cur).then(
      (c) => live && (setCard(c), setChecks(c.checklist), setVerified(c.verified)),
      (e) => toast(apiErrorText(e, 'ru')),
    );
    return () => {
      live = false;
    };
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const failed = checks.filter((c) => c[1] === 0).length;
  const by = lock && !lock.mine ? lock.name : null;
  const senior = me.role !== 'moderator';
  const isReq = cur?.type === L.mastersQueue.proveren;
  const decide = async (ok: boolean, reason?: Reason, comment?: string, back = false) => {
    if (!cur || busy || by) return;
    if (ok && !back) {
      // Одобрение обратимо 5 с: профиль уходит из очереди сразу, запрос — когда истечёт «Отменить»
      const q = cur;
      setRows((r) => r?.filter((x) => x.key !== q.key) ?? r);
      return undo(
        L.mastersQueue.profilOdobren(q.name),
        () =>
          adminApi.moderateMaster(q, true).then(refreshCounts, (e) => {
            setRows((r) => (r && !r.some((x) => x.key === q.key) ? [q, ...r] : r));
            toast(apiErrorText(e, 'ru'));
          }),
        () => setRows((r) => (r && !r.some((x) => x.key === q.key) ? [q, ...r] : r)),
      );
    }
    setBusy(true);
    try {
      if (back) await adminApi.returnMaster(cur, comment ?? '');
      else await adminApi.moderateMaster(cur, ok, reason, comment);
      setRows((r) => r?.filter((x) => x.key !== cur.key) ?? r);
      setRej(null);
      toast(ok ? L.mastersQueue.profilOdobren(cur.name) : back ? L.mastersQueue.profilVozvraschenNaPravki : L.mastersQueue.otklonenoMasterPoluchilPrichinu);
      refreshCounts();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'already_resolved' || code === 'locked_by_other') {
        setRows((r) => r?.filter((x) => x.key !== cur.key) ?? r);
        setRej(null);
        toast(code === 'already_resolved' ? L.mastersQueue.uzheObrabotano(cur.id) : L.mastersQueue.smotritDrugoyModerator(cur.name));
      } else toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const cycle = (i: number) => setChecks((c) => c.map((x, j) => (j === i ? [x[0], x[1] === 1 ? 0 : x[1] === 0 ? 2 : 1, x[2]] : x)));
  const openBack = () => {
    setRej({
      back: true,
      reason: null,
      comment: checks
        .filter((c) => c[1] === 0)
        .map((c) => `${c[0]}${c[2] ? ` (${c[2]})` : ''}`)
        .join('; '),
    });
  };

  useHotkeys(
    cur
      ? {
          j: () => setSel((i) => Math.min(view.length - 1, i + 1)),
          k: () => setSel((i) => Math.max(0, i - 1)),
          a: () => (isReq ? senior && !by && setVer({ on: true, comment: '' }) : !failed && card && decide(true)),
          r: () => !by && (isReq ? senior && setVer({ on: false, comment: '', decline: true }) : setRej({ back: false, reason: null, comment: '' })),
        }
      : {},
  );

  const counts = {
    new: (rows ?? []).filter((m) => inTab(m, 'new')).length,
    changes: (rows ?? []).filter((m) => inTab(m, 'changes')).length,
    verify: (rows ?? []).filter((m) => inTab(m, 'verify')).length,
  };

  return (
    <>
      <Head title={L.mastersQueue.moderatsiyaProfiliMasterov}>
        <HotkeyHelp keys={[["J / K", L.mastersQueue.sleduyuschiyPredyduschiyProfil], ["A", L.mastersQueue.odobrit], ["R", L.mastersQueue.otklonitSPrichinoy], ["Esc", L.mastersQueue.zakrytOkno], ["?", L.mastersQueue.etaPodskazka]]} />
        <Tabs value={tab} onChange={(k) => (setTab(k), setSel(0))} items={[['new', L.mastersQueue.novye(counts.new)], ['changes', L.mastersQueue.izmeneniyaProfilya(counts.changes)], ['verify', L.mastersQueue.zaprosProveren(counts.verify)]]} />
        <span className={s.grow} />
        <span className={s.note}>{L.mastersQueue.sla24Ch}</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : view.length === 0 ? (
        <EmptyQueue text={L.mastersQueue.vseProfiliVEtoy} stats={[[String(counts.new + counts.changes + counts.verify), L.mastersQueue.vDrugihVkladkah], ['—', L.mastersQueue.vashaMediana], ['0', L.mastersQueue.prosrocheno]]}>
          <RefreshBtn onClick={() => (setRows(null), load(), refreshCounts())} />
        </EmptyQueue>
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
              <span>ID</span>
              <span>{L.mastersQueue.masterKategorii}</span>
              <span>{L.mastersQueue.gorod}</span>
              <span>{L.mastersQueue.podano}</span>
              <span className={s.right}>SLA</span>
            </div>
            <div className={s.scroll}>
              {view.map((m, i) => {
                const sl = sla(m.slaLeft - elapsed, 'h');
                return (
                  <div key={m.key} role="button" tabIndex={0} onClick={() => setSel(i)} onKeyDown={(e) => e.key === 'Enter' && setSel(i)} className={cx(s.row, s.rowTall, cur?.key === m.key && s.rowOn)} style={{ gridTemplateColumns: COLS }}>
                    <span className={s.id}>{m.id}</span>
                    <div
                      className={s.cell}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <span className={s.cell} style={{ fontWeight: 600 }}>
                        {m.name} <Pill tone={m.tone}>{m.type}</Pill>
                        {m.lock && !m.lock.mine && <span className={s.lockTag}> {L.mastersQueue.smotrit} {m.lock.name}</span>}
                      </span>
                      <span className={cx(s.cell, s.muted)}>{m.cats}</span>
                    </div>
                    <span style={{ color: '#3B4756' }}>{m.city}</span>
                    <span style={{ color: '#3B4756' }}>{agoText(m.agoMin + elapsed)}</span>
                    <span className={s.num} style={{ color: sl.color }}>
                      {sl.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={s.panel}>
            {!card ? (
              <Loading />
            ) : (
              <>
                <div className={s.panelBody} style={{ padding: '16px 20px', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span
                      className={s.ph}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        flex: 'none',
                      }}
                    >
                      {card.avatar && <img src={card.avatar} alt="" />}
                    </span>
                    <div
                      className={s.grow}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <span className={s.h18}>{card.name}</span>
                      <span style={{ color: '#3B4756' }}>{card.sub}</span>
                      <span className={s.metaLine}>{card.meta}</span>
                    </div>
                    <Pill big tone={isReq ? 'ok' : 'warn'}>{isReq ? L.mastersQueue.zaprosProveren2 : L.mastersQueue.naProverke}</Pill>
                  </div>
                  <div
                    className={s.kv}
                    style={{
                      gridTemplateColumns: '110px 1fr',
                      gap: '6px 12px',
                    }}
                  >
                    <span>{L.mastersQueue.gorodRayony}</span>
                    <span style={{ fontWeight: 400 }}>{card.city}</span>
                    <span>{L.mastersQueue.tseny}</span>
                    <span style={{ fontWeight: 400 }}>{card.prices}</span>
                    <span>{L.mastersQueue.oSebe}</span>
                    <span style={{ fontWeight: 400, lineHeight: 1.5 }}>
                      <Marked text={card.about} marks={card.marks} />
                    </span>
                  </div>
                  {card.verifyReq && (
                    <div className={s.col6}>
                      <Label>{L.mastersQueue.zaprosProveren3} {card.verifyReq.meta}</Label>
                      <span style={{ lineHeight: 1.5 }}>{card.verifyReq.comment || L.mastersQueue.bezKommentariya}</span>
                      {card.verifyReq.photos.length ? (
                        <div className={s.photos6}>
                          {card.verifyReq.photos.map((p, i) => (
                            <Photo key={i} src={p || undefined} />
                          ))}
                        </div>
                      ) : (
                        <span className={s.muted}>{L.mastersQueue.dokumentyNePrilozhenySverte}</span>
                      )}
                    </div>
                  )}
                  {!!card.changes?.length && (
                    <div className={s.col6}>
                      <Label>{L.mastersQueue.byloStalo} {card.changes.length}</Label>
                      <div className={s.kv} style={{ gridTemplateColumns: '110px 1fr 1fr', gap: '6px 12px' }}>
                        <span />
                        <span className={s.muted}>{L.mastersQueue.bylo}</span>
                        <span className={s.muted}>{L.mastersQueue.stalo}</span>
                        {card.changes.map((c) => (
                          <Fragment key={c.label}>
                            <span>{c.label}</span>
                            <span style={{ fontWeight: 400, color: '#A5281B', textDecoration: 'line-through', lineHeight: 1.5 }}>{c.before}</span>
                            <span style={{ fontWeight: 400, color: '#0B6E5E', lineHeight: 1.5 }}>{c.after}</span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={s.col6}>
                    <Label>{L.mastersQueue.portfolio} {card.photos.length} {L.mastersQueue.foto}</Label>
                    {card.photos.length ? (
                      <div className={s.photos6}>
                        {card.photos.slice(0, 6).map((p, i) => (
                          <Photo key={i} src={p || undefined} />
                        ))}
                      </div>
                    ) : (
                      <span className={s.muted}>{L.mastersQueue.fotoRabotNet}</span>
                    )}
                  </div>
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
                        display: 'block',
                        padding: '8px 12px',
                        background: '#F7F9FB',
                        borderBottom: '1px solid #E1E6EC',
                      }}
                    >
                      {L.mastersQueue.chekListModeratora}
                    </div>
                    {checks.map(([t, ok, n], i) => {
                      const [bg, I] = CHK[ok];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => cycle(i)}
                          title={L.mastersQueue.nazhmiteChtobyIzmenitOtmetku}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderBottom: '1px solid #EEF1F4',
                            width: '100%',
                            background: '#fff',
                            border: 'none',
                            borderTop: i ? '1px solid #EEF1F4' : 'none',
                            textAlign: 'left',
                            fontSize: 13,
                          }}
                        >
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 5,
                              background: bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: 'none',
                            }}
                          >
                            <I size={13} color={CHK_FG[ok]} aria-hidden />
                          </span>
                          <span className={s.grow}>{t}</span>
                          <span
                            style={{
                              fontSize: 12,
                              color: ok === 0 ? '#A5281B' : ok === 2 ? '#8A4B0D' : '#5B6878',
                            }}
                          >
                            {n}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {by && (
                    <div className={s.alertWarn}>
                      <TriangleAlert size={15} aria-hidden />
                      <span>{L.mastersQueue.etotProfilSeychasSmotrit} {by}{L.mastersQueue.reshenieDostupnoKogdaOn}</span>
                    </div>
                  )}
                  {isReq && !senior && (
                    <div className={s.alertWarn}>
                      <TriangleAlert size={15} aria-hidden />
                      <span>{L.mastersQueue.zaprosProverenReshaetStarshiy}</span>
                    </div>
                  )}
                  {senior && !isReq && (
                    <div className={s.swRow}>
                      <Switch on={verified} onClick={() => setVer({ on: !verified, comment: '' })} label={L.mastersQueue.otmetkaProveren} />
                      <div className={s.col4} style={{ gap: 2 }}>
                        <span className={s.fieldT}>{L.mastersQueue.otmetkaProveren}</span>
                        <span className={s.muted}>{L.mastersQueue.tolkoPosleZvonkaI}</span>
                      </div>
                    </div>
                  )}
                </div>
                {isReq ? (
                  <div className={s.panelFoot} style={{ padding: '12px 20px' }}>
                    <button type="button" className={cx(s.btn, s.btnOutRed)} disabled={!!by || !senior} onClick={() => setVer({ on: false, comment: '', decline: true })}>
                      {L.mastersQueue.otkazat}
                    </button>
                    <span className={s.grow} />
                    <button type="button" className={cx(s.btn, s.btnGreen)} disabled={!!by || !senior || verified} onClick={() => setVer({ on: true, comment: '' })}>
                      {verified ? L.mastersQueue.uzheProveren : L.mastersQueue.otmetitProveren}
                    </button>
                  </div>
                ) : (
                <div className={s.panelFoot} style={{ padding: '12px 20px' }}>
                  <button type="button" className={cx(s.btn, s.btnOutRed)} disabled={!!by} onClick={() => setRej({ back: false, reason: null, comment: '' })}>
                    {L.mastersQueue.otklonit}
                  </button>
                  <button type="button" className={s.btn} disabled={!!by} onClick={openBack}>
                    {L.mastersQueue.vernutNaPravki}
                  </button>
                  <span className={s.grow} />
                  <button type="button" className={cx(s.btn, s.btnGreen)} disabled={!!failed || busy || !!by} onClick={() => decide(true)}>
                    {failed ? L.mastersQueue.odobrit2(failed, failed === 1 ? L.mastersQueue.punktNeProyden : L.mastersQueue.punktaNeProydeno) : L.mastersQueue.odobrit3}
                  </button>
                </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {rej && cur && (
        <Modal
          icon={UserX}
          tone="red"
          title={rej.back ? L.mastersQueue.vernutNaPravki2(cur.name) : L.mastersQueue.otklonitProfil(cur.name)}
          sub={`${cur.id} · ${cur.cats} · ${cur.city}`}
          okText={rej.back ? L.mastersQueue.vernutNaPravki : L.mastersQueue.otklonit2}
          okTone="red"
          busy={busy}
          okDisabled={rej.back ? rej.comment.trim().length < 10 : !rej.reason || ((rej.reason.needComment || rej.reason.code === 'other') && rej.comment.trim().length < 5)}
          onClose={() => setRej(null)}
          onOk={() => decide(false, rej.reason ?? undefined, rej.comment.trim(), rej.back)}
        >
          {!rej.back && (
            <div className={s.col6}>
              <span className={s.fieldT}>
                {L.mastersQueue.prichina} <span style={{ color: '#B03A2E' }}>*</span>
              </span>
              <div className={s.wrap4}>
                {reasons.map((r) => (
                  <button key={r.id} type="button" className={cx(s.reason, rej.reason?.id === r.id && s.reasonOn)} onClick={() => setRej({ ...rej, reason: r })}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={s.col4}>
            <span className={s.fieldT}>{L.mastersQueue.kommentariyMasteru} {(rej.back || rej.reason?.needComment || rej.reason?.code === 'other') && <span style={{ color: '#B03A2E' }}>*</span>}</span>
            <textarea className={s.textarea} rows={3} value={rej.comment} onChange={(e) => setRej({ ...rej, comment: e.target.value.slice(0, 500) })} placeholder={L.mastersQueue.chtoIspravitChtobyProfil} />
            <span className={s.muted}>{L.mastersQueue.masterUviditPrichinuI}</span>
          </div>
        </Modal>
      )}
      {ver && cur && (
        <Modal
          icon={BadgeCheck}
          tone={ver.decline ? 'red' : 'blue'}
          title={ver.decline ? L.mastersQueue.otkazatVProveren(cur.name) : ver.on ? L.mastersQueue.otmetitProveren2(cur.name) : L.mastersQueue.snyatOtmetkuProveren}
          sub={ver.decline ? L.mastersQueue.masterUviditObyasnenieI : L.mastersQueue.tolkoPosleZvonkaI2}
          okText={ver.decline ? L.mastersQueue.otkazat2 : ver.on ? L.mastersQueue.postavitOtmetku : L.mastersQueue.snyatOtmetku}
          okTone={ver.decline ? 'red' : undefined}
          okDisabled={ver.comment.trim().length < 10}
          busy={busy}
          onClose={() => setVer(null)}
          onOk={async () => {
            setBusy(true);
            try {
              if (ver.decline) await adminApi.declineVerify(cur, ver.comment.trim());
              else await adminApi.verifyMaster(cur, ver.on, ver.comment.trim());
              setVerified(ver.on && !ver.decline);
              setVer(null);
              toast(ver.decline ? L.mastersQueue.otkazanoMasterPoluchilObyasnenie : ver.on ? L.mastersQueue.otmetkaProverenPostavlena : L.mastersQueue.otmetkaSnyata);
              // Запрос решён — уходит из очереди
              if (isReq) (setRows((r) => r?.filter((x) => x.key !== cur.key) ?? r), refreshCounts());
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col4}>
            <span className={s.fieldT}>
              {ver.decline ? L.mastersQueue.pochemuOtkazano : L.mastersQueue.chtoProvereno} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={ver.comment} onChange={(e) => setVer({ ...ver, comment: e.target.value.slice(0, 300) })} placeholder={ver.decline ? L.mastersQueue.naprimerNaFotoDokumenta : L.mastersQueue.naprimerZvonokPasportSovpadaet} autoFocus />
            <span className={s.muted}>{ver.decline ? L.mastersQueue.masterUviditEtoObyasnenie : L.mastersQueue.popadetVAuditLog}</span>
          </div>
        </Modal>
      )}
    </>
  );
}
