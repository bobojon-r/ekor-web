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

type Res = 'done' | 'not_done' | 'partial';
const RES: [Res, string, string][] = [
  ['done', 'Выполнено', 'Заказ завершён, отзыв открыт клиенту'],
  ['not_done', 'Не выполнено', 'Заказ отменён, мастеру отметка в профиле'],
  ['partial', 'Частично', 'Условия доработки и срок — в комментарии'],
];
const AFTER: Record<Res, [string, string, string[]]> = {
  done: ['Push + SMS с решением. Отзыв откроется сразу.', 'Push + SMS. Заказ закроется как завершённый.', ['Клиент может оставить отзыв', 'Спор можно открыть повторно только через поддержку']],
  not_done: ['Push + SMS с решением. Отзыв о мастере доступен.', 'Push + SMS. Заказ отменён, отметка в профиле.', ['Задание можно опубликовать снова', 'Мастер может обжаловать через поддержку']],
  partial: ['Push + SMS с решением. Отзыв откроется после срока доработки.', 'Push + SMS. Заказ вернётся «В работу» до срока из комментария.', ['Мастер снова отметит «выполнено», клиент подтвердит', 'Если не выполнено — спор можно открыть повторно один раз']],
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
        (e) => (e as { code?: string }).code === 'locked_by_other' && setLock({ name: 'другой сотрудник', mine: false }),
      );
  }, [row?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const by = lock && !lock.mine ? lock.name : null;

  const left = cur?.slaH != null ? cur.slaH * 60 - (now - loadedAt) / 60000 : null;
  const leftText = left == null ? '' : left <= 0 ? 'SLA просрочен' : `осталось ${Math.floor(left / 60)} ч ${Math.round(left % 60)} мин`;
  const resLabel = RES.find((r) => r[0] === res)?.[1].toLowerCase();

  const close = async () => {
    if (!cur || !res) return;
    setBusy(true);
    try {
      await adminApi.resolveDispute(cur, res, comment.trim(), res === 'partial' && terms ? new Date(`${terms}T23:59:00`).toISOString() : null);
      setConfirm(false);
      setAgree(false);
      toast('Спор закрыт. Стороны получили решение');
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
      <Head title="Споры">
        <Tabs value={tab} onChange={(k) => (setTab(k), setSelKey(null))} items={[['open', `Открытые ${nOpen}`], ['waiting', `Ждут ответа стороны ${nWait}`], ['resolved', 'Решённые']]} />
        <span className={s.grow} />
        <span className={s.note}>доступно: senior_moderator, admin</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: '320px minmax(0,1fr) 340px' }}>
          <div className={s.list}>
            <div className={s.scroll}>
              {shown.length === 0 && <div className={s.hint} style={{ padding: 16 }}>Споров нет</div>}
              {shown.map((d) => (
                <div key={d.key} role="button" tabIndex={0} onClick={() => setSelKey(d.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(d.key)} className={cx(s.card2, cur?.key === d.key && s.rowOn)}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={s.id}>{d.id}</span>
                    <Pill tone={d.tone}>{d.status}</Pill>
                    <span className={s.grow} />
                    {d.slaH != null && (
                      <span className={s.num} style={{ color: d.slaH <= 6 ? '#B03A2E' : '#3B4756' }}>
                        {d.slaH} ч
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
                    {cur.id} · заказ {cur.order}
                  </span>
                  <Pill big tone={cur.open ? 'bad' : 'grey'}>
                    {cur.open ? 'Спор' : cur.status}
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
                      title: `Мастер · ${cur.masterName}`,
                      text: 'Позиция мастера — в переписке по заказу.',
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
                    <span>Этот спор сейчас смотрит {by}. Решение доступно, когда он закончит или через 10 минут.</span>
                  </div>
                )}
                {cur.price && <span className={s.muted}>Цена заказа: {cur.price}</span>}
                {!!cur.requests?.length && (
                  <div className={s.col6}>
                    <Label>Запросы сторонам · {cur.requests.length}</Label>
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
                          {q.to === 'client' ? 'Клиенту' : 'Мастеру'} · {q.meta}
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
                            <span className={s.fieldT}>Ответ · {q.answerMeta}</span>
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
                          <Pill tone="warn">Ждём ответа</Pill>
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
                    <Label>Решение</Label>
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
                    <textarea className={s.textarea} rows={3} style={{ minHeight: 64 }} value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} placeholder="Обоснование и условия — увидят обе стороны (от 15 символов)" />
                    {res === 'partial' && (
                      <label className={s.col4}>
                        <span className={s.fieldT}>
                          Срок доработки <span style={{ color: '#B03A2E' }}>*</span>
                        </span>
                        <input type="date" className={s.input} style={{ width: 180 }} value={terms} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setTerms(e.target.value)} />
                      </label>
                    )}
                    <span className={s.muted}>Комментарий увидят обе стороны. Решение необратимо и пишется в аудит-лог.</span>
                  </div>
                ) : (
                  <div className={s.alertInfo}>
                    <span>
                      Спор закрыт: {cur.status.replace('Решён: ', '')}.{cur.comment ? ` «${cur.comment}»` : ''}
                      {cur.termsDeadline ? ` Срок доработки — до ${new Date(cur.termsDeadline).toLocaleDateString('ru-RU')}.` : ''} Запись — в аудит-логе.
                    </span>
                  </div>
                )}
              </div>
              {cur.open && (
                <div className={s.panelFoot} style={{ padding: '12px 20px' }}>
                  <button type="button" className={s.btn} disabled={!!by} onClick={() => setAsk({ side: 'master', text: '' })}>
                    Запросить у стороны…
                  </button>
                  <span className={s.grow} />
                  <button type="button" className={cx(s.btn, s.btnBlue)} disabled={!res || comment.trim().length < 15 || (res === 'partial' && !terms) || !!by} onClick={() => setConfirm(true)}>
                    {res ? `Закрыть спор: ${resLabel}` : 'Выберите решение'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={s.loading}>Выберите спор</div>
          )}
          <div
            className={s.panelBody}
            style={{
              borderLeft: '1px solid #E1E6EC',
              background: '#F7F9FB',
              gap: 12,
            }}
          >
            <Label>Хронология заказа</Label>
            {timeline.length === 0 && <span className={s.muted}>Событий пока нет</span>}
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
                  Открыть переписку →
                </Link>
                <span className={s.muted} style={{ fontSize: 12, lineHeight: 1.4 }}>
                  Просмотр чата логируется с причиной «спор {cur.id}»
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
          title={`Запрос по спору ${cur.id}`}
          sub="Сторона получит уведомление и ответит в приложении; ответ появится в карточке спора"
          okText="Отправить запрос"
          okDisabled={ask.text.trim().length < 10}
          busy={busy}
          onClose={() => setAsk(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.requestDispute(cur, ask.side, ask.text.trim());
              setAsk(null);
              toast(`Запрос отправлен ${ask.side === 'client' ? 'клиенту' : 'мастеру'}`);
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
                {k === 'master' ? `Мастеру · ${cur.masterName}` : `Клиенту · ${cur.clientName}`}
              </button>
            ))}
          </div>
          <textarea className={s.textarea} rows={4} value={ask.text} onChange={(e) => setAsk({ ...ask, text: e.target.value.slice(0, 1000) })} placeholder="Что нужно уточнить: фото результата, чек, объяснение" autoFocus />
        </Modal>
      )}
      {confirm && cur && res && (
        <Modal icon={Scale} tone="blue" title={`Закрыть спор ${cur.id}: ${resLabel}`} sub={`${cur.title} · ${cur.clientName} ↔ ${cur.masterName}`} cancelText="Назад" okText="Закрыть спор" okDisabled={!agree} busy={busy} onClose={() => (setConfirm(false), setAgree(false))} onOk={close}>
          <div className={s.textBox} style={{ fontSize: 13, lineHeight: 1.5 }}>
            «{comment.trim()}»
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['Клиент получит', 'Мастер получит'] as const).map((h, i) => (
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
            <b>После решения</b>
            {AFTER[res][2].map((x) => (
              <span key={x}>· {x}</span>
            ))}
          </div>
          <CheckRow on={agree} onClick={() => setAgree(!agree)}>
            Я изучил позиции обеих сторон, фото и переписку. Решение необратимо.
          </CheckRow>
        </Modal>
      )}
    </>
  );
}
