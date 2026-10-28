'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, Info, LockOpen, TriangleAlert, X } from 'lucide-react';
import { initials as toInitials } from '@/lib/i18n';
import s from './Feedback.module.css';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const BANNER_ICON = { info: Info, success: LockOpen, warning: Clock, danger: TriangleAlert };

/** Плашка — постоянный контекст на экране */
export function Banner({ tone = 'info', icon, children, action, className }: { tone?: Tone; icon?: ReactNode | false; children: ReactNode; action?: ReactNode; className?: string }) {
  const Ico = BANNER_ICON[tone];
  return (
    <div className={[s.banner, s[tone], className].filter(Boolean).join(' ')} role={tone === 'danger' ? 'alert' : undefined}>
      {icon === false ? null : (icon ?? <Ico size={18} aria-hidden className={s.bannerIcon} />)}
      <div className={s.bannerBody}>{children}</div>
      {action}
    </div>
  );
}

/* ---------- Toast: подтверждение уже сделанного, 2.4 с, без действий ---------- */

type ToastItem = { id: number; text: ReactNode; icon?: 'check' | 'info' };
/** Раздел может подменить показ уведомлений своим (админка — внизу справа, с «Отменить») */
export const ToastCtx = createContext<(text: ReactNode, icon?: 'check' | 'info') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: ReactNode, icon: 'check' | 'info' = 'check') => {
    clearTimeout(timer.current);
    setItem({ id: Date.now(), text, icon });
    timer.current = setTimeout(() => setItem(null), 2400);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={s.toastHost} aria-live="polite">
        {item && (
          <div key={item.id} className={s.toast}>
            {item.icon === 'info' ? <Info size={18} aria-hidden /> : <Check size={18} aria-hidden />}
            <span>{item.text}</span>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Sheet: шторка снизу на мобильном, диалог по центру на десктопе ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  closeLabel = 'Закрыть',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  closeLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className={s.overlay} onClick={onClose}>
      <div role="dialog" aria-modal="true" className={s.sheet} style={{ ['--sheet-w' as string]: `${width}px` }} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={s.sheetHead}>
            <div className={s.sheetTitle}>{title}</div>
            <button type="button" className={s.sheetClose} onClick={onClose} aria-label={closeLabel}>
              <X size={18} aria-hidden />
            </button>
          </div>
        )}
        <div className={s.sheetBody}>{children}</div>
        {footer && <div className={s.sheetFoot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Подтверждение перед необратимым */
export function ConfirmSheet({ open, onClose, title, text, actions }: { open: boolean; onClose: () => void; title: ReactNode; text?: ReactNode; actions: ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} width={440}>
      <div className={s.confirm}>
        <div className={s.confirmTitle}>{title}</div>
        {text && <div className={s.confirmText}>{text}</div>}
        <div className={s.confirmActions}>{actions}</div>
      </div>
    </Sheet>
  );
}

export function EmptyState({ icon, title, text, action, tone = 'plain' }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; tone?: 'plain' | 'warn' }) {
  return (
    <div className={s.empty}>
      {icon && <span className={[s.emptyIcon, tone === 'warn' && s.emptyIconWarn].filter(Boolean).join(' ')}>{icon}</span>}
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, r = 4, light }: { w?: number | string; h?: number; r?: number; light?: boolean }) {
  return <span className={s.sk} style={{ width: w, height: h, borderRadius: r, background: light ? 'var(--line-100)' : undefined }} />;
}

/** Аватар — инициалы на brand-100 (фото пока заглушки) */
export function Avatar({ name, size = 52, tone = 'brand', striped }: { name: string; size?: number; tone?: 'brand' | 'success' | 'warn'; striped?: boolean }) {
  return (
    <span
      className={[s.avatar, s[`av_${tone}`], striped && s.avStriped].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden
    >
      {toInitials(name)}
    </span>
  );
}

export function Card({ children, className, active, as: As = 'div', ...rest }: { children: ReactNode; className?: string; active?: boolean; as?: 'div' | 'section' | 'article' | 'li' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={[s.card, active && s.cardActive, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </As>
  );
}

export function Stepper({ step, total, label }: { step: number; total: number; label: ReactNode }) {
  return (
    <div className={s.stepper}>
      <span className={s.stepperLabel}>{label}</span>
      <div className={s.stepperBars} style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < step ? s.barOn : s.bar} />
        ))}
      </div>
    </div>
  );
}
