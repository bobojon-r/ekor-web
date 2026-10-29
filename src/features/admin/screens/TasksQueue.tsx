'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PencilLine, TriangleAlert } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin, useUndo } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Lock, Reason, TaskQ } from '../data/types';
import { agoText, FLAG_TEXT, FLAGS, sla } from '../core';
import { Checkbox, cx, EmptyQueue, Head, HotkeyHelp, Label, Loading, Marked, Modal, Photo, Pill, RefreshBtn, SearchBox, SelectChip, Tabs, ToggleChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

const COLS = '28px 64px minmax(0,1fr) 112px 150px 44px';
const toneOf = (label: string) => Object.values(FLAGS).find((f) => f[0] === label)?.[1] ?? 'grey';

/** 02 — модерация заданий: таблица слева + карточка 400px; 13 — пустая очередь */
export function TasksQueue() {
  const { me, counts, refreshCounts } = useAdmin();
  const undo = useUndo();
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
  const [edit, setEdit] = useState<null | {
    title: string;
    text: string;
    address: string;
    note: string;
  }>(null);
  const [locks, setLocks] = useState<Record<string, Lock | null>>({});
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
  // Открытая карточка берётся в работу на 10 мин — у других модераторов строка помечена «Смотрит …»
  useEffect(() => {
    if (!cur || !isQueue || (cur.lock && !cur.lock.mine)) return;
    let live = true;
    const take = () =>
      adminApi.lockTask(cur).then(
        (l) => live && setLocks((m) => ({ ...m, [cur.key]: l })),
        (e) =>
          live &&
          (e as { code?: string }).code === 'locked_by_other' &&
          setLocks((m) => ({
            ...m,
            [cur.key]: { name: L.tasksQueue.drugoyModerator, mine: false },
          })),
      );
    take();
    const id = setInterval(take, 8 * 60000);
    return () => ((live = false), clearInterval(id));
  }, [cur?.key, isQueue]); // eslint-disable-line react-hooks/exhaustive-deps
  const lockOf = (t: TaskQ) => (t.key in locks ? locks[t.key] : t.lock) ?? null;
  const busyBy = (t: TaskQ) => {
    const l = lockOf(t);
    return l && !l.mine ? l.name : null;
  };
  const curBy = cur ? busyBy(cur) : null;

  const openEdit = (t: TaskQ) =>
    !busyBy(t) &&
    setEdit({
      title: t.title,
      text: t.text,
      address: t.address ?? '',
      note: '',
    });
  /** 409: уже решено или смотрит другой — убираем строку и сообщаем */
  const gone = (e: unknown, t: TaskQ) => {
    const code = (e as { code?: string }).code;
    if (code === 'already_resolved' || code === 'locked_by_other') {
      setRows((r) => r?.filter((x) => x.key !== t.key) ?? r);
      toast(code === 'already_resolved' ? L.tasksQueue.uzheObrabotano(t.id) : L.tasksQueue.smotritDrugoyModerator(t.id));
      refreshCounts();
      return true;
    }
    return false;
  };
  const next = (d: number) => setSel((i) => Math.max(0, Math.min(view.length - 1, i + d)));
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const act = async (list: TaskQ[], ok: boolean) => {
    if (busy || !list.length) return;
    if (!ok && !reason) return toast(L.tasksQueue.vyberitePrichinuOtkazaKlavishi, 'info');
    if (list.length === 1 && busyBy(list[0])) return toast(L.tasksQueue.smotritDozhditesResheniya(busyBy(list[0])), 'info');
    if (ok) return approveLater(list);
    setBusy(true);
    try {
      let done = list.map((t) => t.key);
      let failed = 0;
      if (list.length > 1) ({ done, failed } = await adminApi.bulkTasks(list, ok, reason ?? undefined));
      else await adminApi.moderateTask(list[0], ok, reason ?? undefined);
      // После решения фокус — на следующей строке (индекс тот же)
      const keys = new Set(done);
      setRows((r) => r?.filter((x) => !keys.has(x.key)) ?? r);
      setPicked(new Set());
      setReason(null);
      if (ok) setApproved((n) => n + done.length);
      toast(
        failed
          ? L.tasksQueue.neObrabotanoUzheResheny(ok ? L.tasksQueue.odobreno : L.tasksQueue.otkloneno, done.length, failed)
          : ok
            ? list.length > 1
              ? L.tasksQueue.odobreno2(list.length)
              : L.tasksQueue.odobreno3(list[0].title)
            : L.tasksQueue.otklonenoAvtorPoluchilUvedomleni,
      );
      refreshCounts();
    } catch (e) {
      if (!(list.length === 1 && gone(e, list[0]))) toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };

  /**
   * Одобрение обратимо 5 с (ТЗ §4): строки уходят из очереди сразу, запрос — когда истечёт «Отменить».
   * Ошибка при отправке возвращает строки и показывает причину.
   */
  const approveLater = (list: TaskQ[]) => {
    const keys = new Set(list.map((t) => t.key));
    const back = () => setRows((r) => (r ? [...list.filter((t) => !r.some((x) => x.key === t.key)), ...r] : r));
    setRows((r) => r?.filter((x) => !keys.has(x.key)) ?? r);
    setPicked(new Set());
    setReason(null);
    setApproved((n) => n + list.length);
    undo(
      list.length > 1 ? L.tasksQueue.odobreno2(list.length) : L.tasksQueue.odobreno3(list[0].title),
      async () => {
        try {
          if (list.length > 1) {
            const r = await adminApi.bulkTasks(list, true);
            if (r.failed) toast(L.tasksQueue.neObrabotanoUzheResheny2(r.failed), 'info');
          } else await adminApi.moderateTask(list[0], true);
          refreshCounts();
        } catch (e) {
          if (!(list.length === 1 && gone(e, list[0]))) (back(), setApproved((n) => n - list.length), toast(apiErrorText(e, 'ru')));
        }
      },
      () => (back(), setApproved((n) => n - list.length)),
    );
  };

  useHotkeys(
    isQueue && cur
      ? {
          j: () => next(1),
          k: () => next(-1),
          a: () => act([cur], true),
          r: () => act([cur], false),
          e: () => openEdit(cur),
          x: () => toggle(cur.key),
          ...Object.fromEntries(reasons.slice(0, 5).map((r, i) => [String(i + 1), () => setReason((x) => (x?.id === r.id ? null : r))])),
          Escape: () => (picked.size ? setPicked(new Set()) : setReason(null)),
        }
      : {},
  );

  const cities = [...new Set((rows ?? []).map((r) => r.city.split(',')[0]))];
  const cats = [...new Set((rows ?? []).map((r) => r.cat))];
  const chosen = view.filter((r) => picked.has(r.key));
  const flagText = cur?.flags.map((f) => FLAG_TEXT[f]).find(Boolean);

  const header = (
    <Head title={L.tasksQueue.moderatsiyaZadaniya}>
        <HotkeyHelp keys={[["J / K", L.tasksQueue.sleduyuschayaPredyduschayaStroka], ["A", L.tasksQueue.odobrit], ["R", L.tasksQueue.otklonitSnachalaPrichina], ["E", L.tasksQueue.pravitTekst], ["X", L.tasksQueue.vybratStroku], ["1–5", L.tasksQueue.prichinaOtkloneniya], ["/", L.tasksQueue.poisk], ["Esc", L.tasksQueue.zakrytOknoIliSnyat], ["?", L.tasksQueue.etaPodskazka]]} />
      <Tabs value={tab} onChange={setTab} items={[['queue', L.tasksQueue.ochered(rows && isQueue ? rows.length : counts.tasks)], ['rejected', L.tasksQueue.otklonennye], ['approved', L.tasksQueue.odobrennyeSegodnya(approved)]]} />
      <span className={s.grow} />
      {isQueue && rows?.length === 0 ? (
        <span className={s.live}>
          <span className={s.liveDot} />
          {L.tasksQueue.obnovlyaetsyaAvtomaticheski}
        </span>
      ) : (
        <>
          <SearchBox value={q} onChange={setQ} placeholder={L.tasksQueue.idTekstTelefon} slash />
          <span className={s.note}>{L.tasksQueue.sla30Min}</span>
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
          <SelectChip label={L.tasksQueue.gorod} value={city} onChange={setCity} options={[['all', me.role === 'moderator' ? me.meta.split('·')[1]?.trim() || L.tasksQueue.moiRegiony : L.tasksQueue.vse]]} />
          {me.role === 'moderator' && <span className={s.muted}>{L.tasksQueue.vyViditeTolkoZadaniya}</span>}
        </div>
        <EmptyQueue text={L.tasksQueue.vseZadaniyaProverenyNovye} stats={[[String(approved), L.tasksQueue.proverenoSegodnya], ['—', L.tasksQueue.vashaMediana], ['0', L.tasksQueue.prosrocheno]]}>
          <Link href="/admin/moderation/masters" className={s.btn} style={{ textDecoration: 'none', color: '#0F1B2A' }}>
            {L.tasksQueue.profiliMasterov} {counts.masters}
          </Link>
          <RefreshBtn onClick={() => (setRows(null), load(), refreshCounts())} />
        </EmptyQueue>
      </>
    );

  return (
    <>
      {header}
      <div className={s.filters}>
        <SelectChip label={L.tasksQueue.gorod} value={city} onChange={setCity} options={[['all', L.tasksQueue.vse], ...cities.map((c): [string, string] => [c, c])]} />
        <SelectChip label={L.tasksQueue.kategoriya} value={cat} onChange={setCat} options={[['all', L.tasksQueue.vse], ...cats.map((c): [string, string] => [c, c])]} />
        <ToggleChip on={onlyFlags} onClick={() => setOnlyFlags(!onlyFlags)}>
          {L.tasksQueue.tolkoSFlagami}
        </ToggleChip>
        {me.role === 'moderator' && <span className={s.muted}>{L.tasksQueue.vyViditeTolkoZadaniya}</span>}
        <span className={s.grow} />
        {isQueue && chosen.length > 0 && (
          <>
            <span className={s.bulkN}>{L.tasksQueue.vybrano} {chosen.length}</span>
            <button type="button" className={s.bulkOk} disabled={busy} onClick={() => act(chosen, true)}>
              {L.tasksQueue.odobrit2} {chosen.length}
            </button>
            <button type="button" className={s.bulkNo} disabled={busy} onClick={() => act(chosen, false)}>
              {L.tasksQueue.otklonit}
            </button>
          </>
        )}
      </div>
      <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 400px' }}>
        <div className={s.list}>
          <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
            <span />
            <span>ID</span>
            <span>{L.tasksQueue.zadanieKategoriya}</span>
            <span>{L.tasksQueue.gorod}</span>
            <span>{L.tasksQueue.flagi}</span>
            <span className={s.right}>SLA</span>
          </div>
          <div className={s.scroll}>
            {view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{L.tasksQueue.nichegoNeNaydeno}</div>}
            {view.map((r, i) => {
              const left = r.slaLeft === null ? null : r.slaLeft - elapsed;
              const sl =
                left === null
                  ? {
                      text: L.tasksQueue.m(Math.round(r.ageMin + elapsed)),
                      color: '#6B7787',
                    }
                  : sla(left);
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
                  {isQueue ? <Checkbox on={picked.has(r.key)} onClick={() => toggle(r.key)} label={L.tasksQueue.vybrat(r.id)} /> : <span />}
                  <span className={s.id}>{r.id}</span>
                  <span className={s.cell}>
                    <span className={s.rowTitle}>{r.title}</span> <span className={s.muted}>· {r.cat}</span>
                    {busyBy(r) && <span className={s.lockTag}> {L.tasksQueue.smotrit} {busyBy(r)}</span>}
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
        {cur ? (
          <div className={s.panel}>
            <div className={s.panelBody}>
              <div className={s.metaLine}>
                <span>{cur.id}</span>
                <span>·</span>
                <span>{agoText(cur.ageMin + elapsed)}</span>
                <span className={s.grow} />
                <span>
                  {view.indexOf(cur) + 1} {L.tasksQueue.iz} {view.length}
                </span>
              </div>
              <span className={s.h17}>{cur.title}</span>
              <div className={s.kv}>
                <span>{L.tasksQueue.kategoriya}</span>
                <span>{cur.cat}</span>
                <span>{L.tasksQueue.rayon}</span>
                <span>{cur.city}</span>
                <span>{L.tasksQueue.byudzhet}</span>
                <span>{cur.budget}</span>
                <span>{L.tasksQueue.kogda}</span>
                <span>{cur.when}</span>
                <span>{L.tasksQueue.avtor}</span>
                <span>
                  {cur.author} {cur.authorMeta && <span className={s.muted} style={{ fontWeight: 400 }}>· {cur.authorMeta}</span>}
                </span>
              </div>
              {cur.text && (
                <div className={s.textBox}>
                  <Marked text={cur.text} marks={cur.marks} />
                </div>
              )}
              {cur.photos.length > 0 && (
                <div className={s.photos5}>
                  {cur.photos.slice(0, 5).map((p, i) => (
                    <Photo key={i} src={p || undefined} />
                  ))}
                </div>
              )}
              {curBy && (
                <div className={s.alertWarn}>
                  <TriangleAlert size={15} aria-hidden />
                  <span>{L.tasksQueue.etoZadanieSeychasSmotrit} {curBy}{L.tasksQueue.reshenieDostupnoKogdaOn}</span>
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
                  <Label>{L.tasksQueue.bystrayaPrichinaOtkaza}</Label>
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
                  <button type="button" className={cx(s.btn, s.btnOutRed)} disabled={busy || !reason || !!curBy} title={reason ? '' : L.tasksQueue.snachalaVyberitePrichinu} onClick={() => act([cur], false)}>
                    {L.tasksQueue.otklonit2} <span className={s.key}>R</span>
                  </button>
                  <button type="button" className={s.btn} disabled={!!curBy} onClick={() => openEdit(cur)}>
                    {L.tasksQueue.pravit} <span className={s.key}>E</span>
                  </button>
                  <span className={s.grow} />
                  <button
                    type="button"
                    className={cx(s.btn, s.btnGreen)}
                    style={{
                      whiteSpace: 'normal',
                      lineHeight: 1.15,
                      padding: '0 12px',
                      textAlign: 'left',
                    }}
                    disabled={busy || !!curBy}
                    onClick={() => act([cur], true)}
                  >
                    {L.tasksQueue.odobritIDalee} <span className={s.key}>A</span>
                  </button>
                </div>
                <div className={s.hint}>{L.tasksQueue.jKSleduyuscheePredyduschee}</div>
              </>
            )}
          </div>
        ) : (
          <div className={s.loading}>{L.tasksQueue.vyberiteZadanie}</div>
        )}
      </div>
      {edit && cur && (
        <Modal
          icon={PencilLine}
          tone="blue"
          title={L.tasksQueue.pravit2(cur.id)}
          sub={L.tasksQueue.udaliteKontaktyILishnee}
          okText={L.tasksQueue.sohranitIOdobrit}
          okDisabled={edit.title.trim().length < 5 || edit.text.trim().length < 10 || edit.note.trim().length < 5}
          busy={busy}
          onClose={() => setEdit(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.editTask(
                cur,
                {
                  title: edit.title.trim(),
                  text: edit.text.trim(),
                  address: edit.address.trim() || null,
                },
                edit.note.trim(),
              );
              setRows((r) => r?.filter((x) => x.key !== cur.key) ?? r);
              setApproved((n) => n + 1);
              setEdit(null);
              toast(L.tasksQueue.ispravlenoIOdobreno(edit.title.trim()));
              refreshCounts();
            } catch (e) {
              if (!gone(e, cur)) toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <label className={s.col4}>
            <span className={s.fieldT}>{L.tasksQueue.zagolovok}</span>
            <input className={s.input} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value.slice(0, 80) })} />
          </label>
          <label className={s.col4}>
            <span className={s.fieldT}>{L.tasksQueue.opisanie}</span>
            <textarea className={s.textarea} rows={6} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value.slice(0, 2000) })} autoFocus />
          </label>
          {cur.address != null && (
            <label className={s.col4}>
              <span className={s.fieldT}>{L.tasksQueue.adresVidenTolkoVybrannomu}</span>
              <input className={s.input} value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value.slice(0, 200) })} />
            </label>
          )}
          <label className={s.col4}>
            <span className={s.fieldT}>
              {L.tasksQueue.zametkaDlyaAvtora} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <input className={s.input} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value.slice(0, 300) })} placeholder={L.tasksQueue.naprimerUdaliliNomerTelefona} />
            <span className={s.muted}>{L.tasksQueue.izmenenieZapishetsyaVAudit}</span>
          </label>
        </Modal>
      )}
    </>
  );
}
