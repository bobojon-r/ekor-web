'use client';

import { useEffect, useState } from 'react';
import type { RegionKey } from '@/lib/api';

const KEY = 'ekor_region';

/** Выбранный город — запоминается между визитами */
/** ready=false до чтения localStorage — до этого не грузим данные, иначе будет двойная загрузка и мигание */
export function useRegion(): [RegionKey, (r: RegionKey) => void, boolean] {
  const [region, setRegion] = useState<RegionKey>('dushanbe');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY) as RegionKey | null;
      if (v) setRegion(v);
    } catch {}
    setReady(true);
  }, []);
  const set = (r: RegionKey) => {
    setRegion(r);
    try {
      localStorage.setItem(KEY, r);
    } catch {}
  };
  return [region, set, ready];
}
