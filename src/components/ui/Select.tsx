'use client';

import type { ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useLang, type Lang } from '@/lib/i18n';
import s from './Select.module.css';

/** Чип выбора: выбранный получает ✓, а не только цвет */
export function Chip({ selected, onClick, children, icon }: { selected?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button type="button" aria-pressed={!!selected} onClick={onClick} className={[s.chip, selected && s.chipOn].filter(Boolean).join(' ')}>
      {selected ? <Check size={16} aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function RemovableChip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <span className={s.rchip}>
      {children}
      <button type="button" aria-label={removeLabel} onClick={onRemove} className={s.rchipX}>
        <X size={16} aria-hidden />
      </button>
    </span>
  );
}

export function AddChip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={s.addChip}>
      <Plus size={18} aria-hidden />
      {children}
    </button>
  );
}

/** 2–4 взаимоисключающих варианта */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div role="tablist" className={[s.seg, className].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={[s.segBtn, size === 'lg' && s.segLg, o.value === value && s.segOn].filter(Boolean).join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** RU / TJ. onBrand — на синем фоне (мобильная шапка главной) */
export function LangSwitch({ onBrand }: { onBrand?: boolean }) {
  const { lang, setLang } = useLang();
  const opt: Lang[] = ['ru', 'tj'];
  return (
    <div className={[s.lang, onBrand && s.langBrand].filter(Boolean).join(' ')} role="group" aria-label="Язык / Забон">
      {opt.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={[s.langBtn, lang === l && s.langOn].filter(Boolean).join(' ')}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={[s.sw, checked && s.swOn, disabled && s.swLocked].filter(Boolean).join(' ')}
    >
      <span className={s.knob} />
    </button>
  );
}

export function SwitchRow({ title, sub, checked, onChange, disabled }: { title: ReactNode; sub?: ReactNode; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={s.swRow}>
      <div className={s.swText}>
        <span className={s.swTitle}>{title}</span>
        {sub && <span className={s.swSub}>{sub}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={typeof title === 'string' ? title : undefined} />
    </div>
  );
}

export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className={s.cb}>
      <span className={[s.cbBox, checked && s.cbOn, error && !checked && s.cbErr].filter(Boolean).join(' ')}>{checked && <Check size={16} color="#fff" aria-hidden />}</span>
      <span>{children}</span>
    </button>
  );
}

/** Карточка-радио: причины отказа и т.п. tone=danger — выбранная красная */
export function RadioCard({ selected, onClick, children, tone = 'brand' }: { selected: boolean; onClick: () => void; children: ReactNode; tone?: 'brand' | 'danger' }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={[s.radio, selected && (tone === 'danger' ? s.radioDanger : s.radioOn)].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}
