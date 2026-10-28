'use client';

import { useEffect, useState } from 'react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Reason, ReviewV } from '../data/types';
import { splitContact } from '../core';
import { cx, Head, Highlighted, HotkeyHelp, Label, Loading, Pill, Tabs, useHotkeys } from '../ui';
import s from '../Admin.module.css';

const COLS = '64px 60px minmax(0,1fr) 140px 110px 60px';
type TabK = 'review' | 'all' | 'hidden';

/** Оскорбления помечены автофильтром как [оскорбление]; иначе подсвечиваем контакты */
function parts(text: string) {
  const i = text.indexOf('[');
  const j = text.indexOf(']', i);
  if (i >= 0 && j > i)
    return {
      pre: text.slice(0, i),
      hl: text.slice(i, j + 1),
      post: text.slice(j + 1),
    };
  return splitContact(text);
}

/** 05 — отзывы и жалобы: в очередь попадают при 2+ жалобах или автофильтре */
export function Reviews() {
  const { refreshCounts } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState<TabK>('review');
  const [rows, setRows] = useState<ReviewV[] | null>(null);
  const [all, setAll] = useState<ReviewV[]>([]);
  const [sel, setSel] = useState(0);
  const [reason, setReason] = useState<Reason | null>(null);
  const [hide, setHide] = useState<Reason[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([adminApi.reviews(tab), adminApi.reviews('review')]).then(
      ([r, q]) => (setRows(r), setAll(q)),
      (e) => (setRows([]), toast(apiErrorText(e, 'ru'))),
    );
  useEffect(() => {
    adminApi.hideReasons().then(setHide, () => {});
  }, []);
  useEffect(() => {
    setRows(null);
    setSel(0);
    load();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = rows ?? [];
  const cur = view[Math.min(sel, view.length - 1)] ?? null;
  useEffect(() => (setReason(null), setNote('')), [cur?.key]);

  const act = async (doHide: boolean) => {
    if (!cur || busy || (doHide && (!reason || (reason.needComment && note.trim().length < 5)))) return;
    setBusy(true);
    try {
      if (doHide) await adminApi.hideReview(cur, reason!, note.trim());
      else await adminApi.keepReview(cur);
      toast(doHide ? 'Отзыв скрыт. Автор получил причину' : tab === 'hidden' ? 'Отзыв возвращён' : 'Отзыв оставлен, жалобы отклонены');
      await load();
      refreshCounts();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };

  useHotkeys(
    cur
      ? {
          j: () => setSel((i) => Math.min(view.length - 1, i + 1)),
          k: () => setSel((i) => Math.max(0, i - 1)),
          ...Object.fromEntries(hide.slice(0, 5).map((h, i) => [String(i + 1), () => setReason(h)])),
        }
      : {},
  );

  return (
    <>
      <Head title="Отзывы и жалобы">
        <HotkeyHelp keys={[["J / K", "следующий / предыдущий отзыв"], ["1–5", "причина скрытия"], ["Esc", "закрыть окно"], ["?", "эта подсказка"]]} />
        <Tabs value={tab} onChange={setTab} items={[['review', `На проверке ${all.length}`], ['all', 'Все отзывы'], ['hidden', 'Скрытые']]} />
        <span className={s.grow} />
        <span className={s.note}>в очередь попадает при 2+ жалобах или автофильтре</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 440px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
              <span>ID</span>
              <span>Оценка</span>
              <span>Текст</span>
              <span>Мастер</span>
              <span>Причина</span>
              <span className={s.right}>Жалоб</span>
            </div>
            <div className={s.scroll}>
              {view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{tab === 'review' ? 'Очередь пуста — спорных отзывов нет' : 'Отзывов нет'}</div>}
              {view.map((r, i) => (
                <div key={r.key} role="button" tabIndex={0} onClick={() => setSel(i)} onKeyDown={(e) => e.key === 'Enter' && setSel(i)} className={cx(s.row, cur?.key === r.key && s.rowOn)} style={{ gridTemplateColumns: COLS }}>
                  <span className={s.id}>{r.id}</span>
                  <span style={{ color: '#D9822B', fontWeight: 600 }}>★ {r.rating}</span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {r.text}
                  </span>
                  <span className={s.cell}>{r.master}</span>
                  <span>
                    <Pill tone={r.tone}>{r.reason}</Pill>
                  </span>
                  <span className={s.num}>{r.complaints}</span>
                </div>
              ))}
            </div>
          </div>
          {cur ? (
            <div className={s.panel}>
              <div className={s.panelBody} style={{ padding: '16px 20px', gap: 14 }}>
                <div className={s.metaLine}>
                  <span>{cur.id}</span>
                  <span>·</span>
                  <span>заказ {cur.order}</span>
                  <span className={s.grow} />
                  <span>{cur.date}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 18, color: '#D9822B', letterSpacing: 2 }}>{'★'.repeat(cur.rating) + '☆'.repeat(5 - cur.rating)}</span>
                  <span style={{ fontWeight: 600 }}>
                    {cur.author} → {cur.master}
                  </span>
                </div>
                <div className={s.textBox}>
                  <Highlighted {...parts(cur.text)} />
                </div>
                {cur.reply && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#F7F9FB',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <Label>Ответ мастера</Label>
                    <span style={{ lineHeight: 1.5 }}>{cur.reply}</span>
                  </div>
                )}
                <div className={s.col6}>
                  <Label>Жалобы · {cur.complaints}</Label>
                  {cur.complaintList.length === 0 && <span className={s.muted}>{cur.complaints ? 'Подробности жалоб — в разделе «Чаты по жалобам»' : 'Жалоб нет'}</span>}
                  {cur.complaintList.map(([t, d]) => (
                    <div
                      key={t}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #EEF1F4',
                      }}
                    >
                      <span>{t}</span>
                      <span className={s.muted}>{d}</span>
                    </div>
                  ))}
                </div>
                {cur.status === 'hidden' ? (
                  <div className={s.alertWarn}>
                    <span>Скрыт: {cur.hideReason ?? 'причина не указана'}. Оценка не входит в рейтинг.</span>
                  </div>
                ) : (
                  <div className={s.col6}>
                    <Label>Причина скрытия</Label>
                    <div className={s.wrap4}>
                      {hide.map((h) => (
                        <button key={h.id} type="button" aria-pressed={reason?.id === h.id} className={cx(s.reason, reason?.id === h.id && s.reasonOn)} style={{ height: 28, padding: '0 10px' }} onClick={() => setReason(reason?.id === h.id ? null : h)}>
                          {h.label}
                        </button>
                      ))}
                    </div>
                    {reason?.needComment && <input className={s.input} value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Комментарий к причине (обязательно)" />}
                    <span className={s.muted} style={{ lineHeight: 1.45 }}>
                      Автор получит причину и сможет написать отзыв заново один раз. Оценка скрытого отзыва не входит в рейтинг.
                    </span>
                  </div>
                )}
              </div>
              <div className={s.panelFoot} style={{ padding: '12px 20px' }}>
                {cur.status === 'hidden' ? (
                  <button type="button" className={s.btn} disabled={busy} onClick={() => act(false)}>
                    Вернуть отзыв
                  </button>
                ) : (
                  <>
                    <button type="button" className={s.btn} disabled={busy || cur.status !== 'review'} onClick={() => act(false)}>
                      Оставить, жалобы отклонить
                    </button>
                    <span className={s.grow} />
                    <button type="button" className={cx(s.btn, s.btnRed)} disabled={busy || !reason || (reason.needComment && note.trim().length < 5)} onClick={() => act(true)}>
                      Скрыть отзыв
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={s.loading}>Выберите отзыв</div>
          )}
        </div>
      )}
    </>
  );
}
