'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, LogOut, Repeat, Settings } from 'lucide-react';
import { useDict } from '@/lib/i18n';
import { maskPhone, useSession } from '@/lib/session/SessionProvider';
import { Avatar, Button, ConfirmSheet } from '@/components/ui';
import s from './Layout.module.css';

const dict = {
  ru: {
    client: 'Клиент', master: 'Мастер', noName: 'Имя не указано', addName: 'Указать имя', settings: 'Настройки', toMaster: 'Режим мастера', toClient: 'Режим клиента',
    becomeMaster: 'Стать мастером', logout: 'Выйти', logoutH: 'Выйти из аккаунта?', logoutB: 'Задания сохранятся. Войти снова — по номеру и SMS-коду.', cancel: 'Отмена', you: 'Вы вошли как',
  },
  tj: {
    client: 'Мизоҷ', master: 'Усто', noName: 'Ном нишон дода нашудааст', addName: 'Номро нишон диҳед', settings: 'Танзимот', toMaster: 'Реҷаи усто', toClient: 'Реҷаи мизоҷ',
    becomeMaster: 'Усто шудан', logout: 'Баромадан', logoutH: 'Аз аккаунт мебароед?', logoutB: 'Супоришҳо нигоҳ дошта мешаванд. Боз ворид шудан — бо рақам ва рамзи SMS.', cancel: 'Бекор', you: 'Шумо ворид шудед ҳамчун',
  },
};

/**
 * Профиль в мобильном кабинете: кто вошёл (имя, номер, роль) и куда дальше —
 * настройки, смена роли, выход. На десктопе то же — в левом меню.
 */
export function ProfileCard() {
  const t = useDict(dict);
  const router = useRouter();
  const { user, switchRole, signOut } = useSession();
  const [logout, setLogout] = useState(false);
  if (!user) return null;
  const isMaster = user.activeRole === 'master';
  const hasMaster = user.roles.includes('master');
  const settings = isMaster ? '/master/settings' : '/client/settings';
  const swap = () => {
    if (!hasMaster) return router.push('/become-master');
    switchRole(isMaster ? 'client' : 'master');
    router.push(isMaster ? '/client' : '/master');
  };

  return (
    <section className={s.profile} aria-label={t.you}>
      <div className={s.profileTop}>
        <Avatar name={user.name || '?'} size={48} />
        <div className={s.profileText}>
          <span className={s.profileName}>{user.name || t.noName}</span>
          <span className={s.sidePhone}>{maskPhone(user.phone)}</span>
        </div>
        <span className={isMaster ? s.roleMaster : s.roleClient}>{isMaster ? t.master : t.client}</span>
      </div>
      {!user.name && (
        <Link href={settings} className={s.profileWarn}>
          {t.addName} →
        </Link>
      )}
      <div className={s.profileBtns}>
        <Link href={settings} className={s.profileBtn}>
          <Settings size={18} aria-hidden />
          {t.settings}
        </Link>
        <button type="button" className={s.profileBtn} onClick={swap}>
          {hasMaster ? <Repeat size={18} aria-hidden /> : <BriefcaseBusiness size={18} aria-hidden />}
          {hasMaster ? (isMaster ? t.toClient : t.toMaster) : t.becomeMaster}
        </button>
        <button type="button" className={`${s.profileBtn} ${s.profileOut}`} onClick={() => setLogout(true)} aria-label={t.logout}>
          <LogOut size={18} aria-hidden />
        </button>
      </div>
      <ConfirmSheet
        open={logout}
        onClose={() => setLogout(false)}
        title={t.logoutH}
        text={t.logoutB}
        actions={
          <>
            <Button variant="danger" size="lg" block onClick={() => (setLogout(false), router.push('/'), signOut())}>
              {t.logout}
            </Button>
            <Button variant="secondary" size="lg" block onClick={() => setLogout(false)}>
              {t.cancel}
            </Button>
          </>
        }
      />
    </section>
  );
}

/** Роль рядом с именем в левом меню */
export function RoleBadge() {
  const t = useDict(dict);
  const { user } = useSession();
  if (!user) return null;
  const m = user.activeRole === 'master';
  return <span className={m ? s.roleMaster : s.roleClient}>{m ? t.master : t.client}</span>;
}
