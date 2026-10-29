'use client';

import { useEffect, useState } from 'react';
import { MessageSquareWarning, TriangleAlert } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { Reason, UserCard, UserV } from '../data/types';
import { initials, num } from '../core';
import { cx, Head, Label, Loading, Modal, Pill, SearchBox, SelectChip, ToggleChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

const COLS = '72px minmax(0,1fr) 140px 92px 92px 92px 50px 90px';
const TERMS: [string, number | null][] = [
  [L.users._24Ch, 1],
  [L.users._7Dney, 7],
  [L.users._30Dney, 30],
  [L.users.navsegda, null],
];

/** 06 — пользователи и блокировки; 16 — подтверждение вечной блокировки */
export function Users({ initialId }: { initialId?: number }) {
  const { me } = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [withC, setWithC] = useState(false);
  const [city, setCity] = useState('all');
  const [data, setData] = useState<{
    items: UserV[];
    total: number;
    masters: number;
  } | null>(null);
  const [selKey, setSelKey] = useState<number | null>(initialId ?? null);
  const [card, setCard] = useState<UserCard | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reason, setReason] = useState<Reason | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [term, setTerm] = useState<number | null>(7);
  const [comment, setComment] = useState('');
  const [forever, setForever] = useState(false);
  const [digits, setDigits] = useState('');
  const [unblock, setUnblock] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const senior = me.role !== 'moderator';

  useEffect(() => {
    adminApi.blockReasons().then(
      (l) => (setReasons(l), setReason(l[0] ?? null)),
      () => {},
    );
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const load = () => adminApi.users({ q: qDeb, role, status, complaints: withC, city }).then(setData, (e) => (setData({ items: [], total: 0, masters: 0 }), toast(apiErrorText(e, 'ru'))));
  useEffect(() => {
    load();
  }, [qDeb, role, status, withC, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.items ?? [];
  const cur = rows.find((u) => u.key === selKey) ?? rows[0] ?? null;
  useEffect(() => {
    setCard(null);
    setComment('');
    setTerm(7);
    if (cur) adminApi.user(cur).then(setCard, (e) => toast(apiErrorText(e, 'ru')));
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const idx = cur ? rows.indexOf(cur) : -1;
  useHotkeys(
    cur
      ? {
          j: () => rows[idx + 1] && setSelKey(rows[idx + 1].key),
          k: () => idx > 0 && setSelKey(rows[idx - 1].key),
        }
      : {},
  );

  const block = async () => {
    if (!cur || !reason) return;
    setBusy(true);
    try {
      await adminApi.block(cur, reason, term, comment.trim(), term === null ? digits : null);
      setForever(false);
      setDigits('');
      toast(term ? L.users.zablokirovanNa(TERMS.find((t) => t[1] === term)?.[0]) : L.users.zablokirovanNavsegda);
      await load();
      adminApi.user({ ...cur, blocked: true }).then(setCard, () => {});
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const last4 = (card?.phoneFull ?? cur?.phone ?? '').replace(/\D/g, '').slice(-4);
  const cities = [...new Set(rows.map((u) => u.city))];

  return (
    <>
      <Head title={L.users.polzovateli}>
        <span className={s.muted}>{data ? L.users.masterov(num(data.total), num(data.masters)) : ''}</span>
        <span className={s.grow} />
        <SearchBox value={q} onChange={setQ} placeholder={L.users.telefonImyaId} width={300} slash />
      </Head>
      <div className={s.filters}>
        <SelectChip label={L.users.rol} value={role} onChange={setRole} options={[['all', L.users.vse], [L.users.klient, L.users.klient2], [L.users.master, L.users.master2]]} />
        <SelectChip label={L.users.status} value={status} onChange={setStatus} options={[['all', L.users.vse], ['active', L.users.aktiven], ['blocked', L.users.zablokirovan]]} />
        <ToggleChip on={withC} onClick={() => setWithC(!withC)}>
          {L.users.sZhalobami}
        </ToggleChip>
        <SelectChip label={L.users.gorod} value={city} onChange={setCity} options={[['all', L.users.vse], ...cities.map((c): [string, string] => [c, c])]} />
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 420px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
              <span>ID</span>
              <span>{L.users.imya}</span>
              <span>{L.users.telefon}</span>
              <span>{L.users.rol}</span>
              <span>{L.users.gorod}</span>
              <span>{L.users.status}</span>
              <span className={s.right}>{L.users.zhal}</span>
              <span className={s.right}>{L.users.vhod}</span>
            </div>
            <div className={s.scroll}>
              {rows.length === 0 && <div className={s.hint} style={{ padding: 16 }}>{L.users.nikogoNeNashliPoisk}</div>}
              {rows.map((u) => (
                <div key={u.key} role="button" tabIndex={0} onClick={() => setSelKey(u.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(u.key)} className={cx(s.row, cur?.key === u.key && s.rowOn)} style={{ gridTemplateColumns: COLS }}>
                  <span className={s.id}>{u.id}</span>
                  <span className={s.cell} style={{ fontWeight: 500 }}>
                    {u.name}
                  </span>
                  <span className={cx(s.mono, s.cell)} style={{ fontSize: 12, fontWeight: 500 }}>
                    {u.phone}
                  </span>
                  <span style={{ color: '#3B4756' }}>{u.role}</span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {u.city}
                  </span>
                  <span>
                    <Pill tone={u.tone}>{u.status}</Pill>
                  </span>
                  <span className={s.num} style={{ color: u.complaints >= 3 ? '#B03A2E' : '#0F1B2A' }}>
                    {u.complaints}
                  </span>
                  <span className={s.right} style={{ color: '#5B6878' }}>
                    {u.seen}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {cur && card ? (
            <div className={s.panel}>
              <div className={s.panelBody} style={{ padding: '16px 20px', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#EAEEFC',
                      color: '#2647D9',
                      fontWeight: 700,
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                    }}
                  >
                    {initials(cur.name)}
                  </span>
                  <div className={s.col4} style={{ gap: 2 }}>
                    <span className={s.h17}>{cur.name}</span>
                    <span className={s.metaLine}>
                      {cur.id} · {card.phoneFull ?? cur.phone}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4,1fr)',
                    gap: 6,
                  }}
                >
                  {card.stats.map(([v, l, red]) => (
                    <div
                      key={l}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: '#F7F9FB',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: red ? '#B03A2E' : '#0F1B2A',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v}
                      </span>
                      <span className={s.muted} style={{ fontSize: 12 }}>
                        {l}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={s.col6}>
                  <Label>{L.users.signaly}</Label>
                  <span style={{ lineHeight: 1.5 }}>{card.signals}</span>
                </div>
                {!!card.sanctions?.length && (
                  <div className={s.col6}>
                    <Label>{L.users.blokirovkiIPreduprezhdeniya}</Label>
                    {card.sanctions.map((x, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 8,
                          padding: '6px 0',
                          borderBottom: '1px solid #EEF1F4',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            marginTop: 6,
                            borderRadius: '50%',
                            flex: 'none',
                            background: x.active ? (x.warn ? '#D9822B' : '#B03A2E') : '#9AA5B4',
                          }}
                        />
                        <div className={s.col4} style={{ gap: 2 }}>
                          <span style={{ lineHeight: 1.4 }}>{x.text}</span>
                          <span className={s.muted} style={{ fontSize: 12 }}>
                            {x.meta}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!cur.blocked && (
                  <button type="button" className={s.btn} style={{ alignSelf: 'flex-start' }} onClick={() => setWarn('')}>
                    {L.users.predupredit}
                  </button>
                )}
                {cur.blocked ? (
                  <div
                    style={{
                      border: '1.5px solid #DCE3EA',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      background: '#F7F9FB',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{L.users.polzovatelZablokirovan} {cur.status}</span>
                    {card.blockReason && <span className={s.muted}>{L.users.prichina} {card.blockReason}</span>}
                    {cur.status === L.users.navsegda && me.role !== 'admin' ? (
                      <div className={s.alertWarn}>
                        <TriangleAlert size={15} aria-hidden />
                        <span>{L.users.snyatVechnuyuBlokirovkuMozhet}</span>
                      </div>
                    ) : (
                      <button type="button" className={s.btn} onClick={() => setUnblock('')}>
                        {L.users.razblokirovat}
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1.5px solid #E8C4BE',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      background: '#FFF9F8',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#A5281B',
                      }}
                    >
                      {L.users.zablokirovatPolzovatelya}
                    </span>
                    <label className={s.col4}>
                      <span className={s.fieldT}>{L.users.prichina2}</span>
                      <select className={s.select} value={reason?.id ?? ''} onChange={(e) => setReason(reasons.find((r) => r.id === +e.target.value) ?? null)} style={{ height: 34 }}>
                        {reasons.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={s.col4}>
                      <span className={s.fieldT}>{L.users.srok}</span>
                      <div
                        style={{
                          display: 'flex',
                          background: '#fff',
                          border: '1px solid #C9D1DB',
                          borderRadius: 7,
                          padding: 2,
                        }}
                      >
                        {TERMS.map(([l, v]) => {
                          const on = term === v;
                          const locked = v === null && !senior;
                          return (
                            <button
                              key={l}
                              type="button"
                              disabled={locked}
                              title={locked ? L.users.blokirovkaNavsegdaSeniorModerato : ''}
                              onClick={() => setTerm(v)}
                              style={{
                                flex: 1,
                                height: 28,
                                borderRadius: 5,
                                border: 'none',
                                background: on ? (v === null ? '#B03A2E' : '#0F1B2A') : 'transparent',
                                color: on ? '#fff' : locked ? '#9AA5B4' : '#0F1B2A',
                                fontWeight: on ? 600 : 400,
                                fontSize: 13,
                              }}
                            >
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea className={s.textarea} rows={2} value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder={L.users.osnovanieNomerZhalobyChat} />
                    {term === null && (
                      <div className={s.alertWarn}>
                        <TriangleAlert size={15} aria-hidden />
                        <span>
                          {card.activeTasks ? L.users.aktivnZadaniyBudetSnyato(card.activeTasks) : ''}
                          {L.users.nomerNelzyaBudetZaregistrirovat}
                        </span>
                      </div>
                    )}
                    <button type="button" className={cx(s.btn, s.btnRed)} disabled={comment.trim().length < 5 || busy || !reason} onClick={() => (term === null ? setForever(true) : block())}>
                      {term === null ? L.users.zablokirovatNavsegda : L.users.zablokirovatNa(TERMS.find((t) => t[1] === term)?.[0])}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Loading />
          )}
        </div>
      )}
      {forever && cur && (
        <Modal
          icon={TriangleAlert}
          tone="red"
          title={L.users.zablokirovatNavsegda2(cur.name)}
          sub={`${cur.id} · ${cur.phone} · ${cur.role.toLowerCase()} · ${cur.city}`}
          okText={L.users.zablokirovatNavsegda}
          okTone="red"
          okDisabled={digits !== last4}
          busy={busy}
          onClose={() => (setForever(false), setDigits(''))}
          onOk={block}
        >
          <div className={s.bullets}>
            <b>{L.users.chtoProizoydetSrazu}</b>
            <span>{L.users.vyhodSoVsehUstroystv}</span>
            <span>{L.users.otkrytyeZadaniyaSnimayutsyaMaste}</span>
            <span>{L.users.otzyvyPolzovatelyaSkryvayutsyaPe}</span>
            <span>{L.users.polzovatelPoluchitSmsS}</span>
          </div>
          <div className={s.softBox}>
            <span>{L.users.prichina2}</span>
            <b>{reason?.label}</b>
            <span>{L.users.osnovanie}</span>
            <span>{comment.trim()}</span>
          </div>
          <div className={s.col4}>
            <span className={s.fieldT}>{L.users.dlyaPodtverzhdeniyaVveditePosled}</span>
            <input
              className={cx(s.input, digits.length > 0 && digits !== last4 && s.invalid)}
              style={{
                width: 140,
                height: 40,
                font: "600 16px 'JetBrains Mono', monospace",
                letterSpacing: '0.2em',
              }}
              inputMode="numeric"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
              aria-label={L.users.poslednie4TsifryNomera}
            />
            <span className={s.muted}>{digits.length < 4 ? L.users.nuzhnaYaTsifra(digits.length + 1) : digits === last4 ? L.users.sovpadaet : L.users.tsifryNeSovpadayut}</span>
          </div>
          <div className={s.alertWarn}>
            <TriangleAlert size={15} aria-hidden />
            <span>{L.users.snyatVechnuyuBlokirovkuMozhet2}</span>
          </div>
        </Modal>
      )}
      {warn !== null && cur && (
        <Modal
          icon={MessageSquareWarning}
          tone="blue"
          title={L.users.predupredit2(cur.name)}
          sub={L.users.polzovatelPoluchitUvedomlenieZap(cur.id)}
          okText={L.users.otpravitPreduprezhdenie}
          okDisabled={warn.trim().length < 10}
          busy={busy}
          onClose={() => setWarn(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.warn(cur.key, reason, warn.trim());
              setWarn(null);
              toast(L.users.preduprezhdenieOtpravleno);
              adminApi.user(cur).then(setCard, () => {});
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <label className={s.col4}>
            <span className={s.fieldT}>{L.users.prichina2}</span>
            <select className={s.select} value={reason?.id ?? ''} onChange={(e) => setReason(reasons.find((r) => r.id === +e.target.value) ?? null)} style={{ height: 34 }}>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className={s.col4}>
            <span className={s.fieldT}>
              {L.users.tekstPreduprezhdeniya} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={warn} onChange={(e) => setWarn(e.target.value.slice(0, 500))} placeholder={L.users.chtoNarushenoIChto} autoFocus />
          </div>
        </Modal>
      )}
      {unblock !== null && cur && (
        <Modal
          icon={TriangleAlert}
          tone="blue"
          title={L.users.razblokirovat2(cur.name)}
          sub={`${cur.id} · ${cur.status}`}
          okText={L.users.razblokirovat3}
          okDisabled={unblock.trim().length < 5}
          busy={busy}
          onClose={() => setUnblock(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.unblock(cur, unblock.trim());
              setUnblock(null);
              toast(L.users.polzovatelRazblokirovan);
              await load();
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col4}>
            <span className={s.fieldT}>
              {L.users.osnovanie} <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={unblock} onChange={(e) => setUnblock(e.target.value.slice(0, 500))} autoFocus />
            <span className={s.muted}>{L.users.popadetVAuditLog}</span>
          </div>
        </Modal>
      )}
    </>
  );
}
