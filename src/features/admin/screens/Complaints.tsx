'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeOff, Eye, Lock } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { ChatMsg, ComplaintV } from '../data/types';
import { hhmm } from '../core';
import { Checkbox, cx, Head, Label, Loading, Modal, Pill, Tabs } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

/**
 * 07 — чаты по жалобам: только чтение, поиска по всем чатам нет — только по основанию.
 * openId: «C-214» (жалоба) или «D-1021» (спор — переписка по заказу).
 */
export function Complaints({ openId }: { openId?: string }) {
  const { me, refreshCounts } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<ComplaintV[] | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [msgs, setMsgs] = useState<ChatMsg[] | null>(null);
  const [detector, setDetector] = useState<string[]>([]);
  const [openedAt, setOpenedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [hideBasis, setHideBasis] = useState<string | null>(null);
  const dispute = openId?.toUpperCase().startsWith('D-') ? +openId.slice(2) : null;

  const load = async () => {
    try {
      const list = await adminApi.complaints();
      if (dispute) {
        // Переписка по спору: основание — сам спор
        const d = (await adminApi.disputes()).find((x) => x.key === dispute);
        if (d)
          list.unshift({
            key: -d.key,
            id: d.id,
            title: L.complaints.spor(d.title),
            order: `${d.order}`,
            status: d.open ? L.complaints.spor2 : L.complaints.reshen,
            tone: d.open ? 'bad' : 'grey',
            open: false,
            chatId: d.chatId,
            hasChat: true,
            text: d.client.text,
            from: d.clientName,
            date: d.client.meta,
            who: d.who,
            detector: [],
            subject: L.complaints.master(d.masterName),
          });
      }
      setRows(list);
    } catch (e) {
      setRows([]);
      toast(apiErrorText(e, 'ru'));
    }
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (rows ?? []).filter((c) => (c.key < 0 ? true : tab === 'open' ? c.open : !c.open)), [rows, tab]);
  const cur = (openId && rows?.find((c) => c.id.toUpperCase() === openId.toUpperCase())) || list[0] || null;

  useEffect(() => {
    setMsgs(null);
    setPicked(new Set());
    if (!cur) return;
    setOpenedAt(hhmm(new Date().toISOString()));
    adminApi.chat(cur).then(
      // Сообщения с автофлагом (карта, предоплата) сразу отмечены к скрытию
      (r) => (setMsgs(r.msgs), setDetector(r.detector.length ? r.detector : cur.detector), setPicked(new Set(r.msgs.filter((m) => m.flag && !m.hidden && m.id).map((m) => m.id!)))),
      (e) => (setMsgs([]), toast(apiErrorText(e, 'ru'))),
    );
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (text: string, msg: string) => {
    if (!cur || cur.key < 0) return;
    setBusy(true);
    try {
      if (text === 'warned' && cur.subjectUserId) await adminApi.warn(cur.subjectUserId, null, L.complaints.poZhalobe(cur.id, cur.title));
      await adminApi.resolveComplaint(cur, text);
      toast(msg);
      await load();
      refreshCounts();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const nOpen = (rows ?? []).filter((c) => c.open).length;

  return (
    <>
      <Head title={L.complaints.chatyPoZhalobam}>
        <Tabs value={tab} onChange={(k) => (setTab(k), router.replace('/admin/complaints'))} items={[['open', L.complaints.novye(nOpen)], ['done', L.complaints.reshennye]]} />
        <span className={s.grow} />
        <span className={s.note}>{L.complaints.poiskaPoVsemChatam}</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: '300px minmax(0,1fr) 360px' }}>
          <div className={s.list}>
            <div className={s.scroll}>
              {list.length === 0 && (
                <div className={s.hint} style={{ padding: 16 }}>
                  {tab === 'open' ? L.complaints.novyhZhalobNet : L.complaints.reshennyhZhalobNet}
                </div>
              )}
              {list.map((c) => (
                <Link key={c.key} href={`/admin/complaints/${c.id}/chat`} scroll={false} className={cx(s.card2, cur?.key === c.key && s.rowOn)} style={{ color: '#0F1B2A', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={s.id}>{c.id}</span>
                    <Pill tone={c.tone}>{c.status}</Pill>
                  </div>
                  <span style={{ fontWeight: 600 }}>{c.title}</span>
                  <span className={s.muted}>{c.order}</span>
                </Link>
              ))}
            </div>
          </div>
          {cur && cur.key > 0 && !cur.hasChat ? (
            <div className={s.panelBody} style={{ background: '#F5F7F9', gap: 12 }}>
              <Label>{cur.order}</Label>
              <div className={s.textBox} style={{ background: '#fff', lineHeight: 1.5 }}>
                {cur.preview || L.complaints.predprosmotrObektaZhalobyNedostu}
              </div>
              <span className={s.muted}>{L.complaints.perepiskiPoEtoyZhalobe}</span>
            </div>
          ) : cur ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                background: '#F5F7F9',
              }}
            >
              <div
                style={{
                  height: 48,
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 18px',
                  background: '#fff',
                  borderBottom: '1px solid #E1E6EC',
                }}
              >
                <span className={s.cell} style={{ fontWeight: 600 }}>
                  {cur.order}
                </span>
                {cur.who && <span className={cx(s.cell, s.muted)}>{cur.who}</span>}
                <span className={s.grow} />
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#EAEEFC',
                    color: '#1F3BB8',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Eye size={15} color="#5B6878" aria-hidden />
                  {L.complaints.tolkoChtenie}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 18px',
                  background: '#F7F9FF',
                  borderBottom: '1px solid #DCE3FA',
                  color: '#1F3BB8',
                  flex: 'none',
                }}
              >
                <Lock size={15} aria-hidden style={{ flex: 'none' }} />
                <span>
                  {L.complaints.vyOtkryliPerepiskuPo} {cur.key < 0 ? L.complaints.sporu : L.complaints.zhalobe} {cur.id}{L.complaints.zapisVAuditLoge} {me.name.split(' ').map((w, i) => (i ? `${w[0]}.` : w)).join(' ')}, {openedAt}.
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {!msgs && <Loading />}
                {msgs?.length === 0 && <span className={s.muted} style={{ alignSelf: 'center' }}>{L.complaints.soobscheniyNet}</span>}
                {msgs?.map((m, i) =>
                  m.sys ? (
                    <div
                      key={i}
                      style={{
                        alignSelf: 'center',
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: '#E6EAEF',
                        color: '#3B4756',
                        fontSize: 12,
                      }}
                    >
                      {m.text} · {m.time}
                    </div>
                  ) : (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.who === L.complaints.klient ? 'flex-end' : 'flex-start',
                        maxWidth: '66%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        opacity: m.hidden ? 0.55 : 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: '#5B6878',
                          alignSelf: m.who === L.complaints.klient ? 'flex-end' : 'flex-start',
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                        }}
                      >
                        {m.id && !m.hidden && cur.key > 0 && cur.open && (
                          <Checkbox
                            on={picked.has(m.id)}
                            onClick={() =>
                              setPicked((p) => {
                                const n = new Set(p);
                                if (n.has(m.id!)) n.delete(m.id!);
                                else n.add(m.id!);
                                return n;
                              })
                            }
                            label={L.complaints.vybratSoobschenieDlyaSkrytiya}
                          />
                        )}
                        {m.who} · {m.time}
                        {m.hidden && L.complaints.skrytoModeratorom}
                      </span>
                      <div style={{ padding: '9px 12px', borderRadius: 12, background: m.flag ? '#FBE3E0' : m.who === L.complaints.klient ? '#2647D9' : '#fff', color: m.who === L.complaints.klient && !m.flag ? '#fff' : '#0F1B2A', border: `1px solid ${m.flag ? '#E8C4BE' : m.who === L.complaints.klient ? '#2647D9' : '#E1E6EC'}`, lineHeight: 1.45, fontSize: 14, overflowWrap: 'anywhere' }}>
                        {m.text}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className={s.loading}>{L.complaints.vyberiteZhalobu}</div>
          )}
          {cur && (
            <div className={s.panelBody} style={{ borderLeft: '1px solid #E1E6EC', gap: 14 }}>
              <Label>
                {cur.key < 0 ? L.complaints.spor2 : L.complaints.zhaloba} {cur.id}
              </Label>
              <div className={s.col4}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{cur.title}</span>
                <span style={{ color: '#3B4756', lineHeight: 1.5 }}>
                  {cur.text} {cur.from}, {cur.date}.
                </span>
              </div>
              {detector.length > 0 && (
                <div className={s.col6}>
                  <Label>{L.complaints.avtodetektor}</Label>
                  <div className={s.wrap4} style={{ gap: 6 }}>
                    {detector.map((d) => (
                      <Pill key={d} big tone="bad">
                        {d}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {cur.subject && (
                <div className={s.col6}>
                  <Label>{cur.subject}</Label>
                  {cur.subjectUserId && (
                    <Link href={`/admin/users?id=${cur.subjectUserId}`} style={{ fontWeight: 600 }}>
                      {L.complaints.kartochkaPolzovatelya}
                    </Link>
                  )}
                </div>
              )}
              {cur.open && (
                <div className={s.col6} style={{ marginTop: 'auto' }}>
                  <button type="button" className={s.btn} disabled={busy} onClick={() => resolve('warned', L.complaints.preduprezhdenieOtpravlenoZhaloba)}>
                    {L.complaints.predupredit} {cur.subject.startsWith(L.complaints.klient) ? L.complaints.klienta : cur.subject.startsWith(L.complaints.master2) ? L.complaints.mastera : L.complaints.polzovatelya}
                  </button>
                  {cur.hasChat && (
                    <button type="button" className={s.btn} disabled={!picked.size} title={picked.size ? '' : L.complaints.otmetteSoobscheniyaVPerepiske} onClick={() => setHideBasis(L.complaints.zhaloba2(cur.id, cur.title))}>
                      <EyeOff size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      {L.complaints.skrytSoobscheniya}{picked.size ? ` · ${picked.size}` : ''}
                    </button>
                  )}
                  <button type="button" className={cx(s.btn, s.btnRed)} onClick={() => router.push(cur.subjectUserId ? `/admin/users?id=${cur.subjectUserId}` : '/admin/users')}>
                    {L.complaints.zablokirovat} {cur.subject.startsWith(L.complaints.klient) ? L.complaints.klienta : cur.subject.startsWith(L.complaints.master2) ? L.complaints.mastera : L.complaints.polzovatelya}…
                  </button>
                  <button type="button" className={cx(s.btn, s.btnGhost)} disabled={busy} onClick={() => resolve('rejected', L.complaints.zhalobaZakrytaNePodtverdilas)}>
                    {L.complaints.zhalobaNePodtverdilas}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {hideBasis !== null && cur && (
        <Modal
          icon={EyeOff}
          tone="red"
          title={L.complaints.skryt(picked.size, picked.size === 1 ? L.complaints.soobschenie : L.complaints.soobscheniya)}
          sub={L.complaints.storonyUvidyatSoobschenieSkryto}
          okText={L.complaints.skryt2}
          okTone="red"
          okDisabled={hideBasis.trim().length < 5}
          busy={busy}
          onClose={() => setHideBasis(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.hideMessages([...picked], hideBasis.trim());
              setMsgs((l) => l?.map((m) => (m.id && picked.has(m.id) ? { ...m, hidden: true } : m)) ?? l);
              setPicked(new Set());
              setHideBasis(null);
              toast(L.complaints.soobscheniyaSkryty);
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col4}>
            <span className={s.fieldT}>
              {L.complaints.osnovanie} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={2} value={hideBasis} onChange={(e) => setHideBasis(e.target.value.slice(0, 300))} autoFocus />
            <span className={s.muted}>{L.complaints.popadetVAuditLog}</span>
          </div>
        </Modal>
      )}
    </>
  );
}
