'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeX, ExternalLink, History, PauseCircle, TriangleAlert, X } from 'lucide-react';
import { apiErrorText, USE_API } from '@/lib/api';
import { ref } from '@/lib/api/ref';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { MasterRegCard, MasterRegRow, Reason, TaskRegCard, TaskRegRow } from '../data/types';
import { downloadCsv, initials } from '../core';
import { cx, Head, Loading, Modal, Pill, SearchBox, SelectChip, ToggleChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import r from './Registries.module.css';
import { L } from '../i18n';

/** Вкладки с числом: счётчики по статусам сервер пока не отдаёт — показываем, только если известны */
function RegTabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: [K, string, number | null][] }) {
  return (
    <div className={s.tabs} role="tablist">
      {items.map(([k, l, n]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={cx(s.tab, value === k && s.tabOn)} style={{ gap: 6 }} onClick={() => onChange(k)}>
          {l}
          {n != null && <span className={r.tabN}>{n.toLocaleString('ru-RU')}</span>}
        </button>
      ))}
    </div>
  );
}

/** Пагинация курсором: «Показано 1–N», ← Назад / Далее → */
function Pager({ from, count, total, canPrev, canNext, onPrev, onNext }: { from: number; count: number; total: number | null; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void }) {
  return (
    <div className={r.pager}>
      <span className={s.muted}>
        {L.registries.pokazano} {count ? `${from + 1}–${from + count}` : '0'}
        {total != null ? L.registries.iz(total.toLocaleString('ru-RU')) : ''}
      </span>
      <span className={s.grow} />
      <button type="button" className={r.pageBtn} disabled={!canPrev} onClick={onPrev}>
        {L.registries.nazad}
      </button>
      <button type="button" className={cx(r.pageBtn, r.pageNext)} disabled={!canNext} onClick={onNext}>
        {L.registries.dalee}
      </button>
    </div>
  );
}

function usePages() {
  const [stack, setStack] = useState<(string | null)[]>([null]);
  const [next, setNext] = useState<string | null>(null);
  return {
    cursor: stack[stack.length - 1],
    page: stack.length - 1,
    next,
    setNext,
    reset: () => setStack([null]),
    prev: () => setStack((x) => (x.length > 1 ? x.slice(0, -1) : x)),
    forward: () => next && setStack((x) => [...x, next]),
  };
}

const PAGE = 50;

/* ============================== 23 — Все задания ============================== */

const TASK_TABS: [string, string][] = [['all', L.registries.vse], ['review', L.registries.naProverke], ['open', L.registries.otkryto], ['chosen', L.registries.vRabote], ['dispute', L.registries.spor], ['done', L.registries.zaversheno], ['closed', L.registries.zakryto]];
const TCOLS = '64px minmax(0,1fr) 120px 84px 56px 132px 64px';

export function AllTasks() {
  const { me } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('all');
  const [cat, setCat] = useState('all');
  const [period, setPeriod] = useState('30');
  const [flags, setFlags] = useState(false);
  const [qDeb, setQDeb] = useState('');
  const [rows, setRows] = useState<TaskRegRow[] | null>(null);
  const [all, setAll] = useState<TaskRegRow[]>([]);
  const [srv, setSrv] = useState<{ total: number | null; counts: Record<string, number> | null }>({ total: null, counts: null });
  const [selKey, setSelKey] = useState<number | null>(null);
  const [card, setCard] = useState<TaskRegCard | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [unpub, setUnpub] = useState<null | { reason: Reason | null; comment: string }>(null);
  const [busy, setBusy] = useState(false);
  const pages = usePages();

  useEffect(() => {
    const id = setTimeout(() => (setQDeb(q), pages.reset()), 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const filter = { status: tab, cityId: city === 'all' ? null : +city, categoryId: cat === 'all' ? null : +cat, flags, q: qDeb, days: +period };
  const load = () => {
    setRows(null);
    adminApi.allTasks({ ...filter, cursor: pages.cursor }).then(
      (p) => (setRows(p.items), pages.setNext(p.next), setSrv((x) => ({ total: p.total, counts: tab === 'all' ? p.counts : (x.counts ?? p.counts) }))),
      (e) => (setRows([]), toast(apiErrorText(e, 'ru'))),
    );
  };
  useEffect(load, [tab, city, cat, flags, qDeb, period, pages.cursor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!USE_API) adminApi.allTasks({ status: 'all', cityId: null, categoryId: null, flags: false }).then((p) => setAll(p.items), () => {});
    adminApi.rejectReasons('task_reject').then(setReasons, () => {});
  }, []);

  // Поиск (ID, текст, телефон клиента) и период — на сервере
  const view = rows ?? [];
  const cur = view.find((x) => x.key === selKey) ?? null;
  useEffect(() => {
    setCard(null);
    if (cur) adminApi.taskCard(cur).then(setCard, (e) => toast(apiErrorText(e, 'ru')));
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const idx = cur ? view.indexOf(cur) : -1;
  useHotkeys({ j: () => view[idx + 1] && setSelKey(view[idx + 1].key), k: () => idx > 0 && setSelKey(view[idx - 1].key), Escape: () => setSelKey(null) });

  // Вкладки и счётчики — из counts_by_status сервера (демо: по загруженным строкам)
  const tabs: [string, string][] = USE_API && srv.counts ? [['all', L.registries.vse], ...Object.keys(srv.counts).map((k): [string, string] => [k, TASK_TAB_LABEL[k] ?? k])] : TASK_TABS;
  const counts: Record<string, number> | null = USE_API
    ? srv.counts && { all: Object.values(srv.counts).reduce((a, b) => a + b, 0), ...srv.counts }
    : all.length
      ? Object.fromEntries(TASK_TABS.map(([k]) => [k, k === 'all' ? all.length : all.filter((x) => tabOf(x.status) === k).length]))
      : null;
  const csvUrl = adminApi.tasksCsvUrl(filter);
  const cities = ref.get()?.cities ?? [];
  const cats = ref.get()?.cats ?? [];
  const canCsv = me.role !== 'moderator';

  return (
    <>
      <Head title={L.registries.vseZadaniya}>
        <RegTabs value={tab} onChange={(k) => (setTab(k), pages.reset(), setSelKey(null))} items={tabs.map(([k, l]) => [k, l, counts?.[k] ?? null])} />
        <span className={s.grow} />
        {canCsv && csvUrl && (
          <a className={s.hbtn} href={csvUrl} download style={{ textDecoration: 'none', color: '#0F1B2A' }}>
            CSV
          </a>
        )}
        {canCsv && !csvUrl && (
          <button type="button" className={s.hbtn} disabled={!view.length} onClick={() => downloadCsv('ekor-tasks.csv', [['ID', L.registries.zadanie, L.registries.kategoriyaGorod, L.registries.klient, L.registries.byudzhet, L.registries.otklikov, L.registries.status, L.registries.sozdano], ...view.map((x) => [x.id, x.title, x.sub, x.client, x.budget, x.responses, x.status, x.created])])}>
            CSV
          </button>
        )}
      </Head>
      <div className={s.filters}>
        <SearchBox value={q} onChange={setQ} placeholder={L.registries.idTekstTelefonKlienta} slash />
        <SelectChip label={L.registries.gorod} value={city} onChange={(v) => (setCity(v), pages.reset())} options={[['all', L.registries.vse2], ...cities.map((c): [string, string] => [String(c.id), c.name.ru])]} />
        <SelectChip label={L.registries.kategoriya} value={cat} onChange={(v) => (setCat(v), pages.reset())} options={[['all', L.registries.vse2], ...cats.map((c): [string, string] => [String(c.id), c.name.ru])]} />
        <SelectChip label={L.registries.period} value={period} onChange={(v) => (setPeriod(v), pages.reset())} options={[['7', L.registries._7Dney], ['30', L.registries._30Dney], ['90', L.registries._90Dney], ['0', L.registries.vseVremya]]} />
        <ToggleChip on={flags} onClick={() => (setFlags(!flags), pages.reset())}>
          {L.registries.estFlagi}
        </ToggleChip>
        {me.role === 'moderator' && <span className={s.muted}>{L.registries.tolkoVashiRegiony}</span>}
        <span className={s.grow} />
        <span className={s.muted}>{L.registries.sortirovkaNovye}</span>
      </div>
      <div className={s.split} style={{ gridTemplateColumns: cur ? 'minmax(0,1fr) 440px' : 'minmax(0,1fr)' }}>
        <div className={s.list} style={{ borderRight: cur ? undefined : 'none' }}>
          <div className={s.thead} style={{ gridTemplateColumns: TCOLS, padding: '0 16px' }}>
            <span>ID</span>
            <span>{L.registries.zadanie}</span>
            <span>{L.registries.klient}</span>
            <span className={s.right}>{L.registries.byudzhet}</span>
            <span className={s.right}>{L.registries.otkl}</span>
            <span>{L.registries.status}</span>
            <span className={s.right}>{L.registries.sozdano}</span>
          </div>
          <div className={s.scroll}>
            {!rows && <Loading />}
            {rows && view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{L.registries.zadaniyNeNaydeno}</div>}
            {view.map((x) => (
              <div key={x.key} role="button" tabIndex={0} onClick={() => setSelKey(x.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(x.key)} className={cx(s.row, s.rowTall, cur?.key === x.key && s.rowOn)} style={{ gridTemplateColumns: TCOLS, padding: '0 16px' }}>
                <span className={s.id}>{x.id}</span>
                <div className={s.cell} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span className={s.cell} style={{ fontWeight: 600 }}>
                    {x.title}
                  </span>
                  <span className={cx(s.cell, s.muted)}>{x.sub}</span>
                </div>
                <span className={s.cell}>{x.client}</span>
                <span className={s.num}>{x.budget}</span>
                <span className={s.num} style={{ color: x.responses ? '#0F1B2A' : '#B03A2E' }}>
                  {x.responses}
                </span>
                <span>
                  <Pill tone={x.tone}>{x.status}</Pill>
                </span>
                <span className={s.right} style={{ color: '#3B4756' }}>
                  {x.created}
                </span>
              </div>
            ))}
          </div>
          <Pager from={pages.page * PAGE} count={view.length} total={USE_API ? srv.total : tab === 'all' && !pages.page && counts && !pages.next ? counts.all : null} canPrev={pages.page > 0} canNext={!!pages.next} onPrev={pages.prev} onNext={pages.forward} />
        </div>
        {cur && (
          <div className={s.panel}>
            {!card ? (
              <Loading />
            ) : (
              <>
                <div className={s.panelBody}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={s.metaLine}>{card.id}</span>
                    <Pill tone={card.tone}>{card.status}</Pill>
                    <span className={s.grow} />
                    <button type="button" className={r.x} aria-label={L.registries.zakryt} onClick={() => setSelKey(null)}>
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className={s.col4}>
                    <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{card.title}</span>
                    <span className={s.muted}>{card.sub}</span>
                  </div>
                  <KV
                    rows={[
                      [L.registries.klient, card.client],
                      [L.registries.telefon, card.phone],
                      [L.registries.adres, card.address],
                      [L.registries.master, card.master],
                      [L.registries.zakaz, card.order],
                      [L.registries.flagi, card.flags],
                    ]}
                  />
                  <div className={s.col6}>
                    <span className={s.fieldT}>{L.registries.otkliki} {card.responses.length}</span>
                    {card.responses.length === 0 && <span className={s.muted}>{L.registries.otklikovNet}</span>}
                    {card.responses.map((x, i) => (
                      <div key={i} className={cx(r.resp, x.chosen && r.respOn)}>
                        <span className={s.grow} style={{ fontWeight: x.chosen ? 600 : 400 }}>
                          {x.name}
                        </span>
                        <span className={s.num} style={{ width: 70 }}>
                          {x.price}
                        </span>
                        <span className={s.right} style={{ width: 70, color: x.chosen ? '#2647D9' : '#5B6878' }}>
                          {x.state}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className={s.col6}>
                    <span className={s.fieldT}>{L.registries.istoriya}</span>
                    {card.history.map(([d, t], i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '86px minmax(0,1fr)', gap: 8 }}>
                        <span className={s.id} style={{ whiteSpace: 'pre-line' }}>
                          {d.replace(/ (\d\d:\d\d)$/, '\n$1')}
                        </span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={s.panelFoot} style={{ flexWrap: 'wrap' }}>
                  <button type="button" className={s.btn} onClick={() => router.push(`/admin/users?id=${card.clientId}`)}>
                    {L.registries.klient}
                  </button>
                  <button type="button" className={s.btn} disabled={!card.masterId} onClick={() => card.masterId && router.push(`/admin/users?id=${card.masterId}`)}>
                    {L.registries.master}
                  </button>
                  <Link href={`/admin/audit?object=${card.id}`} className={s.btn} style={{ textDecoration: 'none', color: '#0F1B2A' }}>
                    <History size={15} aria-hidden />{L.registries.vAudite}
                  </Link>
                  {card.canUnpublish && (
                    <button type="button" className={cx(s.btn, s.btnOutRed)} onClick={() => setUnpub({ reason: null, comment: '' })}>
                      {L.registries.snyatSPublikatsii}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {unpub && card && (
        <Modal
          icon={TriangleAlert}
          tone="red"
          title={L.registries.snyatSPublikatsii2(card.id)}
          sub={card.title}
          okText={L.registries.snyatSPublikatsii}
          okTone="red"
          busy={busy}
          okDisabled={!unpub.reason || unpub.comment.trim().length < 5}
          onClose={() => setUnpub(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.unpublishTask(card.key, unpub.reason!, unpub.comment.trim());
              setUnpub(null);
              toast(L.registries.zadanieSnyatoSPublikatsii);
              load();
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col6}>
            <span className={s.fieldT}>
              {L.registries.prichina} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <div className={s.wrap4}>
              {reasons.map((x) => (
                <button key={x.id} type="button" className={cx(s.reason, unpub.reason?.id === x.id && s.reasonOn)} onClick={() => setUnpub({ ...unpub, reason: x })}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <Basis value={unpub.comment} onChange={(v) => setUnpub({ ...unpub, comment: v })} hint={L.registries.avtorUviditPrichinuI} />
        </Modal>
      )}
    </>
  );
}
const TASK_TAB_LABEL: Record<string, string> = { draft: L.registries.chernoviki, review: L.registries.naProverke, open: L.registries.otkryto, chosen: L.registries.vRabote, closed: L.registries.zakryto, rejected: L.registries.otkloneno, expired: L.registries.istekli, cancelled: L.registries.otmeneno };
function tabOf(status: string) {
  return status === L.registries.naProverke ? 'review' : status === L.registries.otkryto ? 'open' : ([L.registries.masterVybran, L.registries.vRabote, L.registries.zhdetPodtverzhdeniya] as string[]).includes(status) ? 'chosen' : status === L.registries.spor ? 'dispute' : status === L.registries.zaversheno ? 'done' : 'closed';
}

/* ============================== 24 — Все мастера ============================== */

const MASTER_TABS: [string, string][] = [['all', L.registries.vse], ['approved', L.registries.odobreny], ['review', L.registries.naProverke], ['rejected', L.registries.otkloneny], ['suspended', L.registries.priostanovleny]];
const MCOLS = 'minmax(0,1fr) 128px 60px 56px 112px 70px 64px';

export function AllMasters() {
  const { me } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [city, setCity] = useState('all');
  const [rating, setRating] = useState('any');
  const [verified, setVerified] = useState('all');
  const [rows, setRows] = useState<MasterRegRow[] | null>(null);
  const [all, setAll] = useState<MasterRegRow[]>([]);
  const [srv, setSrv] = useState<{ total: number | null; counts: Record<string, number> | null }>({ total: null, counts: null });
  const [selKey, setSelKey] = useState<number | null>(null);
  const [card, setCard] = useState<MasterRegCard | null>(null);
  const [act, setAct] = useState<null | { kind: 'unverify' | 'suspend' | 'unsuspend'; comment: string }>(null);
  const [busy, setBusy] = useState(false);
  const pages = usePages();

  useEffect(() => {
    const id = setTimeout(() => (setQDeb(q), pages.reset()), 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  // Город, «Проверен» и рейтинг фильтрует сервер; в демо — по загруженной странице
  const mf = { q: qDeb, status: tab, cityId: USE_API && city !== 'all' ? +city : null, verified: USE_API && verified !== 'all' ? verified === 'yes' : null, ratingMin: USE_API && rating !== 'any' ? +rating : null };
  const load = () => {
    setRows(null);
    adminApi.allMasters({ ...mf, cursor: pages.cursor }).then(
      (p) => (setRows(p.items), pages.setNext(p.next), setSrv((x) => ({ total: p.total, counts: tab === 'all' ? p.counts : (x.counts ?? p.counts) }))),
      (e) => (setRows([]), toast(apiErrorText(e, 'ru'))),
    );
  };
  useEffect(load, [tab, qDeb, city, verified, rating, pages.cursor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!USE_API) adminApi.allMasters({ q: '', status: 'all' }).then((p) => setAll(p.items), () => {});
  }, []);

  const view = useMemo(
    () =>
      USE_API
        ? (rows ?? [])
        : (rows ?? []).filter(
            (m) => (city === 'all' || m.city === city) && (verified === 'all' || (verified === 'yes') === m.verified) && (rating === 'any' || (parseFloat(m.rating.replace(',', '.')) || 0) >= +rating),
          ),
    [rows, city, verified, rating],
  );
  const cur = view.find((x) => x.key === selKey) ?? null;
  useEffect(() => {
    setCard(null);
    if (cur) adminApi.masterRegCard(cur).then(setCard, (e) => toast(apiErrorText(e, 'ru')));
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const idx = cur ? view.indexOf(cur) : -1;
  useHotkeys({ j: () => view[idx + 1] && setSelKey(view[idx + 1].key), k: () => idx > 0 && setSelKey(view[idx - 1].key), Escape: () => setSelKey(null) });

  const counts: Record<string, number> | null = all.length
    ? Object.fromEntries(MASTER_TABS.map(([k]) => [k, k === 'all' ? all.length : all.filter((x) => x.status === ({ approved: L.registries.odobren, review: L.registries.naProverke, rejected: L.registries.otklonen, suspended: L.registries.priostanovlen } as Record<string, string>)[k]).length]))
    : null;
  const cities: [string, string][] = USE_API ? (ref.get()?.cities ?? []).map((c): [string, string] => [String(c.id), c.name.ru]) : [...new Set((rows ?? []).map((m) => m.city))].map((c): [string, string] => [c, c]);
  const canVerify = me.role !== 'moderator';
  const csvUrl = adminApi.mastersCsvUrl(mf);
  const mcounts = USE_API ? srv.counts && { all: Object.values(srv.counts).reduce((a, b) => a + b, 0), ...srv.counts } : counts;

  return (
    <>
      <Head title={L.registries.vseMastera}>
        <RegTabs value={tab} onChange={(k) => (setTab(k), pages.reset(), setSelKey(null))} items={MASTER_TABS.map(([k, l]) => [k, l, mcounts ? (mcounts[k] ?? 0) : null])} />
        <span className={s.grow} />
        {me.role !== 'moderator' && csvUrl && (
          <a className={s.hbtn} href={csvUrl} download style={{ textDecoration: 'none', color: '#0F1B2A' }}>
            CSV
          </a>
        )}
        {me.role !== 'moderator' && !csvUrl && (
          <button type="button" className={s.hbtn} disabled={!view.length} onClick={() => downloadCsv('ekor-masters.csv', [['ID', L.registries.master, L.registries.professii, L.registries.gorod, L.registries.reyting, L.registries.zakazov, L.registries.profil, L.registries.proveren], ...view.map((m) => [m.id, m.name, m.profs, m.city, m.rating, m.orders, m.status, m.verified ? L.registries.da : ''])])}>
            CSV
          </button>
        )}
      </Head>
      <div className={s.filters}>
        <SearchBox value={q} onChange={setQ} placeholder={L.registries.imyaTelefonMId} slash />
        <SelectChip label={L.registries.gorod} value={city} onChange={(v) => (setCity(v), pages.reset())} options={[['all', L.registries.vse2], ...cities]} />
        <SelectChip label={L.registries.reyting} value={rating} onChange={(v) => (setRating(v), pages.reset())} options={[['any', L.registries.lyuboy], ['4.5', '4,5+'], ['4', '4+'], ['3', '3+']]} />
        <SelectChip label={L.registries.proveren} value={verified} onChange={(v) => (setVerified(v), pages.reset())} options={[['all', L.registries.vse2], ['yes', L.registries.da], ['no', L.registries.net]]} />
        {me.role === 'moderator' && <span className={s.muted}>{L.registries.tolkoVashiRegiony}</span>}
        <span className={s.grow} />
        <span className={s.muted}>{L.registries.sortirovkaZakazy}</span>
      </div>
      <div className={s.split} style={{ gridTemplateColumns: cur ? 'minmax(0,1fr) 440px' : 'minmax(0,1fr)' }}>
        <div className={s.list} style={{ borderRight: cur ? undefined : 'none' }}>
          <div className={s.thead} style={{ gridTemplateColumns: MCOLS, padding: '0 16px' }}>
            <span>{L.registries.master}</span>
            <span>{L.registries.gorod}</span>
            <span className={s.right}>{L.registries.reyt}</span>
            <span className={s.right}>{L.registries.zakaz2}</span>
            <span>{L.registries.profil}</span>
            <span>{L.registries.proveren}</span>
            <span className={s.right}>{L.registries.vizit}</span>
          </div>
          <div className={s.scroll}>
            {!rows && <Loading />}
            {rows && view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{L.registries.masterovNeNaydeno}</div>}
            {view.map((m) => (
              <div key={m.key} role="button" tabIndex={0} onClick={() => setSelKey(m.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(m.key)} className={cx(s.row, s.rowTall, cur?.key === m.key && s.rowOn)} style={{ gridTemplateColumns: MCOLS, padding: '0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span className={r.av}>{initials(m.name)}</span>
                  <div className={s.cell} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span className={s.cell} style={{ fontWeight: 600 }}>
                      {m.name}
                    </span>
                    {m.profs && <span className={cx(s.cell, s.muted)}>{m.profs}</span>}
                  </div>
                </div>
                <span className={s.cell} style={{ color: '#3B4756' }}>
                  {m.city}
                </span>
                <span className={s.num}>{m.rating}</span>
                <span className={s.num}>{m.orders}</span>
                <span>
                  <Pill tone={m.tone}>{m.status}</Pill>
                </span>
                <span style={{ color: m.verified ? '#0B6E5E' : '#9AA5B4', fontWeight: m.verified ? 600 : 400 }}>{m.verified ? L.registries.proveren : '—'}</span>
                <span className={s.right} style={{ color: '#3B4756' }}>
                  {m.seen}
                </span>
              </div>
            ))}
          </div>
          <Pager from={pages.page * PAGE} count={view.length} total={USE_API ? srv.total : null} canPrev={pages.page > 0} canNext={!!pages.next} onPrev={pages.prev} onNext={pages.forward} />
        </div>
        {cur && (
          <div className={s.panel}>
            {!card ? (
              <Loading />
            ) : (
              <>
                <div className={s.panelBody} style={{ gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className={r.avBig}>{initials(card.name)}</span>
                    <div className={s.grow} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{card.name}</span>
                        <Pill tone={card.tone}>{card.status}</Pill>
                      </span>
                      <span className={s.muted}>{card.sub}</span>
                    </div>
                    <button type="button" className={r.x} aria-label={L.registries.zakryt} onClick={() => setSelKey(null)}>
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className={r.stats}>
                    {card.stats.map(([v, l]) => (
                      <div key={l} className={r.stat}>
                        <span className={r.statV}>{v}</span>
                        <span className={r.statL}>{l}</span>
                      </div>
                    ))}
                  </div>
                  <KV rows={card.rows} />
                  {card.orders.length > 0 && (
                    <div className={s.col6}>
                      <span className={s.fieldT}>{L.registries.poslednieZakazy}</span>
                      {card.orders.map(([id, t, st2]) => (
                        <div key={id} className={r.order}>
                          <span className={s.id}>{id}</span>
                          <span className={s.grow}>{t}</span>
                          <span style={{ color: st2 === L.registries.zaversheno ? '#0B6E5E' : '#2647D9' }}>{st2}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {card.warn && (
                    <div className={s.alertWarn}>
                      <TriangleAlert size={15} aria-hidden />
                      <span>{card.warn}</span>
                    </div>
                  )}
                </div>
                <div className={s.panelFoot} style={{ flexWrap: 'wrap' }}>
                  <a href={`/masters/${card.key}`} target="_blank" rel="noreferrer" className={s.btn} style={{ textDecoration: 'none', color: '#0F1B2A' }}>
                    <ExternalLink size={15} aria-hidden />
                    {L.registries.profilNaSayte}
                  </a>
                  {canVerify && card.verified && (
                    <button type="button" className={s.btn} onClick={() => setAct({ kind: 'unverify', comment: '' })}>
                      {L.registries.snyatProveren}
                    </button>
                  )}
                  <button type="button" className={cx(s.btn, !card.suspended && s.btnOutRed)} onClick={() => setAct({ kind: card.suspended ? 'unsuspend' : 'suspend', comment: '' })}>
                    {card.suspended ? L.registries.vernutVKatalog : L.registries.priostanovit}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {act && card && (
        <Modal
          icon={act.kind === 'unverify' ? BadgeX : PauseCircle}
          tone={act.kind === 'unsuspend' ? 'blue' : 'red'}
          title={act.kind === 'unverify' ? L.registries.snyatProverenU(card.name) : act.kind === 'suspend' ? L.registries.priostanovit2(card.name) : L.registries.vernutVKatalog2(card.name)}
          sub={act.kind === 'suspend' ? L.registries.masterPropadetIzKataloga : act.kind === 'unverify' ? L.registries.beydzhPropadetIzProfilya : L.registries.masterSnovaPoyavitsyaV}
          okText={act.kind === 'unverify' ? L.registries.snyatOtmetku : act.kind === 'suspend' ? L.registries.priostanovit : L.registries.vernut}
          okTone={act.kind === 'unsuspend' ? 'blue' : 'red'}
          busy={busy}
          okDisabled={act.comment.trim().length < 5}
          onClose={() => setAct(null)}
          onOk={async () => {
            setBusy(true);
            try {
              if (act.kind === 'unverify') await adminApi.unverifyMaster(card.key, act.comment.trim());
              else await adminApi.suspendMaster(card.key, act.kind === 'suspend', act.comment.trim());
              setAct(null);
              toast(act.kind === 'unverify' ? L.registries.otmetkaProverenSnyata : act.kind === 'suspend' ? L.registries.masterPriostanovlen : L.registries.masterVozvraschenVKatalog);
              load();
              adminApi.masterRegCard(cur!).then(setCard, () => {});
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <Basis value={act.comment} onChange={(v) => setAct({ ...act, comment: v })} hint={L.registries.popadetVAuditLog} />
        </Modal>
      )}
    </>
  );
}

/* ---------- общее ---------- */

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className={s.kv} style={{ gridTemplateColumns: '120px 1fr', gap: '6px 10px' }}>
      {rows.map(([k, v]) => (
        <span key={k} style={{ display: 'contents' }}>
          <span>{k}</span>
          <span style={{ fontWeight: k === L.registries.klient || k === L.registries.master || k === L.registries.priemZakazov ? 600 : 400, fontFamily: k === L.registries.telefon ? "'JetBrains Mono', monospace" : undefined }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

function Basis({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div className={s.col4}>
      <span className={s.fieldT}>
        {L.registries.osnovanie} <span style={{ color: '#B03A2E' }}>*</span>
      </span>
      <textarea className={s.textarea} rows={3} value={value} onChange={(e) => onChange(e.target.value.slice(0, 1000))} autoFocus />
      <span className={s.muted}>{hint}</span>
    </div>
  );
}

