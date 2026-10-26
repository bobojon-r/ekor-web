'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleCheck, Info, Lock } from 'lucide-react';
import { api, invites, type Master } from '@/lib/api';
import { phoneMask, useDict } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { Button, OtpInput, PhoneField, Sheet, TestCodeNotice, TextField } from '@/components/ui';
import { inviteDict } from './i18n';
import s from './Invite.module.css';

type Step = 'form' | 'phone' | 'code' | 'name' | 'done';
type Err = Partial<Record<'title' | 'desc' | 'when' | 'budget', true>>;

/** Шторка «Предложить работу» (InviteFlow): форма → телефон → код → отправлено */
export function InviteSheet({ master, open, onClose }: { master: Master; open: boolean; onClose: () => void }) {
  const t = useDict(inviteDict);
  const router = useRouter();
  const { user, signIn } = useSession();
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [when, setWhen] = useState<number | null>(null);
  const [budget, setBudget] = useState('');
  const [neg, setNeg] = useState(false);
  const [err, setErr] = useState<Err>({});
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<'len' | 'op' | null>(null);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);
  const [tries, setTries] = useState(3);
  const [timer, setTimer] = useState(0);
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  useEffect(() => {
    if (step !== 'code' || timer <= 0) return;
    const id = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [step, timer]);

  const create = async (clientName: string) => {
    setSending(true);
    const inv = await invites.create({
      masterId: master.id,
      clientName,
      title: title.trim(),
      desc: desc.trim(),
      when: when ?? 3,
      budget: neg ? null : Number(budget),
      region: master.region ?? 'dushanbe',
      district: master.district ?? '',
      category: master.profession,
    });
    setSending(false);
    setCreatedId(inv.id);
    setStep('done');
  };
  const shortName = (n: string) => {
    const [a, b] = n.split(' ');
    return b ? `${a} ${b[0]}.` : a;
  };

  const submitForm = () => {
    const e: Err = {};
    if (title.trim().length < 10) e.title = true;
    if (desc.trim().length < 30) e.desc = true;
    if (when === null) e.when = true;
    if (!neg && !(Number(budget) > 0)) e.budget = true;
    setErr(e);
    if (Object.keys(e).length) return;
    if (user) create(shortName(user.name));
    else setStep('phone');
  };

  const submitPhone = async () => {
    const pe = api.auth.validPhone(phone);
    if (pe) return setPhoneErr(pe);
    setSending(true);
    const r = await api.auth.sendCode(phone);
    setSending(false);
    setCode('');
    setTries(r.tries);
    setTimer(r.resendIn);
    setStep('code');
  };

  const submitCode = async () => {
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
      return create(shortName(r.name));
    }
    setStep('name');
  };

  const submitName = () => {
    if (name.trim().length < 2) return setNameErr(true);
    signIn({ id: `u${phone}`, name: name.trim(), phone, roles: ['client'], activeRole: 'client' });
    create(shortName(name.trim()));
  };

  const stepNo = step === 'form' ? 1 : step === 'phone' ? 2 : step === 'code' || step === 'name' ? 3 : null;
  const head = step === 'phone' ? t.phoneHead : step === 'code' ? t.codeHead : step === 'name' ? t.nameHead : step === 'done' ? t.doneTitle : t.head;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={520}
      closeLabel={t.close}
      title={
        <div className={s.sheetHead}>
          {stepNo && <span className={s.stepLabel}>{t.step(stepNo)}</span>}
          <span>{head}</span>
        </div>
      }
    >
      {step === 'form' && (
        <div className={s.flow}>
          <div className={s.toMaster}>
            <span className={s.avSm} />
            {t.to} {master.name}
          </div>
          <TextField label={t.fTitle} value={title} onChange={(e) => (setTitle(e.target.value.slice(0, 120)), setErr({}))} placeholder={t.titlePh} error={err.title && t.errTitle} />
          <label className={s.fieldCol}>
            <span className={s.labelRow}>
              {t.fDesc}
              <span className={s.count}>{desc.length}/1000</span>
            </span>
            <textarea value={desc} onChange={(e) => (setDesc(e.target.value.slice(0, 1000)), setErr({}))} placeholder={t.descPh} rows={4} className={[s.textarea, err.desc && s.invalid].filter(Boolean).join(' ')} />
            {err.desc && <span className={s.err}>{t.errDesc}</span>}
          </label>
          <div className={s.fieldCol8}>
            <span className={s.label}>{t.fWhen}</span>
            <div className={s.chips}>
              {t.when.map((l, i) => (
                <button key={l} type="button" aria-pressed={when === i} onClick={() => (setWhen(i), setErr({}))} className={[s.pill, when === i && s.pillOn].filter(Boolean).join(' ')}>
                  {l}
                </button>
              ))}
            </div>
            {err.when && <span className={s.err}>{t.errWhen}</span>}
          </div>
          <div className={s.fieldCol8}>
            <span className={s.label}>{t.fBudget}</span>
            <div className={s.budgetRow}>
              <input
                value={neg ? '' : budget}
                disabled={neg}
                onChange={(e) => (setBudget(e.target.value.replace(/\D/g, '').slice(0, 6)), setErr({}))}
                inputMode="numeric"
                placeholder={t.budgetPh}
                className={[s.input, err.budget && s.invalid].filter(Boolean).join(' ')}
              />
              <button type="button" aria-pressed={neg} onClick={() => (setNeg(!neg), setErr({}))} className={[s.negBtn, neg && s.pillOn].filter(Boolean).join(' ')}>
                {neg && <Check size={16} aria-hidden />}
                {t.neg}
              </button>
            </div>
            {err.budget && <span className={s.err}>{t.errBudget}</span>}
          </div>
          <div className={s.notes}>
            <div className={s.noteRow}>
              <Lock size={16} aria-hidden className={s.noShrink} />
              <span>{t.privacy}</span>
            </div>
            <div className={s.noteRow}>
              <Info size={16} aria-hidden className={s.noShrink} />
              <span>{t.noPayShort}</span>
            </div>
          </div>
          <Button size="lg" block busy={sending} onClick={submitForm}>
            {t.next}
          </Button>
        </div>
      )}

      {step === 'phone' && (
        <div className={s.flowSm}>
          <div className={s.savedPill}>
            <Check size={16} aria-hidden />
            {t.draft}
          </div>
          <div className={s.muted15}>{t.phoneHint}</div>
          <PhoneField value={phone} onChange={(v) => (setPhone(v), setPhoneErr(null))} error={phoneErr === 'len' ? t.errPhone : phoneErr === 'op' ? t.errOp : undefined} autoFocus />
          <TestCodeNotice step="phone" />
          <Button size="lg" block busy={sending} onClick={submitPhone}>
            {t.getCode}
          </Button>
          <div className={s.terms}>{t.terms}</div>
        </div>
      )}

      {step === 'code' && (
        <div className={s.flowSm}>
          <div className={s.muted15}>
            {t.codeSent} <b className={s.ink}>+992 {phoneMask(phone)}</b> ·{' '}
            <button type="button" className={s.link} onClick={() => setStep('phone')}>
              {t.change}
            </button>
          </div>
          <OtpInput value={code} onChange={(v) => (setCode(v), setCodeErr(false))} error={codeErr} autoFocus disabled={tries === 0} />
          {codeErr && <span className={s.errTight}>{t.errCode(tries)}</span>}
          {timer > 0 ? (
            <span className={s.muted14}>
              {t.resendIn} 0:{String(timer).padStart(2, '0')}
            </span>
          ) : (
            <button
              type="button"
              className={s.resend}
              onClick={async () => {
                await api.auth.sendCode(phone);
                setTries(3);
                setTimer(60);
                setCodeErr(false);
              }}
            >
              {t.resend}
            </button>
          )}
          <Button size="lg" block busy={sending} onClick={submitCode}>
            {t.confirm}
          </Button>
          <TestCodeNotice step="code" onFill={(v) => (setCode(v), setCodeErr(false))} />
        </div>
      )}

      {step === 'name' && (
        <div className={s.flowSm}>
          <TextField big value={name} onChange={(e) => (setName(e.target.value.slice(0, 40)), setNameErr(false))} placeholder={t.namePh} autoComplete="given-name" error={nameErr ? t.errName : undefined} hint={t.nameNote} autoFocus />
          <Button size="lg" block busy={sending} onClick={submitName}>
            {t.confirm}
          </Button>
        </div>
      )}

      {step === 'done' && (
        <div className={s.done}>
          <div className={s.doneIco}>
            <CircleCheck size={30} color="var(--success-700)" aria-hidden />
          </div>
          <div className={s.doneTitle}>{t.doneTitle}</div>
          <div className={s.doneBody}>{t.done(master.name)}</div>
          <div className={s.doneBtns}>
            <Button size="lg" block onClick={() => createdId && router.push(`/client/invites/${createdId}`)}>
              {t.myTasks}
            </Button>
            <Button size="lg" block variant="secondary" onClick={onClose}>
              {t.close}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
