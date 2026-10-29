'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, Lock } from 'lucide-react';
import { USE_API } from '@/lib/api';
import { adminApi } from '../data/api';
import { cx } from '../ui';
import s from './AdminLogin.module.css';
import { L } from '../i18n';

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
      // Профиль прошлого сотрудника из кэша не должен мелькнуть
      try {
        localStorage.removeItem('ekor_admin_me');
      } catch {}
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
      else if (x.status === 429) setErr(L.adminLogin.slishkomMnogoPopytokS(Math.ceil((x.details?.retry_after ?? 60) / 60)));
      else if (x.status === 401 || x.code === 'invalid_credentials') {
        const n = x.details?.attempts_left;
        setErr(L.adminLogin.nevernayaPochtaIliParol(n != null ? L.adminLogin.ostalos(n, n === 1 ? L.adminLogin.popytka : n >= 2 && n <= 4 ? L.adminLogin.popytki : L.adminLogin.popytok) : ''));
      } else setErr(L.adminLogin.serverNeOtvetilPoprobuyte);
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
          <span className={s.pitchT}>{L.adminLogin.panelModeratsii}</span>
          <span className={s.pitchB}>{L.adminLogin.tolkoDlyaSotrudnikovEkor}</span>
        </div>
        <span className={s.foot}>{L.adminLogin.netUchetnoyZapisiIli}</span>
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
            <h1 className={s.h1}>{locked ? L.adminLogin.vhodVremennoZablokirovan : L.adminLogin.vhod}</h1>
            {!locked && !err && <span className={s.sub}>{L.adminLogin.pochtuIParolVydaet}</span>}
          </div>
          {locked ? (
            <div className={s.warn} role="alert">
              <Lock size={15} aria-hidden />
              <span>
                {L.adminLogin._5NevernyhPopytokDlya} {email.trim() || L.adminLogin.etoyPochty}{L.adminLogin.poprobuyteCherez} <b>{`${pad(Math.floor(left / 60))}:${pad(left % 60)}`}</b> {L.adminLogin.iliPoprositeAdministratoraZadat}
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
            <span className={s.label}>{L.adminLogin.elPochta}</span>
            <input className={cx(s.input, locked && s.inputOff)} type="email" autoComplete="username" value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          {!locked && (
            <label className={s.field}>
              <span className={s.label}>{L.adminLogin.parol}</span>
              <span className={cx(s.pwBox, err && s.pwErr)}>
                <input ref={pwRef} type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={capsCheck} onKeyUp={capsCheck} />
                <button type="button" className={s.eye} aria-label={show ? L.adminLogin.skrytParol : L.adminLogin.pokazatParol} onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </span>
            </label>
          )}
          {!locked && (
            <div className={s.row}>
              <label className={s.check}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {L.adminLogin.zapomnitPochtu}
              </label>
              <span className={caps ? s.capsOn : s.capsOff}>{caps ? L.adminLogin.vklyuchenCapsLock : L.adminLogin.capsLockVyklyuchen}</span>
            </div>
          )}
          <button type="submit" className={s.btn} disabled={!can}>
            {busy ? L.adminLogin.vhodim : L.adminLogin.voyti}
          </button>
          <span className={s.note}>{locked ? L.adminLogin.administratorPoluchitUvedomlenie : L.adminLogin.sessiya12ChasovPosle}</span>
          {!USE_API && <span className={s.note}>{L.adminLogin.demoLyuboyParolWrong}</span>}
        </form>
      </div>
    </div>
  );
}
