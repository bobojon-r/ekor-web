'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { phoneMask, useDict } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useSession } from '@/lib/session/SessionProvider';
import { Button, ButtonLink, LangSwitch, OtpInput, PhoneField, TestCodeNotice, TextField, useToast } from '@/components/ui';
import s from './Login.module.css';

const dict = {
  ru: {
    phoneT: 'Вход в eKor', phoneS: 'Введите номер — пришлём SMS-код. Пароль не нужен.', phoneL: 'Номер телефона', phoneHint: '9 цифр, например 93 512 44 07',
    errLen: 'Введите номер полностью — 9 цифр', errOp: 'Проверьте код оператора: номер в Таджикистане начинается, например, с 90, 93, 98, 55',
    privacy: 'Номер не виден другим людям. Мастер увидит его, только когда вы его выберете.', getCode: 'Получить код',
    terms: 'Нажимая «Получить код», вы принимаете Правила eKor и Политику конфиденциальности.',
    codeT: 'Введите код из SMS', codeS: (p: string) => `Отправили на +992 ${p}.`, changeNum: 'Изменить номер', checking: 'Проверяем…',
    errCode: (n: number) => (n > 0 ? `Неверный код. Осталось попыток: ${n}` : 'Попытки закончились. Запросите новый код'),
    timer: (sec: number) => `Новый код можно запросить через 0:${String(sec).padStart(2, '0')}`,
    resend: 'Отправить код ещё раз',
    nameT: 'Как к вам обращаться?', nameS: 'Имя увидят мастера и клиенты. Спросим один раз.', nameL: 'Имя', namePh: 'Например, Мадина', nameErr: 'Введите имя — от 2 букв', save: 'Продолжить',
    hello: (n: string) => `Добро пожаловать, ${n}!`, doneB: 'Вы вошли. Черновик задания, если он был, сохранился — можно продолжить с того же места.', toHome: 'На главную', cont: 'Продолжить',
  },
  tj: {
    phoneT: 'Ворид шудан ба eKor', phoneS: 'Рақамро ворид кунед — рамзи SMS мефиристем. Парол лозим нест.', phoneL: 'Рақами телефон', phoneHint: '9 рақам, масалан 93 512 44 07',
    errLen: 'Рақамро пурра ворид кунед — 9 рақам', errOp: 'Рамзи операторро санҷед: рақам дар Тоҷикистон, масалан, бо 90, 93, 98, 55 сар мешавад',
    privacy: 'Рақам ба дигарон намоён нест. Усто онро танҳо вақте мебинад, ки шумо ӯро интихоб кунед.', getCode: 'Гирифтани рамз',
    terms: 'Бо пахш кардани «Гирифтани рамз» шумо Қоидаҳои eKor ва Сиёсати махфиятро қабул мекунед.',
    codeT: 'Рамзи SMS-ро ворид кунед', codeS: (p: string) => `Ба +992 ${p} фиристодем.`, changeNum: 'Иваз кардани рақам', checking: 'Месанҷем…',
    errCode: (n: number) => (n > 0 ? `Рамз нодуруст. Кӯшишҳои боқимонда: ${n}` : 'Кӯшишҳо тамом шуданд. Рамзи навро дархост кунед'),
    timer: (sec: number) => `Рамзи навро баъд аз 0:${String(sec).padStart(2, '0')} дархост кардан мумкин`,
    resend: 'Боз фиристодани рамз',
    nameT: 'Шуморо чӣ гуна номем?', nameS: 'Номро устоҳо ва мизоҷон мебинанд. Як бор мепурсем.', nameL: 'Ном', namePh: 'Масалан, Мадина', nameErr: 'Номро ворид кунед — аз 2 ҳарф', save: 'Идома додан',
    hello: (n: string) => `Хуш омадед, ${n}!`, doneB: 'Шумо ворид шудед. Сиёҳнависи супориш, агар буд, нигоҳ дошта шуд — аз ҳамон ҷо идома диҳед.', toHome: 'Ба саҳифаи асосӣ', cont: 'Идома додан',
  },
};

type Step = 'phone' | 'code' | 'name' | 'done';

/** next — куда вернуть после входа (например, к недописанному заданию) */
export function LoginView({ next }: { next?: string }) {
  const t = useDict(dict);
  const c = useDict(common);
  const router = useRouter();
  const { signIn } = useSession();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<'len' | 'op' | null>(null);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);
  const [tries, setTries] = useState(3);
  const [timer, setTimer] = useState(60);
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  useEffect(() => {
    if (step !== 'code' || timer <= 0) return;
    const id = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [step, timer]);

  const submitPhone = async () => {
    if (sending) return;
    const err = api.auth.validPhone(phone);
    if (err) return setPhoneErr(err);
    setSending(true);
    const r = await api.auth.sendCode(phone);
    setSending(false);
    if (r.error) return toast(r.error);
    setCode('');
    setCodeErr(false);
    setTries(r.tries);
    setTimer(r.resendIn);
    setStep('code');
  };

  const onCode = async (v: string) => {
    if (checking || tries === 0) return;
    setCode(v);
    setCodeErr(false);
    if (v.length < 6) return;
    setChecking(true);
    const r = await api.auth.verify(phone, v);
    setChecking(false);
    // Неверный код показываем у поля; прочее (лимит попыток, сеть) — тостом
    if (r.error && !/код/i.test(r.error)) toast(r.error);
    if (r.ok) {
      if (r.name) finish(r.name);
      else setStep('name');
    } else {
      setCode('');
      setTries((x) => x - 1);
      setCodeErr(true);
    }
  };

  const finish = (n: string) => {
    signIn({ id: `u${phone}`, name: n, phone, roles: ['client'], activeRole: 'client' });
    if (safeNext) router.replace(safeNext);
    else setStep('done');
  };

  const submitName = () => {
    if (name.trim().length < 2) return setNameErr(true);
    finish(name.trim());
  };

  const resend = async () => {
    const r = await api.auth.sendCode(phone);
    if (r.error) return toast(r.error);
    setTries(3);
    setCodeErr(false);
    setCode('');
    setTimer(60);
  };

  const back = () => {
    if (step === 'code') setStep('phone');
    else if (step === 'name') setStep('code');
  };
  const canBack = step === 'code' || step === 'name';

  let body: ReactNode = null;
  if (step === 'phone')
    body = (
      <>
        <Heading title={t.phoneT} sub={t.phoneS} />
        <PhoneField
          label={t.phoneL}
          value={phone}
          onChange={(v) => {
            setPhone(v);
            setPhoneErr(null);
          }}
          error={phoneErr === 'len' ? t.errLen : phoneErr === 'op' ? t.errOp : undefined}
          hint={t.phoneHint}
          autoFocus
        />
        <TestCodeNotice step="phone" />
        <div className={s.privacy}>
          <ShieldCheck size={20} color="var(--success-700)" aria-hidden className={s.noShrink} />
          <span>{t.privacy}</span>
        </div>
      </>
    );
  if (step === 'code')
    body = (
      <>
        <Heading
          title={t.codeT}
          sub={
            <>
              {t.codeS(phoneMask(phone))}{' '}
              <button type="button" className={s.link} onClick={back}>
                {t.changeNum}
              </button>
            </>
          }
        />
        <div className={s.otp}>
          <OtpInput value={code} onChange={onCode} error={codeErr} autoFocus disabled={checking || tries === 0} />
        </div>
        {codeErr && <span className={s.err}>{t.errCode(tries)}</span>}
        {checking && <span className={s.muted}>{t.checking}</span>}
        <div className={s.timerRow}>
          {timer > 0 ? (
            <span className={s.muted}>{t.timer(timer)}</span>
          ) : (
            <button type="button" className={s.resend} onClick={resend}>
              {t.resend}
            </button>
          )}
        </div>
        <TestCodeNotice step="code" onFill={onCode} />
      </>
    );
  if (step === 'name')
    body = (
      <>
        <Heading title={t.nameT} sub={t.nameS} />
        <TextField
          big
          label={t.nameL}
          value={name}
          onChange={(e) => {
            setName(e.target.value.slice(0, 40));
            setNameErr(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submitName()}
          placeholder={t.namePh}
          autoComplete="given-name"
          error={nameErr ? t.nameErr : undefined}
          autoFocus
        />
      </>
    );
  if (step === 'done')
    body = (
      <div className={s.done}>
        <span className={s.okBig}>
          <Check size={36} color="var(--success-700)" aria-hidden />
        </span>
        <Heading title={t.hello(name.trim())} sub={t.doneB} />
      </div>
    );

  const action =
    step === 'phone' ? (
      <Button size="lg" block busy={sending} onClick={submitPhone}>
        {t.getCode}
      </Button>
    ) : step === 'name' ? (
      <Button size="lg" block onClick={submitName}>
        {t.save}
      </Button>
    ) : step === 'done' ? (
      <ButtonLink href="/" size="lg" block>
        {t.toHome}
      </ButtonLink>
    ) : null;

  return (
    <div className={s.page}>
      <header className={s.mHead}>
        <button type="button" onClick={back} aria-label={c.back} className={s.mBack} style={{ visibility: canBack ? 'visible' : 'hidden' }}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <Link href="/" className={s.mLogo}>
          eKor
        </Link>
        <LangSwitch />
      </header>
      <header className={s.dHead}>
        <div className={s.dHeadIn}>
          <Link href="/" className={s.dLogo}>
            eKor
          </Link>
          <span className={s.grow} />
          <LangSwitch />
        </div>
      </header>

      <main className={s.main}>
        <div className={s.card}>
          {canBack && (
            <button type="button" onClick={back} className={s.dBack}>
              <ChevronLeft size={18} aria-hidden />
              {c.back}
            </button>
          )}
          <div className={s.body}>{body}</div>
          {action && <div className={s.foot}>{action}{step === 'phone' && <div className={s.terms}>{t.terms}</div>}</div>}
        </div>
      </main>
    </div>
  );
}

function Heading({ title, sub }: { title: ReactNode; sub: ReactNode }) {
  return (
    <div className={s.heading}>
      <h1 className={s.title}>{title}</h1>
      <div className={s.sub}>{sub}</div>
    </div>
  );
}
