'use client';

import { useEffect, useState } from 'react';
import type { RegionKey } from '@/lib/api';

const KEY = 'ekor_region';

/** Выбранный город — запоминается между визитами */
export function useRegion(): [RegionKey, (r: RegionKey) => void] {
  const [region, setRegion] = useState<RegionKey>('dushanbe');
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY) as RegionKey | null;
      if (v) setRegion(v);
    } catch {}
  }, []);
  const set = (r: RegionKey) => {
    setRegion(r);
    try {
      localStorage.setItem(KEY, r);
    } catch {}
  };
  return [region, set];
}
