'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PencilLine, TriangleAlert } from 'lucide-react';
import { apiErrorText, USE_API } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Reason, TaskQ } from '../data/types';
import { agoText, FLAG_TEXT, FLAGS, sla, splitContact } from '../core';
import { Checkbox, cx, EmptyQueue, Head, Highlighted, Label, Loading, Modal, Photo, Pill, RefreshBtn, SearchBox, SelectChip, Tabs, ToggleChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';

const COLS = '28px 64px minmax(0,1fr) 112px 150px 44px';
const toneOf = (label: string) => Object.values(FLAGS).find((f) => f[0] === label)?.[1] ?? 'grey';

/** 02 — модерация заданий: таблица слева + карточка 400px; 13 — пустая очередь */
export function TasksQueue() {
  const { me, counts, refreshCounts } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState<'queue' | 'rejected' | 'approved'>('queue');
  const [rows, setRows] = useState<TaskQ[] | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [approved, setApproved] = useState(0);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('all');
  const [cat, setCat] = useState('all');
  const [onlyFlags, setOnlyFlags] = useState(false);
  const [sel, setSel] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const loadedAt = useRef(Date.now());

  const load = () =>
    adminApi.tasks(tab).then(
      (r) => ((loadedAt.current = Date.now()), setNow(Date.now()), setRows(r)),
      (e) => (setRows([]), toast(apiErrorText(e, 'ru'))),
    );
  useEffect(() => {
    setRows(null);
    setSel(0);
    setPicked(new Set());
    load();
    adminApi.approvedToday().then(setApproved, () => {});
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    adminApi.taskReasons().then(setReasons, () => {});
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // По умолчанию — по SLA: самые горящие сверху
  const view = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const digits = ql.replace(/\D/g, '');
    return (rows ?? [])
      .filter(
        (r) =>
          (!ql || r.id.toLowerCase().includes(ql) || r.title.toLowerCase().includes(ql) || r.text.toLowerCase().includes(ql) || (digits.length >= 4 && r.text.replace(/\D/g, '').includes(digits))) &&
          (city === 'all' || r.city.startsWith(city)) && (cat === 'all' || r.cat === cat) && (!onlyFlags || r.flags.length > 0),
      )
      .sort((a, b) => (a.slaLeft ?? 1e9) - (b.slaLeft ?? 1e9) || a.ageMin - b.ageMin);
  }, [rows, q, city, cat, onlyFlags]);
  const cur = view[Math.min(sel, view.length - 1)] ?? null;
  const elapsed = (now - loadedAt.current) / 60000;
  const isQueue = tab === 'queue';

  useEffect(() => setReason(null), [cur?.key]);

  /** Правка текста модератором: в API пока нет PATCH /admin/tasks/{id} */
  const openEdit = (text: string) => (USE_API ? toast('Правка текста появится, когда в API будет PATCH /admin/tasks/{id}. Пока — отклоните с причиной «Контакты в тексте».', 'info') : setEdit(text));
  const next = (d: number) => setSel((i) => Math.max(0, Math.min(view.length - 1, i + d)));
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const act = async (list: TaskQ[], ok: boolean) => {
    if (busy || !list.length) return;
    if (!ok && !reason) return toast('Выберите причину отказа — клавиши 1–5', 'info');
    setBusy(true);
    try {
      for (const t of list) await adminApi.moderateTask(t, ok, reason ?? undefined);
      // После решения фокус — на следующей строке (индекс тот же)
      const keys = new Set(list.map((t) => t.key));
      setRows((r) => r?.filter((x) => !keys.has(x.key)) ?? r);
      setPicked(new Set());
      setReason(null);
      if (ok) setApproved((n) => n + list.length);
      toast(ok ? (list.length > 1 ? `Одобрено: ${list.length}` : `Одобрено: «${list[0].title}»`) : 'Отклонено. Автор получил уведомление с причиной');
      refreshCounts();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };

  useHotkeys(
    isQueue && cur
      ? {
          j: () => next(1), k: () => next(-1), a: () => act([cur], true), r: () => act([cur], false), e: () => openEdit(cur.text), x: () => toggle(cur.key),
          ...Object.fromEntries(reasons.slice(0, 5).map((r, i) => [String(i + 1), () => setReason((x) => (x?.id === r.id ? null : r))])),
          Escape: () => (picked.size ? setPicked(new Set()) : setReason(null)),
        }
      : {},
  );

  const cities = [...new Set((rows ?? []).map((r) => r.city.split(',')[0]))];
  const cats = [...new Set((rows ?? []).map((r) => r.cat))];
  const chosen = view.filter((r) => picked.has(r.key));
  const parts = cur ? splitContact(cur.text) : null;
  const flagText = cur?.flags.map((f) => FLAG_TEXT[f]).find(Boolean);

  const header = (
    <Head title="Модерация · Задания">
      <Tabs value={tab} onChange={setTab} items={[['queue', `Очередь ${rows && isQueue ? rows.length : counts.tasks}`], ['rejected', 'Отклонённые'], ['approved', `Одобренные сегодня ${approved}`]]} />
      <span className={s.grow} />
      {isQueue && rows?.length === 0 ? (
        <span className={s.live}>
          <span className={s.liveDot} />
          Обновляется автоматически
        </span>
      ) : (
        <>
          <SearchBox value={q} onChange={setQ} placeholder="ID, текст, телефон" slash />
          <span className={s.note}>SLA 30 мин</span>
        </>
      )}
    </Head>
  );

  if (!rows)
    return (
      <>
        {header}
        <Loading />
      </>
    );

  // 13 — пустая очередь: обновляется сама (счётчики раз в 30 с)
  if (isQueue && rows.length === 0)
    return (
      <>
        {header}
        <div className={s.filters}>
          <SelectChip label="Город" value={city} onChange={setCity} options={[['all', me.role === 'moderator' ? me.meta.split('·')[1]?.trim() || 'мои регионы' : 'все']]} />
          {me.role === 'moderator' && <span className={s.muted}>Вы видите только задания своих регионов</span>}
        </div>
        <EmptyQueue text="Все задания проверены. Новые появятся здесь сами — список обновляется автоматически." stats={[[String(approved), 'проверено сегодня'], ['—', 'ваша медиана'], ['0', 'просрочено']]}>
          <Link href="/admin/moderation/masters" className={s.btn} style={{ textDecoration: 'none', color: '#0F1B2A' }}>
            Профили мастеров · {counts.masters}
          </Link>
          <RefreshBtn onClick={() => (setRows(null), load(), refreshCounts())} />
        </EmptyQueue>
      </>
    );

  return (
    <>
      {header}
      <div className={s.filters}>
        <SelectChip label="Город" value={city} onChange={setCity} options={[['all', 'все'], ...cities.map((c): [string, string] => [c, c])]} />
        <SelectChip label="Категория" value={cat} onChange={setCat} options={[['all', 'все'], ...cats.map((c): [string, string] => [c, c])]} />
        <ToggleChip on={onlyFlags} onClick={() => setOnlyFlags(!onlyFlags)}>
          Только с флагами
        </ToggleChip>
        {me.role === 'moderator' && <span className={s.muted}>Вы видите только задания своих регионов</span>}
        <span className={s.grow} />
        {isQueue && chosen.length > 0 && (
          <>
            <span className={s.bulkN}>Выбрано {chosen.length}</span>
            <button type="button" className={s.bulkOk} disabled={busy} onClick={() => act(chosen, true)}>
              Одобрить {chosen.length}
            </button>
            <button type="button" className={s.bulkNo} disabled={busy} onClick={() => act(chosen, false)}>
              Отклонить…
            </button>
          </>
        )}
      </div>
      <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 400px' }}>
        <div className={s.list}>
          <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
            <span />
            <span>ID</span>
            <span>Задание · категория</span>
            <span>Город</span>
            <span>Флаги</span>
            <span className={s.right}>SLA</span>
          </div>
          <div className={s.scroll}>
            {view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>Ничего не найдено</div>}
            {view.map((r, i) => {
              const left = r.slaLeft === null ? null : r.slaLeft - elapsed;
              const sl = left === null ? { text: `${Math.round(r.ageMin + elapsed)}м`, color: '#6B7787' } : sla(left);
              return (
                <div
                  key={r.key}
                  role="button"
                  tabIndex={0}
                  aria-current={cur?.key === r.key}
                  onClick={() => setSel(i)}
                  onKeyDown={(e) => e.key === 'Enter' && setSel(i)}
                  className={cx(s.row, picked.has(r.key) && s.rowChk, cur?.key === r.key && s.rowOn)}
                  style={{ gridTemplateColumns: COLS }}
                >
                  {isQueue ? <Checkbox on={picked.has(r.key)} onClick={() => toggle(r.key)} label={`Выбрать ${r.id}`} /> : <span />}
                  <span className={s.id}>{r.id}</span>
                  <span className={s.cell}>
                    <span className={s.rowTitle}>{r.title}</span> <span className={s.muted}>· {r.cat}</span>
                  </span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {r.city}
                  </span>
                  <span className={s.flags}>
                    {r.flags.map((f) => (
                      <Pill key={f} tone={toneOf(f)}>
                        {f}
                      </Pill>
                    ))}
                  </span>
                  <span className={s.num} style={{ color: sl.color }}>
                    {sl.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {cur && parts ? (
          <div className={s.panel}>
            <div className={s.panelBody}>
              <div className={s.metaLine}>
                <span>{cur.id}</span>
                <span>·</span>
                <span>{agoText(cur.ageMin + elapsed)}</span>
                <span className={s.grow} />
                <span>
                  {view.indexOf(cur) + 1} из {view.length}
                </span>
              </div>
              <span className={s.h17}>{cur.title}</span>
              <div className={s.kv}>
                <span>Категория</span>
                <span>{cur.cat}</span>
                <span>Район</span>
                <span>{cur.city}</span>
                <span>Бюджет</span>
                <span>{cur.budget}</span>
                <span>Когда</span>
                <span>{cur.when}</span>
                <span>Автор</span>
                <span>
                  {cur.author} {cur.authorMeta && <span className={s.muted} style={{ fontWeight: 400 }}>· {cur.authorMeta}</span>}
                </span>
              </div>
              {cur.text && (
                <div className={s.textBox}>
                  <Highlighted {...parts} />
                </div>
              )}
              {cur.photos.length > 0 && (
                <div className={s.photos5}>
                  {cur.photos.slice(0, 5).map((p, i) => (
                    <Photo key={i} src={p || undefined} />
                  ))}
                </div>
              )}
              {flagText && (
                <div className={s.alertRed}>
                  <TriangleAlert size={15} aria-hidden />
                  <span>{flagText}</span>
                </div>
              )}
              {isQueue && (
                <div className={s.col4}>
                  <Label>Быстрая причина отказа</Label>
                  <div className={s.wrap4}>
                    {reasons.slice(0, 5).map((x, i) => (
                      <button key={x.id} type="button" aria-pressed={reason?.id === x.id} className={cx(s.reason, reason?.id === x.id && s.reasonOn)} onClick={() => setReason(reason?.id === x.id ? null : x)}>
                        <span className={s.reasonKey}>{i + 1}</span>
                        {x.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {isQueue && (
              <>
                <div className={s.panelFoot}>
                  <button type="button" className={cx(s.btn, s.btnOutRed)} disabled={busy || !reason} title={reason ? '' : 'Сначала выберите причину'} onClick={() => act([cur], false)}>
                    Отклонить <span className={s.key}>R</span>
                  </button>
                  <button type="button" className={s.btn} onClick={() => openEdit(cur.text)}>
                    Править <span className={s.key}>E</span>
                  </button>
                  <span className={s.grow} />
                  <button type="button" className={cx(s.btn, s.btnGreen)} style={{ whiteSpace: 'normal', lineHeight: 1.15, padding: '0 12px', textAlign: 'left' }} disabled={busy} onClick={() => act([cur], true)}>
                    Одобрить и далее <span className={s.key}>A</span>
                  </button>
                </div>
                <div className={s.hint}>J / K — следующее / предыдущее · X — выбрать · 1–5 — причина</div>
              </>
            )}
          </div>
        ) : (
          <div className={s.loading}>Выберите задание</div>
        )}
      </div>
      {edit !== null && cur && (
        <Modal
          icon={PencilLine}
          tone="blue"
          title={`Править ${cur.id}`}
          sub="Удалите контакты и лишнее — автор увидит, что текст изменён модератором."
          okText="Сохранить и одобрить"
          okDisabled={edit.trim().length < 10}
          onClose={() => setEdit(null)}
          onOk={() => {
            setRows((r) => r?.map((x) => (x.key === cur.key ? { ...x, text: edit, flags: x.flags.filter((f) => f !== 'Контакты') } : x)) ?? r);
            setEdit(null);
            act([{ ...cur, text: edit }], true);
          }}
        >
          <textarea className={s.textarea} rows={6} value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus />
          <span className={s.muted}>Изменение запишется в аудит-лог (task.edit).</span>
        </Modal>
      )}
    </>
  );
}
