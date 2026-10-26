'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CloudAlert, Hourglass, RotateCw, SearchX, WifiOff, type LucideIcon } from 'lucide-react';
import { useDict } from '@/lib/i18n';
import { Button, ButtonLink, useToast } from '@/components/ui';
import { sysDict } from './i18n';
import s from './System.module.css';

/** Сеть: navigator.onLine + события online/offline */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Тёмная плашка под шапкой: «Нет интернета. Показываем сохранённое». Сеть вернулась — плашка исчезает */
export function OfflineBar() {
  const t = useDict(sysDict);
  const toast = useToast();
  const online = useOnline();
  const [was, setWas] = useState(false);
  useEffect(() => {
    if (!online) setWas(true);
    else if (was) {
      toast(t.reloaded);
      setWas(false);
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps
  if (online) return null;
  return (
    <div className={s.bar} role="status">
      <WifiOff size={18} aria-hidden />
      {t.offlineBar}
    </div>
  );
}

type Kind = 'offline' | 'server' | 'slow' | 'notfound';
const ICON: Record<Kind, [LucideIcon, string, string]> = {
  offline: [WifiOff, 'var(--line-100)', 'var(--ink-700)'],
  server: [CloudAlert, 'var(--warn-100)', 'var(--warn-800)'],
  slow: [Hourglass, 'var(--brand-100)', 'var(--brand-700)'],
  notfound: [SearchX, 'var(--line-100)', 'var(--ink-700)'],
};

/**
 * Полноэкранное состояние: нет сети (автоповтор каждые 10 с), ошибка сервера, «дольше обычного», 404.
 * onRetry — повтор запроса; для offline вызывается автоматически.
 */
export function FullState({ kind, onRetry, title, text, action }: { kind: Kind; onRetry?: () => void | Promise<void>; title?: string; text?: string; action?: ReactNode }) {
  const t = useDict(sysDict);
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [I, bg, fg] = ICON[kind];
  const copy = {
    offline: [t.offlineTitle, t.offlineText, t.offlineFoot, t.retry],
    server: [t.serverTitle, t.serverText, t.serverFoot, t.serverCta],
    slow: [t.slowTitle, t.slowText, t.slowFoot, t.slowCta],
    notfound: [t.notFoundTitle, t.notFoundText, '', t.toHome],
  }[kind];

  const retry = async () => {
    if (busy || !onRetry) return;
    setBusy(true);
    await Promise.resolve(onRetry());
    setTimeout(() => setBusy(false), 900);
  };
  // нет сети: автоповтор каждые 10 с и сразу, как связь вернулась
  useEffect(() => {
    if (kind !== 'offline' || !onRetry) return;
    if (online) {
      onRetry();
      return;
    }
    const id = setInterval(() => navigator.onLine && onRetry(), 10000);
    return () => clearInterval(id);
  }, [kind, online]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.full} role="alert">
      <span className={s.ico} style={{ background: bg }}>
        <I size={32} color={fg} aria-hidden />
      </span>
      <h1 className={s.title}>{title ?? copy[0]}</h1>
      <p className={s.text}>{text ?? copy[1]}</p>
      {action ??
        (kind === 'notfound' ? (
          <ButtonLink href="/" variant="secondary" size="md" className={s.cta}>
            {copy[3]}
          </ButtonLink>
        ) : (
          onRetry && (
            <Button size="md" busy={busy} busyText={t.connecting} onClick={retry} icon={<RotateCw size={18} aria-hidden />} className={s.cta}>
              {copy[3]}
            </Button>
          )
        ))}
      {copy[2] && (
        <span className={s.foot}>
          {kind === 'server' ? (
            <Link href="/help" className={s.footLink}>
              {copy[2]}
            </Link>
          ) : (
            copy[2]
          )}
        </span>
      )}
    </div>
  );
}

/**
 * Состояние запроса из useLoad: 15 с — «дольше обычного», 30 с / ошибка — «Сервер не ответил»,
 * нет сети — «Нет интернета» с автоповтором. Пока всё идёт по плану — ничего не рисует.
 */
export function LoadState({ phase, retry }: { phase: string; retry: () => void }) {
  const online = useOnline();
  const [waited, setWaited] = useState(false);
  if (!online && phase !== 'done') return <FullState kind="offline" onRetry={retry} />;
  if (phase === 'timeout' || phase === 'error') return <FullState kind="server" onRetry={retry} />;
  if (phase === 'slow' && !waited) return <FullState kind="slow" onRetry={() => setWaited(true)} />;
  return null;
}
