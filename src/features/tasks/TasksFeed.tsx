'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, Clock, Eye, Flag, Globe, Inbox, MapPin, Share2, Sparkles, Users,
} from 'lucide-react';
import { api, DAILY_LIMIT, USE_API, proposals, type CatalogCategory, type FeedQuery, type FeedTask, type Proposal } from '@/lib/api';
import { ago, initials, num, useDict, useLang, type Lang } from '@/lib/i18n';
import { useLoad } from '@/lib/hooks/useLoad';
import { useRegion } from '@/lib/hooks/useRegion';
import { useSession } from '@/lib/session/SessionProvider';
import { SiteHeader, TabBar } from '@/components/layout';
import { Button, ButtonLink, EmptyState, LangSwitch, Sheet, Skeleton, useToast } from '@/components/ui';
import { feedDict } from './i18n';
import { LoadState } from '@/features/system/SystemStates';
import s from './Tasks.module.css';

type T = (typeof feedDict)['ru'];
type Sort = NonNullable<FeedQuery['sort']>;
type Store = ReturnType<typeof proposals.state>;

export function budgetText(k: FeedTask, t: T, lang: Lang) {
  const cur = 'смн';
  if (k.bmin && k.bmax) return k.bmin === k.bmax ? `${num(k.bmin)} ${cur}` : `${num(k.bmin)}–${num(k.bmax)} ${cur}`;
  if (k.bmin) return `${t.from} ${num(k.bmin)} ${cur}`;
  if (k.bmax) return `${t.to} ${num(k.bmax)} ${cur}`;
  return lang === 'tj' ? 'Бо мувофиқа' : 'Договорная';
}
const whenText = (k: FeedTask, t: T) => t.when[k.when] + (k.tod !== null ? `, ${t.tod[k.tod]}` : '');
const placeText = (k: FeedTask, lang: Lang) =>
  k.online ? (lang === 'tj' ? 'Онлайн дар тамоми Тоҷикистон' : 'Онлайн по всему Таджикистану') : `${k.district}, ${api.region(k.region!).name[lang]}`;

/** selectedId — открыто задание (/tasks/[id]); на мобильном это отдельный экран, на десктопе — правая панель */
export function TasksFeed({ selectedId }: { selectedId?: number }) {
  const t = useDict(feedDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const isMaster = !!user?.roles.includes('master');
  const [region, setRegion, regionReady] = useRegion();
  const [online, setOnline] = useState(false);
  const [cat, setCat] = useState<CatalogCategory | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [store, setStore] = useState<Store>({ used: 0, sent: {} });
  const [sheet, setSheet] = useState(false);

  useEffect(() => setStore(proposals.state()), []);

  const query: FeedQuery = { region, online, category: cat, sort };
  const { data, loading, showSkeleton, phase, retry } = useLoad(() => api.feed(query), [JSON.stringify(query)], regionReady);
  const list = data ?? [];
  const regionName = api.region(region).name[lang];
  const matchN = list.filter((k) => k.match).length;
  // Открытое задание: из списка, а подробности (описание, клиент) — отдельным запросом
  const [detail, setDetail] = useState<FeedTask | null>(null);
  const selId = selectedId ?? list[0]?.id;
  useEffect(() => {
    if (!selId) return;
    const cached = api.feedTaskSync(selId);
    if (cached && (!USE_API || cached.full)) return setDetail(cached);
    let live = true;
    api.feedTask(selId).then((k) => live && setDetail(k), () => {});
    return () => {
      live = false;
    };
  }, [selId, data]);
  const sel = (detail?.id === selId ? detail : null) ?? (selId ? api.feedTaskSync(selId) : null);

  const send = async (id: number, p: Proposal) => {
    const next = await proposals.send(id, p);
    setStore(next);
    setSheet(false);
    toast(t.sentToast);
  };
  const withdraw = async (id: number) => {
    setStore(await proposals.withdraw(id));
    toast(t.withdrawn);
  };
  const resetAll = () => {
    setCat(null);
    setOnline(false);
  };

  const regionSelect = (cls: string) => (
    <label className={cls}>
      <MapPin size={18} color="var(--brand-600)" aria-hidden />
      <select value={region} onChange={(e) => setRegion(e.target.value as typeof region)} className={s.select}>
        {api.regions().map((r) => (
          <option key={r.key} value={r.key}>
            {r.name[lang]}
          </option>
        ))}
      </select>
    </label>
  );
  const onlineBtn = (cls: string) => (
    <button type="button" aria-pressed={online} onClick={() => setOnline(!online)} className={[cls, online && s.on].filter(Boolean).join(' ')}>
      <Globe size={18} aria-hidden />
      {t.online}
    </button>
  );
  const sortSelect = (cls: string) => (
    <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cls} aria-label="sort">
      {(['new', 'few', 'high'] as const).map((v, i) => (
        <option key={v} value={v}>
          {t.sorts[i]}
        </option>
      ))}
    </select>
  );
  const catChips = (cls: string) =>
    [null, ...api.filterCats().map((c) => c.k)].map((k) => (
      <button key={String(k)} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={[cls, cat === k && s.on].filter(Boolean).join(' ')}>
        {k ? (api.catName(k)?.[lang] ?? k) : t.all}
      </button>
    ));
  const empty = !loading && list.length === 0 && (
    <div className={s.empty}>
      <span className={s.emptyIco}>
        <Inbox size={24} color="#B5651D" aria-hidden />
      </span>
      <div className={s.emptyT}>{t.emptyT}</div>
      <div className={s.emptyB}>{t.emptyBody(regionName)}</div>
      <div className={s.emptyBtns}>
        <Button variant="secondary" size="md" onClick={resetAll}>
          {t.reset}
        </Button>
        <Button size="md" onClick={() => setOnline(true)}>
          {t.seeOnline}
        </Button>
      </div>
    </div>
  );
  const cards = (desktop: boolean) =>
    list.map((k) => (
      <TaskCard key={k.id} k={k} t={t} lang={lang} mine={!!store.sent[k.id]} selected={desktop && sel?.id === k.id} desktop={desktop} />
    ));

  const panel = (k: FeedTask) => <ProposalPanel task={k} t={t} role={isMaster ? 'master' : 'guest'} store={store} onSend={send} onWithdraw={withdraw} />;

  /* ---------- мобильная карточка задания ---------- */
  if (selectedId) {
    const k = sel;
    const sent = k ? store.sent[k.id] : undefined;
    const showCta = !!k && k.status === 'open' && !sent;
    return (
      <div className={s.page}>
        <SiteHeader max={1200} />
        <div className="mob-only">
          <div className={s.mDetailTop}>
            <button type="button" className={s.backBtn} onClick={() => (history.length > 1 ? router.back() : router.push('/tasks'))}>
              <ChevronLeft size={24} aria-hidden />
              {t.back}
            </button>
            <span className={s.grow} />
            <ShareBtn t={t} />
          </div>
          <div className={s.mDetail}>
            {!k ? (
              <EmptyState title={t.notFound} text={t.notFoundBody} />
            ) : (
              <>
                <TaskBody k={k} t={t} lang={lang} />
                {sent && (
                  <div className={s.yourResp}>
                    <div className={s.yourRespT}>{t.yourResp}</div>
                    {panel(k)}
                  </div>
                )}
                {k.status === 'chosen' && !sent && panel(k)}
                <button type="button" className={s.complain} onClick={() => toast(t.complaintSent, 'info')}>
                  <Flag size={16} aria-hidden />
                  {t.complain}
                </button>
              </>
            )}
          </div>
          {showCta && (
            <div className={s.cta}>
              <span className={s.ctaNote}>{isMaster ? t.ctaMaster : t.ctaGuest}</span>
              <Button size="lg" block onClick={() => setSheet(true)}>
                {t.respond}
              </Button>
            </div>
          )}
          {k && (
            <Sheet
              open={sheet}
              onClose={() => setSheet(false)}
              title={
                <div className={s.sheetHead}>
                  <span>{t.respond}</span>
                  <span className={s.sheetSub}>{k.title}</span>
                </div>
              }
            >
              <div className={s.sheetBody}>{panel(k)}</div>
            </Sheet>
          )}
        </div>
        <div className="desk-only">{desktopView()}</div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <SiteHeader max={1200} />
      <div className="mob-only">
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <h1 className={s.mTitle}>{t.tasks}</h1>
            <LangSwitch />
          </div>
          <div className={s.mFilters}>
            {regionSelect(s.mRegion)}
            {onlineBtn(s.mOnline)}
          </div>
          <div className={s.mChips}>{catChips(s.mChip)}</div>
        </div>
        {isMaster && matchN > 0 && (
          <div className={s.mMatch}>
            <Sparkles size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />
            <span>{t.match(matchN)}</span>
          </div>
        )}
        <div className={s.mBar}>
          <span className={s.found}>{t.found(list.length)}</span>
          <label className={s.mSort}>
            <ArrowUpDown size={16} color="var(--ink-500)" aria-hidden />
            {sortSelect(s.mSortSelect)}
          </label>
        </div>
        <div className={s.mList}>
          <LoadState phase={phase} retry={retry} />
          {showSkeleton && phase !== 'slow' && [1, 2, 3, 4].map((i) => <div key={i} className={s.skM} />)}
          {empty}
          {!loading && cards(false)}
        </div>
        <TabBar />
      </div>
      <div className="desk-only">{desktopView()}</div>
    </div>
  );

  function desktopView() {
    return (
      <div className={s.dWrap}>
        <div className={s.dHead}>
          <div className={s.dTitleBlock}>
            <div className={s.crumbs}>
              <Link href="/">{t.home}</Link> / {t.tasks}
            </div>
            <h1 className={s.dTitle}>{online ? t.titleOnline : `${t.titleIn} ${regionName}`}</h1>
          </div>
          <div className={s.dControls}>
            {regionSelect(s.dRegion)}
            {onlineBtn(s.dOnline)}
            <label className={s.dSort}>
              <ArrowUpDown size={16} color="var(--ink-500)" aria-hidden />
              {sortSelect(s.select)}
            </label>
          </div>
        </div>
        <div className={s.dChips}>{catChips(s.dChip)}</div>
        {isMaster && matchN > 0 && (
          <div className={s.dMatch}>
            <Sparkles size={18} color="var(--brand-600)" aria-hidden />
            <span className={s.grow}>{t.match(matchN)}</span>
            <Link href="/master/settings" className={s.setupBtn}>
              {t.setupAreas}
            </Link>
          </div>
        )}
        <div className={s.dGrid}>
          <div className={s.dList}>
            <span className={s.found}>{t.found(list.length)}</span>
            <LoadState phase={phase} retry={retry} />
            {showSkeleton && phase !== 'slow' && [1, 2, 3, 4].map((i) => <div key={i} className={s.skD} />)}
            {empty}
            {!loading && cards(true)}
          </div>
          {sel ? (
            <div className={s.dDetail}>
              <div className={s.dBody}>
                <TaskBody k={sel} t={t} lang={lang} />
                <button type="button" className={s.complain} onClick={() => toast(t.complaintSent, 'info')}>
                  <Flag size={16} aria-hidden />
                  {t.complain}
                </button>
              </div>
              <div className={s.dPanel}>
                {isMaster && sel.status === 'open' && !store.sent[sel.id] && <div className={s.panelTitle}>{t.respond}</div>}
                {panel(sel)}
              </div>
            </div>
          ) : (
            loading && (
              <div className={s.dBody}>
                <Skeleton w="30%" />
                <Skeleton w="80%" h={24} />
                <Skeleton w="40%" h={20} />
              </div>
            )
          )}
        </div>
      </div>
    );
  }
}

function ShareBtn({ t }: { t: T }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={s.iconBtn}
      aria-label={t.share}
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ url: location.href });
          else {
            await navigator.clipboard.writeText(location.href);
            toast(t.linkCopied);
          }
        } catch {}
      }}
    >
      <Share2 size={20} aria-hidden />
    </button>
  );
}

function TaskCard({ k, t, lang, mine, selected, desktop }: { k: FeedTask; t: T; lang: Lang; mine: boolean; selected: boolean; desktop: boolean }) {
  const PlaceI = k.online ? Globe : MapPin;
  const st = k.status === 'open' ? s.stOpen : s.stChosen;
  return (
    <Link href={`/tasks/${k.id}`} scroll={!desktop} className={[desktop ? s.dCard : s.mCard, selected && s.cardSel].filter(Boolean).join(' ')}>
      <span className={s.cardTop}>
        <span className={s.cardTitle}>{k.title}</span>
        <span className={s.cardBudget}>{budgetText(k, t, lang)}</span>
      </span>
      <span className={desktop ? s.cardMetaD : s.cardMeta}>
        <span className={s.metaItem}>
          <PlaceI size={16} aria-hidden />
          {placeText(k, lang)}
        </span>
        <span className={s.metaItem}>
          <CalendarDays size={16} aria-hidden />
          {whenText(k, t)}
        </span>
      </span>
      <span className={desktop ? s.cardFootD : s.cardFoot}>
        <span className={st}>{t.statusShort[k.status]}</span>
        {k.responses ? t.respN(k.responses) : t.noResp} · {ago(lang, k.createdAt)}
        {mine && (
          <span className={s.mine}>
            <BadgeCheck size={14} aria-hidden />
            {t.youResponded}
          </span>
        )}
      </span>
    </Link>
  );
}

export function TaskBody({ k, t, lang }: { k: FeedTask; t: T; lang: Lang }) {
  const PlaceI = k.online ? Globe : MapPin;
  const ic = { size: 18, color: 'var(--brand-600)', 'aria-hidden': true, className: s.noShrink } as const;
  return (
    <div className={s.body}>
      <div className={s.bodyHead}>
        <div className={s.bodyBadges}>
          <span className={[k.status === 'open' ? s.stOpen : s.stChosen, s.stLg].join(' ')}>{t.statusLong[k.status]}</span>
          <span className={s.muted13}>{api.catName(k.category)?.[lang]}</span>
        </div>
        <h1 className={s.bodyTitle}>{k.title}</h1>
        <div className={s.bodyBudget}>{budgetText(k, t, lang)}</div>
      </div>
      <div className={s.meta}>
        <div className={s.metaRow}>
          <PlaceI {...ic} />
          <span className={s.metaText}>
            <span>{placeText(k, lang)}</span>
            {!k.online && <span className={s.muted13}>{t.addrNote}</span>}
          </span>
        </div>
        <div className={s.metaRow}>
          <CalendarDays {...ic} />
          <span>{whenText(k, t)}</span>
        </div>
        <div className={s.metaRow}>
          <Clock {...ic} />
          <span>
            {t.published(ago(lang, k.createdAt))} · {t.views(k.views)}
          </span>
        </div>
      </div>
      <div className={s.descBlock}>
        <div className={s.descT}>{t.desc}</div>
        <div className={s.descText}>{k.desc}</div>
      </div>
      {k.photos > 0 && (
        <div className={s.photos}>
          {Array.from({ length: k.photos }, (_, i) => (
            <div key={i} className={s.photo}>
              {t.photoPh}
            </div>
          ))}
        </div>
      )}
      <div className={s.client}>
        <span className={s.clientAv}>{initials(k.client)}</span>
        <span className={s.clientText}>
          <span className={s.clientName}>{k.client}</span>
          <span className={s.muted13}>{t.clientSince(k.clientSince, k.clientDone)}</span>
        </span>
      </div>
      <div className={s.respInfo}>
        <Users size={18} color="var(--ink-500)" aria-hidden className={s.noShrink} />
        <span>{t.respInfo(k.responses)}</span>
      </div>
    </div>
  );
}

/* ---------- ProposalForm ---------- */

function ProposalPanel({
  task, t, role, store, onSend, onWithdraw,
}: {
  task: FeedTask;
  t: T;
  role: 'guest' | 'master';
  store: Store;
  onSend: (id: number, p: Proposal) => Promise<void>;
  onWithdraw: (id: number) => Promise<void>;
}) {
  const sent = store.sent[task.id];
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState('');
  const [inspect, setInspect] = useState(false);
  const [term, setTerm] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<Partial<Record<'price' | 'term' | 'msg', true>>>({});
  const [busy, setBusy] = useState(false);

  // при переключении задания — сбросить черновик
  useEffect(() => {
    setEditing(false);
    setPrice('');
    setInspect(false);
    setTerm(null);
    setMsg('');
    setErr({});
  }, [task.id]);

  if (role === 'guest')
    return (
      <div className={s.guest}>
        <span className={s.guestIco}>
          <BriefcaseBusiness size={26} color="var(--brand-600)" aria-hidden />
        </span>
        <div className={s.guestT}>{t.guestT}</div>
        <div className={s.guestB}>{t.guestB}</div>
        <ButtonLink href="/become-master" size="lg" block>
          {t.becomeBtn}
        </ButtonLink>
        <ButtonLink href={`/login?next=/tasks/${task.id}`} variant="secondary" size="md" block>
          {t.haveAcc}
        </ButtonLink>
      </div>
    );

  if (sent && !editing)
    return (
      <div className={s.sent}>
        <div className={s.sentHead}>
          <span className={s.sentIco}>
            <Check size={20} color="var(--success-700)" aria-hidden />
          </span>
          <span className={s.sentT}>{t.sentT}</span>
        </div>
        <div className={s.sentCard}>
          <div className={s.sentRow}>
            <span className={s.muted14}>{t.yourPrice}</span>
            <span className={s.sentPrice}>{sent.price === null ? t.afterInspect : `${num(sent.price)} смн`}</span>
          </div>
          <div className={s.sentRow}>
            <span className={s.muted14}>{t.term}</span>
            <span className={s.sentTerm}>{t.terms[sent.term]}</span>
          </div>
          <div className={s.sentMsg}>{sent.msg}</div>
        </div>
        <div className={s.steps}>
          {t.nextSteps.map((x) => (
            <div key={x} className={s.step}>
              <span className={s.dot} />
              <span>{x}</span>
            </div>
          ))}
        </div>
        <div className={s.sentBtns}>
          <Button
            variant="secondary"
            size="md"
            className={s.flex1}
            onClick={() => {
              setPrice(sent.price === null ? '' : String(sent.price));
              setInspect(sent.price === null);
              setTerm(sent.term);
              setMsg(sent.msg);
              setEditing(true);
            }}
          >
            {t.editBtn}
          </Button>
          <Button variant="danger-outline" size="md" className={s.flex1} onClick={() => onWithdraw(task.id)}>
            {t.withdraw}
          </Button>
        </div>
      </div>
    );

  if (task.status === 'chosen')
    return (
      <div className={s.closed}>
        <span className={s.closedT}>{t.closedT}</span>
        <span className={s.muted14}>{t.closedB}</span>
      </div>
    );

  const limitOver = store.used >= DAILY_LIMIT && !sent;
  const submit = async () => {
    if (busy) return;
    const e: typeof err = {};
    if (!inspect && !(+price > 0)) e.price = true;
    if (term === null) e.term = true;
    if (msg.trim().length < 20) e.msg = true;
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    await onSend(task.id, { price: inspect ? null : +price, term: term!, msg: msg.trim() });
    setBusy(false);
    setEditing(false);
  };

  return (
    <div className={s.form}>
      <div className={s.limit}>{limitOver ? t.limitOver : t.limit(store.used, DAILY_LIMIT)}</div>
      <div className={s.field}>
        <span className={s.label}>{t.price}</span>
        <label className={[s.priceBox, inspect && s.priceOff, err.price && s.invalid].filter(Boolean).join(' ')}>
          <input value={inspect ? '' : price} disabled={inspect} onChange={(e) => (setPrice(e.target.value.replace(/\D/g, '').slice(0, 6)), setErr({}))} inputMode="numeric" placeholder={t.pricePh} className={s.priceInput} />
          <span className={s.muted14}>смн</span>
        </label>
        <button type="button" role="checkbox" aria-checked={inspect} className={s.check} onClick={() => (setInspect(!inspect), setErr({}))}>
          <span className={[s.box, inspect && s.boxOn].filter(Boolean).join(' ')}>{inspect && <Check size={14} color="#fff" aria-hidden />}</span>
          {t.inspect}
        </button>
        {err.price && <span className={s.err}>{t.errPrice}</span>}
      </div>
      <div className={s.field}>
        <span className={s.label}>{t.term}</span>
        <div className={s.chips}>
          {t.terms.map((l, i) => (
            <button key={l} type="button" aria-pressed={term === i} onClick={() => (setTerm(i), setErr({}))} className={[s.pill, term === i && s.on].filter(Boolean).join(' ')}>
              {l}
            </button>
          ))}
        </div>
        {err.term && <span className={s.err}>{t.errTerm}</span>}
      </div>
      <label className={s.fieldSm}>
        <span className={s.labelRow}>
          {t.msg}
          <span className={s.count}>{msg.length}/1000</span>
        </span>
        <textarea value={msg} onChange={(e) => (setMsg(e.target.value.slice(0, 1000)), setErr({}))} rows={4} placeholder={t.msgPh} className={[s.textarea, err.msg && s.invalid].filter(Boolean).join(' ')} />
        {err.msg && <span className={s.err}>{t.errMsg}</span>}
      </label>
      <button type="button" className={s.tpl} onClick={() => (setMsg(t.tplText), setErr({}))}>
        {t.tpl}
      </button>
      <div className={s.privacy}>
        <Eye size={16} aria-hidden className={s.noShrink} />
        <span>{t.privacy}</span>
      </div>
      <Button size="lg" block busy={busy} disabled={limitOver} onClick={submit}>
        {t.send}
      </Button>
    </div>
  );
}
