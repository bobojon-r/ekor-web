'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ChevronLeft, Search, SearchX, ShieldCheck, SlidersHorizontal, Star, X } from 'lucide-react';
import { api, type CatalogCategory, type Master, type MastersQuery, type RegionKey } from '@/lib/api';
import { countReviews, initials, money, rating, useDict, useLang, type Lang } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useLoad } from '@/lib/hooks/useLoad';
import { useRegion } from '@/lib/hooks/useRegion';
import { SiteHeader, TabBar } from '@/components/layout';
import { LangSwitch, Sheet } from '@/components/ui';
import { mastersDict } from './i18n';
import { LoadState } from '@/features/system/SystemStates';
import s from './Masters.module.css';

type Filters = { cat: CatalogCategory | null; price: number; rating: number; online: boolean; avail: boolean };
const F0: Filters = { cat: null, price: 0, rating: 0, online: false, avail: false };
const PRICES = [0, 50, 100, 200];
const RATINGS = [0, 4, 4.5];
type Sort = NonNullable<MastersQuery['sort']>;

const toQuery = (f: Filters, region: RegionKey, q: string, sort: Sort): MastersQuery => ({
  region, q, sort, category: f.cat, priceMax: f.price, ratingMin: f.rating, onlineOnly: f.online, availableOnly: f.avail,
});

export function MastersCatalog({ initialCat, initialQ }: { initialCat?: string; initialQ?: string }) {
  const t = useDict(mastersDict);
  const c = useDict(common);
  const { lang } = useLang();
  const [region, setRegion, regionReady] = useRegion();
  const validCat = initialCat && api.catName(initialCat) ? (initialCat as CatalogCategory) : null;
  const [f, setF] = useState<Filters>({ ...F0, cat: validCat });
  const [q, setQ] = useState(initialQ ?? '');
  const [qDeb, setQDeb] = useState(q);
  const [sort, setSort] = useState<Sort>('rel');
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Filters>(f);
  const draftCount = useDraftCount(sheet, draft, region, qDeb, sort);

  useEffect(() => {
    const id = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const query = toQuery(f, region, qDeb, sort);
  const { data, loading, showSkeleton, phase, retry } = useLoad(() => api.masters(query), [JSON.stringify(query)], regionReady);
  const results = data ?? [];
  const empty = !loading && results.length === 0;
  const [near, setNear] = useState<Awaited<ReturnType<typeof api.mastersElsewhere>>>([]);
  useEffect(() => {
    if (!empty) return setNear([]);
    let live = true;
    api.mastersElsewhere({ ...query, onlineOnly: false }).then((l) => live && setNear(l.slice(0, 3)), () => {});
    return () => {
      live = false;
    };
  }, [empty, JSON.stringify(query)]); // eslint-disable-line react-hooks/exhaustive-deps
  const regionName = api.region(region).name[lang];
  const activeCount = (['cat', 'price', 'rating', 'online', 'avail'] as const).filter((k) => f[k]).length;
  const foundText = `${t.found(results.length)} · ${f.online ? t.online : regionName}`;
  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }));
  const resetAll = () => {
    setF(F0);
    setQ('');
  };

  const sortSelect = (cls: string) => (
    <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cls} aria-label={t.sortLabel}>
      {(['rel', 'rev', 'act'] as const).map((v, i) => (
        <option key={v} value={v}>
          {t.sorts[i]}
        </option>
      ))}
    </select>
  );

  const regionSelect = (cls: string, value: RegionKey, onChange: (r: RegionKey) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value as RegionKey)} className={cls}>
      {api.regions().map((r) => (
        <option key={r.key} value={r.key}>
          {r.name[lang]}
        </option>
      ))}
    </select>
  );

  const emptyBlock = (desktop: boolean) => (
    <div className={desktop ? s.dEmpty : s.mEmpty}>
      <span className={desktop ? s.dEmptyIco : s.mEmptyIco}>
        <SearchX size={24} color="#B5651D" aria-hidden />
      </span>
      <div className={s.emptyBody}>
        <div className={desktop ? s.dEmptyTitle : s.mEmptyTitle}>{t.emptyTitle}</div>
        <div className={s.emptyText}>{t.emptyBody}</div>
        {near.length > 0 && (
          <div className={desktop ? s.nearRowD : s.nearRow}>
            <span className={s.nearLabel}>
              {t.emptyNear}
              {desktop ? ':' : ''}
            </span>
            <div className={s.nearChips}>
              {near.map((o) => (
                <button key={o.region.key} type="button" className={s.nearChip} onClick={() => setRegion(o.region.key)}>
                  {o.region.name[lang]} · {o.n}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={s.emptyBtns}>
          <button type="button" className={s.btnSecondary} onClick={resetAll}>
            {t.resetAll}
          </button>
          <Link href="/tasks/new" className={s.btnPrimary}>
            {c.postTask}
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1200} />

      {/* ============ MOBILE ============ */}
      <div className="mob-only">
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <Link href="/" aria-label={c.back} className={s.back}>
              <ChevronLeft size={24} aria-hidden />
            </Link>
            <h1 className={s.mTitle}>{t.masters}</h1>
            <LangSwitch />
          </div>
          <label className={s.mSearch}>
            <Search size={20} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh} className={s.searchInput} type="search" />
            {q && (
              <button type="button" className={s.clear} onClick={() => setQ('')} aria-label={c.close}>
                <X size={18} color="var(--ink-500)" aria-hidden />
              </button>
            )}
          </label>
          <div className={s.quickRow}>
            <button
              type="button"
              className={s.filtersBtn}
              onClick={() => {
                setDraft(f);
                setSheet(true);
              }}
            >
              <SlidersHorizontal size={16} aria-hidden />
              {t.filters}
              {activeCount > 0 && <span className={s.filtersCount}>{activeCount}</span>}
            </button>
            <QuickChip on={f.online} onClick={() => set({ online: !f.online })}>
              {t.online}
            </QuickChip>
            <QuickChip on={f.avail} onClick={() => set({ avail: !f.avail })}>
              {t.avail}
            </QuickChip>
            <QuickChip on={f.rating >= 4} onClick={() => set({ rating: f.rating >= 4 ? 0 : 4 })}>
              {t.r4}
            </QuickChip>
          </div>
        </div>
        <div className={s.mBar}>
          <div className={s.found}>{foundText}</div>
          <label className={s.mSort}>
            <ArrowUpDown size={16} color="var(--ink-500)" aria-hidden />
            {sortSelect(s.mSortSelect)}
          </label>
        </div>
        <div className={s.mList}>
          <LoadState phase={phase} retry={retry} />
          {showSkeleton && phase !== 'slow' && [1, 2, 3, 4].map((i) => <div key={i} className={s.skM} />)}
          {empty && emptyBlock(false)}
          {!loading && results.map((m) => <MasterCardM key={m.id} m={m} lang={lang} />)}
        </div>
        <TabBar />

        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title={t.filters}
          closeLabel={c.close}
          footer={
            <div className={s.sheetFoot}>
              <button type="button" className={s.btnSecondaryLg} onClick={() => setDraft(F0)}>
                {t.reset}
              </button>
              <button
                type="button"
                className={s.btnPrimaryLg}
                onClick={() => {
                  setF(draft);
                  setSheet(false);
                }}
              >
                {draftCount === null ? t.showAny : t.show(draftCount)}
              </button>
            </div>
          }
        >
          <div className={s.sheetBody}>
            <label className={s.group}>
              <span className={s.groupLabel}>{t.regionLabel}</span>
              {regionSelect(s.mSelect, region, setRegion)}
            </label>
            <div className={s.group}>
              <span className={s.groupLabel}>{t.fCat}</span>
              <div className={s.chipsWrap}>
                {[{ k: null, name: { ru: t.anyCat, tj: t.anyCat } }, ...api.filterCats()].map((k) => (
                  <OptBtn key={String(k.k)} on={draft.cat === k.k} pill onClick={() => setDraft({ ...draft, cat: k.k as CatalogCategory | null })}>
                    {k.name[lang]}
                  </OptBtn>
                ))}
              </div>
            </div>
            <div className={s.group}>
              <span className={s.groupLabel}>{t.fPrice}</span>
              <div className={s.grid4}>
                {PRICES.map((v, i) => (
                  <OptBtn key={v} on={draft.price === v} onClick={() => setDraft({ ...draft, price: v })}>
                    {t.priceOpts[i]}
                  </OptBtn>
                ))}
              </div>
            </div>
            <div className={s.group}>
              <span className={s.groupLabel}>{t.fRating}</span>
              <div className={s.grid3}>
                {RATINGS.map((v, i) => (
                  <OptBtn key={v} on={draft.rating === v} onClick={() => setDraft({ ...draft, rating: v })}>
                    {t.ratingOpts[i]}
                  </OptBtn>
                ))}
              </div>
            </div>
            <ToggleRow on={draft.online} onClick={() => setDraft({ ...draft, online: !draft.online })}>
              {t.fOnline}
            </ToggleRow>
            <ToggleRow on={draft.avail} onClick={() => setDraft({ ...draft, avail: !draft.avail })}>
              {t.fAvail}
            </ToggleRow>
          </div>
        </Sheet>
      </div>

      {/* ============ DESKTOP ============ */}
      <div className={`${s.dWrap} desk-only`}>
        <div className={s.dTitleBlock}>
          <div className={s.crumbs}>
            <Link href="/">{t.home}</Link> / {t.masters} / {regionName}
          </div>
          <h1 className={s.dTitle}>{f.online ? t.titleOnline : `${t.titleIn} ${regionName}`}</h1>
        </div>
        <div className={s.dGrid}>
          <aside className={s.dFilters}>
            <label className={s.dSearch}>
              <Search size={20} aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchShort} className={s.dSearchInput} type="search" />
            </label>
            <label className={s.groupD}>
              <span className={s.groupLabelD}>{t.regionLabel}</span>
              {regionSelect(s.dSelect, region, setRegion)}
            </label>
            <div className={s.catRadios} role="radiogroup" aria-label={t.fCat}>
              <span className={s.groupLabelD} style={{ marginBottom: 6 }}>
                {t.fCat}
              </span>
              {[{ k: null, name: { ru: t.anyCat, tj: t.anyCat } }, ...api.filterCats()].map((k) => {
                const on = f.cat === k.k;
                return (
                  <button key={String(k.k)} type="button" role="radio" aria-checked={on} className={[s.catRadio, on && s.catRadioOn].filter(Boolean).join(' ')} onClick={() => set({ cat: k.k as CatalogCategory | null })}>
                    <span className={s.radioDot}>
                      <span />
                    </span>
                    <span className={s.grow}>{k.name[lang]}</span>
                  </button>
                );
              })}
            </div>
            <div className={s.groupD}>
              <span className={s.groupLabelD}>{t.fPrice}</span>
              <div className={s.grid2}>
                {PRICES.map((v, i) => (
                  <OptBtn key={v} on={f.price === v} small onClick={() => set({ price: v })}>
                    {t.priceOpts[i]}
                  </OptBtn>
                ))}
              </div>
            </div>
            <div className={s.groupD}>
              <span className={s.groupLabelD}>{t.fRating}</span>
              <div className={s.grid3}>
                {RATINGS.map((v, i) => (
                  <OptBtn key={v} on={f.rating === v} small onClick={() => set({ rating: v })}>
                    {t.ratingOpts[i]}
                  </OptBtn>
                ))}
              </div>
            </div>
            <ToggleRow small on={f.online} onClick={() => set({ online: !f.online })}>
              {t.fOnline}
            </ToggleRow>
            <ToggleRow small on={f.avail} onClick={() => set({ avail: !f.avail })}>
              {t.fAvail}
            </ToggleRow>
            {activeCount > 0 && (
              <button type="button" className={s.btnSecondary} onClick={resetAll}>
                {t.resetAll}
              </button>
            )}
          </aside>

          <div className={s.dResults}>
            <div className={s.dBar}>
              <span className={s.dFound}>{foundText}</span>
              <label className={s.dSortLabel}>
                {t.sortLabel}
                {sortSelect(s.dSortSelect)}
              </label>
            </div>
            <LoadState phase={phase} retry={retry} />
            {showSkeleton && phase !== 'slow' && [1, 2, 3, 4].map((i) => <div key={i} className={s.skD} />)}
            {empty && emptyBlock(true)}
            {!loading && results.map((m) => <MasterCardD key={m.id} m={m} lang={lang} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Сколько покажет кнопка «Показать N» в шторке фильтров; null — пока считаем */
function useDraftCount(open: boolean, f: Filters, region: RegionKey, q: string, sort: Sort) {
  const [n, setN] = useState<number | null>(null);
  const key = JSON.stringify(toQuery(f, region, q, sort));
  useEffect(() => {
    if (!open) return;
    let live = true;
    setN(null);
    const id = setTimeout(() => api.mastersCount(toQuery(f, region, q, sort)).then((v) => live && setN(v), () => {}), 200);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [open, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}

function QuickChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={[s.quick, on && s.optOn].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}

function OptBtn({ on, onClick, children, pill, small }: { on: boolean; onClick: () => void; children: React.ReactNode; pill?: boolean; small?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={[s.opt, pill && s.optPill, small && s.optSmall, on && s.optOn].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}

function ToggleRow({ on, onClick, children, small }: { on: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={[s.toggleRow, small && s.toggleRowSm].filter(Boolean).join(' ')}>
      {children}
      <span className={[s.track, on && s.trackOn].filter(Boolean).join(' ')}>
        <span className={s.knob} />
      </span>
    </button>
  );
}

function Avail({ m }: { m: Master }) {
  const t = useDict(mastersDict);
  return <span className={m.available ? s.avOn : s.avOff}>{m.available ? t.avail : t.busy}</span>;
}

function placeOf(m: Master, lang: Lang, onlineAll: string) {
  return m.online ? onlineAll : `${m.district}, ${api.region(m.region!).name[lang]}`;
}

function RatingLine({ m, lang }: { m: Master; lang: Lang }) {
  const c = useDict(common);
  return m.reviews > 0 ? (
    <span className={s.rate}>
      <Star size={15} color="var(--warn-600)" fill="var(--warn-600)" aria-hidden />
      {rating(m.rating)} · {countReviews(lang, m.reviews)}
    </span>
  ) : (
    <span className={s.muted}>{c.noReviews}</span>
  );
}

function MasterCardM({ m, lang }: { m: Master; lang: Lang }) {
  const t = useDict(mastersDict);
  const c = useDict(common);
  return (
    <Link href={`/masters/${m.id}`} className={s.mCard}>
      <span className={s.mCardTop}>
        <span className={s.av} style={{ width: 56, height: 56, fontSize: 15 }}>
          {initials(m.name)}
        </span>
        <span className={s.mCardBody}>
          <span className={s.mName}>
            {m.name}
            {m.verified && <ShieldCheck size={16} color="var(--success-btn)" aria-label={c.verified} />}
          </span>
          <span className={s.mProf}>
            {m.profession[lang]} · {placeOf(m, lang, c.onlineAll)}
          </span>
          <span className={s.mMeta}>
            <RatingLine m={m} lang={lang} />
            <span>{money(lang, m.priceFrom, 'from')}</span>
          </span>
        </span>
      </span>
      <span className={s.mCardFoot}>
        <Avail m={m} />
        {t.exp.toLowerCase()} {t.years(m.years)} · {m.works ? t.works(m.works) : t.noWorks}
      </span>
    </Link>
  );
}

function MasterCardD({ m, lang }: { m: Master; lang: Lang }) {
  const t = useDict(mastersDict);
  const c = useDict(common);
  return (
    <div className={s.dCard}>
      <span className={s.av} style={{ width: 72, height: 72, fontSize: 18 }}>
        {initials(m.name)}
      </span>
      <div className={s.dCardBody}>
        <div className={s.dNameRow}>
          <Link href={`/masters/${m.id}`} className={s.dName}>
            {m.name}
          </Link>
          {m.verified && (
            <span className={s.verifiedInline}>
              <ShieldCheck size={16} color="var(--success-btn)" aria-hidden />
              {c.verified}
            </span>
          )}
          <Avail m={m} />
        </div>
        <div className={s.dProf}>
          {m.profession[lang]} · {placeOf(m, lang, c.onlineAll)} · {t.exp.toLowerCase()} {t.years(m.years)}
        </div>
        <div className={s.dRate}>
          <RatingLine m={m} lang={lang} />
        </div>
        <div className={s.dBio}>{m.bio}</div>
        {m.portfolio.length > 0 && (
          <div className={s.thumbs}>
            {m.portfolio.slice(0, 3).map((p) => (
              <span key={p} className={s.thumb} title={p} />
            ))}
            <span className={s.thumbsText}>{m.works ? t.works(m.works) : t.noWorks}</span>
          </div>
        )}
      </div>
      <div className={s.dSide}>
        <div className={s.dPrice}>{money(lang, m.priceFrom, 'from')}</div>
        <Link href={`/invite/${m.id}`} className={s.btnPrimary46}>
          {t.offer}
        </Link>
        <Link href={`/masters/${m.id}`} className={s.btnSecondary46}>
          {t.profile}
        </Link>
      </div>
    </div>
  );
}
