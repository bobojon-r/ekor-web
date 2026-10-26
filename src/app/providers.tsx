'use client';

import type { ReactNode } from 'react';
import { I18nProvider, type Lang } from '@/lib/i18n';
import { SessionProvider } from '@/lib/session/SessionProvider';
import { ToastProvider } from '@/components/ui';

export function Providers({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <I18nProvider initialLang={lang}>
      <SessionProvider>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
