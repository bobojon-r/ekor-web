import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { LANG_COOKIE, type Lang } from '@/lib/i18n';
import { USE_API } from '@/lib/api';
import { fetchRef, ref } from '@/lib/api/ref';
import { Providers } from './providers';
// Golos Text самохостинг: кириллица + таджикские ӣ ӯ ҳ ҷ қ ғ (cyrillic-ext)
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/golos-text/700.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'eKor — мастера по всему Таджикистану',
  description: 'Найдите мастера или разместите задание. Душанбе, Худжанд, Бохтар, Куляб, Хорог.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2647D9' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === 'tj' ? 'tj' : 'ru';
  const refData = USE_API ? await fetchRef() : null;
  ref.set(refData);
  return (
    <html lang={lang === 'tj' ? 'tg' : 'ru'}>
      <body>
        <Providers lang={lang} refData={refData}>{children}</Providers>
      </body>
    </html>
  );
}
