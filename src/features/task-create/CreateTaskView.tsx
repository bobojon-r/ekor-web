'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, CalendarDays, Camera, Check, ChevronLeft, CircleCheck, Globe, Info, Lock, MapPin, ShieldCheck, TrendingUp, Wallet, X,
} from 'lucide-react';
import { api, type RegionKey } from '@/lib/api';
import { phoneMask, useDict, useLang } from '@/lib/i18n';
import { useRegion } from '@/lib/hooks/useRegion';
import { useSession } from '@/lib/session/SessionProvider';
import { SiteHeader } from '@/components/layout';
import { Button, Icon, LangSwitch, OtpInput, PhoneField, TestCodeNotice, TextField } from '@/components/ui';
import { EMPTY, clearDraft, loadDraft, saveDraft, validate, type Draft, type Errors } from './draft';
import { createDict } from './i18n';
import s from './CreateTask.module.css';

type Step = 1 | 2 | 3 | 4 | 'phone' | 'code' | 'name' | 'done';
type T = (typeof createDict)['ru'];
type Photo = { id: number; url: string };

export function CreateTaskView() {
  const t = useDict(createDict);
  const { lang } = useLang();
  const router = useRouter();
  const { user, signIn } = useSession();
  const [savedRegion, , regionReady] = useRegion();

  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState(1);
  const [err, setErr] = useState<Errors>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // вход по SMS внутри мастера
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<'len' | 'op' | null>(null);
  const [code, setCode] = useState('');
  const [tries, setTries] = useState(3);
  const [codeErr, setCodeErr] = useState(false);
  const [timer, setTimer] = useState(0);
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Восстановить черновик (или подставить сохранённый город)
  useEffect(() => {
    if (!regionReady) return;
    const saved = loadDraft();
    if (saved) {
      setD(saved.draft);
      setStep(saved.step as Step);
      setMaxStep(saved.step);
    } else setD((x) => ({ ...x, region: savedRegion }));
    setHydrated(true);
  }, [regionReady, savedRegion]);

  useEffect(() => {
    if (hydrated && typeof step === 'number') saveDraft(d, step);
  }, [d, step, hydrated]);

  useEffect(() => {
    if (step !== 'code' || timer <= 0) return;
    const id = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [step, timer]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setErr({});
  };
  const go = (n: Step) => {
    setStep(n);
    setErr({});
    if (typeof n === 'number') setMaxStep((m) => Math.max(m, n));
    topRef.current?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    setSending(true);
    await api.tasks.create(d);
    clearDraft();
    setSending(false);
    go('done');
  };

  const next = async () => {
    if (sending) return;
    if (typeof step === 'number') {
      const e = validate(step, d);
      if (Object.keys(e).length) return setErr(e);
      if (step < 4) return go((step + 1) as Step);
      if (user) return submit();
      return go('phone');
    }
    if (step === 'phone') {
      const pe = api.auth.validPhone(phone);
      if (pe) return setPhoneErr(pe);
      setSending(true);
      const r = await api.auth.sendCode(phone);
      setSending(false);
      setCode('');
      setTries(r.tries);
      setCodeErr(false);
      setTimer(r.resendIn);
      return go('code');
    }
    if (step === 'code') {
      if (code.length !== 6 || tries === 0) return setCodeErr(true);
      setSending(true);
      const r = await api.auth.verify(phone, code);
      setSending(false);
      if (!r.ok) {
        setCode('');
        setTries((x) => x - 1);
        return setCodeErr(true);
      }
      if (r.name) {
        signIn({ id: `u${phone}`, name: r.name, phone, roles: ['client'], activeRole: 'client' });
        return submit();
      }
      return go('name');
    }
    if (step === 'name') {
      if (name.trim().length < 2) return setNameErr(true);
      signIn({ id: `u${phone}`, name: name.trim(), phone, roles: ['client'], activeRole: 'client' });
      return submit();
    }
  };

  const back = () => {
    if (typeof step === 'number' && step > 1) go((step - 1) as Step);
    else if (step === 'phone') go(4);
    else if (step === 'code') go('phone');
  };

  const restart = () => {
    clearDraft();
    setD({ ...EMPTY, region: savedRegion });
    setPhotos([]);
    setMaxStep(1);
    go(1);
  };

  const close = () => (history.length > 1 ? router.back() : router.push('/'));

  const isForm = typeof step === 'number';
  const stepNum = isForm ? step : 4;
  const primary =
    step === 4 ? (user ? t.finish : t.next) : step === 'phone' ? t.getCode : step === 'code' ? t.confirm : step === 'name' ? t.finish : t.next;
  const canBack = (isForm && step > 1) || step === 'phone' || step === 'code';
  const showBar = step !== 'done';

  const pv = preview(d, t, lang, photos.length);

  const body = (narrow: boolean) => (
    <StepBody
      step={step}
      d={d}
      set={set}
      err={err}
      t={t}
      lang={lang}
      narrow={narrow}
      pv={pv}
      photos={photos}
      setPhotos={setPhotos}
      auth={{ phone, setPhone: (v) => (setPhone(v), setPhoneErr(null)), phoneErr, code, setCode: (v) => (setCode(v), setCodeErr(false)), codeErr, tries, timer, resend: async () => { await api.auth.sendCode(phone); setTries(3); setTimer(60); setCodeErr(false); }, name, setName: (v) => (setName(v), setNameErr(false)), nameErr, backPhone: () => go('phone') }}
      onRestart={restart}
    />
  );

  return (
    <div className={s.page} ref={topRef}>
      {/* ============ MOBILE ============ */}
      <div className={`${s.m} mob-only`}>
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <button type="button" className={s.mClose} onClick={close} aria-label={t.close}>
              <X size={24} aria-hidden />
            </button>
            <div className={s.mTitle}>{t.newTask}</div>
            <LangSwitch />
          </div>
          {isForm && (
            <>
              <div className={s.bars}>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={i <= stepNum ? s.barOn : s.bar} />
                ))}
              </div>
              <div className={s.mStepRow}>
                <span>{t.stepOf(stepNum)}</span>
                <span className={s.saved}>
                  <CircleCheck size={16} aria-hidden />
                  {t.saved}
                </span>
              </div>
            </>
          )}
        </div>
        <div className={s.mBody}>{body(true)}</div>
        {showBar && (
          <div className={s.mBar}>
            {canBack && (
              <button type="button" className={s.mBack} onClick={back} aria-label={t.back}>
                <ChevronLeft size={24} aria-hidden />
              </button>
            )}
            <Button size="lg" block busy={sending} onClick={next} className={s.mPrimary}>
              {primary}
            </Button>
          </div>
        )}
      </div>

      {/* ============ DESKTOP ============ */}
      <div className="desk-only">
        <SiteHeader max={1200} />
        <div className={s.dWrap}>
          <div className={s.dTitleRow}>
            <h1 className={s.dTitle}>{t.newTask}</h1>
            {isForm && (
              <span className={s.savedD}>
                <CircleCheck size={18} aria-hidden />
                {t.saved}
              </span>
            )}
          </div>
          <div className={s.dGrid}>
            <div className={s.dCard}>
              {isForm && (
                <div className={s.dStepper}>
                  {t.steps.map((label, i) => {
                    const n = i + 1;
                    const cur = n === step;
                    const done = n < stepNum || (n <= maxStep && n !== step);
                    const reachable = n <= maxStep;
                    return (
                      <button key={n} type="button" disabled={!reachable} onClick={() => reachable && go(n as Step)} className={[s.dStep, cur && s.dStepCur].filter(Boolean).join(' ')}>
                        <span className={cur ? s.dotCur : done ? s.dotDone : s.dot}>{done && !cur ? <Check size={15} aria-hidden /> : n}</span>
                        <span className={s.dStepLabel}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={s.dBody}>{body(false)}</div>
              {showBar && (
                <div className={s.dBar}>
                  <div>
                    {canBack && (
                      <Button variant="secondary" size="md" onClick={back} icon={<ChevronLeft size={18} aria-hidden />} className={s.dBack}>
                        {t.back}
                      </Button>
                    )}
                  </div>
                  <Button size="md" busy={sending} onClick={next} className={s.dPrimary}>
                    {primary}
                  </Button>
                </div>
              )}
            </div>

            <aside className={s.dSide}>
              <div className={s.pvCard}>
                <div className={s.pvHead}>
                  <span className={s.overline}>{t.previewT}</span>
                  <span className={step === 'done' ? s.badgeWarn : s.badgeNeutral}>{step === 'done' ? t.pending : t.draft}</span>
                </div>
                <span className={pv.hasTitle ? s.pvTitle : s.pvTitleEmpty}>{pv.title}</span>
                <span className={s.pvCat}>{pv.cat}</span>
                {d.desc.trim() && <span className={s.pvDesc}>{d.desc}</span>}
                <div className={s.pvRows}>
                  {pv.rows.map((r, i) => (
                    <span key={i} className={s.pvRow}>
                      {r.icon}
                      {r.text}
                    </span>
                  ))}
                </div>
                {photos.length > 0 && (
                  <div className={s.pvPhotos}>
                    {photos.map((p) => (
                      <img key={p.id} src={p.url} alt="" className={s.pvPhoto} />
                    ))}
                  </div>
                )}
                <span className={s.pvLock}>
                  <Lock size={16} aria-hidden className={s.noShrink} />
                  {t.lock}
                </span>
              </div>
              <div className={s.tipsCard}>
                <span className={s.tipsT}>{t.tipsT}</span>
                {t.tips.map((x) => (
                  <span key={x} className={s.tip}>
                    <span className={s.tipDot} />
                    {x}
                  </span>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- предпросмотр ---------- */

function preview(d: Draft, t: T, lang: 'ru' | 'tj', nPhotos: number) {
  const C = api.taskCategories().find((c) => c.k === d.cat);
  const R = api.region(d.region);
  const whenText =
    d.when === null
      ? t.notSet
      : (d.when === 2 ? (d.date ? d.date.split('-').reverse().join('.') : t.notSet) : t.whenOpts[d.when]) + (d.tod !== null ? `, ${t.todOpts[d.tod].toLowerCase()}` : '');
  const budgetText =
    d.bmode === 'neg'
      ? t.negotiable
      : d.bmin && d.bmax
        ? `${d.bmin}–${d.bmax} ${t.cur}`
        : d.bmin
          ? `${t.bFrom} ${d.bmin} ${t.cur}`
          : d.bmax
            ? `${t.bTo} ${d.bmax} ${t.cur}`
            : t.notSet;
  const onlineAll = lang === 'tj' ? 'Онлайн дар тамоми Тоҷикистон' : 'Онлайн по всему Таджикистану';
  const placeText = d.mode === 'online' ? onlineAll : d.district ? `${d.district}, ${R.name[lang]}` : R.name[lang];
  const catText = C ? C[lang] + (d.sub !== null && C.sr.length ? ` · ${(lang === 'tj' ? C.st : C.sr)[d.sub]}` : '') : t.notSet;
  const ic = (I: typeof MapPin) => <I size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />;
  const rows = [
    { icon: ic(MapPin), text: placeText },
    { icon: ic(CalendarDays), text: whenText },
    { icon: ic(Wallet), text: budgetText },
    ...(nPhotos ? [{ icon: ic(Camera), text: t.photosN(nPhotos) }] : []),
  ];
  return { title: d.title.trim() || t.titlePv, hasTitle: !!d.title.trim(), cat: catText, rows };
}

/* ---------- тело шагов (общее для mobile/desktop) ---------- */

type Auth = {
  phone: string;
  setPhone: (v: string) => void;
  phoneErr: 'len' | 'op' | null;
  code: string;
  setCode: (v: string) => void;
  codeErr: boolean;
  tries: number;
  timer: number;
  resend: () => void;
  name: string;
  setName: (v: string) => void;
  nameErr: boolean;
  backPhone: () => void;
};

function StepBody({
  step, d, set, err, t, lang, narrow, pv, photos, setPhotos, auth, onRestart,
}: {
  step: Step;
  d: Draft;
  set: (p: Partial<Draft>) => void;
  err: Errors;
  t: T;
  lang: 'ru' | 'tj';
  narrow: boolean;
  pv: ReturnType<typeof preview>;
  photos: Photo[];
  setPhotos: (fn: (p: Photo[]) => Photo[]) => void;
  auth: Auth;
  onRestart: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const C = api.taskCategories().find((c) => c.k === d.cat);

  if (step === 1)
    return (
      <div className={s.steps}>
        <Q title={t.q1} sub={t.q1sub} />
        <div className={s.field}>
          <span className={s.label}>{t.cat}</span>
          <div className={s.catGrid}>
            {api.taskCategories().map((c) => {
              const on = d.cat === c.k;
              return (
                <button key={c.k} type="button" aria-pressed={on} onClick={() => set({ cat: c.k, sub: null })} className={[s.catBtn, on && s.catOn, err.cat && !on && s.catErr].filter(Boolean).join(' ')}>
                  <span className={on ? s.catIcoOn : s.catIco}>
                    <Icon name={c.i} size={20} color={on ? '#fff' : 'var(--brand-600)'} />
                  </span>
                  {c[lang]}
                </button>
              );
            })}
          </div>
          {err.cat && <span className={s.err}>{t.errCat}</span>}
        </div>
        {C && C.sr.length > 0 && (
          <div className={s.field}>
            <span className={s.label}>
              {t.sub} <span className={s.opt}>· {t.optional}</span>
            </span>
            <div className={s.chips}>
              {(lang === 'tj' ? C.st : C.sr).map((l, i) => (
                <Pill key={l} on={d.sub === i} onClick={() => set({ sub: d.sub === i ? null : i })}>
                  {l}
                </Pill>
              ))}
            </div>
          </div>
        )}
        {d.cat === 'other' && <div className={s.otherNote}>{t.other}</div>}
        <label className={s.fieldSm}>
          <span className={s.labelRow}>
            {t.title}
            <span className={s.count}>{d.title.length}/120</span>
          </span>
          <input value={d.title} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} placeholder={t.titlePh} className={[s.input, err.title && s.invalid].filter(Boolean).join(' ')} />
          {err.title && <span className={s.err}>{t.errTitle}</span>}
        </label>
        {C && C.er.length > 0 && !d.title && (
          <div className={s.examples}>
            <span className={s.examplesLabel}>{t.examples}</span>
            {(lang === 'tj' ? C.et : C.er).map((l) => (
              <button key={l} type="button" className={s.example} onClick={() => set({ title: l })}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
    );

  if (step === 2)
    return (
      <div className={s.steps}>
        <Q title={t.q2} sub={t.q2sub} />
        <label className={s.fieldSm}>
          <span className={s.labelRow}>
            {t.desc}
            <span className={s.count}>{d.desc.length}/3000</span>
          </span>
          <textarea value={d.desc} onChange={(e) => set({ desc: e.target.value.slice(0, 3000) })} placeholder={t.descPh} rows={6} className={[s.textarea, err.desc && s.invalid].filter(Boolean).join(' ')} />
          {err.desc && <span className={s.err}>{t.errDesc}</span>}
        </label>
        <div className={s.hints}>
          {t.hints.map((h) => (
            <div key={h} className={s.hint}>
              <span className={s.tipDot} />
              {h}
            </div>
          ))}
        </div>
        <div className={s.field}>
          <span className={s.label}>
            {t.photos} <span className={s.opt}>· {t.photosSub}</span>
          </span>
          <div className={s.photoGrid}>
            {photos.map((p) => (
              <div key={p.id} className={s.photo}>
                <img src={p.url} alt="" className={s.photoImg} />
                <button
                  type="button"
                  aria-label={t.removePhoto}
                  className={s.photoX}
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setPhotos((x) => x.filter((y) => y.id !== p.id));
                  }}
                >
                  <X size={16} color="#fff" aria-hidden />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button type="button" className={s.addPhoto} onClick={() => fileRef.current?.click()}>
                <Camera size={22} aria-hidden />
                {t.addPhoto}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPhotos((x) => [...x, ...files.slice(0, 5 - x.length).map((f, i) => ({ id: Date.now() + i, url: URL.createObjectURL(f) }))]);
              e.target.value = '';
            }}
          />
          <span className={s.note}>
            <ShieldCheck size={16} aria-hidden className={s.noShrink} />
            {t.exif}
          </span>
        </div>
      </div>
    );

  if (step === 3)
    return (
      <div className={s.steps}>
        <Q title={t.q3} />
        <div className={s.modes}>
          {(['site', 'online'] as const).map((m, i) => {
            const on = d.mode === m;
            const I = m === 'site' ? MapPin : Globe;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => set({ mode: m })} className={[s.mode, on && s.modeOn].filter(Boolean).join(' ')}>
                <span className={s.modeTitle}>
                  <I size={18} color="var(--brand-600)" aria-hidden />
                  {t.modes[i][0]}
                </span>
                <span className={s.modeSub}>{t.modes[i][1]}</span>
              </button>
            );
          })}
        </div>
        {d.mode === 'site' && (
          <>
            <label className={s.fieldSm}>
              <span className={s.label}>{t.city}</span>
              <select value={d.region} onChange={(e) => set({ region: e.target.value as RegionKey, district: null })} className={s.select}>
                {api.regions().map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name[lang]}
                  </option>
                ))}
              </select>
            </label>
            <div className={s.field}>
              <span className={s.label}>{t.district}</span>
              <div className={s.chips}>
                {api.districts(d.region).map((x) => (
                  <Pill key={x} on={d.district === x} onClick={() => set({ district: x })}>
                    {x}
                  </Pill>
                ))}
              </div>
              {err.district && <span className={s.err}>{t.errDistrict}</span>}
            </div>
            <label className={s.fieldSm}>
              <span className={s.label}>
                {t.addr} <span className={s.opt}>· {t.optional}</span>
              </span>
              <input value={d.addr} onChange={(e) => set({ addr: e.target.value.slice(0, 200) })} placeholder={t.addrPh} className={s.input} />
              <span className={s.note}>
                <Lock size={16} aria-hidden className={s.noShrink} />
                {t.lock}
              </span>
            </label>
          </>
        )}
        <div className={s.field}>
          <span className={s.label}>{t.when}</span>
          <div className={s.chips}>
            {t.whenOpts.map((l, i) => (
              <Pill key={l} on={d.when === i} onClick={() => set({ when: i })}>
                {l}
              </Pill>
            ))}
          </div>
          {d.when === 2 && (
            <input type="date" value={d.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ date: e.target.value })} className={[s.date, err.when === 'd' && s.invalid].filter(Boolean).join(' ')} />
          )}
          {err.when && <span className={s.err}>{err.when === 'd' ? t.errDate : t.errWhen}</span>}
        </div>
        <div className={s.field}>
          <span className={s.label}>
            {t.tod} <span className={s.opt}>· {t.optional}</span>
          </span>
          <div className={s.grid3}>
            {t.todOpts.map((l, i) => (
              <button key={l} type="button" aria-pressed={d.tod === i} onClick={() => set({ tod: d.tod === i ? null : i })} className={[s.todBtn, d.tod === i && s.pillOn].filter(Boolean).join(' ')}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  if (step === 4)
    return (
      <div className={s.steps}>
        <Q title={t.q4} sub={t.q4sub} />
        <div className={s.bSeg}>
          {(['sum', 'neg'] as const).map((m, i) => (
            <button key={m} type="button" aria-pressed={d.bmode === m} onClick={() => set({ bmode: m })} className={[s.bSegBtn, d.bmode === m && s.bSegOn].filter(Boolean).join(' ')}>
              {t.bModes[i]}
            </button>
          ))}
        </div>
        {d.bmode === 'sum' && (
          <>
            <div className={s.budget}>
              {(['bmin', 'bmax'] as const).map((k) => (
                <label key={k} className={[s.money, err.budget && s.invalid].filter(Boolean).join(' ')}>
                  <span className={s.moneyAffix}>{k === 'bmin' ? t.bFrom : t.bTo}</span>
                  <input value={d[k]} onChange={(e) => set({ [k]: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" placeholder="0" className={s.moneyInput} />
                  <span className={s.moneyAffix}>{t.cur}</span>
                </label>
              ))}
            </div>
            {err.budget && <span className={s.errTight}>{err.budget === 'r' ? t.errRange : t.errBudget}</span>}
            {C?.p && (
              <span className={s.bHint}>
                <TrendingUp size={18} aria-hidden className={s.noShrink} />
                {t.bHint(C.p)}
              </span>
            )}
          </>
        )}
        {narrow && (
          <div className={s.check}>
            <span className={s.overline}>{t.check}</span>
            <span className={s.checkTitle}>{pv.title}</span>
            <span className={s.pvCat}>{pv.cat}</span>
            {pv.rows.map((r, i) => (
              <span key={i} className={s.pvRow}>
                {r.icon}
                {r.text}
              </span>
            ))}
          </div>
        )}
        <div className={s.noPay}>
          <Info size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />
          <span>{lang === 'tj' ? 'eKor пардохтро қабул намекунад. Нарх ва пардохтро мустақиман бо усто мувофиқа мекунед.' : 'eKor не принимает оплату. Цену и оплату вы согласуете напрямую с мастером.'}</span>
        </div>
        <span className={s.rules}>{t.rules}</span>
      </div>
    );

  if (step === 'phone')
    return (
      <div className={s.steps}>
        <div className={s.savedPill}>
          <Check size={16} aria-hidden />
          {t.saved}
        </div>
        <Q title={t.phoneQ} sub={t.phoneSub} />
        <div className={s.narrowField}>
          <PhoneField value={auth.phone} onChange={auth.setPhone} error={auth.phoneErr === 'len' ? t.errPhone : auth.phoneErr === 'op' ? t.errOp : undefined} autoFocus />
        </div>
        <div className={s.narrowField}>
          <TestCodeNotice step="phone" />
        </div>
        <span className={s.note}>
          <Lock size={16} aria-hidden className={s.noShrink} />
          {t.phonePriv}
        </span>
        <span className={s.terms}>{t.terms}</span>
      </div>
    );

  if (step === 'code')
    return (
      <div className={s.steps}>
        <Q
          title={t.codeQ}
          sub={
            <>
              {t.codeSent} <b className={s.ink}>+992 {phoneMask(auth.phone)}</b> ·{' '}
              <button type="button" className={s.link} onClick={auth.backPhone}>
                {t.change}
              </button>
            </>
          }
        />
        <div className={s.narrowField}>
          <OtpInput value={auth.code} onChange={auth.setCode} error={auth.codeErr} autoFocus disabled={auth.tries === 0} />
        </div>
        {auth.codeErr && <span className={s.errTight}>{t.errCode(auth.tries)}</span>}
        {auth.timer > 0 ? (
          <span className={s.muted}>
            {t.resendIn} 0:{String(auth.timer).padStart(2, '0')}
          </span>
        ) : (
          <button type="button" className={s.resend} onClick={auth.resend}>
            {t.resend}
          </button>
        )}
        <div className={s.narrowField}>
          <TestCodeNotice step="code" onFill={auth.setCode} />
        </div>
      </div>
    );

  if (step === 'name')
    return (
      <div className={s.steps}>
        <Q title={t.nameQ} />
        <div className={s.narrowField}>
          <TextField big value={auth.name} onChange={(e) => auth.setName(e.target.value.slice(0, 40))} placeholder={t.namePh} autoComplete="given-name" error={auth.nameErr ? t.errName : undefined} autoFocus />
        </div>
        <span className={s.muted}>{t.nameNote}</span>
      </div>
    );

  // done
  return (
    <div className={s.steps}>
      <div className={s.done}>
        <div className={s.doneIco}>
          <Check size={30} color="var(--success-700)" aria-hidden />
        </div>
        <Q title={t.doneQ} />
        <span className={s.badgeNeutralLg}>{t.pending}</span>
        <div className={s.doneBody}>{t.doneBody}</div>
      </div>
      <div className={s.timeline}>
        {t.tl.map(([title, sub], i) => (
          <div key={title} className={s.tlRow}>
            <div className={s.tlRail}>
              <span className={i === 0 ? s.tlDotCur : s.tlDot}>{i + 1}</span>
              {i < t.tl.length - 1 && <span className={s.tlLine} />}
            </div>
            <div className={s.tlText}>
              <span className={i === 0 ? s.tlTitle : s.tlTitleOff}>{title}</span>
              <span className={s.tlSub}>{sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={s.tipBox}>
        <Bell size={18} aria-hidden className={s.noShrink} />
        <span>{t.tip}</span>
      </div>
      <div className={s.doneBtns}>
        <Link href="/client" className={s.doneMain}>
          {t.myTasks}
        </Link>
        <button type="button" className={s.doneSec} onClick={onRestart}>
          {t.again}
        </button>
      </div>
    </div>
  );
}

function Q({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className={s.q}>
      <h2 className={s.qTitle}>{title}</h2>
      {sub && <div className={s.qSub}>{sub}</div>}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={[s.pill, on && s.pillOn].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}
