'use client';

import { useEffect, useState } from 'react';
import { http, loadChats, realtime, USE_API } from '@/lib/api';
import { useSession } from '@/lib/session/SessionProvider';

/** Непрочитанные сообщения во всех чатах активной роли (бейдж в меню) */
export function useChatUnread() {
  const { user } = useSession();
  const [n, setN] = useState(0);
  const role = user?.activeRole === 'master' ? 'master' : 'client';
  useEffect(() => {
    if (!user) return setN(0);
    if (!USE_API) return setN(loadChats()[role].reduce((a, t) => a + t.unread, 0));
    let live = true;
    const load = () =>
      http<{ items: { role: string; unread_count: number }[] }>('/chats').then(
        (r) => live && setN(r.items.filter((c) => c.role === role).reduce((a, c) => a + c.unread_count, 0)),
        () => {},
      );
    load();
    const off = realtime.on((e) => (e.type === 'chat.message' || e.type === 'reconnected') && load());
    return () => {
      live = false;
      off();
    };
  }, [user, role]);
  return n;
}
