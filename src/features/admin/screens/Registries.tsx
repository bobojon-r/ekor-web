'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeX, ExternalLink, History, PauseCircle, TriangleAlert, X } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { ref } from '@/lib/api/ref';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { MasterRegCard, MasterRegRow, Reason, TaskRegCard, TaskRegRow } from '../data/types';
import { downloadCsv, initials } from '../core';
import { cx, Head, Loading, Modal, Pill, SearchBox, SelectChip, ToggleChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import r from './Registries.module.css';

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
        Показано {count ? `${from + 1}–${from + count}` : '0'}
        {total != null ? ` из ${total.toLocaleString('ru-RU')}` : ''}
      </span>
      <span className={s.grow} />
      <button type="button" className={r.pageBtn} disabled={!canPrev} onClick={onPrev}>
        ← Назад
      </button>
      <button type="button" className={cx(r.pageBtn, r.pageNext)} disabled={!canNext} onClick={onNext}>
        Далее →
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

const TASK_TABS: [string, string][] = [['all', 'Все'], ['review', 'На проверке'], ['open', 'Открыто'], ['chosen', 'В работе'], ['dispute', 'Спор'], ['done', 'Завершено'], ['closed', 'Закрыто']];
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
  const [rows, setRows] = useState<TaskRegRow[] | null>(null);
  const [all, setAll] = useState<TaskRegRow[]>([]);
  const [selKey, setSelKey] = useState<number | null>(null);
  const [card, setCard] = useState<TaskRegCard | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [unpub, setUnpub] = useState<null | { reason: Reason | null; comment: string }>(null);
  const [busy, setBusy] = useState(false);
  const pages = usePages();

  const load = () => {
    setRows(null);
    adminApi
      .allTasks({ status: tab, cityId: city === 'all' ? null : +city, categoryId: cat === 'all' ? null : +cat, flags, cursor: pages.cursor })
      .then((p) => (setRows(p.items), pages.setNext(p.next)), (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  };
  useEffect(load, [tab, city, cat, flags, pages.cursor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    adminApi.allTasks({ status: 'all', cityId: null, categoryId: null, flags: false }).then((p) => setAll(p.items), () => {});
    adminApi.rejectReasons('task_reject').then(setReasons, () => {});
  }, []);

  // Поиск по ID и тексту — по загруженной странице (серверного поиска в API пока нет)
  const view = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (rows ?? []).filter((x) => !ql || x.id.toLowerCase().includes(ql) || x.title.toLowerCase().includes(ql) || x.client.toLowerCase().includes(ql));
  }, [rows, q]);
  const cur = view.find((x) => x.key === selKey) ?? null;
  useEffect(() => {
    setCard(null);
    if (cur) adminApi.taskCard(cur).then(setCard, (e) => toast(apiErrorText(e, 'ru')));
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const idx = cur ? view.indexOf(cur) : -1;
  useHotkeys({ j: () => view[idx + 1] && setSelKey(view[idx + 1].key), k: () => idx > 0 && setSelKey(view[idx - 1].key), Escape: () => setSelKey(null) });

  const counts: Record<string, number> | null = all.length ? Object.fromEntries(TASK_TABS.map(([k]) => [k, k === 'all' ? all.length : all.filter((x) => tabOf(x.status) === k).length])) : null;
  const cities = ref.get()?.cities ?? [];
  const cats = ref.get()?.cats ?? [];
  const canCsv = me.role !== 'moderator';

  return (
    <>
      <Head title="Все задания">
        <RegTabs value={tab} onChange={(k) => (setTab(k), pages.reset(), setSelKey(null))} items={TASK_TABS.map(([k, l]) => [k, l, counts?.[k] ?? null])} />
        <span className={s.grow} />
        {canCsv && (
          <button type="button" className={s.hbtn} disabled={!view.length} onClick={() => downloadCsv('ekor-tasks.csv', [['ID', 'Задание', 'Категория · город', 'Клиент', 'Бюджет', 'Откликов', 'Статус', 'Создано'], ...view.map((x) => [x.id, x.title, x.sub, x.client, x.budget, x.responses, x.status, x.created])])}>
            CSV
          </button>
        )}
      </Head>
      <div className={s.filters}>
        <SearchBox value={q} onChange={setQ} placeholder="ID, текст, телефон клиента" slash />
        <SelectChip label="Город" value={city} onChange={(v) => (setCity(v), pages.reset())} options={[['all', 'все'], ...cities.map((c): [string, string] => [String(c.id), c.name.ru])]} />
        <SelectChip label="Категория" value={cat} onChange={(v) => (setCat(v), pages.reset())} options={[['all', 'все'], ...cats.map((c): [string, string] => [String(c.id), c.name.ru])]} />
        <SelectChip label="Период" value={period} onChange={setPeriod} options={[['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней']]} />
        <ToggleChip on={flags} onClick={() => (setFlags(!flags), pages.reset())}>
          Есть флаги
        </ToggleChip>
        {me.role === 'moderator' && <span className={s.muted}>Только ваши регионы</span>}
        <span className={s.grow} />
        <span className={s.muted}>Сортировка: новые</span>
      </div>
      <div className={s.split} style={{ gridTemplateColumns: cur ? 'minmax(0,1fr) 440px' : 'minmax(0,1fr)' }}>
        <div className={s.list} style={{ borderRight: cur ? undefined : 'none' }}>
          <div className={s.thead} style={{ gridTemplateColumns: TCOLS, padding: '0 16px' }}>
            <span>ID</span>
            <span>Задание</span>
            <span>Клиент</span>
            <span className={s.right}>Бюджет</span>
            <span className={s.right}>Откл.</span>
            <span>Статус</span>
            <span className={s.right}>Создано</span>
          </div>
          <div className={s.scroll}>
            {!rows && <Loading />}
            {rows && view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>Заданий не найдено</div>}
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
          <Pager from={pages.page * PAGE} count={view.length} total={tab === 'all' && !pages.page && counts && !pages.next ? counts.all : null} canPrev={pages.page > 0} canNext={!!pages.next} onPrev={pages.prev} onNext={pages.forward} />
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
                    <button type="button" className={r.x} aria-label="Закрыть" onClick={() => setSelKey(null)}>
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className={s.col4}>
                    <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{card.title}</span>
                    <span className={s.muted}>{card.sub}</span>
                  </div>
                  <KV
                    rows={[
                      ['Клиент', card.client],
                      ['Телефон', card.phone],
                      ['Адрес', card.address],
                      ['Мастер', card.master],
                      ['Заказ', card.order],
                      ['Флаги', card.flags],
                    ]}
                  />
                  <div className={s.col6}>
                    <span className={s.fieldT}>Отклики · {card.responses.length}</span>
                    {card.responses.length === 0 && <span className={s.muted}>Откликов нет</span>}
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
                    <span className={s.fieldT}>История</span>
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
                    Клиент
                  </button>
                  <button type="button" className={s.btn} disabled={!card.masterId} onClick={() => card.masterId && router.push(`/admin/users?id=${card.masterId}`)}>
                    Мастер
                  </button>
                  <Link href={`/admin/audit?object=${card.id}`} className={s.btn} style={{ textDecoration: 'none', color: '#0F1B2A' }}>
                    <History size={15} aria-hidden />В аудите
                  </Link>
                  {card.canUnpublish && (
                    <button type="button" className={cx(s.btn, s.btnOutRed)} onClick={() => setUnpub({ reason: null, comment: '' })}>
                      Снять с публикации
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
          title={`Снять ${card.id} с публикации?`}
          sub={card.title}
          okText="Снять с публикации"
          okTone="red"
          busy={busy}
          okDisabled={!unpub.reason || unpub.comment.trim().length < 5}
          onClose={() => setUnpub(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.unpublishTask(card.key, unpub.reason!, unpub.comment.trim());
              setUnpub(null);
              toast('Задание снято с публикации. Автор получил причину');
              load();
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col6}>
            <span className={s.fieldT}>
              Причина <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <div className={s.wrap4}>
              {reasons.map((x) => (
                <button key={x.id} type="button" className={cx(s.reason, unpub.reason?.id === x.id && s.reasonOn)} onClick={() => setUnpub({ ...unpub, reason: x })}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <Basis value={unpub.comment} onChange={(v) => setUnpub({ ...unpub, comment: v })} hint="Автор увидит причину и комментарий" />
        </Modal>
      )}
    </>
  );
}
function tabOf(status: string) {
  return status === 'На проверке' ? 'review' : status === 'Открыто' ? 'open' : ['Мастер выбран', 'В работе', 'Ждёт подтверждения'].includes(status) ? 'chosen' : status === 'Спор' ? 'dispute' : status === 'Завершено' ? 'done' : 'closed';
}

/* ============================== 24 — Все мастера ============================== */

const MASTER_TABS: [string, string][] = [['all', 'Все'], ['approved', 'Одобрены'], ['review', 'На проверке'], ['rejected', 'Отклонены'], ['suspended', 'Приостановлены']];
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
  const [selKey, setSelKey] = useState<number | null>(null);
  const [card, setCard] = useState<MasterRegCard | null>(null);
  const [act, setAct] = useState<null | { kind: 'unverify' | 'suspend' | 'unsuspend'; comment: string }>(null);
  const [busy, setBusy] = useState(false);
  const pages = usePages();

  useEffect(() => {
    const id = setTimeout(() => (setQDeb(q), pages.reset()), 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => {
    setRows(null);
    adminApi.allMasters({ q: qDeb, status: tab, cursor: pages.cursor }).then((p) => (setRows(p.items), pages.setNext(p.next)), (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  };
  useEffect(load, [tab, qDeb, pages.cursor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    adminApi.allMasters({ q: '', status: 'all' }).then((p) => setAll(p.items), () => {});
  }, []);

  const view = useMemo(
    () =>
      (rows ?? []).filter(
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
    ? Object.fromEntries(MASTER_TABS.map(([k]) => [k, k === 'all' ? all.length : all.filter((x) => x.status === ({ approved: 'Одобрен', review: 'На проверке', rejected: 'Отклонён', suspended: 'Приостановлен' } as Record<string, string>)[k]).length]))
    : null;
  const cities = [...new Set((rows ?? []).map((m) => m.city))];
  const canVerify = me.role !== 'moderator';

  return (
    <>
      <Head title="Все мастера">
        <RegTabs value={tab} onChange={(k) => (setTab(k), pages.reset(), setSelKey(null))} items={MASTER_TABS.map(([k, l]) => [k, l, counts?.[k] ?? null])} />
        <span className={s.grow} />
        {me.role !== 'moderator' && (
          <button type="button" className={s.hbtn} disabled={!view.length} onClick={() => downloadCsv('ekor-masters.csv', [['ID', 'Мастер', 'Профессии', 'Город', 'Рейтинг', 'Заказов', 'Профиль', 'Проверен'], ...view.map((m) => [m.id, m.name, m.profs, m.city, m.rating, m.orders, m.status, m.verified ? 'да' : ''])])}>
            CSV
          </button>
        )}
      </Head>
      <div className={s.filters}>
        <SearchBox value={q} onChange={setQ} placeholder="Имя, телефон, M-ID" slash />
        <SelectChip label="Город" value={city} onChange={setCity} options={[['all', 'все'], ...cities.map((c): [string, string] => [c, c])]} />
        <SelectChip label="Рейтинг" value={rating} onChange={setRating} options={[['any', 'любой'], ['4.5', '4,5+'], ['4', '4+'], ['3', '3+']]} />
        <SelectChip label="Проверен" value={verified} onChange={setVerified} options={[['all', 'все'], ['yes', 'да'], ['no', 'нет']]} />
        {me.role === 'moderator' && <span className={s.muted}>Только ваши регионы</span>}
        <span className={s.grow} />
        <span className={s.muted}>Сортировка: заказы</span>
      </div>
      <div className={s.split} style={{ gridTemplateColumns: cur ? 'minmax(0,1fr) 440px' : 'minmax(0,1fr)' }}>
        <div className={s.list} style={{ borderRight: cur ? undefined : 'none' }}>
          <div className={s.thead} style={{ gridTemplateColumns: MCOLS, padding: '0 16px' }}>
            <span>Мастер</span>
            <span>Город</span>
            <span className={s.right}>Рейт.</span>
            <span className={s.right}>Заказ.</span>
            <span>Профиль</span>
            <span>Проверен</span>
            <span className={s.right}>Визит</span>
          </div>
          <div className={s.scroll}>
            {!rows && <Loading />}
            {rows && view.length === 0 && <div className={s.hint} style={{ padding: 16 }}>Мастеров не найдено</div>}
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
                <span style={{ color: m.verified ? '#0B6E5E' : '#9AA5B4', fontWeight: m.verified ? 600 : 400 }}>{m.verified ? 'Проверен' : '—'}</span>
                <span className={s.right} style={{ color: '#3B4756' }}>
                  {m.seen}
                </span>
              </div>
            ))}
          </div>
          <Pager from={pages.page * PAGE} count={view.length} total={null} canPrev={pages.page > 0} canNext={!!pages.next} onPrev={pages.prev} onNext={pages.forward} />
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
                    <button type="button" className={r.x} aria-label="Закрыть" onClick={() => setSelKey(null)}>
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
                      <span className={s.fieldT}>Последние заказы</span>
                      {card.orders.map(([id, t, st2]) => (
                        <div key={id} className={r.order}>
                          <span className={s.id}>{id}</span>
                          <span className={s.grow}>{t}</span>
                          <span style={{ color: st2 === 'Завершено' ? '#0B6E5E' : '#2647D9' }}>{st2}</span>
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
                    Профиль на сайте
                  </a>
                  {canVerify && card.verified && (
                    <button type="button" className={s.btn} onClick={() => setAct({ kind: 'unverify', comment: '' })}>
                      Снять «Проверен»
                    </button>
                  )}
                  <button type="button" className={cx(s.btn, !card.suspended && s.btnOutRed)} onClick={() => setAct({ kind: card.suspended ? 'unsuspend' : 'suspend', comment: '' })}>
                    {card.suspended ? 'Вернуть в каталог' : 'Приостановить'}
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
          title={act.kind === 'unverify' ? `Снять «Проверен» у ${card.name}?` : act.kind === 'suspend' ? `Приостановить ${card.name}?` : `Вернуть ${card.name} в каталог?`}
          sub={act.kind === 'suspend' ? 'Мастер пропадёт из каталога и не сможет откликаться. Текущие заказы сохранятся.' : act.kind === 'unverify' ? 'Бейдж пропадёт из профиля и карточек.' : 'Мастер снова появится в каталоге и сможет откликаться.'}
          okText={act.kind === 'unverify' ? 'Снять отметку' : act.kind === 'suspend' ? 'Приостановить' : 'Вернуть'}
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
              toast(act.kind === 'unverify' ? 'Отметка «Проверен» снята' : act.kind === 'suspend' ? 'Мастер приостановлен' : 'Мастер возвращён в каталог');
              load();
              adminApi.masterRegCard(cur!).then(setCard, () => {});
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <Basis value={act.comment} onChange={(v) => setAct({ ...act, comment: v })} hint="Попадёт в аудит-лог" />
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
          <span style={{ fontWeight: k === 'Клиент' || k === 'Мастер' || k === 'Приём заказов' ? 600 : 400, fontFamily: k === 'Телефон' ? "'JetBrains Mono', monospace" : undefined }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

function Basis({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div className={s.col4}>
      <span className={s.fieldT}>
        Основание <span style={{ color: '#B03A2E' }}>*</span>
      </span>
      <textarea className={s.textarea} rows={3} value={value} onChange={(e) => onChange(e.target.value.slice(0, 1000))} autoFocus />
      <span className={s.muted}>{hint}</span>
    </div>
  );
}

