'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Check, ChevronLeft, Clock, Globe, HandCoins, Hourglass, Info, ListChecks, MapPin, Search, Star, Wrench } from 'lucide-react';
import { apiErrorText, masterProfile, USE_API } from '@/lib/api';
import { initials, num, useDict, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { Button, ButtonLink, LangSwitch, Switch, useToast } from '@/components/ui';
import { cities, profs, onboardDict } from './i18n';
import { track } from '@/lib/api/events';
import s from './Onboard.module.css';

type T = (typeof onboardDict)['ru'];
type Step = 0 | 1 | 2 | 3 | 4 | 5;
type Form = { profs: string[]; q: string; city: string; cityOpen: boolean; areas: string[]; online: boolean; prices: Record<string, string>; neg: Record<string, boolean>; exp: number | null; about: string; showPhone: boolean; agree: boolean };
type Err = Record<string, boolean>;

const F0: Form = { profs: [], q: '', city: 'Душанбе', cityOpen: false, areas: [], online: false, prices: {}, neg: {}, exp: null, about: '', showPhone: false, agree: false };
const DRAFT = 'ekor_master_draft';

export function BecomeMaster() {
  const t = useDict(onboardDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  useEffect(() => track('master_signup_started'), []);
  const { user, ready, update, switchRole } = useSession();
  const [step, setStep] = useState<Step>(0);
  const [f, setF] = useState<Form>(F0);
  const [err, setErr] = useState<Err>({});
  const [sending, setSending] = useState(false);
  const [approved, setApproved] = useState(false);

  // Черновик сохраняется автоматически; если профиль уже отправлен — сразу экран статуса
  useEffect(() => {
    if (!ready) return;
    if (!user) return restoreDraft();
    let live = true;
    masterProfile.load().then(
      (prof) => {
        if (!live) return;
        if (prof) {
          setStep(5);
          setApproved(prof.status === 'approved');
          return;
        }
        restoreDraft();
      },
      () => live && restoreDraft(),
    );
    return () => {
      live = false;
    };
  }, [ready, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT);
      if (raw) {
        const d = JSON.parse(raw);
        setF({ ...F0, ...d.f });
        setStep(d.step);
      }
    } catch {}
  };
  useEffect(() => {
    if (step >= 1 && step <= 4)
      try {
        localStorage.setItem(DRAFT, JSON.stringify({ f, step }));
      } catch {}
  }, [f, step]);

  const set = (p: Partial<Form>, clear?: string) => {
    setF((x) => ({ ...x, ...p }));
    if (clear) setErr((e) => ({ ...e, [clear]: false }));
  };
  const pName = (id: string) => {
    const p = profs().find((x) => x[0] === id);
    return p ? p[lang === 'tj' ? 2 : 1] : id;
  };
  const priceOf = (id: string) => (f.neg[id] ? t.neg : +f.prices[id] > 0 ? `${t.from} ${num(+f.prices[id])} смн` : '—');
  const areasTxt = [...f.areas, ...(f.online ? [t.onlineW] : [])].join(', ') || '—';
  const name = user?.name ?? (lang === 'tj' ? 'Номи шумо' : 'Ваше имя');

  const validate = (): Err => {
    const e: Err = {};
    if (step === 1 && !f.profs.length) e.profs = true;
    if (step === 2 && !f.areas.length && !f.online) e.areas = true;
    if (step === 3) {
      f.profs.forEach((p) => {
        if (!f.neg[p] && !(+f.prices[p] > 0)) e['p_' + p] = true;
      });
      if (f.exp === null) e.exp = true;
      if (f.about.trim().length < 30) e.about = true;
    }
    if (step === 4 && !f.agree) e.agree = true;
    return e;
  };

  const next = async () => {
    if (sending) return;
    if (step === 0) {
      if (ready && !user) return router.push('/login?next=/become-master');
      return setStep(1);
    }
    const e = validate();
    setErr(e);
    if (Object.keys(e).length) return;
    if (step === 4) {
      setSending(true);
      try {
        await masterProfile.submit({
        profs: f.profs,
        city: f.city,
        areas: f.areas,
        online: f.online,
        prices: Object.fromEntries(f.profs.map((p) => [p, f.neg[p] ? null : +f.prices[p]])),
        exp: f.exp!,
        about: f.about.trim(),
        showPhone: f.showPhone,
        });
      } catch (e) {
        setSending(false);
        return toast(apiErrorText(e, lang));
      }
      try {
        localStorage.removeItem(DRAFT);
      } catch {}
      setSending(false);
      setStep(5);
      window.scrollTo({ top: 0 });
      return;
    }
    setStep((step + 1) as Step);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setErr({});
    setStep(Math.max(0, step - 1) as Step);
  };
  const approve = () => {
    masterProfile.approve();
    if (user) update({ roles: Array.from(new Set([...user.roles, 'master' as const])) });
    setApproved(true);
  };

  const titles: [string, string][] = [['', ''], [t.s1T, t.s1S], [t.s2T, t.s2S], [t.s3T, t.s3S], [t.s4T, t.s4S]];
  const isForm = step >= 1 && step <= 4;
  const btnLabel = step === 4 ? t.submit : t.next;
  const q = f.q.trim().toLowerCase();

  const body: ReactNode = (
    <>
      {step === 1 && (
        <>
          <label className={s.search}>
            <Search size={20} color="var(--ink-500)" aria-hidden />
            <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t.search} className={s.searchInput} />
          </label>
          <div className={s.picked} style={{ color: f.profs.length === 3 ? 'var(--brand-700)' : 'var(--ink-500)' }}>
            {t.picked(f.profs.length)}
          </div>
          <div className={s.chips}>
            {profs().filter((p) => !q || p[1].toLowerCase().includes(q) || p[2].toLowerCase().includes(q)).map(([id, ru, tj]) => {
              const on = f.profs.includes(id);
              return (
                <Chip
                  key={id}
                  on={on}
                  onClick={() => {
                    if (on) return set({ profs: f.profs.filter((x) => x !== id) });
                    if (f.profs.length >= 3) return toast(t.max3, 'info');
                    set({ profs: [...f.profs, id] }, 'profs');
                  }}
                >
                  {lang === 'tj' ? tj : ru}
                </Chip>
              );
            })}
          </div>
          {err.profs && <div className={s.err}>{t.errProfs}</div>}
          <div className={s.muted14}>{t.noFound}</div>
        </>
      )}

      {step === 2 && (
        <>
          <div className={s.box}>
            <MapPin size={20} color="var(--brand-600)" aria-hidden />
            <div className={s.boxText}>
              <span className={s.muted14}>{t.city}</span>
              <span className={s.boxTitle}>{f.city}</span>
            </div>
            <button type="button" className={s.linkBtn} onClick={() => set({ cityOpen: !f.cityOpen })}>
              {t.changeCity}
            </button>
          </div>
          {f.cityOpen && (
            <div className={s.chips}>
              {Object.keys(cities()).map((c) => (
                <Chip key={c} on={f.city === c} small onClick={() => set({ city: c, areas: [], cityOpen: false })}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
          <div className={s.group}>
            <span className={s.label}>{t.districts}</span>
            <div className={s.chips}>
              {(cities()[f.city] ?? []).map(([a, near]) => {
                const on = f.areas.includes(a);
                return (
                  <Chip key={a} on={on} onClick={() => set({ areas: on ? f.areas.filter((x) => x !== a) : [...f.areas, a] }, 'areas')}>
                    {a}
                    {!!near && <span className={s.near}>{t.near}</span>}
                  </Chip>
                );
              })}
            </div>
          </div>
          <div className={s.box}>
            <Globe size={20} color="var(--brand-600)" aria-hidden />
            <div className={s.boxText}>
              <span className={s.boxTitle}>{t.online}</span>
              <span className={s.muted14}>{t.onlineSub}</span>
            </div>
            <Switch checked={f.online} onChange={(v) => set({ online: v }, 'areas')} label={t.online} />
          </div>
          {err.areas && <div className={s.err}>{t.errAreas}</div>}
        </>
      )}

      {step === 3 && (
        <>
          <div className={s.prices}>
            {f.profs.map((id) => {
              const neg = !!f.neg[id];
              const bad = err['p_' + id];
              return (
                <div key={id} className={s.priceRow} style={{ borderColor: bad ? 'var(--danger-600)' : undefined }}>
                  <span className={s.priceName}>{pName(id)}</span>
                  <label className={[s.priceBox, neg && s.off].filter(Boolean).join(' ')}>
                    <span className={s.affix}>{t.from}</span>
                    <input value={neg ? '' : (f.prices[id] ?? '')} disabled={neg} inputMode="numeric" placeholder="50" onChange={(e) => set({ prices: { ...f.prices, [id]: e.target.value.replace(/\D/g, '').slice(0, 5) } }, 'p_' + id)} className={s.priceInput} />
                    <span className={s.affix}>смн</span>
                  </label>
                  <button type="button" aria-pressed={neg} onClick={() => set({ neg: { ...f.neg, [id]: !neg } }, 'p_' + id)} className={[s.negBtn, neg && s.on].filter(Boolean).join(' ')}>
                    {neg && <Check size={16} aria-hidden />}
                    {t.neg}
                  </button>
                  {bad && <span className={s.errFull}>{t.errPrice}</span>}
                </div>
              );
            })}
          </div>
          <div className={s.group}>
            <span className={s.label}>{t.expT}</span>
            <div className={s.expGrid}>
              {t.exp.map((l, i) => (
                <button key={l} type="button" aria-pressed={f.exp === i} onClick={() => set({ exp: i }, 'exp')} className={[s.expBtn, f.exp === i && s.on].filter(Boolean).join(' ')}>
                  {l}
                </button>
              ))}
            </div>
            {err.exp && <span className={s.err}>{t.errExp}</span>}
          </div>
          <label className={s.group8}>
            <span className={s.label}>{t.aboutT}</span>
            <textarea value={f.about} onChange={(e) => set({ about: e.target.value.slice(0, 600) }, 'about')} placeholder={t.aboutPh} rows={5} className={[s.textarea, err.about && s.invalid].filter(Boolean).join(' ')} />
            <span className={s.msgRow}>
              <span className={s.err}>{err.about ? t.errAbout : ''}</span>
              <span className={s.muted13}>{f.about.length} / 600</span>
            </span>
          </label>
        </>
      )}

      {step === 4 && (
        <>
          <PreviewCard t={t} name={name} profLine={`${f.profs.map(pName).join(' · ') || '—'} · ${f.city}`} priceLine={f.profs.map((id) => `${pName(id)} — ${priceOf(id)}`).join(' · ') || '—'} className="mob-only" />
          <div className={s.summary}>
            {[
              { label: t.sumProfs, value: f.profs.map((id) => `${pName(id)} — ${priceOf(id)}`).join('; ') || '—', to: 1 },
              { label: t.sumAreas, value: `${f.city}: ${areasTxt}`, to: 2 },
              { label: t.sumExp, value: f.exp === null ? '—' : t.exp[f.exp], to: 3 },
              { label: t.sumAbout, value: f.about.trim() || '—', to: 3 },
            ].map((r) => (
              <div key={r.label} className={s.sumRow}>
                <span className={s.sumLabel}>{r.label}</span>
                <span className={s.sumValue}>{r.value}</span>
                <button type="button" className={s.linkBtn} onClick={() => setStep(r.to as Step)}>
                  {t.edit}
                </button>
              </div>
            ))}
          </div>
          <div className={s.box}>
            <div className={s.boxText}>
              <span className={s.boxTitle}>{t.showPhone}</span>
              <span className={s.muted14}>{f.showPhone ? t.phoneOn : t.phoneOff}</span>
            </div>
            <Switch checked={f.showPhone} onChange={(v) => set({ showPhone: v })} label={t.showPhone} />
          </div>
          <button type="button" role="checkbox" aria-checked={f.agree} className={s.agree} onClick={() => set({ agree: !f.agree }, 'agree')}>
            <span className={s.cb} style={{ borderColor: f.agree ? 'var(--brand-600)' : err.agree ? 'var(--danger-600)' : 'var(--checkbox-off)', background: f.agree ? 'var(--brand-600)' : 'var(--white)' }}>
              {f.agree && <Check size={16} color="#fff" aria-hidden />}
            </span>
            <span>{t.agree}</span>
          </button>
          {err.agree && <div className={s.errTight}>{t.errAgree}</div>}
          <div className={`${s.noPay} mob-only`}>
            <Info size={18} aria-hidden className={s.noShrink} />
            <span>{t.noPay}</span>
          </div>
        </>
      )}
    </>
  );

  /* ---------- вступление ---------- */
  const introPts = [HandCoins, ListChecks, Star].map((I, i) => ({ I, text: t.introPts[i] }));
  if (step === 0)
    return (
      <div className={s.page}>
        <Header t={t} />
        <div className={`${s.mIntroTop} mob-only`}>
          <Link href="/" className={s.mLogo}>
            eKor
          </Link>
          <LangSwitch />
        </div>
        <div className={s.intro}>
          <div className={s.introArt}>
            <Wrench aria-hidden className={s.wrench} color="var(--brand-600)" />
          </div>
          <div className={s.introText}>
            <h1 className={s.introT}>{t.introT}</h1>
            <p className={s.introB}>{t.introB}</p>
            <div className={s.pts}>
              {introPts.map(({ I, text }) => (
                <div key={text} className={s.pt}>
                  <span className={s.ptIco}>
                    <I size={18} color="var(--success-700)" aria-hidden />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className={s.introCta}>
              <Button size="lg" className={s.startBtn} onClick={next}>
                {t.start}
              </Button>
              <span className={s.introNote}>{t.introNote}</span>
            </div>
          </div>
        </div>
      </div>
    );

  /* ---------- готово ---------- */
  if (step === 5) {
    const pending = !approved;
    return (
      <div className={s.page}>
        <Header t={t} />
        <div className={s.doneWrap}>
          <div className={s.doneCard}>
            <span className={s.doneIco} style={{ background: pending ? 'var(--warn-100)' : 'var(--success-100)' }}>
              {pending ? <Hourglass size={34} color="var(--warn-800)" aria-hidden /> : <BadgeCheck size={36} color="var(--success-700)" aria-hidden />}
            </span>
            <div className={s.doneHead}>
              <h1 className={s.doneT}>{pending ? t.doneT : t.apprT}</h1>
              <p className={s.doneB}>{pending ? t.doneB : t.apprB}</p>
            </div>
            <div className={s.timeline}>
              {t.tl.map((l, i) => {
                const done = i === 0 || !pending;
                const cur = i === 1 && pending;
                return (
                  <div key={l} className={s.tlItem} style={{ color: done || cur ? 'var(--ink-900)' : 'var(--ink-400)', fontWeight: cur ? 600 : 400 }}>
                    <span className={s.tlDot} style={{ background: done ? 'var(--success-600)' : cur ? 'var(--warn-600)' : 'var(--stepper-off)' }}>
                      {done && <Check size={14} color="#fff" aria-hidden />}
                    </span>
                    {l}
                  </div>
                );
              })}
            </div>
            {pending && (
              <>
                <div className={s.pendingNote}>
                  <Clock size={18} aria-hidden className={s.noShrink} />
                  <span>{t.doneWhile}</span>
                </div>
                {!USE_API && (
                  <button type="button" className={s.demoBtn} onClick={approve}>
                    {t.simApprove}
                  </button>
                )}
              </>
            )}
            <div className={s.doneBtns}>
              <ButtonLink href="/tasks" size="lg" block>
                {t.seeTasks}
              </ButtonLink>
              {approved ? (
                <Button
                  variant="secondary"
                  size="lg"
                  block
                  onClick={() => {
                    switchRole('master');
                    router.push('/master');
                  }}
                >
                  {lang === 'tj' ? 'Кабинети усто' : 'Кабинет мастера'}
                </Button>
              ) : (
                <ButtonLink href="/master/settings" variant="secondary" size="lg" block>
                  {t.settings}
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- шаги 1–4 ---------- */
  return (
    <div className={s.page}>
      <Header t={t} />
      <div className={`${s.mTop} mob-only`}>
        <div className={s.mTopRow}>
          <button type="button" className={s.iconBtn} onClick={back} aria-label={t.back}>
            <ChevronLeft size={24} aria-hidden />
          </button>
          <span className={s.stepOf}>{t.stepOf(step)}</span>
          <LangSwitch />
        </div>
        <div className={s.bars}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={s.bar} style={{ background: n <= step ? 'var(--brand-600)' : 'var(--stepper-off)' }} />
          ))}
        </div>
      </div>

      <div className={s.formWrap}>
        <div className={s.formCol}>
          <div className={`${s.stepper} desk-only`}>
            {t.steps.map((l, i) => {
              const n = i + 1;
              const done = n < step;
              const cur = n === step;
              return (
                <button key={l} type="button" disabled={!done} onClick={() => done && setStep(n as Step)} className={s.stepBtn}>
                  <span className={s.stepBar} style={{ background: n <= step ? 'var(--brand-600)' : 'var(--stepper-off)' }} />
                  <span className={s.stepLabel} style={{ color: cur ? 'var(--ink-900)' : 'var(--ink-500)', fontWeight: cur ? 600 : 500 }}>
                    <span className={s.stepDot} style={{ background: done || cur ? 'var(--brand-600)' : 'var(--stepper-off)', color: done || cur ? '#fff' : 'var(--ink-500)' }}>
                      {done ? <Check size={13} aria-hidden /> : n}
                    </span>
                    {l}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={s.card}>
            <div className={s.heading}>
              <h1 className={s.title}>{isForm ? titles[step][0] : ''}</h1>
              <p className={s.sub}>{isForm ? titles[step][1] : ''}</p>
            </div>
            {body}
            <div className={`${s.dFoot} desk-only`}>
              <Button variant="secondary" size="lg" onClick={back}>
                {t.back}
              </Button>
              <span className={s.draft}>{t.draft}</span>
              <Button size="lg" busy={sending} onClick={next}>
                {btnLabel}
              </Button>
            </div>
            <div className={`${s.draft} ${s.center} mob-only`}>{t.draft}</div>
          </div>
        </div>
        <aside className={`${s.aside} desk-only`}>
          <PreviewCard t={t} name={name} profLine={`${f.profs.map(pName).join(' · ') || '—'} · ${f.city}`} priceLine={f.profs.map((id) => `${pName(id)} — ${priceOf(id)}`).join(' · ') || '—'} withLabel />
          <div className={s.noPay}>
            <Info size={18} aria-hidden className={s.noShrink} />
            <span>{t.noPay}</span>
          </div>
        </aside>
      </div>

      <div className={`${s.mBar} mob-only`}>
        <Button size="lg" block busy={sending} onClick={next}>
          {btnLabel}
        </Button>
      </div>
    </div>
  );
}

function Header({ t }: { t: T }) {
  const { user } = useSession();
  return (
    <>
      <header className={`${s.dHeader} desk-only`}>
        <div className={s.dHeaderIn}>
          <Link href="/" className={s.logo}>
            eKor
          </Link>
          <span className={s.muted15}>{t.becomeMaster}</span>
          <span className={s.grow} />
          <LangSwitch />
          {user && <span className={s.me}>{initials(user.name)}</span>}
        </div>
      </header>
    </>
  );
}

function PreviewCard({ t, name, profLine, priceLine, withLabel, className }: { t: T; name: string; profLine: string; priceLine: string; withLabel?: boolean; className?: string }) {
  return (
    <div className={[s.preview, className].filter(Boolean).join(' ')}>
      {withLabel && <span className={s.overline}>{t.preview}</span>}
      <div className={s.pvRow}>
        <span className={s.pvAv}>{initials(name)}</span>
        <div className={s.pvText}>
          <span className={s.pvName}>{name}</span>
          <span className={s.pvProf}>{profLine}</span>
          <span className={s.muted13}>{t.noReviews}</span>
        </div>
      </div>
      <div className={s.pvPrice}>{priceLine}</div>
    </div>
  );
}

function Chip({ on, onClick, children, small }: { on: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={[s.chip, small && s.chipSm, on && s.on].filter(Boolean).join(' ')}>
      {on && <Check size={16} aria-hidden />}
      {children}
    </button>
  );
}
