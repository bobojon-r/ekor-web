'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageCircleQuestion, Scale, TriangleAlert } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { DisputeV, Lock, TimelineItem } from '../data/types';
import { CheckRow, cx, Head, Label, Loading, Modal, Photo, Pill, Tabs } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

type Res = 'done' | 'not_done' | 'partial';
const RES: [Res, string, string][] = [
  ['done', L.disputes.vypolneno, L.disputes.zakazZavershenOtzyvOtkryt],
  ['not_done', L.disputes.neVypolneno, L.disputes.zakazOtmenenMasteruOtmetka],
  ['partial', L.disputes.chastichno, L.disputes.usloviyaDorabotkiISrok],
];
const AFTER: Record<Res, [string, string, string[]]> = {
  done: [L.disputes.pushSmsSResheniem, L.disputes.pushSmsZakazZakroetsya, [L.disputes.klientMozhetOstavitOtzyv, L.disputes.sporMozhnoOtkrytPovtorno]],
  not_done: [L.disputes.pushSmsSResheniem2, L.disputes.pushSmsZakazOtmenen, [L.disputes.zadanieMozhnoOpublikovatSnova, L.disputes.masterMozhetObzhalovatCherez]],
  partial: [L.disputes.pushSmsSResheniem3, L.disputes.pushSmsZakazVernetsya, [L.disputes.masterSnovaOtmetitVypolneno, L.disputes.esliNeVypolnenoSpor]],
};

/** 04 — споры (senior_moderator, admin); 17 — подтверждение решения */
export function Disputes() {
  const { refreshCounts } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState<DisputeV[] | null>(null);
  const [tab, setTab] = useState<'open' | 'waiting' | 'resolved'>('open');
  const [selKey, setSelKey] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [full, setFull] = useState<DisputeV | null>(null);
  const [lock, setLock] = useState<Lock | null>(null);
  const [ask, setAsk] = useState<null | {
    side: 'client' | 'master';
    text: string;
  }>(null);
  const [terms, setTerms] = useState('');
  const [res, setRes] = useState<Res | null>(null);
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = () => adminApi.disputes().then(setRows, (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  useEffect(() => {
    load();
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [loadedAt] = useState(Date.now());

  const list = useMemo(() => (rows ?? []).filter((d) => (tab === 'resolved' ? !d.open : tab === 'waiting' ? d.open && d.waiting : d.open)), [rows, tab]);
  // В дизайне список показывает и решённые ниже открытых
  const shown = tab === 'open' ? [...list, ...(rows ?? []).filter((d) => !d.open)] : list;
  const row = shown.find((d) => d.key === selKey) ?? shown[0] ?? null;
  // Карточка с фото, запросами и хронологией — из GET /admin/disputes/{id}; пока грузится — строка списка
  const cur = full && row && full.key === row.key ? full : row;

  const loadCard = (d: DisputeV) =>
    adminApi.disputeCard(d).then(
      (r) => (setFull(r.d), setTimeline(r.timeline)),
      (e) => toast(apiErrorText(e, 'ru')),
    );
  useEffect(() => {
    setRes(null);
    setComment('');
    setTerms('');
    setTimeline([]);
    setFull(null);
    setLock(row?.lock ?? null);
    if (!row) return;
    loadCard(row);
    if (row.open && (!row.lock || row.lock.mine))
      adminApi.lockDispute(row).then(
        (l) => l && setLock(l),
        (e) => (e as { code?: string }).code === 'locked_by_other' && setLock({ name: L.disputes.drugoySotrudnik, mine: false }),
      );
  }, [row?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const by = lock && !lock.mine ? lock.name : null;

  const left = cur?.slaH != null ? cur.slaH * 60 - (now - loadedAt) / 60000 : null;
  const leftText = left == null ? '' : left <= 0 ? L.disputes.slaProsrochen : L.disputes.ostalosChMin(Math.floor(left / 60), Math.round(left % 60));
  const resLabel = RES.find((r) => r[0] === res)?.[1].toLowerCase();

  const close = async () => {
    if (!cur || !res) return;
    setBusy(true);
    try {
      await adminApi.resolveDispute(cur, res, comment.trim(), res === 'partial' && terms ? new Date(`${terms}T23:59:00`).toISOString() : null);
      setConfirm(false);
      setAgree(false);
      toast(L.disputes.sporZakrytStoronyPoluchili);
      await load();
      refreshCounts();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };

  const nOpen = (rows ?? []).filter((d) => d.open).length;
  const nWait = (rows ?? []).filter((d) => d.open && d.waiting).length;

  return (
    <>
      <Head title={L.disputes.spory}>
        <Tabs value={tab} onChange={(k) => (setTab(k), setSelKey(null))} items={[['open', L.disputes.otkrytye(nOpen)], ['waiting', L.disputes.zhdutOtvetaStorony(nWait)], ['resolved', L.disputes.reshennye]]} />
        <span className={s.grow} />
        <span className={s.note}>{L.disputes.dostupnoSeniorModeratorAdmin}</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: '320px minmax(0,1fr) 340px' }}>
          <div className={s.list}>
            <div className={s.scroll}>
              {shown.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{L.disputes.sporovNet}</div>}
              {shown.map((d) => (
                <div key={d.key} role="button" tabIndex={0} onClick={() => setSelKey(d.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(d.key)} className={cx(s.card2, cur?.key === d.key && s.rowOn)}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={s.id}>{d.id}</span>
                    <Pill tone={d.tone}>{d.status}</Pill>
                    <span className={s.grow} />
                    {d.slaH != null && (
                      <span className={s.num} style={{ color: d.slaH <= 6 ? '#B03A2E' : '#3B4756' }}>
                        {d.slaH} {L.disputes.ch}
                      </span>
                    )}
                  </div>
                  <span className={s.cell} style={{ fontWeight: 600 }}>
                    {d.title}
                  </span>
                  <span className={s.muted}>{d.who}</span>
                </div>
              ))}
            </div>
          </div>
          {cur ? (
            <div className={s.panel}>
              <div className={s.panelBody} style={{ padding: '16px 20px', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className={s.metaLine}>
                    {cur.id} {L.disputes.zakaz} {cur.order}
                  </span>
                  <Pill big tone={cur.open ? 'bad' : 'grey'}>
                    {cur.open ? L.disputes.spor : cur.status}
                  </Pill>
                  <span className={s.grow} />
                  {cur.open && (
                    <span
                      style={{
                        fontWeight: 600,
                        color: left != null && left <= 0 ? '#B03A2E' : '#8A4B0D',
                      }}
                    >
                      {leftText}
                    </span>
                  )}
                </div>
                <span className={s.h18}>{cur.title}</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  {[
                    cur.client,
                    cur.master ?? {
                      title: L.disputes.master(cur.masterName),
                      text: L.disputes.pozitsiyaMasteraVPerepiske,
                      meta: '',
                    },
                  ].map((p) => (
                    <div
                      key={p.title}
                      style={{
                        border: '1px solid #E1E6EC',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <Label>{p.title}</Label>
                      <span style={{ lineHeight: 1.5 }}>{p.text || '—'}</span>
                      {p.meta && <span className={s.muted}>{p.meta}</span>}
                    </div>
                  ))}
                </div>
                {by && (
                  <div className={s.alertWarn}>
                    <TriangleAlert size={15} aria-hidden />
                    <span>{L.disputes.etotSporSeychasSmotrit} {by}{L.disputes.reshenieDostupnoKogdaOn}</span>
                  </div>
                )}
                {cur.price && <span className={s.muted}>{L.disputes.tsenaZakaza} {cur.price}</span>}
                {!!cur.requests?.length && (
                  <div className={s.col6}>
                    <Label>{L.disputes.zaprosyStoronam} {cur.requests.length}</Label>
                    {cur.requests.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          border: '1px solid #E1E6EC',
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <span className={s.muted} style={{ fontSize: 12 }}>
                          {q.to === 'client' ? L.disputes.klientu : L.disputes.masteru} · {q.meta}
                        </span>
                        <span style={{ lineHeight: 1.45 }}>{q.text}</span>
                        {q.answer ? (
                          <div
                            style={{
                              marginTop: 4,
                              padding: '8px 10px',
                              borderRadius: 7,
                              background: '#F7F9FB',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <span className={s.fieldT}>{L.disputes.otvet} {q.answerMeta}</span>
                            <span style={{ lineHeight: 1.45 }}>{q.answer}</span>
                            {q.photos.length > 0 && (
                              <div className={s.photos5}>
                                {q.photos.slice(0, 5).map((p, i) => (
                                  <Photo key={i} src={p} ratio="4/3" />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Pill tone="warn">{L.disputes.zhdemOtveta}</Pill>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {cur.photos.length > 0 && (
                  <div className={s.photos5}>
                    {cur.photos.slice(0, 5).map((p, i) => (
                      <Photo key={i} src={p || undefined} ratio="4/3" />
                    ))}
                  </div>
                )}
                {cur.open ? (
                  <div className={s.col6}>
                    <Label>{L.disputes.reshenie}</Label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3,1fr)',
                        gap: 6,
                      }}
                    >
                      {RES.map(([k, t, dsc]) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={res === k}
                          onClick={() => setRes(k)}
                          style={{ padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${res === k ? '#2647D9' : '#DCE3EA'}`, background: res === k ? '#F7F9FF' : '#fff', display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', fontSize: 13, color: '#0F1B2A' }}
                        >
                          <span style={{ fontWeight: 600 }}>{t}</span>
                          <span className={s.muted} style={{ lineHeight: 1.4 }}>
                            {dsc}
                          </span>
                        </button>
                      ))}
                    </div>
                    <textarea className={s.textarea} rows={3} style={{ minHeight: 64 }} value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} placeholder={L.disputes.obosnovanieIUsloviyaUvidyat} />
                    {res === 'partial' && (
                      <label className={s.col4}>
                        <span className={s.fieldT}>
                          {L.disputes.srokDorabotki} <span style={{ color: '#B03A2E' }}>*</span>
                        </span>
                        <input type="date" className={s.input} style={{ width: 180 }} value={terms} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setTerms(e.target.value)} />
                      </label>
                    )}
                    <span className={s.muted}>{L.disputes.kommentariyUvidyatObeStorony}</span>
                  </div>
                ) : (
                  <div className={s.alertInfo}>
                    <span>
                      {L.disputes.sporZakryt} {cur.status.replace(L.disputes.reshen, '')}.{cur.comment ? ` «${cur.comment}»` : ''}
                      {cur.termsDeadline ? L.disputes.srokDorabotkiDo(new Date(cur.termsDeadline).toLocaleDateString('ru-RU')) : ''} {L.disputes.zapisVAuditLoge}
                    </span>
                  </div>
                )}
              </div>
              {cur.open && (
                <div className={s.panelFoot} style={{ padding: '12px 20px' }}>
                  <button type="button" className={s.btn} disabled={!!by} onClick={() => setAsk({ side: 'master', text: '' })}>
                    {L.disputes.zaprositUStorony}
                  </button>
                  <span className={s.grow} />
                  <button type="button" className={cx(s.btn, s.btnBlue)} disabled={!res || comment.trim().length < 15 || (res === 'partial' && !terms) || !!by} onClick={() => setConfirm(true)}>
                    {res ? L.disputes.zakrytSpor(resLabel) : L.disputes.vyberiteReshenie}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={s.loading}>{L.disputes.vyberiteSpor}</div>
          )}
          <div
            className={s.panelBody}
            style={{
              borderLeft: '1px solid #E1E6EC',
              background: '#F7F9FB',
              gap: 12,
            }}
          >
            <Label>{L.disputes.hronologiyaZakaza}</Label>
            {timeline.length === 0 && <span className={s.muted}>{L.disputes.sobytiyPokaNet}</span>}
            {timeline.map(([t, d, c], i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 5,
                    borderRadius: '50%',
                    background: c,
                    flex: 'none',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ lineHeight: 1.4 }}>{t}</span>
                  <span className={s.muted} style={{ fontSize: 12 }}>
                    {d}
                  </span>
                </div>
              </div>
            ))}
            {cur?.chatId != null && (
              <>
                <Link href={`/admin/complaints/D-${cur.key}/chat`} style={{ marginTop: 4, fontWeight: 600 }}>
                  {L.disputes.otkrytPerepisku}
                </Link>
                <span className={s.muted} style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {L.disputes.prosmotrChataLogiruetsyaS} {cur.id}»
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {ask && cur && (
        <Modal
          icon={MessageCircleQuestion}
          tone="blue"
          title={L.disputes.zaprosPoSporu(cur.id)}
          sub={L.disputes.storonaPoluchitUvedomlenieI}
          okText={L.disputes.otpravitZapros}
          okDisabled={ask.text.trim().length < 10}
          busy={busy}
          onClose={() => setAsk(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.requestDispute(cur, ask.side, ask.text.trim());
              setAsk(null);
              toast(L.disputes.zaprosOtpravlen(ask.side === 'client' ? L.disputes.klientu2 : L.disputes.masteru2));
              loadCard(cur);
              load();
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#fff',
              border: '1px solid #C9D1DB',
              borderRadius: 7,
              padding: 2,
            }}
          >
            {(['master', 'client'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAsk({ ...ask, side: k })}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 5,
                  border: 'none',
                  background: ask.side === k ? '#0F1B2A' : 'transparent',
                  color: ask.side === k ? '#fff' : '#0F1B2A',
                  fontWeight: ask.side === k ? 600 : 400,
                  fontSize: 13,
                }}
              >
                {k === 'master' ? L.disputes.masteru3(cur.masterName) : L.disputes.klientu3(cur.clientName)}
              </button>
            ))}
          </div>
          <textarea className={s.textarea} rows={4} value={ask.text} onChange={(e) => setAsk({ ...ask, text: e.target.value.slice(0, 1000) })} placeholder={L.disputes.chtoNuzhnoUtochnitFoto} autoFocus />
        </Modal>
      )}
      {confirm && cur && res && (
        <Modal icon={Scale} tone="blue" title={L.disputes.zakrytSpor2(cur.id, resLabel)} sub={`${cur.title} · ${cur.clientName} ↔ ${cur.masterName}`} cancelText={L.disputes.nazad} okText={L.disputes.zakrytSpor3} okDisabled={!agree} busy={busy} onClose={() => (setConfirm(false), setAgree(false))} onOk={close}>
          <div className={s.textBox} style={{ fontSize: 13, lineHeight: 1.5 }}>
            «{comment.trim()}»
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([L.disputes.klientPoluchit, L.disputes.masterPoluchit] as const).map((h, i) => (
              <div
                key={h}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#F7F9FB',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  lineHeight: 1.45,
                }}
              >
                <span className={s.fieldT}>{h}</span>
                <span style={{ color: '#3B4756' }}>{AFTER[res][i] as string}</span>
              </div>
            ))}
          </div>
          <div className={s.bullets}>
            <b>{L.disputes.posleResheniya}</b>
            {AFTER[res][2].map((x) => (
              <span key={x}>· {x}</span>
            ))}
          </div>
          <CheckRow on={agree} onClick={() => setAgree(!agree)}>
            {L.disputes.yaIzuchilPozitsiiObeih}
          </CheckRow>
        </Modal>
      )}
    </>
  );
}
