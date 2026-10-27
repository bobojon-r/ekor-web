'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, Hourglass, Lock, PencilLine, TrendingUp, UserPlus } from 'lucide-react';
import { api, apiErrorText, clientTasks, type ClientTask } from '@/lib/api';
import { num, useDict, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { SiteHeader } from '@/components/layout';
import { Button, ButtonLink, EmptyState, RadioCard, Sheet, Skeleton, useToast } from '@/components/ui';
import { clientDict } from '@/features/client/i18n';
import { manageDict } from './i18n';
import s from './Manage.module.css';

type T = (typeof manageDict)['ru'];
type Form = { title: string; desc: string; budget: string; neg: boolean; when: number };

const ST: Record<string, [string, string]> = {
  open: ['var(--brand-100)', 'var(--brand-700)'], review: ['var(--warn-100)', 'var(--warn-800)'],
  expired: ['var(--line-100)', 'var(--ink-700)'], cancelled: ['var(--surface-50)', 'var(--ink-400)'],
};
const DAY = 24 * 3600 * 1000;

export function ManageTask({ id }: { id: number }) {
  const t = useDict(manageDict);
  const ct = useDict(clientDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useSession();
  const [task, setTask] = useState<ClientTask | null | undefined>(undefined);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [f, setF] = useState<Form | null>(null);
  const [focus, setFocus] = useState<null | 'budget' | 'desc'>(null);
  const [tried, setTried] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<number | null>(null);
  const [reasonErr, setReasonErr] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clientTasks.list().then((l) => setTask(l.find((k) => k.id === id) ?? null));
  }, [id]);
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=/client/tasks/${id}/manage`);
  }, [ready, user, router, id]);

  if (task === null)
    return (
      <Frame t={t} title={t.viewT}>
        <EmptyState title={lang === 'tj' ? 'Супориш ёфт нашуд' : 'Задание не найдено'} action={<ButtonLink href="/client" size="sm">{t.myTasks}</ButtonLink>} />
      </Frame>
    );
  if (!task)
    return (
      <Frame t={t} title={t.viewT}>
        <div className={s.card}>
          <Skeleton w="30%" />
          <Skeleton w="80%" h={24} />
          <Skeleton w="100%" light />
        </div>
      </Frame>
    );

  const k = task;
  const status = k.status as 'open' | 'review' | 'expired' | 'cancelled';
  const managed = ['open', 'review', 'expired', 'cancelled'].includes(k.status);
  if (!managed) {
    router.replace(`/client/tasks/${k.id}`);
    return null;
  }
  const n = k.responses?.length ?? 0;
  const noResp = status === 'open' && n === 0 && Date.now() - +new Date(k.createdAt) > DAY;
  const canEdit = status === 'open' || status === 'review';
  const budgetTxt = k.budgetMax == null ? t.neg : `${t.upTo} ${num(k.budgetMax)} смн`;
  const catTxt = (ct.cats as Record<string, string>)[k.category] ?? t.cat;
  const facts = [
    { k: t.fk[0], v: catTxt },
    { k: t.fk[1], v: `${api.region(k.region).name[lang]}, ${k.district}` },
    { k: t.fk[2], v: budgetTxt },
    { k: t.fk[3], v: t.whenO[k.when] },
  ];
  const meta = metaText(k, lang, n);

  const startEdit = (fc: null | 'budget' | 'desc') => {
    const raise = fc === 'budget' && k.budgetMax != null ? Math.max(k.budgetMax, 200) : k.budgetMax;
    setF({ title: k.title, desc: k.desc ?? '', budget: raise == null ? '' : String(raise), neg: fc === 'budget' ? false : k.budgetMax == null, when: k.when });
    setFocus(fc);
    setTried(false);
    setMode('edit');
    window.scrollTo({ top: 0 });
  };
  const titleBad = !!f && (f.title.trim().length < 10 || f.title.length > 120);
  const descBad = !!f && f.desc.trim().length < 30;
  const reReview = !!f && status !== 'expired' && (f.title !== k.title || f.desc !== (k.desc ?? ''));
  const budgetUp = !!f && !f.neg && k.budgetMax != null && +f.budget > k.budgetMax;

  const save = async () => {
    if (!f) return;
    setTried(true);
    if (titleBad || descBad) return;
    setBusy(true);
    const list = await clientTasks.update(k.id, { title: f.title.trim(), desc: f.desc.trim(), budgetMax: f.neg || !f.budget ? null : +f.budget, when: f.when }).catch((e: unknown) => (toast(apiErrorText(e, lang)), null));
    setBusy(false);
    if (!list) return;
    setTask(list.find((x) => x.id === k.id) ?? null);
    setMode('view');
    toast(reReview ? t.tReview : t.tSaved);
  };
  const doCancel = async () => {
    if (reason === null) return setReasonErr(true);
    setBusy(true);
    const list = await clientTasks.cancelTask(k.id, reason).catch((e: unknown) => (toast(apiErrorText(e, lang)), null));
    setBusy(false);
    if (!list) return;
    setTask(list.find((x) => x.id === k.id) ?? null);
    setCancelOpen(false);
    toast(t.tCancelled);
  };
  const republish = async () => {
    setBusy(true);
    const list = await clientTasks.republish(k.id).catch((e: unknown) => (toast(apiErrorText(e, lang)), null));
    setBusy(false);
    if (!list) return;
    setTask(list.find((x) => x.id === k.id) ?? null);
    toast(t.tRepub);
  };

  const tipIcons = [TrendingUp, PencilLine, UserPlus];
  const tipGo = (i: number) => (i === 0 ? startEdit('budget') : i === 1 ? startEdit('desc') : router.push(`/masters?cat=${k.category}`));
  const banner = (noResp || status === 'expired') && (
    <div className={s.banner} style={{ borderColor: status === 'expired' ? 'var(--line-300)' : 'var(--brand-300)' }}>
      <div className={s.bannerRow}>
        {status === 'expired' ? <Clock size={22} color="var(--ink-500)" aria-hidden className={s.noShrink} /> : <Hourglass size={22} color="var(--brand-600)" aria-hidden className={s.noShrink} />}
        <div className={s.bannerText}>
          <span className={s.bannerT}>{status === 'expired' ? t.exT : t.noT}</span>
          <span className={s.bannerB}>{status === 'expired' ? t.exB : t.noB.replace('23', String(k.views ?? 0))}</span>
        </div>
      </div>
      {noResp &&
        t.tips.map((l, i) => {
          const I = tipIcons[i];
          return (
            <button key={l} type="button" className={s.tip} onClick={() => tipGo(i)}>
              <I size={18} color="var(--brand-600)" aria-hidden />
              <span className={s.grow}>{l}</span>
              <ChevronRight size={18} color="var(--ink-400)" aria-hidden className="mob-only" />
            </button>
          );
        })}
    </div>
  );

  const editForm = f && (
    <div className={s.form}>
      <h2 className={`${s.editT} desk-only`}>{t.editT}</h2>
      {reReview && (
        <div className={s.warn}>
          <Clock size={18} aria-hidden className={s.noShrink} />
          <span>{t.reReview}</span>
        </div>
      )}
      <label className={s.field}>
        <span className={s.label}>{t.fTitle}</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value.slice(0, 120) })} className={[s.input, tried && titleBad && s.invalid].filter(Boolean).join(' ')} />
        <span className={s.msgRow}>
          <span className={s.err}>{tried && titleBad ? t.errTitle : ''}</span>
          <span className={s.count}>{f.title.length} / 120</span>
        </span>
      </label>
      <label className={s.field}>
        <span className={s.label}>{t.fDesc}</span>
        <textarea autoFocus={focus === 'desc'} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value.slice(0, 3000) })} rows={5} className={[s.textarea, focus === 'desc' && s.focusRing, tried && descBad && s.invalid].filter(Boolean).join(' ')} />
        <span className={s.msgRow}>
          <span className={s.err}>{tried && descBad ? t.errDesc : ''}</span>
          <span className={s.count}>{f.desc.length} / 3000</span>
        </span>
      </label>
      <div className={s.twoCols}>
        <div className={s.field8}>
          <span className={s.label}>{t.fBudget}</span>
          <div className={s.budgetRow}>
            <label className={[s.budgetBox, f.neg && s.boxOff, focus === 'budget' && s.focusRing].filter(Boolean).join(' ')}>
              <span className={s.affix}>{t.upTo}</span>
              <input autoFocus={focus === 'budget'} value={f.neg ? '' : f.budget} disabled={f.neg} inputMode="numeric" onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={s.budgetInput} />
              <span className={s.affix}>смн</span>
            </label>
            <button type="button" aria-pressed={f.neg} onClick={() => setF({ ...f, neg: !f.neg })} className={[s.negBtn, f.neg && s.on].filter(Boolean).join(' ')}>
              {t.neg}
            </button>
          </div>
          {budgetUp && <span className={s.good}>{t.budgetUp}</span>}
        </div>
        <div className={s.field8}>
          <span className={s.label}>{t.fWhen}</span>
          <div className={s.grid2}>
            {t.whenO.map((l, i) => (
              <button key={l} type="button" aria-pressed={f.when === i} onClick={() => setF({ ...f, when: i })} className={[s.whenBtn, f.when === i && s.on].filter(Boolean).join(' ')}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={s.locked}>{t.lockedFields}</div>
    </div>
  );
  const saveLabel = reReview ? t.saveRe : t.save;

  return (
    <Frame t={t} title={mode === 'edit' ? t.editT : t.viewT} onBack={mode === 'edit' ? () => setMode('view') : undefined}>
      {/* ===== mobile ===== */}
      <div className="mob-only">
        {mode === 'view' ? (
          <div className={s.mCol}>
            <div className={s.stRow}>
              <span className={s.badge} style={{ background: ST[status][0], color: ST[status][1] }}>
                {t.st[status]}
              </span>
              <span className={s.muted13}>{meta}</span>
            </div>
            <h1 className={s.mTitle}>{k.title}</h1>
            {k.desc && <p className={s.desc}>{k.desc}</p>}
            <div className={s.facts2}>
              {facts.map((x) => (
                <div key={x.k} className={s.factM}>
                  <span className={s.factK}>{x.k}</span>
                  <span className={s.factV}>{x.v}</span>
                </div>
              ))}
            </div>
            {banner}
            <div className={s.addr}>
              <Lock size={16} aria-hidden className={s.noShrink} />
              <span>{t.addrNote}</span>
            </div>
          </div>
        ) : (
          <div className={s.mCol}>{editForm}</div>
        )}
        <div className={s.spacer} />
        <div className={s.mBar}>
          {mode === 'edit' ? (
            <div className={s.row}>
              <Button variant="secondary" size="md" className={s.flex1} onClick={() => setMode('view')}>
                {t.cancel}
              </Button>
              <Button size="md" className={s.flex14} busy={busy} onClick={save}>
                {saveLabel}
              </Button>
            </div>
          ) : (
            <>
              {canEdit && (
                <div className={s.row}>
                  <Button variant="danger-outline" size="md" className={s.flex1} onClick={() => (setReason(null), setReasonErr(false), setCancelOpen(true))}>
                    {t.cancelTask}
                  </Button>
                  <Button size="md" className={s.flex13} onClick={() => startEdit(null)}>
                    {t.edit}
                  </Button>
                </div>
              )}
              {status === 'expired' && (
                <>
                  <Button size="lg" block busy={busy} onClick={republish}>
                    {t.republish}
                  </Button>
                  <button type="button" className={s.textBtn} onClick={() => startEdit(null)}>
                    {t.editFirst}
                  </button>
                </>
              )}
              {status === 'cancelled' && (
                <ButtonLink href="/tasks/new" variant="secondary" size="lg" block>
                  {t.createSimilar}
                </ButtonLink>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== desktop ===== */}
      <div className={`${s.dGrid} desk-only`}>
        <div className={s.dCard}>
          {mode === 'view' ? (
            <>
              <div className={s.stRow}>
                <span className={s.badge} style={{ background: ST[status][0], color: ST[status][1] }}>
                  {t.st[status]}
                </span>
                <span className={s.muted13}>{meta}</span>
              </div>
              <h1 className={s.dTitle}>{k.title}</h1>
              {k.desc && <p className={s.dDesc}>{k.desc}</p>}
              <div className={s.facts4}>
                {facts.map((x) => (
                  <div key={x.k} className={s.factD}>
                    <span className={s.factK}>{x.k}</span>
                    <span className={s.factV}>{x.v}</span>
                  </div>
                ))}
              </div>
              <div className={s.addrD}>
                <Lock size={16} aria-hidden className={s.noShrink} />
                <span>{t.addrNote}</span>
              </div>
            </>
          ) : (
            <>
              {editForm}
              <div className={s.dFormBtns}>
                <Button variant="secondary" size="md" onClick={() => setMode('view')}>
                  {t.cancel}
                </Button>
                <Button size="md" busy={busy} onClick={save}>
                  {saveLabel}
                </Button>
              </div>
            </>
          )}
        </div>
        <aside className={s.dSide}>
          {banner}
          <div className={s.actions}>
            {canEdit && (
              <>
                <Button size="md" block onClick={() => startEdit(null)}>
                  {t.edit}
                </Button>
                <Button variant="danger-outline" size="sm" block onClick={() => (setReason(null), setReasonErr(false), setCancelOpen(true))}>
                  {t.cancelTask}
                </Button>
              </>
            )}
            {status === 'expired' && (
              <Button size="md" block busy={busy} onClick={republish}>
                {t.republish}
              </Button>
            )}
            {status === 'cancelled' && (
              <ButtonLink href="/tasks/new" variant="secondary" size="md" block>
                {t.createSimilar}
              </ButtonLink>
            )}
            <span className={s.muted13}>{status === 'expired' ? t.sideExp : status === 'cancelled' ? t.sideCanc : t.sideOpen}</span>
          </div>
        </aside>
      </div>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} width={460}>
        <div className={s.cancel}>
          <div className={s.cancelH}>{t.cancelH}</div>
          <div className={s.muted14}>{t.cancelSub0}</div>
          <div className={s.reasons} role="radiogroup">
            {t.cancelR.map((l, i) => (
              <RadioCard key={l} tone="danger" selected={reason === i} onClick={() => (setReason(i), setReasonErr(false))}>
                {l}
              </RadioCard>
            ))}
          </div>
          {reasonErr && <span className={s.err}>{t.errReason}</span>}
          <div className={s.cancelBtns}>
            <Button variant="danger" size="lg" block busy={busy} onClick={doCancel}>
              {t.cancelTask}
            </Button>
            <Button variant="secondary" size="md" block onClick={() => setCancelOpen(false)}>
              {t.keep}
            </Button>
          </div>
        </div>
      </Sheet>
    </Frame>
  );
}

function metaText(k: ClientTask, lang: 'ru' | 'tj', n: number) {
  const views = k.views ?? 0;
  const hours = Math.round((Date.now() - +new Date(k.createdAt)) / 3600000);
  const when = hours < 24 ? (lang === 'tj' ? `${Math.max(1, hours)} соат пеш` : `${Math.max(1, hours)} ч назад`) : lang === 'tj' ? `${Math.round(hours / 24)} рӯз пеш` : `${Math.round(hours / 24)} дн. назад`;
  if (k.status === 'review') return lang === 'tj' ? 'одатан то 30 дақиқа' : 'обычно до 30 минут';
  if (k.status === 'expired') return lang === 'tj' ? `14 рӯз кушода буд · ҷавобҳо ${n}` : `было открыто 14 дней · откликов ${n}`;
  if (k.status === 'cancelled') return lang === 'tj' ? 'бекор шуд' : 'отменено';
  return lang === 'tj' ? `нашр шуд ${when} · дидаанд ${views} · ҷавобҳо ${n}` : `опубликовано ${when} · просмотров ${views} · откликов ${n}`;
}

function Frame({ t, title, children, onBack }: { t: T; title: string; children: React.ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <div className={s.page}>
      <SiteHeader max={1280} />
      <div className={`${s.mTop} mob-only`}>
        <button type="button" className={s.iconBtn} aria-label={t.myTasks} onClick={onBack ?? (() => (history.length > 1 ? router.back() : router.push('/client')))}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <span className={s.mTopTitle}>{title}</span>
      </div>
      <div className={s.wrap}>
        <Link href="/client" className={`${s.backLink} desk-only`}>
          <ChevronLeft size={18} aria-hidden />
          {t.myTasks}
        </Link>
        {children}
      </div>
    </div>
  );
}
