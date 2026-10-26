'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { useDict } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'success' | 'dark' | 'white' | 'ghost';
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Отправка: кнопка светлеет, текст меняется, повторные нажатия игнорируются */
  busy?: boolean;
  busyText?: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

type Props = Common & ButtonHTMLAttributes<HTMLButtonElement>;

export function cls(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block?: boolean, extra?: string) {
  return [s.btn, s[variant], s[size], block && s.block, extra].filter(Boolean).join(' ');
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', block, busy, busyText, icon, iconRight, className, children, onClick, disabled, type = 'button', ...rest },
  ref,
) {
  const c = useDict(common);
  return (
    <button
      ref={ref}
      type={type}
      className={cls(variant, size, block, [busy && s.busy, className].filter(Boolean).join(' '))}
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {!busy && icon}
      <span className={s.label}>{busy ? busyText ?? c.sending : children}</span>
      {!busy && iconRight}
    </button>
  );
});

type LinkProps = Common & { href: string; className?: string; children: ReactNode };

export function ButtonLink({ href, variant = 'primary', size = 'md', block, icon, iconRight, className, children }: LinkProps) {
  return (
    <Link href={href} className={cls(variant, size, block, className)}>
      {icon}
      <span className={s.label}>{children}</span>
      {iconRight}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  bordered = false,
  className,
  ...rest
}: { label: string; bordered?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={[s.iconBtn, bordered && s.iconBordered, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
