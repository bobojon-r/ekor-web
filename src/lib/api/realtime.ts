/**
 * WebSocket бэкенда (AsyncAPI: /api/ws-docs). Одно соединение на пользователя:
 * chat.message, chat.read, chat.typing, chat.system, notification.
 * Отправка сообщений — через REST; события без соединения не досылаются,
 * поэтому после переподключения подписчики получают «reconnected» и перезапрашивают данные.
 */
import { USE_API } from './flags';
import { refresh, tokens } from './http';

export type RtEvent =
  | { type: 'chat.message'; chat_id: number; message: Record<string, unknown> }
  | { type: 'chat.read'; chat_id: number; up_to_id: number }
  | { type: 'chat.typing'; chat_id: number }
  | { type: 'chat.system'; chat_id: number; system_code: string }
  | { type: 'notification'; notification_id: number; role: 'client' | 'master' }
  | { type: 'reconnected' };

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://lab.tcell.tj/api/ws';
const subs = new Set<(e: RtEvent) => void>();
let ws: WebSocket | null = null;
let ping: ReturnType<typeof setInterval> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let wasOpen = false;

function connect() {
  if (!USE_API || typeof window === 'undefined' || ws || retry || !subs.size) return;
  const t = tokens.get();
  if (!t) return;
  const sock = new WebSocket(`${WS_URL}?token=${encodeURIComponent(t.access)}`);
  ws = sock;
  sock.onopen = () => {
    attempts = 0;
    if (wasOpen) subs.forEach((f) => f({ type: 'reconnected' }));
    wasOpen = true;
    ping = setInterval(() => sock.readyState === 1 && sock.send('{"type":"ping"}'), 30000);
  };
  sock.onmessage = (m) => {
    try {
      const e = JSON.parse(m.data) as RtEvent;
      if ((e as { type: string }).type !== 'pong') subs.forEach((f) => f(e));
    } catch {}
  };
  sock.onclose = (c) => {
    clearInterval(ping);
    ws = null;
    if (c.code === 4403 || !subs.size) return; // заблокирован или никто не слушает
    // Сервер недоступен — не долбим: после MAX_ATTEMPTS ждём сети или возврата на вкладку
    if (attempts >= MAX_ATTEMPTS) return;
    const delay = Math.min(30000, 1000 * 2 ** attempts++);
    retry = setTimeout(async () => {
      retry = undefined;
      // Токен обновляем, только если он действительно истёк (иначе зря крутим сессию)
      if (expired(tokens.get()?.access)) await refresh();
      connect();
    }, delay);
  };
}
const MAX_ATTEMPTS = 5;
/** exp из JWT (секунды); запас 30 с */
function expired(jwt: string | undefined) {
  try {
    const exp = JSON.parse(atob(jwt!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp as number;
    return exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
}

export const realtime = {
  on(f: (e: RtEvent) => void) {
    subs.add(f);
    connect();
    return () => {
      subs.delete(f);
      if (!subs.size) ws?.close();
    };
  },
  /** «Я печатаю» в чате */
  typing(chatId: number) {
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'typing', chat_id: chatId }));
  },
  /** После входа/выхода — пересоздать соединение с новым токеном */
  reset() {
    clearTimeout(retry);
    retry = undefined;
    attempts = 0;
    wasOpen = false;
    ws?.close();
    ws = null;
    connect();
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => !ws && realtime.reset());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && !ws && subs.size && realtime.reset());
}
