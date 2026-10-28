'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Check, CircleHelp, TriangleAlert, UserX, X } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Check as Chk, Lock, MasterCard, MasterQ, Reason } from '../data/types';
import { agoText, sla } from '../core';
import { cx, EmptyQueue, Head, Label, Marked, Loading, Modal, Photo, Pill, RefreshBtn, Switch, Tabs, useHotkeys } from '../ui';
import s from '../Admin.module.css';

const COLS = '64px minmax(0,1fr) 120px 92px 56px';
type TabK = 'new' | 'changes' | 'verify';
const inTab = (m: MasterQ, t: TabK) => (t === 'new' ? m.type === 'Новый' || m.type === 'Повторно' : t === 'changes' ? m.type === 'Изменения' : m.type === '«Проверен»');
const CHK: Record<0 | 1 | 2, [string, typeof Check]> = {
  1: ['#E3F4F0', Check],
  0: ['#FBE3E0', X],
  2: ['#FBEBDA', CircleHelp],
};
const CHK_FG = { 1: '#0B6E5E', 0: '#A5281B', 2: '#8A4B0D' } as const;

/** 03 — профили мастеров: таблица + карточка 560px с чек-листом модератора */
export function MastersQueue() {
  const { me, refreshCounts } = useAdmin();
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
  const [ver, setVer] = useState<null | { on: boolean; comment: string }>(null);
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
        (e) => live && (e as { code?: string }).code === 'locked_by_other' && setLock({ name: 'другой модератор', mine: false }),
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
  const decide = async (ok: boolean, reason?: Reason, comment?: string, back = false) => {
    if (!cur || busy || by) return;
    setBusy(true);
    try {
      if (back) await adminApi.returnMaster(cur, comment ?? '');
      else await adminApi.moderateMaster(cur, ok, reason, comment);
      setRows((r) => r?.filter((x) => x.key !== cur.key) ?? r);
      setRej(null);
      toast(ok ? `Профиль одобрен: ${cur.name}` : back ? 'Профиль возвращён на правки с комментарием' : 'Отклонено. Мастер получил причину');
      refreshCounts();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'already_resolved' || code === 'locked_by_other') {
        setRows((r) => r?.filter((x) => x.key !== cur.key) ?? r);
        setRej(null);
        toast(code === 'already_resolved' ? `Уже обработано: ${cur.id}` : `${cur.name} смотрит другой модератор`);
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
          a: () => !failed && card && decide(true),
          r: () => !by && setRej({ back: false, reason: null, comment: '' }),
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
      <Head title="Модерация · Профили мастеров">
        <Tabs value={tab} onChange={(k) => (setTab(k), setSel(0))} items={[['new', `Новые ${counts.new}`], ['changes', `Изменения профиля ${counts.changes}`], ['verify', `Запрос «Проверен» ${counts.verify}`]]} />
        <span className={s.grow} />
        <span className={s.note}>SLA 24 ч</span>
      </Head>
      {!rows ? (
        <Loading />
      ) : view.length === 0 ? (
        <EmptyQueue text="Все профили в этой вкладке проверены. Новые появятся здесь сами." stats={[[String(counts.new + counts.changes + counts.verify), 'в других вкладках'], ['—', 'ваша медиана'], ['0', 'просрочено']]}>
          <RefreshBtn onClick={() => (setRows(null), load(), refreshCounts())} />
        </EmptyQueue>
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
              <span>ID</span>
              <span>Мастер · категории</span>
              <span>Город</span>
              <span>Подано</span>
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
                        {m.lock && !m.lock.mine && <span className={s.lockTag}> Смотрит {m.lock.name}</span>}
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
                    <Pill big tone="warn">
                      На проверке
                    </Pill>
                  </div>
                  <div
                    className={s.kv}
                    style={{
                      gridTemplateColumns: '110px 1fr',
                      gap: '6px 12px',
                    }}
                  >
                    <span>Город, районы</span>
                    <span style={{ fontWeight: 400 }}>{card.city}</span>
                    <span>Цены</span>
                    <span style={{ fontWeight: 400 }}>{card.prices}</span>
                    <span>О себе</span>
                    <span style={{ fontWeight: 400, lineHeight: 1.5 }}>
                      <Marked text={card.about} marks={card.marks} />
                    </span>
                  </div>
                  <div className={s.col6}>
                    <Label>Портфолио · {card.photos.length} фото</Label>
                    {card.photos.length ? (
                      <div className={s.photos6}>
                        {card.photos.slice(0, 6).map((p, i) => (
                          <Photo key={i} src={p || undefined} />
                        ))}
                      </div>
                    ) : (
                      <span className={s.muted}>Фото работ нет</span>
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
                      Чек-лист модератора
                    </div>
                    {checks.map(([t, ok, n], i) => {
                      const [bg, I] = CHK[ok];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => cycle(i)}
                          title="Нажмите, чтобы изменить отметку"
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
                      <span>Этот профиль сейчас смотрит {by}. Решение доступно, когда он закончит или через 10 минут.</span>
                    </div>
                  )}
                  {senior && (
                    <div className={s.swRow}>
                      <Switch on={verified} onClick={() => setVer({ on: !verified, comment: '' })} label="Отметка «Проверен»" />
                      <div className={s.col4} style={{ gap: 2 }}>
                        <span className={s.fieldT}>Отметка «Проверен»</span>
                        <span className={s.muted}>Только после звонка и сверки документа. Подтверждённый телефон — не проверка.</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className={s.panelFoot} style={{ padding: '12px 20px' }}>
                  <button type="button" className={cx(s.btn, s.btnOutRed)} disabled={!!by} onClick={() => setRej({ back: false, reason: null, comment: '' })}>
                    Отклонить…
                  </button>
                  <button type="button" className={s.btn} disabled={!!by} onClick={openBack}>
                    Вернуть на правки
                  </button>
                  <span className={s.grow} />
                  <button type="button" className={cx(s.btn, s.btnGreen)} disabled={!!failed || busy || !!by} onClick={() => decide(true)}>
                    {failed ? `Одобрить — ${failed} ${failed === 1 ? 'пункт не пройден' : 'пункта не пройдено'}` : 'Одобрить'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {rej && cur && (
        <Modal
          icon={UserX}
          tone="red"
          title={rej.back ? `Вернуть ${cur.name} на правки?` : `Отклонить профиль ${cur.name}?`}
          sub={`${cur.id} · ${cur.cats} · ${cur.city}`}
          okText={rej.back ? 'Вернуть на правки' : 'Отклонить'}
          okTone="red"
          busy={busy}
          okDisabled={rej.back ? rej.comment.trim().length < 10 : !rej.reason || ((rej.reason.needComment || rej.reason.code === 'other') && rej.comment.trim().length < 5)}
          onClose={() => setRej(null)}
          onOk={() => decide(false, rej.reason ?? undefined, rej.comment.trim(), rej.back)}
        >
          {!rej.back && (
            <div className={s.col6}>
              <span className={s.fieldT}>
                Причина <span style={{ color: '#B03A2E' }}>*</span>
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
            <span className={s.fieldT}>Комментарий мастеру {(rej.back || rej.reason?.needComment || rej.reason?.code === 'other') && <span style={{ color: '#B03A2E' }}>*</span>}</span>
            <textarea className={s.textarea} rows={3} value={rej.comment} onChange={(e) => setRej({ ...rej, comment: e.target.value.slice(0, 500) })} placeholder="Что исправить, чтобы профиль прошёл проверку" />
            <span className={s.muted}>Мастер увидит причину и комментарий. Запись — в аудит-логе.</span>
          </div>
        </Modal>
      )}
      {ver && cur && (
        <Modal
          icon={BadgeCheck}
          tone="blue"
          title={ver.on ? `Отметить ${cur.name} «Проверен»?` : 'Снять отметку «Проверен»?'}
          sub="Только после звонка и сверки документа"
          okText={ver.on ? 'Поставить отметку' : 'Снять отметку'}
          okDisabled={ver.comment.trim().length < 10}
          busy={busy}
          onClose={() => setVer(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.verifyMaster(cur, ver.on, ver.comment.trim());
              setVerified(ver.on);
              setVer(null);
              toast(ver.on ? 'Отметка «Проверен» поставлена' : 'Отметка снята');
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col4}>
            <span className={s.fieldT}>
              Что проверено <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={ver.comment} onChange={(e) => setVer({ ...ver, comment: e.target.value.slice(0, 300) })} placeholder="Например: звонок + паспорт, совпадает с фото" autoFocus />
            <span className={s.muted}>Попадёт в аудит-лог (master.verify)</span>
          </div>
        </Modal>
      )}
    </>
  );
}
