'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { realAuth, USE_API } from '@/lib/api';
import type { UserOut } from '@/lib/api/real/auth';

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

/** Пользователь бэкенда → сессия экранов; активная роль хранится локально */
function fromMe(m: UserOut, prev: User | null): User {
  const roles: Role[] = m.is_master ? ['client', 'master'] : ['client'];
  return {
    id: String(m.id),
    name: m.name ?? prev?.name ?? '',
    phone: m.phone.replace(/\D/g, '').slice(-9),
    roles,
    activeRole: prev && roles.includes(prev.activeRole) ? prev.activeRole : 'client',
  };
}

/** Сессия: в моках — профиль в localStorage; с бэкендом — токены + GET /me (кэш для мгновенного рендера) */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cached: User | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) cached = JSON.parse(raw);
    } catch {}
    if (!USE_API) {
      setUser(cached);
      return setReady(true);
    }
    realAuth.fetchMe().then(
      (m) => {
        const u = m ? fromMe(m, cached) : null;
        setUser(u);
        try {
          if (u) localStorage.setItem(KEY, JSON.stringify(u));
          else localStorage.removeItem(KEY);
        } catch {}
        setReady(true);
      },
      // Нет сети — работаем с кэшем; токен отозван (401 после refresh) — выходим
      (e) => {
        setUser(e?.status === 401 ? null : cached);
        setReady(true);
      },
    );
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
      signIn: (u) => {
        if (!USE_API) return persist(u);
        // После verify сервер уже знает пользователя; имя нового пользователя сохраняем в профиль
        const m = realAuth.me();
        persist(m ? { ...fromMe(m, null), name: u.name || m.name || '' } : u);
        if (m && u.name && u.name !== m.name) realAuth.updateMe({ name: u.name }).catch(() => {});
      },
      signOut: () => {
        persist(null);
        if (USE_API) realAuth.logout();
      },
      switchRole: (r) => user && persist({ ...user, activeRole: r, roles: user.roles.includes(r) ? user.roles : [...user.roles, r] }),
      update: (patch) => {
        if (!user) return;
        persist({ ...user, ...patch });
        if (USE_API && patch.name && patch.name !== user.name) realAuth.updateMe({ name: patch.name }).catch(() => {});
      },
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

/**
 * Защита страниц мастера: гость → вход, клиент без роли мастера → «Стать мастером».
 * Возвращает true, когда страницу можно показывать.
 */
export function useRequireMaster(next: string) {
  const { user, ready } = useSession();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!user) window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    else if (!user.roles.includes('master')) window.location.replace('/become-master');
    else setOk(true);
  }, [ready, user, next]);
  return ok;
}
