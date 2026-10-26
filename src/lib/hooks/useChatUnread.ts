'use client';

import { useEffect, useState } from 'react';
import { loadChats } from '@/lib/api';
import { useSession } from '@/lib/session/SessionProvider';

/** Непрочитанные сообщения во всех чатах активной роли (бейдж в меню) */
export function useChatUnread() {
  const { user } = useSession();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user) return setN(0);
    setN(loadChats()[user.activeRole === 'master' ? 'master' : 'client'].reduce((a, t) => a + t.unread, 0));
  }, [user]);
  return n;
}
