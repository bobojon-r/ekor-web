'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, Lock } from 'lucide-react';
import { USE_API } from '@/lib/api';
import { adminApi } from '../data/api';
import { cx } from '../ui';
import s from './AdminLogin.module.css';

const REMEMBER = 'ekor_admin_email';
const pad = (n: number) => String(n).padStart(2, '0');

/** 18–19 — вход сотрудника: почта + пароль; ошибка всегда общая; 5 неудач → блок 15 мин */
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER);
      if (saved) (setEmail(saved), setRemember(true), pwRef.current?.focus());
    } catch {}
  }, []);
  // Обратный отсчёт блокировки
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) (setUntil(null), setErr(null));
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  const locked = !!until && until > now;
  const left = locked ? Math.ceil((until! - now) / 1000) : 0;
  const can = email.trim().length > 0 && pw.length > 0 && !busy && !locked;

  const submit = async () => {
    if (!can) return;
    setBusy(true);
    setErr(null);
    try {
      await adminApi.login(email, pw);
      try {
        if (remember) localStorage.setItem(REMEMBER, email.trim());
        else localStorage.removeItem(REMEMBER);
      } catch {}
      const next = new URLSearchParams(location.search).get('next');
      router.replace(next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin');
      return;
    } catch (e) {
      const x = e as { status?: number; code?: string; details?: { attempts_left?: number; until?: string; retry_after?: number } };
      setPw('');
      if (x.status === 423 || x.code === 'locked') setUntil(x.details?.until ? +new Date(x.details.until) : Date.now() + 15 * 60000);
      else if (x.status === 429) setErr(`Слишком много попыток с этого адреса. Повторите через ${Math.ceil((x.details?.retry_after ?? 60) / 60)} мин.`);
      else if (x.status === 401 || x.code === 'invalid_credentials') {
        const n = x.details?.attempts_left;
        setErr(`Неверная почта или пароль.${n != null ? ` Осталось ${n} ${n === 1 ? 'попытка' : n >= 2 && n <= 4 ? 'попытки' : 'попыток'}.` : ''}`);
      } else setErr('Сервер не ответил. Попробуйте ещё раз.');
      pwRef.current?.focus();
    }
    setBusy(false);
  };
  const capsCheck = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className={s.page}>
      <div className={s.left}>
        <div className={s.brand}>
          <span className={s.brandName}>eKor</span>
          <span className={s.brandTag}>admin</span>
        </div>
        <div className={s.pitch}>
          <span className={s.pitchT}>Панель модерации</span>
          <span className={s.pitchB}>Только для сотрудников eKor. Все действия записываются в аудит-лог.</span>
        </div>
        <span className={s.foot}>Нет учётной записи или забыли пароль — обратитесь к администратору</span>
      </div>
      <div className={s.right}>
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className={s.head}>
            <h1 className={s.h1}>{locked ? 'Вход временно заблокирован' : 'Вход'}</h1>
            {!locked && !err && <span className={s.sub}>Почту и пароль выдаёт администратор</span>}
          </div>
          {locked ? (
            <div className={s.warn} role="alert">
              <Lock size={15} aria-hidden />
              <span>
                5 неверных попыток для {email.trim() || 'этой почты'}. Попробуйте через <b>{`${pad(Math.floor(left / 60))}:${pad(left % 60)}`}</b> или попросите администратора задать новый пароль.
              </span>
            </div>
          ) : (
            err && (
              <div className={s.err} role="alert">
                <CircleAlert size={15} aria-hidden />
                <span>{err}</span>
              </div>
            )
          )}
          <label className={s.field}>
            <span className={s.label}>Эл. почта</span>
            <input className={cx(s.input, locked && s.inputOff)} type="email" autoComplete="username" value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          {!locked && (
            <label className={s.field}>
              <span className={s.label}>Пароль</span>
              <span className={cx(s.pwBox, err && s.pwErr)}>
                <input ref={pwRef} type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={capsCheck} onKeyUp={capsCheck} />
                <button type="button" className={s.eye} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </span>
            </label>
          )}
          {!locked && (
            <div className={s.row}>
              <label className={s.check}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Запомнить почту
              </label>
              <span className={caps ? s.capsOn : s.capsOff}>{caps ? 'Включён Caps Lock' : 'Caps Lock выключен'}</span>
            </div>
          )}
          <button type="submit" className={s.btn} disabled={!can}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
          <span className={s.note}>{locked ? 'Администратор получит уведомление о блокировке' : 'Сессия — 12 часов. После 5 неверных попыток вход блокируется на 15 минут.'}</span>
          {!USE_API && <span className={s.note}>Демо: любой пароль; «wrong» — неверный.</span>}
        </form>
      </div>
    </div>
  );
}
