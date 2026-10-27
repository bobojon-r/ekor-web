'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, TriangleAlert, X } from 'lucide-react';
import { apiErrorText, USE_API } from '@/lib/api';
import { useToast } from '@/components/ui';
import { adminApi } from '../data/api';
import type { CatNode, CityNode, Reason } from '../data/types';
import { num } from '../core';
import { cx, Head, Loading, SearchBox, Seg, Switch } from '../ui';
import s from '../Admin.module.css';

type TabK = 'cities' | 'cats' | 'reject' | 'block';
const ICONS = ['Wrench', 'Zap', 'Droplets', 'PaintRoller', 'HardHat', 'WashingMachine', 'Truck', 'GraduationCap', 'Scissors', 'PartyPopper', 'Laptop', 'Sparkles', 'CircleEllipsis'];
const BLOCK = ['Мошенничество: предоплата', 'Оскорбления и угрозы', 'Спам и реклама', 'Фейковый профиль', 'Обход правил платформы'];
const TJ_CHARS = /[ӣӯҳҷқғ]/i;

/** 08 — справочники (admin): категории, города и районы, причины */
export function Dictionaries() {
  const [tab, setTab] = useState<TabK>('cats');
  const [creating, setCreating] = useState(0);
  return (
    <>
      <Head title="Справочники">
        <Seg value={tab} onChange={setTab} items={[['cities', 'Города и районы'], ['cats', 'Категории'], ['reject', 'Причины отказа'], ['block', 'Причины блокировки']]} />
        <span className={s.grow} />
        {tab === 'cats' && (
          <button type="button" className={s.hprimary} onClick={() => setCreating((n) => n + 1)}>
            + Категория
          </button>
        )}
      </Head>
      {tab === 'cats' && <Categories creating={creating} />}
      {tab === 'cities' && <Cities />}
      {(tab === 'reject' || tab === 'block') && <Reasons kind={tab} />}
    </>
  );
}

function Categories({ creating }: { creating: number }) {
  const toast = useToast();
  const [cats, setCats] = useState<CatNode[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [selId, setSelId] = useState<number | null>(null);
  const [draft, setDraft] = useState<CatNode | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [alias, setAlias] = useState('');
  const [extra, setExtra] = useState<Record<number, { photo: boolean; hourly: boolean }>>({});
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    adminApi.categories().then((c) => {
      setCats(c);
      setOpen((o) => (o.size ? o : new Set(c.filter((x) => !x.parentId).slice(0, 3).map((x) => x.id))));
      setSelId((id) => id ?? c.find((x) => x.parentId)?.id ?? c[0]?.id ?? null);
    }, (e) => toast(apiErrorText(e, 'ru')));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = cats?.find((c) => c.id === selId) ?? null;
  useEffect(() => {
    if (sel && !isNew) setDraft({ ...sel, aliases: [...sel.aliases] });
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!creating || !cats) return;
    setIsNew(true);
    setDraft({ id: 0, key: '', ru: '', tj: '', parentId: null, icon: 'Wrench', masters: 0, hidden: false, aliases: [], online: false });
  }, [creating]); // eslint-disable-line react-hooks/exhaustive-deps

  const ql = q.trim().toLowerCase();
  const tree = useMemo(() => {
    const all = cats ?? [];
    const match = (c: CatNode) => !ql || `${c.ru} ${c.tj} ${c.key} ${c.aliases.join(' ')}`.toLowerCase().includes(ql);
    return all
      .filter((c) => !c.parentId)
      .flatMap((p) => {
        const kids = all.filter((c) => c.parentId === p.id && match(c));
        if (!match(p) && !kids.length) return [];
        return [{ c: p, child: false }, ...(open.has(p.id) || ql ? kids.map((c) => ({ c, child: true })) : [])];
      });
  }, [cats, ql, open]);

  const ed = draft;
  const changed = !!ed && (isNew || JSON.stringify(ed) !== JSON.stringify(sel));
  const save = async () => {
    if (!ed || !ed.ru.trim() || !ed.tj.trim()) return toast('Заполните названия RU и TJ', 'info');
    setBusy(true);
    try {
      const key = ed.key || ed.ru.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\wа-яё_]/gi, '').slice(0, 30);
      await adminApi.saveCategory({ ...ed, key }, isNew);
      toast(isNew ? 'Категория добавлена' : 'Сохранено. В приложении — через 5 мин');
      setIsNew(false);
      await load();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  // Перетаскивание — порядок внутри одного родителя (сохраняется локально, порядок в API — поле sort)
  const drop = (target: CatNode) => {
    if (!cats || drag === null || drag === target.id) return;
    const d = cats.find((c) => c.id === drag)!;
    if (d.parentId !== target.parentId) return toast('Переносить можно внутри одной категории', 'info');
    const list = cats.filter((c) => c.id !== drag);
    list.splice(list.indexOf(target), 0, d);
    setCats(list);
    setDrag(null);
    toast('Порядок изменён');
  };
  const parent = ed?.parentId ? cats?.find((c) => c.id === ed.parentId) : null;
  const ex = (ed && extra[ed.id]) ?? { photo: false, hourly: false };

  if (!cats) return <Loading />;
  return (
    <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
      <div className={s.list}>
        <div className={s.filters} style={{ padding: '0 16px' }}>
          <SearchBox value={q} onChange={setQ} placeholder="Название или синоним" width={0} />
          <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>
            Перетаскивание — порядок в приложении
          </span>
        </div>
        <div className={s.thead} style={{ gridTemplateColumns: '20px minmax(0,1fr) 90px', padding: '0 16px', height: 32 }}>
          <span />
          <span>Категория</span>
          <span className={s.right}>Мастеров</span>
        </div>
        <div className={s.scroll}>
          {tree.map(({ c, child }) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={() => setDrag(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(c)}
              onClick={() => (setIsNew(false), setSelId(c.id), !child && setOpen((o) => { const n = new Set(o); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; }))}
              onKeyDown={(e) => e.key === 'Enter' && (setIsNew(false), setSelId(c.id))}
              className={cx(s.row, !isNew && selId === c.id && s.rowOn)}
              style={{ gridTemplateColumns: '20px minmax(0,1fr) 90px', padding: '0 16px' }}
            >
              <GripVertical size={14} color="#9AA5B4" aria-hidden style={{ cursor: 'grab' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: child ? 34 : 10, fontWeight: child ? 400 : 600, color: c.hidden ? '#6B7787' : '#0F1B2A' }}>
                {!child && (open.has(c.id) ? <ChevronDown size={14} color="#0F1B2A" aria-hidden /> : <ChevronRight size={14} color="#5B6878" aria-hidden />)}
                {c.ru}
                {c.hidden && ' (скрыта)'}
              </span>
              <span className={s.num} style={{ fontWeight: 500, color: '#3B4756' }}>
                {c.masters ? num(c.masters) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
      {ed ? (
        <div className={s.panel}>
          <div className={s.panelBody} style={{ padding: '18px 22px', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={s.h18}>{ed.ru || 'Новая категория'}</span>
              {!isNew && <span className={s.metaLine}>category:{ed.id} · slug {ed.key}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className={s.col4}>
                <span className={s.fieldT}>Название RU</span>
                <input className={s.input} value={ed.ru} onChange={(e) => setDraft({ ...ed, ru: e.target.value.slice(0, 60) })} />
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>Название TJ</span>
                <input className={s.input} value={ed.tj} onChange={(e) => setDraft({ ...ed, tj: e.target.value.slice(0, 60) })} />
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>Родитель</span>
                <select className={s.select} value={ed.parentId ?? ''} disabled={!isNew} onChange={(e) => setDraft({ ...ed, parentId: e.target.value ? +e.target.value : null })}>
                  <option value="">— верхний уровень —</option>
                  {cats.filter((c) => !c.parentId && c.id !== ed.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ru}
                    </option>
                  ))}
                </select>
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>Иконка</span>
                <select className={s.select} style={{ fontFamily: "'JetBrains Mono', monospace" }} value={parent ? parent.icon : ed.icon} disabled={!!parent} onChange={(e) => setDraft({ ...ed, icon: e.target.value })}>
                  {ICONS.map((i) => (
                    <option key={i} value={i}>
                      {i.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={s.col6}>
              <span className={s.fieldT}>Синонимы для поиска</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 7, border: '1px solid #C9D1DB' }}>
                {ed.aliases.map((w) => (
                  <span key={w} style={{ height: 26, padding: '0 4px 0 9px', borderRadius: 999, background: '#EAEEFC', color: '#1F3BB8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {w}
                    <button type="button" aria-label={`Убрать ${w}`} onClick={() => setDraft({ ...ed, aliases: ed.aliases.filter((x) => x !== w) })} style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', padding: 0 }}>
                      <X size={12} color="#1F3BB8" aria-hidden />
                    </button>
                  </span>
                ))}
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && alias.trim()) {
                      e.preventDefault();
                      if (!ed.aliases.includes(alias.trim().toLowerCase())) setDraft({ ...ed, aliases: [...ed.aliases, alias.trim().toLowerCase()] });
                      setAlias('');
                    }
                  }}
                  placeholder="+ добавить"
                  style={{ height: 26, border: 'none', outline: 'none', minWidth: 100, flex: 1 }}
                />
              </div>
              <span className={s.muted}>RU, TJ и латиница: «барк», «elektr», «проводка» найдут эту категорию. Enter — добавить.</span>
            </div>
            <div className={s.col6}>
              <span className={s.fieldT}>Поля задания для категории</span>
              <div className={s.wrap4} style={{ gap: 6 }}>
                {([['photo', 'Фото обязательно'], ['online', 'Онлайн-формат'], ['hourly', 'Цена «за час»']] as const).map(([k, l]) => {
                  const on = k === 'online' ? ed.online : ex[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => (k === 'online' ? setDraft({ ...ed, online: !ed.online }) : setExtra({ ...extra, [ed.id]: { ...ex, [k]: !on } }))}
                      style={{ height: 28, padding: '0 10px', borderRadius: 6, border: on ? '1.5px solid #2647D9' : '1px solid #DCE3EA', background: on ? '#F7F9FF' : '#fff', fontWeight: on ? 600 : 400, fontSize: 13, color: '#0F1B2A' }}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={s.swRow}>
              <Switch on={!ed.hidden} onClick={() => setDraft({ ...ed, hidden: !ed.hidden })} label="Показывать в приложении" />
              <div className={s.col4} style={{ gap: 2 }}>
                <span className={s.fieldT}>Показывать в приложении</span>
                <span className={s.muted}>{num(ed.masters)} мастеров. Удалить нельзя — только скрыть; мастера сохранят категорию в профиле.</span>
              </div>
            </div>
            {(!TJ_CHARS.test(ed.tj) || ed.tj === ed.ru) && ed.tj && (
              <div className={s.alertWarn}>
                <TriangleAlert size={15} aria-hidden />
                <span>Название TJ ждёт вычитки носителем языка</span>
              </div>
            )}
          </div>
          <div className={s.panelFoot} style={{ padding: '12px 22px' }}>
            <span className={s.muted}>Изменения применяются в приложении через 5 мин (кэш)</span>
            <span className={s.grow} />
            <button type="button" className={s.btn} disabled={!changed} onClick={() => (isNew ? (setIsNew(false), setDraft(sel ? { ...sel } : null)) : sel && setDraft({ ...sel, aliases: [...sel.aliases] }))}>
              Отмена
            </button>
            <button type="button" className={cx(s.btn, s.btnBlue)} disabled={!changed || busy} onClick={save}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <div className={s.loading}>Выберите категорию</div>
      )}
    </div>
  );
}

function Cities() {
  const toast = useToast();
  const [cities, setCities] = useState<CityNode[] | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [ru, setRu] = useState('');
  const [tj, setTj] = useState('');
  useEffect(() => {
    adminApi.cities().then((c) => (setCities(c), setSelId(c[0]?.id ?? null)), (e) => toast(apiErrorText(e, 'ru')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = cities?.find((c) => c.id === selId) ?? null;
  useEffect(() => {
    if (sel) (setRu(sel.ru), setTj(sel.tj));
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cities) return <Loading />;
  const COLS = 'minmax(0,1fr) 160px 90px 90px';
  return (
    <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
      <div className={s.list}>
        <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
          <span>Город</span>
          <span>Регион</span>
          <span className={s.right}>Районов</span>
          <span className={s.right}>Мастеров</span>
        </div>
        <div className={s.scroll}>
          {cities.map((c) => (
            <div key={c.id} role="button" tabIndex={0} onClick={() => setSelId(c.id)} onKeyDown={(e) => e.key === 'Enter' && setSelId(c.id)} className={cx(s.row, selId === c.id && s.rowOn)} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
              <b style={{ fontWeight: 600 }}>{c.ru}</b>
              <span className={s.muted}>{c.region}</span>
              <span className={s.num} style={{ fontWeight: 500 }}>{c.districts.length}</span>
              <span className={s.num} style={{ fontWeight: 500 }}>{num(c.masters)}</span>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div className={s.panel}>
          <div className={s.panelBody} style={{ padding: '18px 22px', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={s.h18}>{sel.ru}</span>
              <span className={s.metaLine}>city:{sel.id}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className={s.col4}>
                <span className={s.fieldT}>Название RU</span>
                <input className={s.input} value={ru} onChange={(e) => setRu(e.target.value)} />
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>Название TJ</span>
                <input className={s.input} value={tj} onChange={(e) => setTj(e.target.value)} />
              </label>
            </div>
            <div className={s.col6}>
              <span className={s.fieldT}>Районы · {sel.districts.length}</span>
              {sel.districts.length === 0 && <span className={s.muted}>Районы не заданы</span>}
              {sel.districts.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #EEF1F4' }}>
                  <span>
                    {d.ru} <span className={s.muted}>/ {d.tj}</span>
                  </span>
                  {d.near && <span className={s.muted}>пригород</span>}
                </div>
              ))}
              <span className={s.muted}>Синонимы RU/TJ/лат. (Ходжент / Худжанд / Khujand) и соседние районы — для пустых выдач.</span>
            </div>
          </div>
          <div className={s.panelFoot} style={{ padding: '12px 22px' }}>
            <span className={s.muted}>Изменения применяются в приложении через 5 мин (кэш)</span>
            <span className={s.grow} />
            <button
              type="button"
              className={cx(s.btn, s.btnBlue)}
              disabled={ru === sel.ru && tj === sel.tj}
              onClick={() => adminApi.saveCity(sel.id, ru.trim(), tj.trim()).then(() => (setCities(cities.map((c) => (c.id === sel.id ? { ...c, ru, tj } : c))), toast('Сохранено')), (e) => toast(apiErrorText(e, 'ru')))}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Reasons({ kind }: { kind: 'reject' | 'block' }) {
  const toast = useToast();
  const [rows, setRows] = useState<(Reason & { group: string })[] | null>(null);
  const [edit, setEdit] = useState<Record<number, string>>({});
  useEffect(() => {
    if (kind === 'block') return setRows(BLOCK.map((l, i) => ({ id: i + 1, code: `block_${i + 1}`, label: l, group: 'Блокировка пользователя' })));
    Promise.all([adminApi.rejectReasons('task_reject'), adminApi.rejectReasons('master_reject')]).then(
      ([t, m]) => setRows([...t.map((r) => ({ ...r, group: 'Задание' })), ...m.map((r) => ({ ...r, group: 'Профиль мастера' }))]),
      (e) => toast(apiErrorText(e, 'ru')),
    );
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loading />;
  const COLS = '140px 160px minmax(0,1fr) 110px';
  return (
    <div className={s.list} style={{ borderRight: 'none', flex: 1 }}>
      <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 20px' }}>
        <span>Где</span>
        <span>Код</span>
        <span>Текст причины (RU)</span>
        <span />
      </div>
      <div className={s.scroll}>
        {rows.map((r) => (
          <div key={`${r.group}${r.id}`} className={s.row} style={{ gridTemplateColumns: COLS, padding: '0 20px', height: 44, cursor: 'default' }}>
            <span className={s.muted}>{r.group}</span>
            <span className={s.id}>{r.code}</span>
            <input className={s.input} style={{ height: 32 }} value={edit[r.id] ?? r.label} disabled={kind === 'block'} onChange={(e) => setEdit({ ...edit, [r.id]: e.target.value })} />
            <span className={s.right}>
              {edit[r.id] !== undefined && edit[r.id] !== r.label && (
                <button type="button" className={cx(s.btn, s.btnBlue)} style={{ height: 32 }} onClick={() => adminApi.saveReason(r.id, edit[r.id].trim()).then(() => (setRows(rows.map((x) => (x.id === r.id && x.group === r.group ? { ...x, label: edit[r.id] } : x))), toast('Сохранено')), (e) => toast(apiErrorText(e, 'ru')))}>
                  Сохранить
                </button>
              )}
            </span>
          </div>
        ))}
        <div className={s.hint} style={{ padding: '14px 20px' }}>
          {kind === 'block' ? (USE_API ? 'Причины блокировки — текстом в карточке пользователя; справочника в API пока нет.' : 'Причины блокировки — выбор в карточке пользователя.') : 'Порядок причин совпадает с клавишами 1–5 в очередях модерации. Удалить нельзя — причины используются в истории.'}
        </div>
      </div>
    </div>
  );
}
