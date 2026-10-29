'use client';

import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { adminApi } from '../data/api';
import type { TplCard, TplRow, TplText } from '../data/types';
import { cx, Head, Label, Loading } from '../ui';
import s from '../Admin.module.css';
import { L } from '../i18n';

type Ch = TplText['ch'];
const CH: Record<Ch, [string, string, string]> = { sms: ['SMS', '#FBEBDA', '#8A4B0D'], push: ['Push', '#EAEEFC', '#1F3BB8'], inapp: ['In-app', '#EEF1F4', '#3B4756'] };
const GSM = /^[\n\r @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

/** Длина с переменными по их максимальной длине; кириллица — UCS-2: 70 символов в одном SMS, 67 при склейке */
function smsCount(t: string, max: Record<string, number>) {
  const n = t.replace(/\{(\w+)\}/g, (_, v: string) => 'x'.repeat(max[v] ?? 10)).length;
  const [one, part] = GSM.test(t) ? [160, 153] : [70, 67];
  return { n, one, p: n <= one ? 1 : Math.ceil(n / part) };
}
const unknownVars = (t: string, vars: string[]) => [...t.matchAll(/\{(\w*)\}/g)].map((m) => m[1]).filter((v) => !vars.includes(v));

/** 10 — шаблоны SMS и уведомлений (admin): события, каналы SMS / push / in-app, тексты RU и TJ */
export function Templates() {
  const toast = useToast();
  const [list, setList] = useState<TplRow[] | null>(null);
  const [sel, setSel] = useState(0);
  const [card, setCard] = useState<TplCard | null>(null);
  const [ch, setCh] = useState<Ch>('sms');
  const [draft, setDraft] = useState<Record<'ru' | 'tj', { title: string; body: string }>>({ ru: { title: '', body: '' }, tj: { title: '', body: '' } });
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const last = useRef<'ru' | 'tj'>('ru');

  useEffect(() => {
    adminApi.templates().then(setList, (e) => (setList([]), toast(apiErrorText(e, 'ru'))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = list?.[sel] ?? null;
  useEffect(() => {
    setCard(null);
    if (cur) adminApi.template(cur.code).then((c) => (setCard(c), setCh(c.ch.includes(ch) ? ch : c.ch[0])), (e) => toast(apiErrorText(e, 'ru')));
  }, [cur?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = (lang: 'ru' | 'tj') => card?.texts.find((t) => t.ch === ch && t.lang === lang) ?? null;
  useEffect(() => {
    const r = text('ru');
    const t = text('tj');
    setDraft({ ru: { title: r?.title ?? '', body: r?.body ?? '' }, tj: { title: t?.title ?? '', body: t?.body ?? '' } });
  }, [card, ch]); // eslint-disable-line react-hooks/exhaustive-deps

  const vars = card?.vars.map((v) => v.name) ?? [];
  const maxLen = Object.fromEntries(card?.vars.map((v) => [v.name, v.max]) ?? []);
  const sample = Object.fromEntries(card?.vars.map((v) => [v.name, v.sample]) ?? []);
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (m, v: string) => sample[v] ?? m);
  const sms = ch === 'sms';
  const withTitle = ch !== 'sms';
  const changed = (['ru', 'tj'] as const).filter((l) => {
    const o = text(l);
    return o && (draft[l].body !== o.body || (withTitle && draft[l].title !== (o.title ?? '')));
  });
  const bad = (['ru', 'tj'] as const).flatMap((l) => unknownVars(`${draft[l].title} ${draft[l].body}`, vars));

  const save = async () => {
    if (!cur || !changed.length) return;
    setBusy(true);
    try {
      let c: TplCard | null = null;
      for (const l of changed) c = await adminApi.saveTemplate(cur.code, { ...text(l)!, title: withTitle ? draft[l].title || null : null, body: draft[l].body.trim() });
      if (c) setCard(c);
      setList((x) => x?.map((t) => (t.code === cur.code ? { ...t, custom: [...new Set([...t.custom, ...changed.map((l) => `${ch}:${l}`)])] } : t)) ?? x);
      toast(L.templates.shablonSohranen);
    } catch (e) {
      toast((e as { status?: number }).status === 409 ? L.templates.shablonUspeliIzmenitOtkroyte : apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const test = async () => {
    if (!cur) return;
    const lang = last.current;
    setBusy(true);
    try {
      const r = await adminApi.testTemplate(cur.code, phone.trim(), { ...text(lang)!, title: withTitle ? draft[lang].title || null : null, body: draft[lang].body });
      toast(L.templates.testOtpravlenNa(r.sent_to, sms ? ` · ${r.sms.segments} SMS` : ''));
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const insert = (v: string) => setDraft((d) => ({ ...d, [last.current]: { ...d[last.current], body: `${d[last.current].body}${d[last.current].body.endsWith(' ') ? '' : ' '}{${v}}` } }));
  const set = (lang: 'ru' | 'tj', k: 'title' | 'body', v: string) => setDraft((d) => ({ ...d, [lang]: { ...d[lang], [k]: v } }));

  const area = (lang: 'ru' | 'tj') => {
    const v = draft[lang].body;
    const c = smsCount(v, maxLen);
    const over = sms && c.p > 1;
    const o = text(lang);
    return (
      <div className={s.col6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span className={s.fieldT}>
            {lang === 'ru' ? L.templates.russkiy : L.templates.toIk}
            {o?.custom && <span className={s.muted}> {L.templates.izmenen}</span>}
          </span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {o && v !== o.defBody && (
              <button type="button" className={s.linkBtn} onClick={() => set(lang, 'body', o.defBody)}>
                {L.templates.vernutStandartnyy}
              </button>
            )}
            <span style={{ font: "600 12px 'JetBrains Mono', monospace", color: over ? '#8A4B0D' : '#0B6E5E' }}>{sms ? `${c.n} / ${c.one} · ${c.p} SMS` : L.templates.simv(c.n)}</span>
          </span>
        </div>
        {withTitle && <input className={s.input} value={draft[lang].title} onFocus={() => (last.current = lang)} onChange={(e) => set(lang, 'title', e.target.value.slice(0, 60))} placeholder={L.templates.zagolovok} aria-label={L.templates.zagolovok2(lang)} />}
        <textarea
          value={v}
          onFocus={() => (last.current = lang)}
          onChange={(e) => set(lang, 'body', e.target.value.slice(0, 500))}
          rows={2}
          style={{ padding: '10px 12px', borderRadius: 7, border: `1.5px solid ${over ? '#D9822B' : '#2647D9'}`, lineHeight: 1.5, fontSize: 14, minHeight: 44, resize: 'vertical', outline: 'none' }}
        />
        {over && <span style={{ color: '#8A4B0D' }}>{L.templates.prevyshaet} {c.one} {L.templates.simvolovOtpravitsya} {c.p === 2 ? L.templates.dvumya : `${c.p}`} {L.templates.smsIStoit} {c.p === 2 ? L.templates.vdvoe : L.templates.vRaza(c.p)} {L.templates.dorozheSokratiteTekst}</span>}
      </div>
    );
  };

  return (
    <>
      <Head title={L.templates.shablonyUvedomleniy}>
        <span className={s.muted}>{list ? L.templates.sobytiySmsTolkoKritichnye(list.length) : ''}</span>
      </Head>
      {!list ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: '340px minmax(0,1fr) 320px' }}>
          <div className={s.list}>
            <div className={s.scroll}>
              {list.map((t, i) => (
                <div key={t.code} role="button" tabIndex={0} onClick={() => setSel(i)} onKeyDown={(e) => e.key === 'Enter' && setSel(i)} className={cx(s.row, i === sel && s.rowOn)} style={{ height: 52, display: 'flex', padding: '0 16px', gap: 10 }}>
                  <div className={s.grow} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span className={s.cell} style={{ fontWeight: i === sel ? 600 : 400 }}>
                      {t.title}
                    </span>
                    <span style={{ font: "500 11px 'JetBrains Mono', monospace", color: '#5B6878' }}>
                      {t.code}
                      {t.custom.length ? L.templates.izmenen2 : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.ch.map((c) => (
                      <span key={c} className={s.pill} style={{ background: CH[c][1], color: CH[c][2] }}>
                        {CH[c][0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={s.panel}>
            {!card || !cur ? (
              <Loading />
            ) : (
              <>
                <div className={s.panelBody} style={{ padding: '16px 22px', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={s.h18}>{card.title}</span>
                    <span className={s.metaLine}>{card.code}</span>
                  </div>
                  {card.ch.length > 1 && (
                    <div className={s.tabs} role="tablist" style={{ alignSelf: 'flex-start' }}>
                      {card.ch.map((c) => (
                        <button key={c} type="button" role="tab" aria-selected={ch === c} className={cx(s.tab, ch === c && s.tabOn)} onClick={() => setCh(c)}>
                          {CH[c][0]}
                        </button>
                      ))}
                    </div>
                  )}
                  {area('ru')}
                  {area('tj')}
                  <div className={s.col6}>
                    <span className={s.fieldT}>{L.templates.peremennye}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {card.vars.map((v) => (
                        <button key={v.name} type="button" title={L.templates.doSimvPrimer(v.max, v.sample)} onClick={() => insert(v.name)} style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid #DCE3EA', background: '#fff', font: "500 12px 'JetBrains Mono', monospace" }}>
                          {`{${v.name}}`}
                        </button>
                      ))}
                    </div>
                    {bad.length > 0 ? (
                      <span style={{ color: '#A5281B' }}>{L.templates.neizvestnayaPeremennaya} {[...new Set(bad)].map((v) => `{${v}}`).join(', ')}</span>
                    ) : (
                      <span className={s.muted}>{L.templates.kirillitsa70SimvolovNa}</span>
                    )}
                  </div>
                  <div className={s.alertWarn}>
                    <TriangleAlert size={15} aria-hidden />
                    <span>{L.templates.tekstyTjChernovikNuzhna}</span>
                  </div>
                </div>
                <div className={s.panelFoot} style={{ padding: '12px 22px' }}>
                  <input className={s.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+992 …" style={{ width: 150, height: 34, font: "500 12px 'JetBrains Mono', monospace" }} aria-label={L.templates.nomerDlyaTesta} />
                  <button type="button" className={s.btn} style={{ height: 34 }} disabled={busy || phone.replace(/\D/g, '').length < 9 || bad.length > 0} onClick={test}>
                    {L.templates.otpravitTest}
                  </button>
                  <span className={s.grow} />
                  <button type="button" className={cx(s.btn, s.btnBlue)} disabled={busy || !changed.length || bad.length > 0 || changed.some((l) => !draft[l].body.trim())} onClick={save}>
                    {L.templates.sohranit}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className={s.panelBody} style={{ borderLeft: '1px solid #E1E6EC', background: '#F7F9FB', alignItems: 'center' }}>
            <span style={{ alignSelf: 'flex-start' }}>
              <Label>{L.templates.predprosmotr}</Label>
            </span>
            <div style={{ width: 260, borderRadius: 28, background: '#0F1B2A', padding: 10 }}>
              <div style={{ borderRadius: 20, background: '#E9EDF1', padding: '18px 12px 60px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ alignSelf: 'center', fontSize: 11, color: '#5B6878' }}>{L.templates.ekorSeychas}</span>
                {(['ru', 'tj'] as const).map((l) => (
                  <div key={l} style={{ padding: '10px 12px', borderRadius: '14px 14px 14px 4px', background: '#fff', fontSize: 14, lineHeight: 1.45 }}>
                    {withTitle && draft[l].title && <b style={{ display: 'block' }}>{fill(draft[l].title)}</b>}
                    {fill(draft[l].body)}
                  </div>
                ))}
              </div>
            </div>
            <span className={s.muted} style={{ textAlign: 'center', lineHeight: 1.45 }}>
              {L.templates.yazykVybiraetsyaPoProfilyu}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
