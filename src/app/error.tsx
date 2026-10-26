'use client';

import { useEffect } from 'react';
import { Shell } from '@/components/layout';
import { FullState } from '@/features/system/SystemStates';

/** Непредвиденная ошибка на странице: «Сервер не ответил» + повтор. Введённое в формах хранится в черновиках */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Shell>
      <FullState kind="server" onRetry={reset} />
    </Shell>
  );
}
