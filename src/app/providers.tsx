'use client';

import type { ReactNode } from 'react';
import { I18nProvider, type Lang } from '@/lib/i18n';
import { SessionProvider } from '@/lib/session/SessionProvider';
import { ToastProvider } from '@/components/ui';
import { OfflineBar } from '@/features/system/SystemStates';
import { ref, type RefData } from '@/lib/api/ref';
import { api } from '@/lib/api';
import { setLangListener } from '@/lib/i18n/I18nProvider';

// Переключатель языка сохраняет язык в профиле — SMS и push придут на нём же
setLangListener((l) => void api.saveLang(l));

export function Providers({ lang, refData, children }: { lang: Lang; refData: RefData | null; children: ReactNode }) {
  // Справочники с сервера кладём в кэш до рендера детей — SSR и гидратация видят одни данные
  ref.set(refData);
  return (
    <I18nProvider initialLang={lang}>
      <SessionProvider>
        <ToastProvider>
          <OfflineBar />
          {children}
        </ToastProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
