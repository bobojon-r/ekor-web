'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Inbox, Lock, RefreshCw, Search, type LucideIcon } from 'lucide-react';
import { ST, type Tone } from './core';
import s from './Admin.module.css';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/** Шапка раздела 52px */
export function Head({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={s.head}>
      <span className={s.title}>{title}</span>
      {children}
    </div>
  );
}

export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: [K, string][] }) {
  return (
    <div className={s.tabs} role="tablist">
      {items.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={cx(s.tab, value === k && s.tabOn)} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Seg<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: [K, string][] }) {
  return (
    <div className={s.seg}>
      {items.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} className={cx(s.segItem, value === k && s.segOn)} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Поиск в шапке; «/» — фокус */
export function SearchBox({ value, onChange, placeholder, width = 260, slash }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number; slash?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useHotkeys(slash ? { '/': () => ref.current?.focus() } : {});
  return (
    <label className={s.search} style={width ? { width } : { flex: 1, width: 'auto' }}>
      <Search size={15} color="#5B6878" aria-hidden />
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Escape' && (onChange(''), ref.current?.blur())} />
      {slash && <span className={s.kbd}>/</span>}
    </label>
  );
}

/** Фильтр-кнопка с выпадающим списком (нативный select поверх — доступно с клавиатуры) */
export function SelectChip<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  const cur = options.find((o) => o[0] === value)?.[1] ?? '';
  return (
    <span className={s.chip}>
      {label ? `${label}: ${cur}` : cur}
      <ChevronDown size={14} color="#5B6878" aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value as V)} aria-label={label}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} className={cx(s.chip, on && s.chipOn)} onClick={onClick}>
      {children}
    </button>
  );
}

export function Pill({ tone, children, mono, big }: { tone: Tone | [string, string]; children: ReactNode; mono?: boolean; big?: boolean }) {
  const [bg, fg] = typeof tone === 'string' ? ST[tone] : tone;
  return (
    <span className={cx(big ? s.badge : s.pill, mono && s.pillMono)} style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

export const Label = ({ children }: { children: ReactNode }) => <span className={s.label}>{children}</span>;

/** Подсветка найденного фрагмента (контакты, оскорбления) */
export function Highlighted({ pre, hl, post }: { pre: string; hl: string; post: string }) {
  return (
    <>
      {pre}
      {hl && <span className={s.hl}>{hl}</span>}
      {post}
    </>
  );
}

export function Photo({ src, ratio }: { src?: string; ratio?: string }) {
  return <span className={s.ph} style={ratio ? { aspectRatio: ratio } : undefined}>{src && <img src={src} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />}</span>;
}

export function Checkbox({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      className={cx(s.cb, on && s.cbOn)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {on && <Check size={11} color="#fff" strokeWidth={3} aria-hidden />}
    </button>
  );
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx(s.sw, on && s.swOn)} onClick={onClick}>
      <span />
    </button>
  );
}

/**
 * Модальное окно 520px для необратимых действий: кнопка подтверждения неактивна,
 * пока условие не выполнено (основание, 4 цифры номера, галочка). Esc — закрыть.
 */
export function Modal({
  icon: I, tone, title, sub, children, onClose, okText, okTone = 'blue', okDisabled, busy, onOk, cancelText = 'Отмена',
}: {
  icon: LucideIcon; tone: 'blue' | 'red'; title: string; sub?: ReactNode; children: ReactNode; onClose: () => void; okText: string; okTone?: 'blue' | 'red';
  okDisabled?: boolean; busy?: boolean; onOk: () => void; cancelText?: string;
}) {
  useHotkeys({ Escape: onClose }, true);
  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.mHead}>
          <span className={s.mIcon} style={{ background: tone === 'red' ? '#FBE3E0' : '#EAEEFC' }}>
            <I size={22} color={tone === 'red' ? '#A5281B' : '#1F3BB8'} aria-hidden />
          </span>
          <div className={s.col4}>
            <span className={s.mTitle}>{title}</span>
            {sub && <span className={s.mSub}>{sub}</span>}
          </div>
        </div>
        <div className={s.mBody}>{children}</div>
        <div className={s.mFoot}>
          <button type="button" className={s.btn} onClick={onClose}>
            {cancelText}
          </button>
          <button type="button" className={cx(s.btn, okTone === 'red' ? s.btnRed : s.btnBlue)} disabled={okDisabled || busy} onClick={onOk}>
            {busy ? 'Сохраняем…' : okText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CheckRow({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} className={cx(s.checkRow, on && s.checkRowOn)} onClick={onClick}>
      <span className={s.checkBox}>{on && <Check size={14} color="#fff" strokeWidth={3} aria-hidden />}</span>
      <span>{children}</span>
    </button>
  );
}

/**
 * Горячие клавиши. Не срабатывают при вводе в поля (кроме Escape) и с модификаторами.
 * global=true — слушать и при открытой модалке (для самой модалки).
 */
export function useHotkeys(map: Record<string, () => void>, global = false) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
      if (typing && e.key !== 'Escape') return;
      if (!global && document.querySelector('[aria-modal="true"]')) return;
      const f = ref.current[e.key.length === 1 ? e.key.toLowerCase() : e.key] ?? ref.current[e.key];
      if (f) {
        e.preventDefault();
        f();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [global]);
}

/** 13 — пустая очередь */
export function EmptyQueue({ text, stats, children }: { text: string; stats: [string, string][]; children?: ReactNode }) {
  return (
    <div className={s.center}>
      <div className={s.emptyBox}>
        <span className={s.bigIco} style={{ background: '#E3F4F0' }}>
          <Inbox size={32} color="#0B6E5E" aria-hidden />
        </span>
        <span className={s.h20}>Очередь пуста</span>
        <span className={s.lead}>{text}</span>
        <div className={s.stats3}>
          {stats.map(([v, l]) => (
            <div key={l} className={s.stat}>
              <span className={s.statV}>{v}</span>
              <span className={s.statL}>{l}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{children}</div>
      </div>
    </div>
  );
}

export function RefreshBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={s.btn} onClick={onClick}>
      <RefreshCw size={15} aria-hidden />
      Обновить
    </button>
  );
}

/** 14 — нет доступа: данные раздела не запрашиваются */
export function NoAccess({ need, roleText, admin, at, onRequest }: { need: string; roleText: string; admin?: string; at: string; onRequest: () => void }) {
  return (
    <div className={s.center} style={{ background: '#F7F9FB' }}>
      <div className={s.denied}>
        <span className={s.bigIco} style={{ background: '#EEF1F4' }}>
          <Lock size={32} color="#3B4756" aria-hidden />
        </span>
        <span className={s.h20}>Раздел доступен только {need}</span>
        <span className={s.lead}>Ваша роль — {roleText}. Изменения в этом разделе влияют на всех пользователей и сотрудников.</span>
        <div className={s.softBox} style={{ width: '100%', textAlign: 'left', boxSizing: 'border-box' }}>
          {admin && (
            <>
              <span>Администратор</span>
              <b>{admin}</b>
            </>
          )}
          <span>Попытка</span>
          <span>записана в аудит-лог · {at}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Link href="/admin" className={s.deniedBtn}>
            На дашборд
          </Link>
          <button type="button" className={cx(s.deniedBtn, s.deniedBtnBlue)} onClick={onRequest}>
            Запросить доступ
          </button>
        </div>
      </div>
    </div>
  );
}

export const Loading = () => <div className={s.loading}>Загрузка…</div>;
