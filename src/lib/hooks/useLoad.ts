'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type LoadPhase = 'idle' | 'skeleton' | 'slow' | 'timeout' | 'done' | 'error';

/**
 * Правила загрузки из «Состояния системы»:
 * < 300 мс — ничего не показываем; далее скелетон; 15 с — «дольше обычного»; 30 с — «сервер не ответил».
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [phase, setPhase] = useState<LoadPhase>('idle');
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setPhase('idle');
    const t1 = setTimeout(() => alive && setPhase((p) => (p === 'idle' ? 'skeleton' : p)), 300);
    const t2 = setTimeout(() => alive && setPhase((p) => (p === 'skeleton' ? 'slow' : p)), 15000);
    const t3 = setTimeout(() => alive && setPhase((p) => (p === 'slow' ? 'timeout' : p)), 30000);
    fnRef
      .current()
      .then((v) => {
        if (!alive) return;
        setData(v);
        setPhase('done');
      })
      .catch(() => alive && setPhase('error'));
    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const loading = phase === 'idle' || phase === 'skeleton' || phase === 'slow';
  return { data, phase, loading, showSkeleton: phase === 'skeleton' || phase === 'slow', retry };
}
