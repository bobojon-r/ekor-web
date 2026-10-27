'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, CircleCheck, Clock, Info, Lock, LockOpen, Mail, MessageCircle, X } from 'lucide-react';
import { api, apiErrorText, invites, type Invite, type InviteStatus } from '@/lib/api';
import { ago, initials, money, phoneMask, useDict, useLang, type Lang } from '@/lib/i18n';
import { useLoad } from '@/lib/hooks/useLoad';
import { AppBar, SideNav, SiteHeader, type SideItem } from '@/components/layout';
import { Button, ButtonLink, EmptyState, RadioCard, Skeleton, useToast } from '@/components/ui';
import { masterSideItems } from '@/features/master/MasterCabinet';
import { masterDict } from '@/features/master/i18n';
import { useRequireMaster } from '@/lib/session/SessionProvider';
import { inviteDict } from './i18n';
import s from './Invite.module.css';

type T = (typeof inviteDict)['ru'];

const MS: Record<InviteStatus, [string, string]> = {
  sent: ['var(--brand-100)', 'var(--brand-700)'], accepted: ['var(--warn-100)', 'var(--warn-800)'], declined: ['var(--surface-50)', 'var(--ink-400)'],
  confirmed: ['var(--success-100)', 'var(--success-700)'], cancelled: ['var(--surface-50)', 'var(--ink-400)'], public: ['var(--surface-50)', 'var(--ink-400)'],
};
const CS: Record<InviteStatus, [string, string]> = {
  sent: ['var(--warn-100)', 'var(--warn-800)'], accepted: ['var(--brand-100)', 'var(--brand-700)'], declined: ['var(--danger-100)', 'var(--danger-700)'],
  confirmed: ['var(--success-100)', 'var(--success-700)'], cancelled: ['var(--surface-50)', 'var(--ink-400)'], public: ['var(--warn-100)', 'var(--warn-800)'],
};

/** То же меню, что в кабинете мастера */
export function masterSide(_t: T): SideItem[] {
  return masterSideItems(masterDict[_t === inviteDict.tj ? 'tj' : 'ru'], [0, 0, 0], 1);
}

function useInvite(id: number) {
  const [local, setLocal] = useState<Invite | null>(null);
  const load = useLoad(() => invites.get(id), [id]);
  const inv = local ?? load.data;
  return { inv, loading: load.loading && !local, set: setLocal };
}

function facts(inv: Invite, t: T, lang: Lang) {
  const whenTxt = inviteDict[lang].when[inv.when];
  return [
    { k: t.fk[0], v: inv.district || api.region(inv.region).name[lang] },
    { k: t.fk[1], v: whenTxt },
    { k: t.fk[2], v: money(lang, inv.budget, 'upto') },
    { k: t.fk[3], v: inv.category[lang] },
  ];
}

function Note({ tone, children }: { tone: 'good' | 'warn' | 'neutral'; children: ReactNode }) {
  const I = tone === 'good' ? CircleCheck : tone === 'warn' ? Clock : Info;
  return (
    <div className={[s.note, s[`note_${tone}`]].join(' ')}>
      <I size={18} aria-hidden className={s.noShrink} />
      <span>{children}</span>
    </div>
  );
}

function NotFound({ t }: { t: T }) {
  return (
    <div className={s.nf}>
      <EmptyState icon={<Mail size={32} aria-hidden />} title={t.notFound} text={t.notFoundBody} />
    </div>
  );
}

/* ================= Мастер: входящее приглашение ================= */

export function MasterInviteView({ id }: { id: number }) {
  const t = useDict(inviteDict);
  const { lang } = useLang();
  const toast = useToast();
  const { inv, loading, set } = useInvite(id);
  const [mode, setMode] = useState<null | 'form' | 'decl'>(null);
  const [price, setPrice] = useState('');
  const [inspect, setInspect] = useState(false);
  const [when, setWhen] = useState(0);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<null | 'price' | 'msg'>(null);
  const [reason, setReason] = useState<number | null>(null);
  const [declErr, setDeclErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowed = useRequireMaster(`/master/invites/${id}`);

  if (!allowed) return <div className={s.page} />;
  if (!loading && !inv) return <Frame t={t} side><NotFound t={t} /></Frame>;

  const accept = async () => {
    if (!inspect && !(+price > 0)) return setErr('price');
    if (msg.trim().length < 20) return setErr('msg');
    setBusy(true);
    const r = await invites.accept(id, { price: inspect ? null : +price, when, msg: msg.trim() }).catch((e: unknown) => (toast(apiErrorText(e, lang)), null));
    setBusy(false);
    if (!r) return;
    set(r);
    setMode(null);
    toast(t.tAccepted);
  };
  const decline = async () => {
    if (reason === null) return setDeclErr(true);
    setBusy(true);
    const r = await invites.decline(id, reason).catch((e: unknown) => (toast(apiErrorText(e, lang)), null));
    setBusy(false);
    if (!r) return;
    set(r);
    setMode(null);
    toast(t.tDeclined);
  };

  const st = inv?.status ?? 'sent';
  const good = st === 'confirmed';
  const note = { accepted: t.nAccepted, declined: t.nDeclined, confirmed: t.nConfirmed, cancelled: t.nCancelled, public: t.nDeclined, sent: null }[st];
  const showActions = st === 'sent' && !mode;

  const termsForm = (desktop: boolean) => (
    <div className={desktop ? s.formD : s.card}>
      <span className={desktop ? s.formTitleD : s.formTitle}>{t.yourTerms}</span>
      <div className={desktop ? s.termsGrid : s.termsCol}>
        <div className={s.priceRow}>
          <div className={[s.priceBox, inspect && s.priceOff, err === 'price' && s.invalid].filter(Boolean).join(' ')}>
            <input value={inspect ? '' : price} disabled={inspect} onChange={(e) => (setPrice(e.target.value.replace(/\D/g, '').slice(0, 5)), setErr(null))} inputMode="numeric" placeholder={t.pricePh} className={s.priceInput} />
            <span className={s.affix}>смн</span>
          </div>
          <button type="button" aria-pressed={inspect} onClick={() => (setInspect(!inspect), setErr(null))} className={[s.inspectBtn, inspect && s.pillOn].filter(Boolean).join(' ')}>
            {t.afterInspect}
          </button>
        </div>
        <div className={s.chips}>
          {t.whenO.map((l, i) => (
            <button key={l} type="button" aria-pressed={when === i} onClick={() => setWhen(i)} className={[desktop ? s.whenD : s.whenM, when === i && s.pillOn].filter(Boolean).join(' ')}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <textarea value={msg} onChange={(e) => (setMsg(e.target.value.slice(0, 1000)), setErr(null))} rows={3} placeholder={t.msgPh} className={[s.msg, err === 'msg' && s.invalid].filter(Boolean).join(' ')} />
      {desktop ? (
        <div className={s.formFootD}>
          <span className={s.errFlex}>{err === 'price' ? t.errPrice : err === 'msg' ? t.errMsg : ''}</span>
          <span className={s.count}>{msg.trim().length} / 1000</span>
          <Button variant="secondary" size="sm" onClick={() => setMode(null)}>
            {t.cancel}
          </Button>
          <Button size="sm" busy={busy} onClick={accept}>
            {t.sendAccept}
          </Button>
        </div>
      ) : (
        <>
          <div className={s.msgFoot}>
            <span className={s.errText}>{err === 'price' ? t.errPrice : err === 'msg' ? t.errMsg : ''}</span>
            <span className={s.count}>{msg.trim().length} / 1000</span>
          </div>
          <Button size="md" block busy={busy} onClick={accept}>
            {t.sendAccept}
          </Button>
          <button type="button" className={s.textBtn} onClick={() => setMode(null)}>
            {t.cancel}
          </button>
        </>
      )}
    </div>
  );

  const declForm = (desktop: boolean) => (
    <div className={desktop ? s.formD : s.card} style={{ gap: desktop ? 10 : 8 }}>
      <span className={desktop ? s.formTitleD : s.formTitle}>{t.declH}</span>
      <span className={s.muted14}>{t.declSub}</span>
      <div className={desktop ? s.reasonGrid : s.reasonCol} role="radiogroup">
        {t.declR.map((r, i) => (
          <RadioCard key={r} tone="danger" selected={reason === i} onClick={() => (setReason(i), setDeclErr(false))}>
            {r}
          </RadioCard>
        ))}
      </div>
      {declErr && <span className={s.errText}>{t.errReason}</span>}
      {desktop ? (
        <div className={s.formFootD}>
          <span className={s.errFlex} />
          <Button variant="secondary" size="sm" onClick={() => setMode(null)}>
            {t.cancel}
          </Button>
          <Button variant="danger" size="sm" busy={busy} onClick={decline}>
            {t.declBtn}
          </Button>
        </div>
      ) : (
        <>
          <Button variant="danger" size="md" block busy={busy} onClick={decline} className={s.mt4}>
            {t.declBtn}
          </Button>
          <button type="button" className={s.textBtn} onClick={() => setMode(null)}>
            {t.cancel}
          </button>
        </>
      )}
    </div>
  );

  const address = inv?.contacts && (
    <div className={s.addrOpen}>
      <span className={s.addrNote}>
        <LockOpen size={16} aria-hidden />
        {t.addrNote}
      </span>
      <span className={s.addrText}>
        {inv.contacts.address} · <a href={`tel:+992${inv.contacts.phone}`}>+992 {phoneMask(inv.contacts.phone)}</a>
      </span>
    </div>
  );
  const locked = (
    <div className={s.locked}>
      <Lock size={16} aria-hidden className={s.noShrink} />
      <span>{t.addrLocked}</span>
    </div>
  );
  const badge = <span className={s.badge} style={{ background: MS[st][0], color: MS[st][1] }}>{t.st[st]}</span>;

  return (
    <Frame t={t} side title={t.invTitle} back="/master">
      {!inv ? (
        <LoadingCard />
      ) : (
        <>
          {/* mobile */}
          <div className={`${s.mCol} mob-only`}>
            <div className={s.badgeRow}>
              {badge}
              <span className={s.muted13}>{ago(lang, inv.createdAt)}</span>
            </div>
            <div className={s.card}>
              <div className={s.clientRow}>
                <span className={s.avGrey}>{initials(inv.clientName)}</span>
                <div className={s.clientText}>
                  <span className={s.clientName}>{inv.clientName}</span>
                  <span className={s.muted13}>{t.invitedYou}</span>
                </div>
              </div>
              <div className={s.taskTitle}>{inv.title}</div>
              <div className={s.taskDesc}>{inv.desc}</div>
              <div className={s.facts2}>
                {facts(inv, t, lang).map((f) => (
                  <div key={f.k} className={s.fact}>
                    <span className={s.factK}>{f.k}</span>
                    <span className={s.factV}>{f.v}</span>
                  </div>
                ))}
              </div>
              {good ? address : locked}
            </div>
            {st === 'sent' && mode === 'form' && termsForm(false)}
            {st === 'sent' && mode === 'decl' && declForm(false)}
            {note && <Note tone={good ? 'good' : st === 'accepted' ? 'warn' : 'neutral'}>{note}</Note>}
            {good && (
              <ButtonLink href="/chats" size="md" block icon={<MessageCircle size={18} aria-hidden />}>
                {t.openChat}
              </ButtonLink>
            )}
            <div className={s.infoBanner}>
              <Info size={18} aria-hidden className={s.noShrink} />
              <span>{t.noPayMaster}</span>
            </div>
            {showActions && <div className={s.barSpacer} />}
            {showActions && (
              <div className={s.mBar}>
                <Button variant="secondary" size="lg" className={s.flex1} onClick={() => (setMode('decl'), setDeclErr(false))}>
                  {t.declineBtn}
                </Button>
                <Button size="lg" className={s.flex14} onClick={() => (setMode('form'), setErr(null))}>
                  {t.acceptBtn}
                </Button>
              </div>
            )}
          </div>

          {/* desktop */}
          <div className={`${s.dCol} desk-only`}>
            <div className={s.dCard}>
              <div className={s.badgeRow}>
                {badge}
                <span className={s.muted13}>
                  {inv.clientName} · {t.invitedYou} · {ago(lang, inv.createdAt)}
                </span>
              </div>
              <div className={s.dTitle}>{inv.title}</div>
              <div className={s.dDesc}>{inv.desc}</div>
              <div className={s.facts4}>
                {facts(inv, t, lang).map((f) => (
                  <div key={f.k} className={s.factD}>
                    <span className={s.factK}>{f.k}</span>
                    <span className={s.factV}>{f.v}</span>
                  </div>
                ))}
              </div>
              {good ? address : locked}
              {showActions && (
                <div className={s.dActions}>
                  <Button size="md" onClick={() => (setMode('form'), setErr(null))}>
                    {t.acceptBtn}
                  </Button>
                  <Button variant="secondary" size="md" onClick={() => (setMode('decl'), setDeclErr(false))}>
                    {t.declineBtn}
                  </Button>
                </div>
              )}
              {st === 'sent' && mode === 'form' && termsForm(true)}
              {st === 'sent' && mode === 'decl' && declForm(true)}
            </div>
            {note && <Note tone={good ? 'good' : st === 'accepted' ? 'warn' : 'neutral'}>{note}</Note>}
            {good && (
              <ButtonLink href="/chats" size="md" icon={<MessageCircle size={18} aria-hidden />} className={s.selfStart}>
                {t.openChat}
              </ButtonLink>
            )}
            <div className={s.infoBanner}>
              <Info size={18} aria-hidden className={s.noShrink} />
              <span>{t.noPayMaster}</span>
            </div>
          </div>
        </>
      )}
    </Frame>
  );
}

/* ================= Клиент: заявка-приглашение ================= */

export function ClientInviteView({ id }: { id: number }) {
  const t = useDict(inviteDict);
  const { lang } = useLang();
  const toast = useToast();
  const { inv, loading, set } = useInvite(id);
  const [busy, setBusy] = useState<null | 'confirm' | 'public' | 'cancel'>(null);

  if (!loading && !inv) return <Frame t={t} title={t.myTask} back="/client"><NotFound t={t} /></Frame>;

  const run = async (k: 'confirm' | 'public' | 'cancel', msg: string) => {
    setBusy(k);
    const r = await (k === 'confirm' ? invites.confirm(id) : k === 'public' ? invites.makePublic(id) : invites.cancel(id)).catch((e: unknown) => (toast(apiErrorText(e, lang)), null));
    setBusy(null);
    if (!r) return;
    set(r);
    toast(msg);
  };

  const master = inv ? api.masterSync(inv.masterId) : null;
  const st = inv?.status ?? 'sent';
  const good = st === 'confirmed';
  const city = inv ? api.region(inv.region).name[lang] : '';
  const cNote = { confirmed: t.cConfirmed, public: t.cPublic(city), cancelled: t.cCancelled, sent: null, accepted: null, declined: null }[st];
  const stepDone = [true, st !== 'sent' && st !== 'cancelled', good];
  const offerPrice = inv?.offer ? (inv.offer.price === null ? t.afterInspect : money(lang, inv.offer.price)) : '';

  const actions = inv && (
    <>
      {st === 'accepted' && (
        <>
          <Button size="lg" block busy={busy === 'confirm'} onClick={() => run('confirm', t.tConfirmed)}>
            {t.confirmBtn}
          </Button>
          <Link href="/masters" className={s.linkBtn}>
            {t.inviteOther}
          </Link>
        </>
      )}
      {st === 'declined' && (
        <>
          <Button size="lg" block busy={busy === 'public'} onClick={() => run('public', t.tPublic)}>
            {t.makePublic}
          </Button>
          <ButtonLink href="/masters" variant="secondary" size="md" block>
            {t.inviteOther}
          </ButtonLink>
        </>
      )}
      {st === 'sent' && (
        <Button variant="secondary" size="md" block busy={busy === 'cancel'} onClick={() => run('cancel', t.tCancelled)}>
          {t.cancelInv}
        </Button>
      )}
      {good && (
        <ButtonLink href="/chats" size="lg" block icon={<MessageCircle size={18} aria-hidden />}>
          {t.openChat}
        </ButtonLink>
      )}
      {(st === 'public' || st === 'cancelled') && (
        <ButtonLink href="/client" variant="secondary" size="lg" block>
          {t.toMyTasks}
        </ButtonLink>
      )}
    </>
  );

  return (
    <Frame t={t} title={t.myTask} back="/client" narrow>
      {!inv ? (
        <LoadingCard />
      ) : (
        <div className={s.cCol}>
          <div className={s.badgeRow}>
            <span className={s.badge} style={{ background: CS[st][0], color: CS[st][1] }}>
              {t.cst[st]}
            </span>
            <span className={s.badge} style={{ background: 'var(--line-100)', color: 'var(--ink-700)' }}>
              {st === 'public' ? t.publicL : t.privacyL}
            </span>
          </div>
          <div className={s.cTitle}>{inv.title}</div>
          <div className={s.timelineBox}>
            {t.tl.map((l, i) => {
              const done = stepDone[i];
              const cur = !done && stepDone[i - 1];
              const bad = i === 1 && (st === 'declined' || st === 'public');
              return (
                <div key={l} className={s.tlItem} style={{ color: done || cur || bad ? 'var(--ink-900)' : 'var(--ink-400)', fontWeight: cur ? 600 : 400 }}>
                  <span className={s.tlDot} style={{ background: bad ? 'var(--danger-600)' : done ? 'var(--success-600)' : cur ? 'var(--warn-600)' : 'var(--stepper-off)' }}>
                    {bad ? <X size={14} color="#fff" aria-hidden /> : done ? <Check size={14} color="#fff" aria-hidden /> : null}
                  </span>
                  {bad ? t.cst.declined : l}
                </div>
              );
            })}
          </div>
          <div className={s.card} style={{ border: `1.5px solid ${st === 'accepted' ? 'var(--brand-300)' : 'var(--line-200)'}`, gap: 10 }}>
            <div className={s.clientRow}>
              <span className={s.avBrand}>{master ? initials(master.name) : ''}</span>
              <div className={s.clientText}>
                <Link href={`/masters/${inv.masterId}`} className={s.masterName}>
                  {master?.name}
                </Link>
                <span className={s.muted13}>{master && `${master.profession[lang]} · ★ ${master.rating.toFixed(1).replace('.', ',')}`}</span>
              </div>
            </div>
            {inv.offer && (st === 'accepted' || good) && (
              <div className={s.offer}>
                <div className={s.offerRow}>
                  <span className={s.muted14}>{t.price}</span>
                  <b>{offerPrice}</b>
                </div>
                <div className={s.offerRow}>
                  <span className={s.muted14}>{t.whenL}</span>
                  <b className={s.right}>{t.whenO[inv.offer.when]}</b>
                </div>
                <span className={s.offerMsg}>«{inv.offer.msg}»</span>
              </div>
            )}
            {(st === 'declined' || st === 'public') && inv.declineReason !== undefined && (
              <div className={s.declBox}>
                <b>{t.declinedL}</b> {t.declR[inv.declineReason]}
              </div>
            )}
            {st === 'sent' && <span className={s.muted14}>{t.waitingTxt}</span>}
          </div>
          {cNote && <Note tone={good ? 'good' : 'warn'}>{cNote}</Note>}
          <div className={s.cActionsD}>{actions}</div>
          <div className={s.barSpacer} />
          <div className={s.cBar}>{actions}</div>
        </div>
      )}
    </Frame>
  );
}

/* ---------- каркас страницы ---------- */

function Frame({ t, children, side, title, back, narrow }: { t: T; children: ReactNode; side?: boolean; title?: string; back?: string; narrow?: boolean }) {
  return (
    <div className={s.page}>
      <SiteHeader max={side ? 1360 : 1280} />
      {title && <AppBar title={title} back={back ?? true} />}
      <main className={side ? s.cabinet : narrow ? s.narrowWrap : s.wrap}>
        {side && (
          <div className="desk-only">
            <SideNav items={masterSide(t)} />
          </div>
        )}
        <div className={s.main}>{children}</div>
      </main>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className={s.card}>
      <Skeleton w="40%" h={14} />
      <Skeleton w="80%" h={20} />
      <Skeleton w="100%" light />
      <Skeleton w="70%" light />
    </div>
  );
}
