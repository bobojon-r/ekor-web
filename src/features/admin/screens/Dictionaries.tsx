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
import { L } from '../i18n';

type TabK = 'cities' | 'cats' | 'reject' | 'block';
const ICONS = ['Wrench', 'Zap', 'Droplets', 'PaintRoller', 'HardHat', 'WashingMachine', 'Truck', 'GraduationCap', 'Scissors', 'PartyPopper', 'Laptop', 'Sparkles', 'CircleEllipsis'];
const BLOCK = [L.dictionaries.moshennichestvoPredoplata, L.dictionaries.oskorbleniyaIUgrozy, L.dictionaries.spamIReklama, L.dictionaries.feykovyyProfil, L.dictionaries.obhodPravilPlatformy];
const TJ_CHARS = /[ӣӯҳҷқғ]/i;

/** 08 — справочники (admin): категории, города и районы, причины */
export function Dictionaries() {
  const [tab, setTab] = useState<TabK>('cats');
  const [creating, setCreating] = useState(0);
  return (
    <>
      <Head title={L.dictionaries.spravochniki}>
        <Seg value={tab} onChange={setTab} items={[['cities', L.dictionaries.gorodaIRayony], ['cats', L.dictionaries.kategorii], ['reject', L.dictionaries.prichinyOtkaza], ['block', L.dictionaries.prichinyBlokirovki]]} />
        <span className={s.grow} />
        {tab === 'cats' && (
          <button type="button" className={s.hprimary} onClick={() => setCreating((n) => n + 1)}>
            {L.dictionaries.kategoriya}
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
    setDraft({ id: 0, key: '', ru: '', tj: '', parentId: null, icon: 'Wrench', masters: 0, hidden: false, aliases: [], online: false, photoRequired: false, perHour: false, sort: cats.length });
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
    if (!ed || !ed.ru.trim() || !ed.tj.trim()) return toast(L.dictionaries.zapolniteNazvaniyaRuI, 'info');
    setBusy(true);
    try {
      const key = ed.key || ed.ru.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\wа-яё_]/gi, '').slice(0, 30);
      await adminApi.saveCategory({ ...ed, key }, isNew);
      toast(isNew ? L.dictionaries.kategoriyaDobavlena : L.dictionaries.sohranenoVPrilozheniiCherez);
      setIsNew(false);
      await load();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  // Перетаскивание — порядок внутри одного родителя; сохраняется полем sort у сдвинутых категорий
  const drop = async (target: CatNode) => {
    if (!cats || drag === null || drag === target.id) return;
    const d = cats.find((c) => c.id === drag)!;
    setDrag(null);
    if (d.parentId !== target.parentId) return toast(L.dictionaries.perenositMozhnoVnutriOdnoy, 'info');
    const list = cats.filter((c) => c.id !== d.id);
    list.splice(list.indexOf(target), 0, d);
    const prev = cats;
    setCats(list);
    try {
      await adminApi.sortCategories(list.filter((c) => c.parentId === d.parentId).map((c) => c.id), prev);
      toast(L.dictionaries.poryadokSohranen);
      load();
    } catch (e) {
      setCats(prev);
      toast(apiErrorText(e, 'ru'));
    }
  };
  const parent = ed?.parentId ? cats?.find((c) => c.id === ed.parentId) : null;

  if (!cats) return <Loading />;
  return (
    <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
      <div className={s.list}>
        <div className={s.filters} style={{ padding: '0 16px' }}>
          <SearchBox value={q} onChange={setQ} placeholder={L.dictionaries.nazvanieIliSinonim} width={0} />
          <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>
            {L.dictionaries.peretaskivaniePoryadokVPrilozhen}
          </span>
        </div>
        <div className={s.thead} style={{ gridTemplateColumns: '20px minmax(0,1fr) 90px', padding: '0 16px', height: 32 }}>
          <span />
          <span>{L.dictionaries.kategoriya2}</span>
          <span className={s.right}>{L.dictionaries.masterov}</span>
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
                {c.hidden && L.dictionaries.skryta}
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
              <span className={s.h18}>{ed.ru || L.dictionaries.novayaKategoriya}</span>
              {!isNew && <span className={s.metaLine}>category:{ed.id} · slug {ed.key}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className={s.col4}>
                <span className={s.fieldT}>{L.dictionaries.nazvanieRu}</span>
                <input className={s.input} value={ed.ru} onChange={(e) => setDraft({ ...ed, ru: e.target.value.slice(0, 60) })} />
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>{L.dictionaries.nazvanieTj}</span>
                <input className={s.input} value={ed.tj} onChange={(e) => setDraft({ ...ed, tj: e.target.value.slice(0, 60) })} />
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>{L.dictionaries.roditel}</span>
                <select className={s.select} value={ed.parentId ?? ''} disabled={!isNew} onChange={(e) => setDraft({ ...ed, parentId: e.target.value ? +e.target.value : null })}>
                  <option value="">{L.dictionaries.verhniyUroven}</option>
                  {cats.filter((c) => !c.parentId && c.id !== ed.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ru}
                    </option>
                  ))}
                </select>
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>{L.dictionaries.ikonka}</span>
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
              <span className={s.fieldT}>{L.dictionaries.sinonimyDlyaPoiska}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 7, border: '1px solid #C9D1DB' }}>
                {ed.aliases.map((w) => (
                  <span key={w} style={{ height: 26, padding: '0 4px 0 9px', borderRadius: 999, background: '#EAEEFC', color: '#1F3BB8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {w}
                    <button type="button" aria-label={L.dictionaries.ubrat(w)} onClick={() => setDraft({ ...ed, aliases: ed.aliases.filter((x) => x !== w) })} style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', padding: 0 }}>
                      <X size={14} color="#5B6878" aria-hidden />
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
                  placeholder={L.dictionaries.dobavit}
                  style={{ height: 26, border: 'none', outline: 'none', minWidth: 100, flex: 1 }}
                />
              </div>
              <span className={s.muted}>{L.dictionaries.ruTjILatinitsa}</span>
            </div>
            <div className={s.col6}>
              <span className={s.fieldT}>{L.dictionaries.polyaZadaniyaDlyaKategorii}</span>
              <div className={s.wrap4} style={{ gap: 6 }}>
                {([['photoRequired', L.dictionaries.fotoObyazatelno], ['online', L.dictionaries.onlaynFormat], ['perHour', L.dictionaries.tsenaZaChas]] as const).map(([k, l]) => {
                  const on = !!ed[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft({ ...ed, [k]: !on })}
                      style={{ height: 28, padding: '0 10px', borderRadius: 6, border: on ? '1.5px solid #2647D9' : '1px solid #DCE3EA', background: on ? '#F7F9FF' : '#fff', fontWeight: on ? 600 : 400, fontSize: 13, color: '#0F1B2A' }}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={s.swRow}>
              <Switch on={!ed.hidden} onClick={() => setDraft({ ...ed, hidden: !ed.hidden })} label={L.dictionaries.pokazyvatVPrilozhenii} />
              <div className={s.col4} style={{ gap: 2 }}>
                <span className={s.fieldT}>{L.dictionaries.pokazyvatVPrilozhenii}</span>
                <span className={s.muted}>
                  {num(ed.masters)} {L.dictionaries.masterov2}{ed.openTasks ? L.dictionaries.otkrytyhZadaniy(num(ed.openTasks)) : ''}{L.dictionaries.udalitNelzyaTolkoSkryt}
                </span>
              </div>
            </div>
            {(!TJ_CHARS.test(ed.tj) || ed.tj === ed.ru) && ed.tj && (
              <div className={s.alertWarn}>
                <TriangleAlert size={15} aria-hidden />
                <span>{L.dictionaries.nazvanieTjZhdetVychitki}</span>
              </div>
            )}
          </div>
          <div className={s.panelFoot} style={{ padding: '12px 22px' }}>
            <span className={s.muted}>{L.dictionaries.izmeneniyaPrimenyayutsyaVPrilozh}</span>
            <span className={s.grow} />
            <button type="button" className={s.btn} disabled={!changed} onClick={() => (isNew ? (setIsNew(false), setDraft(sel ? { ...sel } : null)) : sel && setDraft({ ...sel, aliases: [...sel.aliases] }))}>
              {L.dictionaries.otmena}
            </button>
            <button type="button" className={cx(s.btn, s.btnBlue)} disabled={!changed || busy} onClick={save}>
              {busy ? L.dictionaries.sohranyaem : L.dictionaries.sohranit}
            </button>
          </div>
        </div>
      ) : (
        <div className={s.loading}>{L.dictionaries.vyberiteKategoriyu}</div>
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
  const [dist, setDist] = useState<{ id: number; near: number[] } | null>(null);
  useEffect(() => {
    adminApi.cities().then((c) => (setCities(c), setSelId(c[0]?.id ?? null)), (e) => toast(apiErrorText(e, 'ru')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = cities?.find((c) => c.id === selId) ?? null;
  useEffect(() => {
    if (sel) (setRu(sel.ru), setTj(sel.tj), setDist(null));
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cities) return <Loading />;
  const COLS = 'minmax(0,1fr) 160px 90px 90px';
  return (
    <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
      <div className={s.list}>
        <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
          <span>{L.dictionaries.gorod}</span>
          <span>{L.dictionaries.region}</span>
          <span className={s.right}>{L.dictionaries.rayonov}</span>
          <span className={s.right}>{L.dictionaries.masterov}</span>
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
                <span className={s.fieldT}>{L.dictionaries.nazvanieRu}</span>
                <input className={s.input} value={ru} onChange={(e) => setRu(e.target.value)} />
              </label>
              <label className={s.col4}>
                <span className={s.fieldT}>{L.dictionaries.nazvanieTj}</span>
                <input className={s.input} value={tj} onChange={(e) => setTj(e.target.value)} />
              </label>
            </div>
            <div className={s.col6}>
              <span className={s.fieldT}>{L.dictionaries.rayony} {sel.districts.length}</span>
              {sel.districts.length === 0 && <span className={s.muted}>{L.dictionaries.rayonyNeZadany}</span>}
              {sel.districts.map((d) => {
                const on = dist?.id === d.id;
                const names = (d.neighbors ?? []).map((id) => sel.districts.find((x) => x.id === id)?.ru).filter(Boolean);
                return (
                  <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '7px 0', borderBottom: '1px solid #EEF1F4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span>
                        {d.ru} <span className={s.muted}>/ {d.tj}</span>
                        {d.near && <span className={s.muted}> {L.dictionaries.prigorod}</span>}
                      </span>
                      {USE_API && (
                        <button type="button" className={s.linkBtn} onClick={() => setDist(on ? null : { id: d.id, near: [...(d.neighbors ?? [])] })}>
                          {on ? L.dictionaries.svernut : L.dictionaries.sosednieRayony}
                        </button>
                      )}
                    </div>
                    {!on && names.length > 0 && <span className={s.muted} style={{ fontSize: 12 }}>{L.dictionaries.sosedi} {names.join(', ')}</span>}
                    {on && dist && (
                      <>
                        <div className={s.wrap4} style={{ gap: 6 }}>
                          {sel.districts
                            .filter((x) => x.id !== d.id)
                            .map((x) => {
                              const n = dist.near.includes(x.id);
                              return (
                                <button key={x.id} type="button" aria-pressed={n} className={cx(s.reason, n && s.reasonOn)} style={{ height: 28, padding: '0 10px' }} onClick={() => setDist({ ...dist, near: n ? dist.near.filter((y) => y !== x.id) : [...dist.near, x.id] })}>
                                  {x.ru}
                                </button>
                              );
                            })}
                        </div>
                        <button
                          type="button"
                          className={cx(s.btn, s.btnBlue)}
                          style={{ alignSelf: 'flex-start', height: 30 }}
                          onClick={() =>
                            adminApi.saveDistrict(d.id, { neighbors: dist.near }).then(
                              () => (setCities(cities.map((c) => (c.id === sel.id ? { ...c, districts: c.districts.map((x) => (x.id === d.id ? { ...x, neighbors: dist.near } : x)) } : c))), setDist(null), toast(L.dictionaries.sosednieRayonySohraneny)),
                              (e) => toast(apiErrorText(e, 'ru')),
                            )
                          }
                        >
                          {L.dictionaries.sohranitSosedey}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              <span className={s.muted}>{L.dictionaries.sosednieRayonyRasshiryayutLentu}</span>
            </div>
          </div>
          <div className={s.panelFoot} style={{ padding: '12px 22px' }}>
            <span className={s.muted}>{L.dictionaries.izmeneniyaPrimenyayutsyaVPrilozh}</span>
            <span className={s.grow} />
            <button
              type="button"
              className={cx(s.btn, s.btnBlue)}
              disabled={ru === sel.ru && tj === sel.tj}
              onClick={() => adminApi.saveCity(sel.id, ru.trim(), tj.trim()).then(() => (setCities(cities.map((c) => (c.id === sel.id ? { ...c, ru, tj } : c))), toast(L.dictionaries.sohraneno)), (e) => toast(apiErrorText(e, 'ru')))}
            >
              {L.dictionaries.sohranit}
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
    if (kind === 'block' && !USE_API) return setRows(BLOCK.map((l, i) => ({ id: i + 1, code: `block_${i + 1}`, label: l, group: L.dictionaries.blokirovkaPolzovatelya })));
    const kinds: [string, string][] = kind === 'block' ? [['user_block', L.dictionaries.blokirovkaPolzovatelya], ['review_hide', L.dictionaries.skrytieOtzyva]] : [['task_reject', L.dictionaries.zadanie], ['master_reject', L.dictionaries.profilMastera]];
    Promise.all(kinds.map(([k]) => adminApi.rejectReasons(k))).then(
      (ls) => setRows(ls.flatMap((l, i) => l.map((r) => ({ ...r, group: kinds[i][1] })))),
      (e) => toast(apiErrorText(e, 'ru')),
    );
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loading />;
  const COLS = '160px 160px minmax(0,1fr) 110px 110px';
  return (
    <div className={s.list} style={{ borderRight: 'none', flex: 1 }}>
      <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 20px' }}>
        <span>{L.dictionaries.gde}</span>
        <span>{L.dictionaries.kod}</span>
        <span>{L.dictionaries.tekstPrichinyRu}</span>
        <span>{USE_API ? L.dictionaries.vSpiske : ''}</span>
        <span />
      </div>
      <div className={s.scroll}>
        {rows.map((r) => (
          <div key={`${r.group}${r.id}`} className={s.row} style={{ gridTemplateColumns: COLS, padding: '0 20px', height: 44, cursor: 'default' }}>
            <span className={s.muted}>{r.group}</span>
            <span className={s.id}>{r.code}</span>
            <input className={s.input} style={{ height: 32 }} value={edit[r.id] ?? r.label} disabled={kind === 'block' && !USE_API} title={r.text ? L.dictionaries.polzovatelUvidit(r.text) : undefined} onChange={(e) => setEdit({ ...edit, [r.id]: e.target.value })} />
            <span>
              {USE_API && (
                <Switch
                  on={!r.hidden}
                  label={L.dictionaries.pokazyvat(r.label)}
                  onClick={() => adminApi.saveReason(r.id, r.label, { hidden: !r.hidden }).then(() => setRows(rows.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x))), (e) => toast(apiErrorText(e, 'ru')))}
                />
              )}
            </span>
            <span className={s.right}>
              {edit[r.id] !== undefined && edit[r.id] !== r.label && (
                <button type="button" className={cx(s.btn, s.btnBlue)} style={{ height: 32 }} onClick={() => adminApi.saveReason(r.id, edit[r.id].trim()).then(() => (setRows(rows.map((x) => (x.id === r.id && x.group === r.group ? { ...x, label: edit[r.id] } : x))), toast(L.dictionaries.sohraneno)), (e) => toast(apiErrorText(e, 'ru')))}>
                  {L.dictionaries.sohranit}
                </button>
              )}
            </span>
          </div>
        ))}
        <div className={s.hint} style={{ padding: '14px 20px' }}>
          {kind === 'block' ? L.dictionaries.prichinyBlokirovkiISkrytiya : L.dictionaries.poryadokPrichinSovpadaetS}
        </div>
      </div>
    </div>
  );
}
