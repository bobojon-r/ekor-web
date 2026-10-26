'use client';

import { useId, useRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { phoneMask, useLang } from '@/lib/i18n';
import s from './Field.module.css';

type Wrap = {
  label?: ReactNode;
  /** Показывать только после попытки отправки — решает вызывающий код */
  error?: ReactNode;
  hint?: ReactNode;
  counter?: string;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
};

/** Подпись над полем, ошибка под полем красным, счётчик справа */
export function FieldWrap({ label, error, hint, counter, className, children }: Wrap) {
  const id = useId();
  const msgId = `${id}-msg`;
  const hasMsg = !!(error || hint || counter);
  return (
    <div className={[s.wrap, className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
      )}
      {children(id, hasMsg ? msgId : undefined)}
      {hasMsg && (
        <div className={s.msg} id={msgId}>
          {error ? <span className={s.err}>{error}</span> : <span className={s.hint}>{hint}</span>}
          {counter && <span className={s.counter}>{counter}</span>}
        </div>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  counter?: string;
  big?: boolean;
  wrapClassName?: string;
};

export function TextField({ label, error, hint, counter, big, wrapClassName, className, ...rest }: TextFieldProps) {
  return (
    <FieldWrap label={label} error={error} hint={hint} counter={counter} className={wrapClassName}>
      {(id, d) => (
        <input
          id={id}
          aria-describedby={d}
          aria-invalid={!!error || undefined}
          className={[s.input, big && s.big, error && s.invalid, className].filter(Boolean).join(' ')}
          {...rest}
        />
      )}
    </FieldWrap>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  counter?: string;
  wrapClassName?: string;
};

export function TextArea({ label, error, hint, counter, wrapClassName, className, rows = 3, ...rest }: TextAreaProps) {
  return (
    <FieldWrap label={label} error={error} hint={hint} counter={counter} className={wrapClassName}>
      {(id, d) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={d}
          aria-invalid={!!error || undefined}
          className={[s.textarea, error && s.invalid, className].filter(Boolean).join(' ')}
          {...rest}
        />
      )}
    </FieldWrap>
  );
}

/** +992 и маска 2-3-2-2; код страны не стирается. value — 9 цифр без кода */
export function PhoneField({
  label,
  error,
  hint,
  value,
  onChange,
  autoFocus,
  disabled,
}: {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (digits: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      {(id, d) => (
        <div className={[s.phone, error && s.invalid].filter(Boolean).join(' ')}>
          <span className={s.cc}>+992</span>
          <span className={s.sep} />
          <input
            id={id}
            aria-describedby={d}
            aria-invalid={!!error || undefined}
            value={phoneMask(value)}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^992(?=\d{9})/, '').slice(0, 9))}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="__ ___ __ __"
            autoFocus={autoFocus}
            disabled={disabled}
            className={s.phoneInput}
          />
        </div>
      )}
    </FieldWrap>
  );
}

/** Бюджет «до … смн» + «Договорная». value=null — договорная */
export function PriceField({
  label,
  error,
  hint,
  value,
  onChange,
  prefix,
  negotiable = true,
}: {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  value: string | null;
  onChange: (v: string | null) => void;
  prefix?: 'upto' | 'from' | null;
  negotiable?: boolean;
}) {
  const { lang } = useLang();
  const last = useRef('');
  const neg = value === null;
  const pre = prefix === 'from' ? (lang === 'tj' ? 'аз' : 'от') : prefix === 'upto' ? (lang === 'tj' ? 'то' : 'до') : null;
  return (
    <FieldWrap label={label} error={error} hint={hint}>
      {(id, d) => (
        <div className={s.priceRow}>
          <div className={[s.price, neg && s.priceOff, error && s.invalid].filter(Boolean).join(' ')}>
            {pre && <span className={s.affix}>{pre}</span>}
            <input
              id={id}
              aria-describedby={d}
              value={neg ? '' : value}
              disabled={neg}
              inputMode="numeric"
              onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={s.priceInput}
            />
            <span className={s.affix}>смн</span>
          </div>
          {negotiable && (
            <button
              type="button"
              aria-pressed={neg}
              className={[s.negBtn, neg && s.negOn].filter(Boolean).join(' ')}
              onClick={() => {
                if (neg) onChange(last.current);
                else {
                  last.current = value ?? '';
                  onChange(null);
                }
              }}
            >
              {lang === 'tj' ? 'Бо мувофиқа' : 'Договорная'}
            </button>
          )}
        </div>
      )}
    </FieldWrap>
  );
}

/** 6 ячеек; одно скрытое поле для автозаполнения SMS-кода */
export function OtpInput({ value, onChange, error, autoFocus, disabled }: { value: string; onChange: (v: string) => void; error?: boolean; autoFocus?: boolean; disabled?: boolean }) {
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  return (
    <label className={s.otp}>
      <input
        className={s.otpHidden}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={error || undefined}
      />
      {cells.map((v, i) => {
        const active = i === Math.min(value.length, 5);
        return (
          <span key={i} aria-hidden className={[s.otpCell, v && s.otpFilled, active && s.otpActive, error && s.otpErr].filter(Boolean).join(' ')}>
            {v}
          </span>
        );
      })}
    </label>
  );
}

export function SearchField({ className, big, ...rest }: InputHTMLAttributes<HTMLInputElement> & { big?: boolean }) {
  return (
    <label className={[s.search, big && s.searchBig, className].filter(Boolean).join(' ')}>
      <Search size={20} color="var(--ink-500)" aria-hidden />
      <input type="search" className={s.searchInput} {...rest} />
    </label>
  );
}
