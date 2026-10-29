'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, ChevronRight, CircleHelp, FileText, LogOut, Mail, Phone, Repeat, Star } from 'lucide-react';
import { api, clientTasks, invites, type ClientTask, type Invite } from '@/lib/api';
import { ago, money, phoneMask, useDict, useLang, type Lang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { AppBar, SideNav, SiteHeader, TabBar } from '@/components/layout';
import { Button, ConfirmSheet, EmptyState, Segmented, Switch, TextField, useToast } from '@/components/ui';
import { PhoneChange } from '@/features/settings/MasterSettings';
import { inviteDict } from '@/features/invite/i18n';
import { clientSide } from './ClientCabinet';
import { clientDict } from './i18n';
import { CHAT } from '@/lib/features';
import s from './ClientExtra.module.css';

const dict = {
  ru: {
    invites: 'Приглашения мастерам', invitesEmpty: 'Вы ещё никого не приглашали', invitesEmptyB: 'Найдите мастера в каталоге и нажмите «Предложить работу».', toCatalog: 'Найти мастера',
    reviews: 'Мои отзывы', reviewsEmpty: 'Отзывов пока нет', reviewsEmptyB: 'Оставить отзыв можно после заказа, выполненного через eKor.', reply: 'Ответ мастера', master: 'Мастер',
    settings: 'Настройки', profile: 'Профиль', name: 'Имя', nameHint: 'Мастера видят только имя', save: 'Сохранить', saved: 'Сохранено', errName: 'Введите имя — от 2 букв',
    phone: 'Телефон', change: 'Изменить', notif: 'Уведомления', nResp: 'Новые отклики на мои задания', nChat: 'Сообщения в чате', nDone: 'Мастер отметил работу выполненной', always: 'Всегда включено',
    channel: 'Куда присылать', lang: 'Язык', langSub: 'Сохраняется в профиле', app: 'Приложение', toMaster: 'Перейти в режим мастера', becomeMaster: 'Стать мастером', roleSub: 'Аккаунт один — тот же номер',
    help: 'Поддержка', rules: 'Правила', logout: 'Выйти', logoutH: 'Выйти из аккаунта?', logoutB: 'Задания сохранятся. Войти снова — по номеру и SMS-коду.', cancel: 'Отмена',
  },
  tj: {
    invites: 'Даъват ба устоҳо', invitesEmpty: 'Шумо ҳанӯз касеро даъват накардаед', invitesEmptyB: 'Усторо дар каталог ёбед ва «Кор пешниҳод кардан»-ро пахш кунед.', toCatalog: 'Усторо ёбед',
    reviews: 'Шарҳҳои ман', reviewsEmpty: 'Ҳоло шарҳ нест', reviewsEmptyB: 'Шарҳро пас аз фармоише, ки тавассути eKor иҷро шудааст, гузоштан мумкин.', reply: 'Ҷавоби усто', master: 'Усто',
    settings: 'Танзимот', profile: 'Профил', name: 'Ном', nameHint: 'Устоҳо танҳо номро мебинанд', save: 'Захира', saved: 'Захира шуд', errName: 'Номро ворид кунед — аз 2 ҳарф',
    phone: 'Телефон', change: 'Иваз кардан', notif: 'Огоҳиномаҳо', nResp: 'Ҷавобҳои нав ба супоришҳои ман', nChat: 'Паёмҳо дар чат', nDone: 'Усто корро иҷрошуда қайд кард', always: 'Ҳамеша фаъол',
    channel: 'Ба куҷо фиристем', lang: 'Забон', langSub: 'Дар профил нигоҳ дошта мешавад', app: 'Барнома', toMaster: 'Ба реҷаи усто гузаштан', becomeMaster: 'Усто шудан', roleSub: 'Як аккаунт — ҳамон рақам',
    help: 'Дастгирӣ', rules: 'Қоидаҳо', logout: 'Баромадан', logoutH: 'Аз аккаунт мебароед?', logoutB: 'Супоришҳо нигоҳ дошта мешаванд. Боз ворид шудан — бо рақам ва рамзи SMS.', cancel: 'Бекор',
  },
};
type D = (typeof dict)['ru'];

/** Каркас страниц кабинета клиента: левое меню на десктопе, шапка на мобильном */
function ClientFrame({ title, children, back = '/client' }: { title: string; children: ReactNode; back?: string }) {
  const ct = useDict(clientDict);
  const router = useRouter();
  const { user, ready } = useSession();
  const leaving = useRef(false);
  useEffect(() => {
    if (ready && !user && !leaving.current) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
  }, [ready, user, router]);
  return (
    <div className={s.page}>
      <SiteHeader max={1280} />
      <AppBar title={title} back={back} />
      <div className={s.wrap}>
        <div className="desk-only">
          <SideNav items={clientSide(ct)} />
        </div>
        <main className={s.main}>
          <h1 className={`${s.h} desk-only`}>{title}</h1>
          {user ? children : null}
        </main>
      </div>
      <TabBar />
    </div>
  );
}

/* ---------- Приглашения мастерам ---------- */

export function ClientInvites() {
  const t = useDict(dict);
  const it = useDict(inviteDict);
  const { lang } = useLang();
  const [list, setList] = useState<Invite[] | null>(null);
  useEffect(() => {
    invites.list('client').then((l) => setList(l.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))));
  }, []);
  return (
    <ClientFrame title={t.invites}>
      {list && list.length === 0 && (
        <EmptyState icon={<Mail size={32} aria-hidden />} title={t.invitesEmpty} text={t.invitesEmptyB} action={<Link href="/masters">{t.toCatalog}</Link>} />
      )}
      <div className={s.list}>
        {list?.map((inv) => {
          const m = api.masterSync(inv.masterId);
          return (
            <Link key={inv.id} href={`/client/invites/${inv.id}`} className={s.row}>
              <span className={s.rowTop}>
                <span className={s.badge}>{it.cst[inv.status]}</span>
                <span className={s.muted13}>{ago(lang, inv.createdAt)}</span>
              </span>
              <span className={s.rowTitle}>{inv.title}</span>
              <span className={s.muted14}>
                {t.master}: {m?.name} · {money(lang, inv.budget, 'upto')}
              </span>
            </Link>
          );
        })}
      </div>
    </ClientFrame>
  );
}

/* ---------- Мои отзывы ---------- */

export function ClientReviews() {
  const t = useDict(dict);
  const [list, setList] = useState<ClientTask[] | null>(null);
  useEffect(() => {
    clientTasks.list().then((l) => setList(l.filter((k) => k.review)));
  }, []);
  return (
    <ClientFrame title={t.reviews}>
      {list && list.length === 0 && <EmptyState icon={<Star size={32} aria-hidden />} title={t.reviewsEmpty} text={t.reviewsEmptyB} />}
      <div className={s.list}>
        {list?.map((k) => (
          <div key={k.id} className={s.card}>
            <div className={s.rowTop}>
              <span className={s.stars}>{'★'.repeat(k.review!.stars) + '☆'.repeat(5 - k.review!.stars)}</span>
              <span className={s.muted13}>{k.review!.date}</span>
            </div>
            <Link href={`/client/tasks/${k.id}`} className={s.rowTitle}>
              {k.title}
            </Link>
            <span className={s.muted14}>
              {t.master}: {k.master?.name}
            </span>
            <p className={s.text}>{k.review!.text}</p>
            {k.review!.reply && (
              <div className={s.reply}>
                <b>{t.reply}:</b> {k.review!.reply}
              </div>
            )}
          </div>
        ))}
      </div>
    </ClientFrame>
  );
}

/* ---------- Настройки клиента ---------- */

const PREFS = 'ekor_client_prefs';
type Prefs = { nResp: boolean; nChat: boolean; channel: 'sms' | 'tg' };

export function ClientSettings() {
  const t = useDict(dict);
  const { lang, setLang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user, update, signOut, switchRole } = useSession();
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ nResp: true, nChat: true, channel: 'sms' });
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [logout, setLogout] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS);
      if (raw) setPrefs(JSON.parse(raw));
    } catch {}
  }, []);
  const setPref = (p: Partial<Prefs>) => {
    const v = { ...prefs, ...p };
    setPrefs(v);
    try {
      localStorage.setItem(PREFS, JSON.stringify(v));
    } catch {}
    toast(t.saved);
  };
  const isMaster = !!user?.roles.includes('master');
  const row = (title: ReactNode, sub: ReactNode, control: ReactNode, icon?: ReactNode) => (
    <div className={s.setRow}>
      {icon}
      <div className={s.setText}>
        <span className={s.setT}>{title}</span>
        {sub && <span className={s.muted14}>{sub}</span>}
      </div>
      {control}
    </div>
  );

  return (
    <ClientFrame title={t.settings}>
      <section className={s.card}>
        <span className={s.cardH}>{t.profile}</span>
        <div className={s.nameRow}>
          <TextField
            wrapClassName={s.grow}
            label={t.name}
            value={name}
            onChange={(e) => (setName(e.target.value.slice(0, 40)), setNameErr(false))}
            error={nameErr ? t.errName : undefined}
            hint={t.nameHint}
            autoComplete="given-name"
          />
          <Button
            size="md"
            className={s.saveBtn}
            disabled={!user || name.trim() === user.name}
            onClick={() => {
              if (name.trim().length < 2) return setNameErr(true);
              update({ name: name.trim() });
              toast(t.saved);
            }}
          >
            {t.save}
          </Button>
        </div>
        {row(
          <span className={s.muted14}>{t.phone}</span>,
          <span className={s.phoneVal}>+992 {user ? phoneMask(user.phone) : ''}</span>,
          <button type="button" className={s.link} onClick={() => setPhoneOpen(true)}>
            {t.change}
          </button>,
          <Phone size={20} color="var(--brand-600)" aria-hidden />,
        )}
      </section>

      <section className={s.card}>
        <span className={s.cardH}>{t.notif}</span>
        {row(t.nResp, null, <Switch checked={prefs.nResp} onChange={(v) => setPref({ nResp: v })} label={t.nResp} />)}
        {CHAT && row(t.nChat, null, <Switch checked={prefs.nChat} onChange={(v) => setPref({ nChat: v })} label={t.nChat} />)}
        {row(t.nDone, t.always, null)}
        <div className={s.stack}>
          <span className={s.muted14}>{t.channel}</span>
          <Segmented value={prefs.channel} onChange={(v) => setPref({ channel: v })} options={[{ value: 'sms', label: 'SMS' }, { value: 'tg', label: 'Telegram' }]} />
        </div>
        <div className={s.stack}>
          <span className={s.muted14}>
            {t.lang} · {t.langSub}
          </span>
          <Segmented value={lang} onChange={(v: Lang) => setLang(v)} options={[{ value: 'ru', label: 'Русский' }, { value: 'tj', label: 'Тоҷикӣ' }]} />
        </div>
      </section>

      <section className={s.card}>
        <span className={s.cardH}>{t.app}</span>
        <button
          type="button"
          className={s.linkRow}
          onClick={() => {
            if (isMaster) {
              switchRole('master');
              router.push('/master');
            } else router.push('/become-master');
          }}
        >
          {isMaster ? <Repeat size={20} color="var(--brand-600)" aria-hidden /> : <BriefcaseBusiness size={20} color="var(--brand-600)" aria-hidden />}
          <span className={s.setText}>
            <span className={s.setT}>{isMaster ? t.toMaster : t.becomeMaster}</span>
            <span className={s.muted14}>{t.roleSub}</span>
          </span>
          <ChevronRight size={20} color="var(--ink-400)" aria-hidden />
        </button>
        <Link href="/help" className={s.linkRow}>
          <CircleHelp size={20} color="var(--ink-500)" aria-hidden />
          <span className={s.grow}>{t.help}</span>
          <ChevronRight size={20} color="var(--ink-400)" aria-hidden />
        </Link>
        <Link href="/help#rules" className={s.linkRow}>
          <FileText size={20} color="var(--ink-500)" aria-hidden />
          <span className={s.grow}>{t.rules}</span>
          <ChevronRight size={20} color="var(--ink-400)" aria-hidden />
        </Link>
      </section>

      <button type="button" className={s.logout} onClick={() => setLogout(true)}>
        <LogOut size={20} aria-hidden />
        {t.logout}
      </button>

      <ConfirmSheet
        open={logout}
        onClose={() => setLogout(false)}
        title={t.logoutH}
        text={t.logoutB}
        actions={
          <>
            <Button
              variant="danger"
              size="lg"
              block
              onClick={() => {
                setLogout(false);
                router.push('/');
                signOut();
              }}
            >
              {t.logout}
            </Button>
            <Button variant="secondary" size="lg" block onClick={() => setLogout(false)}>
              {t.cancel}
            </Button>
          </>
        }
      />
      {user && <PhoneChange open={phoneOpen} current={user.phone} onClose={() => setPhoneOpen(false)} onDone={(n) => (update({ phone: n }), setPhoneOpen(false))} />}
    </ClientFrame>
  );
}
