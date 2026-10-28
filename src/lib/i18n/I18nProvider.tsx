'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';

export const LANG_COOKIE = 'ekor_lang';

/** Слушатель смены языка (слой данных сохраняет язык в профиле) — без импорта api в i18n */
let onLangChange: ((l: Lang) => void) | null = null;
export const setLangListener = (f: (l: Lang) => void) => void (onLangChange = f);

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    // Cookie — чтобы сервер рендерил на нужном языке; в профиле язык сохраняется через API настроек
    document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = l === 'tj' ? 'tg' : 'ru';
    onLangChange?.(l);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLang() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLang вне I18nProvider');
  return ctx;
}

/** Словарь фичи: `{ ru: {...}, tj: {...} }`. Ключи tj обязаны совпадать с ru. */
export function useDict<T>(dict: { ru: T; tj: T }): T {
  const { lang } = useLang();
  return dict[lang];
}
