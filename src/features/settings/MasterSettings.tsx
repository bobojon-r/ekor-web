'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, CircleHelp, Eye, FileText, Globe, Lock, LogOut, MapPin, Pause, Phone, Plus, Repeat, ShieldCheck, Wrench, X } from 'lucide-react';
import { api, apiErrorText, masterProfile, type MasterProfileData } from '@/lib/api';
import { initials, num, phoneMask, useDict, useLang } from '@/lib/i18n';
import { useRequireMaster, useSession } from '@/lib/session/SessionProvider';
import { SideNav, SiteHeader, TabBar } from '@/components/layout';
import { Button, ConfirmSheet, OtpInput, PhoneField, Segmented, Sheet, Switch, TestCodeNotice, useToast } from '@/components/ui';
import { masterSideItems } from '@/features/master/MasterCabinet';
import { masterDict } from '@/features/master/i18n';
import { profs } from '@/features/onboarding/i18n';
import { ALL_AREAS, phoneDict, settingsDict } from './i18n';
import s from './Settings.module.css';

const DEFAULT: MasterProfileData = {
  status: 'approved', profs: ['electric', 'furniture'], city: 'Душанбе', areas: ['Сино', 'Фирдавсӣ', 'Шоҳмансур'], online: false, prices: { electric: 50, furniture: null },
  exp: 2, about: '', showPhone: false, accepting: true, freeToday: true, notifyTasks: true, notifyChat: true, channel: 'sms',
};

export function MasterSettings() {
  const t = useDict(settingsDict);
  const mt = useDict(masterDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user, signOut, switchRole, update } = useSession();
  const [p, setP] = useState<MasterProfileData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [logout, setLogout] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    masterProfile.load().then((v) => setP(v ?? DEFAULT), () => setP(DEFAULT));
  }, []);
  const allowed = useRequireMaster('/master/settings');
  if (!p || (!allowed && !leaving.current)) return <div className={s.page} />;

  /** Переключатель — мгновенное действие с сохранением */
  const patch = (x: Partial<MasterProfileData>, msg: string = t.saved) => {
    // Оптимистично: переключатель меняется сразу, при ошибке — откат
    const prev = p;
    setP({ ...p, ...x });
    masterProfile.patchAsync(p, x).then(
      (v) => (setP(v), toast(msg)),
      (e) => (setP(prev), toast(apiErrorText(e, lang))),
    );
  };
  const accepting = p.accepting !== false;
  const pName = (id: string) => {
    const f = profs().find((x) => x[0] === id);
    return f ? f[lang === 'tj' ? 2 : 1] : id;
  };
  const removeArea = (a: string) => {
    if (p.areas.length === 1 && !p.online) return toast(t.minOne, 'info');
    patch({ areas: p.areas.filter((x) => x !== a) });
  };
  const name = user?.name ?? 'Фаррух Назаров';
  const phone = user?.phone ?? '935124407';

  const row = (title: ReactNode, sub: ReactNode, control: ReactNode, icon?: ReactNode) => (
    <div className={s.row}>
      {icon}
      <div className={s.rowText}>
        <span className={s.rowT}>{title}</span>
        {sub && <span className={s.rowSub}>{sub}</span>}
      </div>
      {control}
    </div>
  );

  const profileCard = (desktop: boolean) => (
    <div className={desktop ? s.profileD : s.profileM}>
      <div className={s.profileRow}>
        <span className={s.av} style={{ width: desktop ? 64 : 56, height: desktop ? 64 : 56, fontSize: desktop ? 22 : 20 }}>
          {initials(name)}
        </span>
        <div className={s.profileText}>
          <span className={desktop ? s.nameD : s.nameM}>
            {name}
            {desktop && p.status === 'approved' && (
              <span className={s.verifiedPill}>
                <ShieldCheck size={16} aria-hidden />
                {t.verified}
              </span>
            )}
          </span>
          <span className={s.muted14}>
            {p.profs.map(pName).join(', ')} · {p.city}
          </span>
          {!desktop && p.status === 'approved' && (
            <span className={s.verifiedTxt}>
              <ShieldCheck size={16} aria-hidden />
              {t.verified}
            </span>
          )}
          {p.status === 'review' && <span className={s.reviewTxt}>{lang === 'tj' ? 'Профил дар санҷиш' : 'Профиль на проверке'}</span>}
        </div>
        {desktop && (
          <Link href="/master/profile" className={s.secBtn}>
            <Eye size={18} aria-hidden />
            {t.openProfile}
          </Link>
        )}
      </div>
      {!desktop && (
        <Link href="/master/profile" className={s.secBtnFull}>
          <Eye size={18} aria-hidden />
          {t.openProfile}
        </Link>
      )}
    </div>
  );

  const availability = (desktop: boolean) => (
    <section className={s.card}>
      {desktop && <h2 className={s.cardH}>{t.availability}</h2>}
      {row(t.accepting, accepting ? t.accOn : t.accOff, <Switch checked={accepting} onChange={(v) => patch({ accepting: v })} label={t.accepting} />)}
      {accepting &&
        row(
          <>
            <span className={s.greenDot} />
            {t.free}
          </>,
          t.freeSub,
          <Switch checked={p.freeToday !== false} onChange={(v) => patch({ freeToday: v })} label={t.free} />,
        )}
      {!accepting && (
        <div className={s.paused}>
          <Pause size={18} aria-hidden className={s.noShrink} />
          <span>{t.paused}</span>
        </div>
      )}
    </section>
  );

  const work = (
    <section className={s.card}>
      <div className={s.block}>
        <div className={s.blockHead}>
          <Wrench size={20} color="var(--brand-600)" aria-hidden />
          <span className={s.rowT}>{t.profs}</span>
          <span className={s.grow} />
          <Link href="/master/profile" className={s.link}>
            {t.edit}
          </Link>
        </div>
        {p.profs.map((id) => (
          <div key={id} className={s.priceRow}>
            <span>{pName(id)}</span>
            <b>{p.prices[id] == null ? t.neg : `${t.from} ${num(p.prices[id]!)} ${t.cur}`}</b>
          </div>
        ))}
      </div>
      <div className={s.block}>
        <div className={s.blockHead}>
          <MapPin size={20} color="var(--brand-600)" aria-hidden />
          <div className={s.rowText}>
            <span className={s.rowT}>
              {t.areas} · {p.city}
            </span>
            <span className={s.rowSub}>{t.areasSub}</span>
          </div>
        </div>
        <div className={s.chips}>
          {p.areas.map((a) => (
            <span key={a} className={s.areaChip}>
              {a}
              <button type="button" aria-label="remove" className={s.areaX} onClick={() => removeArea(a)}>
                <X size={16} aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" className={s.addArea} onClick={() => setAddOpen(!addOpen)}>
            <Plus size={18} aria-hidden />
            {t.addArea}
          </button>
        </div>
        {addOpen && (
          <div className={s.suggest}>
            {ALL_AREAS.filter(([a]) => !p.areas.includes(a)).map(([a, near]) => (
              <button
                key={a}
                type="button"
                className={s.suggestItem}
                onClick={() => {
                  setAddOpen(false);
                  patch({ areas: [...p.areas, a] }, t.added(a));
                }}
              >
                <span className={s.grow}>{a}</span>
                {!!near && <span className={s.muted13}>{t.near}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {row(
        t.online,
        t.onlineSub,
        <Switch
          checked={p.online}
          onChange={(v) => {
            if (!v && !p.areas.length) return toast(t.minOne, 'info');
            patch({ online: v });
          }}
          label={t.online}
        />,
        <Globe size={20} color="var(--brand-600)" aria-hidden className={s.noShrink} />,
      )}
    </section>
  );

  const contacts = (desktop: boolean) => (
    <section className={s.card}>
      {desktop && <h2 className={s.cardH}>{t.contacts}</h2>}
      {row(
        <span className={s.muted14}>{t.phone}</span>,
        <span className={s.phoneVal}>+992 {phoneMask(phone)}</span>,
        <button type="button" className={s.link} onClick={() => setPhoneOpen(true)}>
          {t.change}
        </button>,
        <Phone size={20} color="var(--brand-600)" aria-hidden className={s.noShrink} />,
      )}
      {row(t.showPhone, p.showPhone ? t.phoneOn : t.phoneOff, <Switch checked={p.showPhone} onChange={(v) => patch({ showPhone: v })} label={t.showPhone} />)}
    </section>
  );

  const notif = (desktop: boolean) => (
    <section className={s.card}>
      {desktop && <h2 className={s.cardH}>{t.notif}</h2>}
      {row(t.nTasks, null, <Switch checked={p.notifyTasks !== false} onChange={(v) => patch({ notifyTasks: v })} label={t.nTasks} />)}
      {row(t.nChat, null, <Switch checked={p.notifyChat !== false} onChange={(v) => patch({ notifyChat: v })} label={t.nChat} />)}
      {row(t.nChosen, t.always, <Lock size={18} color="var(--ink-400)" aria-hidden />)}
      <div className={s.channel}>
        <span className={s.muted14}>{t.channel}</span>
        <Segmented
          value={p.channel ?? 'sms'}
          onChange={(v) => patch({ channel: v })}
          options={[
            { value: 'sms', label: 'SMS' },
            { value: 'tg', label: 'Telegram' },
          ]}
        />
      </div>
    </section>
  );

  const app = (
    <section className={s.card}>
      <button
        type="button"
        className={s.linkRow}
        onClick={() => {
          switchRole('client');
          router.push('/client');
        }}
      >
        <Repeat size={20} color="var(--brand-600)" aria-hidden />
        <span className={s.rowText}>
          <span className={s.rowT}>{t.role}</span>
          <span className={s.rowSub}>{t.roleSub}</span>
        </span>
        <ChevronRight size={20} color="var(--ink-400)" aria-hidden />
      </button>
      <Link href="/help" className={s.linkRowSm}>
        <CircleHelp size={20} color="var(--ink-500)" aria-hidden />
        <span className={s.grow}>{t.help}</span>
        <ChevronRight size={20} color="var(--ink-400)" aria-hidden />
      </Link>
      <Link href="/help#rules" className={s.linkRowSm}>
        <FileText size={20} color="var(--ink-500)" aria-hidden />
        <span className={s.grow}>{t.rules}</span>
        <ChevronRight size={20} color="var(--ink-400)" aria-hidden />
      </Link>
    </section>
  );

  const logoutBtn = (
    <button type="button" className={s.logout} onClick={() => setLogout(true)}>
      <LogOut size={20} aria-hidden />
      {t.logout}
    </button>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1280} />

      <div className="mob-only">
        <div className={s.mHead}>
          <h1 className={s.mTitle}>{t.title}</h1>
        </div>
        <div className={s.mBody}>
          {profileCard(false)}
          {availability(false)}
          <div className={s.overline}>{t.work}</div>
          {work}
          <div className={s.overline}>{t.contacts}</div>
          {contacts(false)}
          <div className={s.overline}>{t.notif}</div>
          {notif(false)}
          <div className={s.overline}>{t.app}</div>
          {app}
          {logoutBtn}
          <div className={s.version}>eKor · 1.0</div>
        </div>
        <TabBar />
      </div>

      <div className={`${s.dWrap} desk-only`}>
        <SideNav items={masterSideItems(mt, [0, 0, 0], 0)} />
        <div className={s.dMain}>
          {profileCard(true)}
          <div className={s.dGrid}>
            <div className={s.dCol}>
              {availability(true)}
              <section className={s.cardWrap}>
                <h2 className={s.cardHOut}>{t.work}</h2>
                {work}
              </section>
            </div>
            <div className={s.dCol}>
              {contacts(true)}
              {notif(true)}
              {app}
              {logoutBtn}
            </div>
          </div>
        </div>
      </div>

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
                leaving.current = true;
                signOut();
                router.push('/');
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

      <PhoneChange
        open={phoneOpen}
        current={phone}
        onClose={() => setPhoneOpen(false)}
        onDone={(n) => {
          update({ phone: n });
          setPhoneOpen(false);
        }}
      />
    </div>
  );
}

/** Смена номера: новый номер → SMS-код → готово */
export function PhoneChange({ open, current, onClose, onDone }: { open: boolean; current: string; onClose: () => void; onDone: (n: string) => void }) {
  const t = useDict(phoneDict);
  const toast = useToast();
  const [step, setStep] = useState<'num' | 'code'>('num');
  const [num, setNum] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<null | 'num' | 'same' | 'code'>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setStep('num');
      setNum('');
      setCode('');
      setErr(null);
    }
  }, [open]);

  const next = async () => {
    if (step === 'num') {
      if (num.length < 9) return setErr('num');
      if (num === current) return setErr('same');
      setBusy(true);
      const s = await api.auth.changePhoneSend(num);
      setBusy(false);
      if (s.error) return toast(s.error);
      setErr(null);
      return setStep('code');
    }
    setBusy(true);
    const r = await api.auth.changePhoneConfirm(num, code);
    setBusy(false);
    if (!r.ok) {
      setCode('');
      return setErr('code');
    }
    onDone(num);
    toast(t.done);
  };

  return (
    <Sheet open={open} onClose={onClose} width={460}>
      <div className={s.phoneSheet}>
        <div className={s.phoneH}>{step === 'num' ? t.h1 : t.h2}</div>
        <div className={s.phoneSub}>{step === 'num' ? t.s1 : t.s2(phoneMask(num))}</div>
        {step === 'num' ? (
          <PhoneField value={num} onChange={(v) => (setNum(v), setErr(null))} error={err === 'num' ? t.errNum : err === 'same' ? t.errSame : undefined} autoFocus />
        ) : (
          <>
            <OtpInput value={code} onChange={(v) => (setCode(v), setErr(null))} error={err === 'code'} autoFocus />
            {err === 'code' && <span className={s.err}>{t.errCode}</span>}
            <TestCodeNotice step="code" onFill={(v) => (setCode(v), setErr(null))} />
          </>
        )}
        <Button size="lg" block busy={busy} onClick={next}>
          {step === 'num' ? t.getCode : t.confirm}
        </Button>
      </div>
    </Sheet>
  );
}
