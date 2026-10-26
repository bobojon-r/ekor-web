'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Role = 'client' | 'master';
export type User = {
  id: string;
  name: string;
  phone: string; // 9 цифр без +992
  roles: Role[];
  activeRole: Role;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  signIn: (u: User) => void;
  signOut: () => void;
  switchRole: (r: Role) => void;
  update: (patch: Partial<User>) => void;
};

const KEY = 'ekor_session';
const SessionCtx = createContext<Ctx | null>(null);

/** Мок-сессия до подключения API: токен и профиль в localStorage */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const persist = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      ready,
      signIn: persist,
      signOut: () => persist(null),
      switchRole: (r) => user && persist({ ...user, activeRole: r, roles: user.roles.includes(r) ? user.roles : [...user.roles, r] }),
      update: (patch) => user && persist({ ...user, ...patch }),
    }),
    [user, ready, persist],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession вне SessionProvider');
  return ctx;
}

export function maskPhone(digits: string) {
  return `+992 ${digits.slice(0, 2)} *** ** ${digits.slice(7, 9)}`;
}
