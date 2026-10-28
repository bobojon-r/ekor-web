'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Lock } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { ChatMsg, ComplaintV } from '../data/types';
import { hhmm } from '../core';
import { cx, Head, Label, Loading, Pill, Tabs } from '../ui';
import s from '../Admin.module.css';

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
  const dispute = openId?.toUpperCase().startsWith('D-') ? +openId.slice(2) : null;

  const load = async () => {
    try {
      const list = await adminApi.complaints();
      if (dispute) {
        // Переписка по спору: основание — сам спор
        const d = (await adminApi.disputes()).find((x) => x.key === dispute);
        if (d)
          list.unshift({
            key: -d.key, id: d.id, title: `Спор: ${d.title}`, order: `${d.order}`, status: d.open ? 'Спор' : 'Решён', tone: d.open ? 'bad' : 'grey', open: false, chatId: d.chatId,
            text: d.client.text, from: d.clientName, date: d.client.meta, who: d.who, detector: [], subject: `Мастер · ${d.masterName}`,
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
    if (!cur) return;
    setOpenedAt(hhmm(new Date().toISOString()));
    adminApi.chat(cur).then(
      (r) => (setMsgs(r.msgs), setDetector(r.detector.length ? r.detector : cur.detector)),
      (e) => (setMsgs([]), toast(apiErrorText(e, 'ru'))),
    );
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (text: string, msg: string) => {
    if (!cur || cur.key < 0) return;
    setBusy(true);
    try {
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
      <Head title="Чаты по жалобам">
        <Tabs value={tab} onChange={(k) => (setTab(k), router.replace('/admin/complaints'))} items={[['open', `Новые ${nOpen}`], ['done', 'Решённые']]} />
        <span className={s.grow} />
        <span className={s.note}>Поиска по всем чатам нет — только по основанию</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: '300px minmax(0,1fr) 360px' }}>
          <div className={s.list}>
            <div className={s.scroll}>
              {list.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{tab === 'open' ? 'Новых жалоб на чаты нет' : 'Решённых жалоб нет'}</div>}
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
          {cur ? (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: '#F5F7F9' }}>
              <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', background: '#fff', borderBottom: '1px solid #E1E6EC' }}>
                <span className={s.cell} style={{ fontWeight: 600 }}>
                  {cur.order}
                </span>
                {cur.who && <span className={cx(s.cell, s.muted)}>{cur.who}</span>}
                <span className={s.grow} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 6, background: '#EAEEFC', color: '#1F3BB8', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <Eye size={15} color="#5B6878" aria-hidden />
                  Только чтение
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 18px', background: '#F7F9FF', borderBottom: '1px solid #DCE3FA', color: '#1F3BB8', flex: 'none' }}>
                <Lock size={15} aria-hidden style={{ flex: 'none' }} />
                <span>
                  Вы открыли переписку по {cur.key < 0 ? 'спору' : 'жалобе'} {cur.id}. Запись в аудит-логе: {me.name.split(' ').map((w, i) => (i ? `${w[0]}.` : w)).join(' ')}, {openedAt}.
                </span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!msgs && <Loading />}
                {msgs?.length === 0 && <span className={s.muted} style={{ alignSelf: 'center' }}>Сообщений нет</span>}
                {msgs?.map((m, i) =>
                  m.sys ? (
                    <div key={i} style={{ alignSelf: 'center', padding: '4px 10px', borderRadius: 999, background: '#E6EAEF', color: '#3B4756', fontSize: 12 }}>
                      {m.text} · {m.time}
                    </div>
                  ) : (
                    <div key={i} style={{ alignSelf: m.who === 'Клиент' ? 'flex-end' : 'flex-start', maxWidth: '66%', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, color: '#5B6878', alignSelf: m.who === 'Клиент' ? 'flex-end' : 'flex-start' }}>
                        {m.who} · {m.time}
                      </span>
                      <div style={{ padding: '9px 12px', borderRadius: 12, background: m.flag ? '#FBE3E0' : m.who === 'Клиент' ? '#2647D9' : '#fff', color: m.who === 'Клиент' && !m.flag ? '#fff' : '#0F1B2A', border: `1px solid ${m.flag ? '#E8C4BE' : m.who === 'Клиент' ? '#2647D9' : '#E1E6EC'}`, lineHeight: 1.45, fontSize: 14, overflowWrap: 'anywhere' }}>
                        {m.text}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className={s.loading}>Выберите жалобу</div>
          )}
          {cur && (
            <div className={s.panelBody} style={{ borderLeft: '1px solid #E1E6EC', gap: 14 }}>
              <Label>
                {cur.key < 0 ? 'Спор' : 'Жалоба'} {cur.id}
              </Label>
              <div className={s.col4}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{cur.title}</span>
                <span style={{ color: '#3B4756', lineHeight: 1.5 }}>
                  {cur.text} {cur.from}, {cur.date}.
                </span>
              </div>
              {detector.length > 0 && (
                <div className={s.col6}>
                  <Label>Автодетектор</Label>
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
                      Карточка пользователя →
                    </Link>
                  )}
                </div>
              )}
              {cur.open && (
                <div className={s.col6} style={{ marginTop: 'auto' }}>
                  <button type="button" className={s.btn} disabled={busy} onClick={() => resolve('warned', 'Предупреждение отправлено, жалоба закрыта')}>
                    Предупредить {cur.subject.startsWith('Клиент') ? 'клиента' : 'мастера'}
                  </button>
                  <button type="button" className={s.btn} onClick={() => toast('Скрытие отдельных сообщений появится, когда в API будет эндпоинт', 'info')}>
                    Скрыть сообщения с картой
                  </button>
                  <button type="button" className={cx(s.btn, s.btnRed)} onClick={() => router.push(cur.subjectUserId ? `/admin/users?id=${cur.subjectUserId}` : '/admin/users')}>
                    Заблокировать {cur.subject.startsWith('Клиент') ? 'клиента' : 'мастера'}…
                  </button>
                  <button type="button" className={cx(s.btn, s.btnGhost)} disabled={busy} onClick={() => resolve('rejected', 'Жалоба закрыта: не подтвердилась')}>
                    Жалоба не подтвердилась
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
