/** Вход по SMS-коду и профиль пользователя (/auth/*, /me) */
import { ApiError, http, tokens } from '../http';
import { realtime } from '../realtime';
import { digits, intl } from './common';
import { uiLang } from '../ref';

export type UserOut = { id: number; phone: string; name: string | null; lang: 'ru' | 'tj'; city_id: number | null; avatar_url: string | null; is_client: boolean; is_master: boolean };
type AuthOut = { access_token: string; refresh_token: string; user: UserOut; needs_name: boolean };

let me: UserOut | null = null;
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Нет связи. Проверьте интернет');

export const realAuth = {
  me: () => me,
  /** error — текст для пользователя (лимит отправок, неверный номер, нет сети) */
  async sendCode(phone: string) {
    try {
      const r = await http<{ resend_after: number }>('/auth/otp/send', { method: 'POST', body: { phone: intl(phone), lang: uiLang() } });
      return { phone, resendIn: r.resend_after, tries: 3 };
    } catch (e) {
      return { phone, resendIn: 0, tries: 3, error: msg(e) };
    }
  },
  /** ok:false — неверный или истёкший код; name:null — новый пользователь, спросим имя */
  async verify(phone: string, code: string) {
    try {
      const r = await http<AuthOut>('/auth/otp/verify', { method: 'POST', body: { phone: intl(phone), code } });
      tokens.set({ access: r.access_token, refresh: r.refresh_token });
      me = r.user;
      realtime.reset();
      return { ok: true as const, name: r.needs_name ? null : r.user.name };
    } catch (e) {
      return { ok: false as const, name: null, error: msg(e) };
    }
  },
  async fetchMe() {
    if (!tokens.get()) return (me = null);
    me = await http<UserOut>('/me');
    return me;
  },
  async updateMe(p: { name?: string; lang?: 'ru' | 'tj'; city_id?: number }) {
    me = await http<UserOut>('/me', { method: 'PATCH', body: p });
    return me;
  },
  async logout() {
    const t = tokens.get();
    tokens.set(null);
    me = null;
    realtime.reset();
    if (t) await http('/auth/logout', { method: 'POST', body: { refresh_token: t.refresh } }).catch(() => {});
  },
  /** Смена номера: код на новый номер, затем подтверждение */
  async changePhoneSend(phone: string) {
    try {
      await http('/me/phone/change', { method: 'POST', body: { new_phone: intl(phone) } });
      return {};
    } catch (e) {
      return { error: msg(e) };
    }
  },
  async changePhoneConfirm(phone: string, code: string) {
    try {
      me = await http<UserOut>('/me/phone/change/confirm', { method: 'POST', body: { new_phone: intl(phone), code } });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: msg(e) };
    }
  },
};

export const phoneDigits = digits;
