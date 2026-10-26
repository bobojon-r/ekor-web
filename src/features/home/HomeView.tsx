'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, Check, ChevronDown, ChevronRight, FilePlus2, Info, MapPin, MapPinOff, Phone, Search, Send, Star, Users, X,
} from 'lucide-react';
import { api, type Master, type RegionKey, type TaskSummary } from '@/lib/api';
import { ago, countMasters, countResponses, countReviews, initials, money, rating, useDict, useLang, type Lang } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useLoad } from '@/lib/hooks/useLoad';
import { useRegion } from '@/lib/hooks/useRegion';
import { useSession } from '@/lib/session/SessionProvider';
import { Footer, TabBar } from '@/components/layout';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Icon, LangSwitch, Segmented, VerifiedBadge } from '@/components/ui';
import { homeDict } from './i18n';
import { LoadState } from '@/features/system/SystemStates';
import s from './Home.module.css';

const MAX = 1200;

export function HomeView() {
  const t = useDict(homeDict);
  const c = useDict(common);
  const { lang } = useLang();
  const { user } = useSession();
  const [region, setRegion, regionReady] = useRegion();
  const [regionOpen, setRegionOpen] = useState<null | 'm' | 'd'>(null);
  const [tab, setTab] = useState<'client' | 'master'>('client');

  const R = api.region(region);
  const regionName = R.name[lang];
  const { data, showSkeleton, loading, phase, retry } = useLoad(() => api.home(region), [region], regionReady);
  const empty = !loading && data?.localCount === 0;
  // Место под контент резервируется с первого кадра; анимация скелетона — только после 300 мс
  const sk = (base: string) => (showSkeleton ? base : `${base} ${s.ph}`);
  const mastersBusy = loading || !data;

  const findSub = R.masters > 0 ? (lang === 'tj' ? `${R.masters} усто дар ${regionName}` : `${countMasters(lang, R.masters)} — ${regionName}`) : t.onlyOnline;
  const pickRegion = (k: RegionKey) => {
    setRegion(k);
    setRegionOpen(null);
  };
  const steps = tab === 'client' ? t.stepsClient : t.stepsMaster;
  const cats = api.featuredCategories();

  const regionList = (
    <RegionList
      title={t.regionTitle}
      lang={lang}
      current={region}
      onPick={pickRegion}
      onClose={() => setRegionOpen(null)}
      closeLabel={c.close}
    />
  );

  return (
    <div className={s.page}>
      {/* ============ MOBILE ============ */}
      <div className="mob-only">
        <section className={s.mHero}>
          <div className={s.mTop}>
            <span className={s.mLogo}>eKor</span>
            <div className={s.mTopRight}>
              <LangSwitch onBrand />
              {!user && (
                <Link href="/login" className={s.mLogin}>
                  {c.login}
                </Link>
              )}
            </div>
          </div>
          <h1 className={s.mTitle}>{t.heroTitle}</h1>
          <div className={s.mSearchCard}>
            <SearchSuggest variant="m" placeholder={t.searchPh} noMatch={t.noMatch} postTask={c.postTask} />
            <button type="button" className={s.mRegionBtn} onClick={() => setRegionOpen('m')}>
              <MapPin size={20} color="var(--brand-600)" aria-hidden />
              <span className={s.mRegionText}>
                <span className={s.mRegionName}>{regionName}</span>
                <span className={s.mRegionSub}>{R.sub[lang]}</span>
              </span>
              <ChevronDown size={18} color="var(--ink-500)" aria-hidden />
            </button>
          </div>
        </section>

        {regionOpen === 'm' && (
          <div className={s.mOverlay} onClick={() => setRegionOpen(null)}>
            <div onClick={(e) => e.stopPropagation()}>{regionList}</div>
          </div>
        )}

        <div className={s.mActions}>
          <Link href="/masters" className={s.mFind}>
            <Users size={24} aria-hidden />
            <span className={s.actText}>
              <span className={s.actTitle}>{c.findMaster}</span>
              <span className={s.actSubLight}>{findSub}</span>
            </span>
            <ChevronRight size={20} aria-hidden />
          </Link>
          <Link href="/tasks/new" className={s.mPost}>
            <FilePlus2 size={24} color="var(--brand-600)" aria-hidden />
            <span className={s.actText}>
              <span className={s.actTitle}>{c.postTask}</span>
              <span className={s.actSub}>{t.postTaskSub}</span>
            </span>
            <ChevronRight size={20} color="var(--ink-500)" aria-hidden />
          </Link>
          <Link href="/tasks" className={s.mTasks}>
            <BriefcaseBusiness size={22} color="var(--brand-600)" aria-hidden />
            <span className={s.actText}>
              <span className={s.actTitleSm}>{t.findTasks}</span>
              <span className={s.actSub}>{t.findTasksSub}</span>
            </span>
            <ChevronRight size={20} color="var(--ink-500)" aria-hidden />
          </Link>
        </div>

        <SectionHead title={t.categories} href="/categories" link={t.allCats} />
        <div className={s.mCats}>
          {cats.map((k) => (
            <Link key={k.key} href={`/masters?cat=${k.key}`} className={s.mCat}>
              <span className={s.mCatIco}>
                <Icon name={k.icon} size={20} color="var(--brand-600)" />
              </span>
              <span className={s.mCatName}>{k.name[lang]}</span>
            </Link>
          ))}
        </div>

        <SectionHead title={t.nearby} href="/masters" link={t.seeAll} />
        <div className={s.mList}>
          <LoadState phase={phase} retry={retry} />
          {mastersBusy && [1, 2, 3].map((i) => <MasterRowSkeleton key={i} cls={sk(s.skRow)} />)}
          {empty && (
            <>
              <EmptyRegion title={t.emptyTitle(regionName)} body={t.emptyBody} action={c.postTask} />
              <div className={s.overline}>{t.onlineMasters}</div>
            </>
          )}
          {!mastersBusy && data.masters.slice(0, 3).map((m) => <MasterRow key={m.id} m={m} lang={lang} />)}
        </div>

        <SectionHead title={t.tasksTitle} href="/tasks" link={t.allTasks} />
        <div className={s.mList}>
          {!data && [1, 2].map((i) => <div key={i} className={sk(s.skTask)} />)}
          {data &&
            data.tasks.slice(0, 2).map((k) => (
              <Link key={k.id} href={`/tasks/${k.id}`} className={s.mTask}>
                <span className={s.taskTop}>
                  <span className={s.taskTitle}>{k.title}</span>
                  <span className={s.taskBudget}>{money(lang, k.budget)}</span>
                </span>
                <span className={s.taskMeta}>
                  <span className={s.openBadge}>{t.statusOpen}</span>
                  {taskPlace(k, lang, c.onlineAll)} · {countResponses(lang, k.responses)} · {ago(lang, k.createdAt)}
                </span>
              </Link>
            ))}
        </div>

        <div className={s.secHeadCol}>
          <div className={s.secTitle}>{t.lastReviews}</div>
          <div className={s.secNote}>{t.reviewsNote}</div>
        </div>
        <div className={s.mReviews}>
          {!data && [1, 2].map((i) => <div key={i} className={sk(s.skReviewM)} />)}
          {data?.reviews.map((v, i) => (
            <div key={i} className={s.mReview}>
              <div className={s.revTop}>
                <span className={s.stars}>{'★'.repeat(v.stars) + '☆'.repeat(5 - v.stars)}</span>
                <span className={s.muted}>
                  {v.daysAgo} {t.days}
                </span>
              </div>
              <div className={s.revText}>{v.text}</div>
              <div className={s.revAuthor}>{v.author}</div>
              <div className={s.revMaster}>
                <span className={s.avStriped} style={{ width: 36, height: 36, fontSize: 12 }}>
                  {initials(v.master)}
                </span>
                <span className={s.revMasterText}>
                  <span className={s.revMasterName}>{v.master}</span>
                  <span className={s.revMasterSub}>
                    {v.profession[lang]} · {v.online ? c.online : api.region(v.region!).name[lang]}
                  </span>
                </span>
              </div>
              <span className={s.revTag}>
                <BadgeCheck size={14} aria-hidden />
                {t.reviewTag}
              </span>
            </div>
          ))}
        </div>

        <div className={s.mHow}>
          <div className={s.secTitle}>{t.how}</div>
          <Segmented
            size="lg"
            className={s.howSeg}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'client', label: t.tabClient },
              { value: 'master', label: t.tabMaster },
            ]}
          />
          {steps.map((x, i) => (
            <div key={i} className={s.mStep}>
              <span className={s.stepN}>{i + 1}</span>
              <span className={s.mStepText}>{x}</span>
            </div>
          ))}
        </div>

        <div className={s.mBecome}>
          <div className={s.becomeTitle}>{t.becomeTitle}</div>
          <div className={s.becomeSub}>{t.becomeSub}</div>
          <Link href="/become-master" className={s.becomeBtn}>
            {c.becomeMaster}
          </Link>
        </div>

        <div className={s.mNoPay}>
          <Info size={20} color="var(--brand-600)" aria-hidden className={s.noShrink} />
          <span>{c.noPay}</span>
        </div>

        <Support t={t} className={s.mSupport} />
        <Footer />
        <TabBar chatBadge={user ? 2 : 0} />
      </div>

      {/* ============ DESKTOP ============ */}
      <div className="desk-only">
        <SiteHeader max={MAX} />
        <section className={s.dHero}>
          <div className={s.dHeroIn}>
            <div className={s.dHeroLeft}>
              <h1 className={s.dTitle}>{t.heroTitle}</h1>
              <p className={s.dSub}>{t.heroSub}</p>
              <div className={s.dSearchWrap}>
                <SearchSuggest
                  variant="d"
                  placeholder={t.searchPh}
                  noMatch={t.noMatch}
                  postTask={c.postTask}
                  findLabel={t.find}
                  regionSlot={
                    <button type="button" className={s.dRegionBtn} onClick={() => setRegionOpen(regionOpen === 'd' ? null : 'd')} aria-expanded={regionOpen === 'd'}>
                      <MapPin size={20} color="var(--brand-600)" aria-hidden />
                      {regionName}
                      <ChevronDown size={18} color="var(--ink-500)" aria-hidden />
                    </button>
                  }
                />
                {regionOpen === 'd' && <div className={s.dRegionPop}>{regionList}</div>}
              </div>
              <div className={s.dActions}>
                <Link href="/masters" className={s.dFind}>
                  <Users size={24} aria-hidden />
                  <span className={s.actText}>
                    <span className={s.dActTitle}>{c.findMaster}</span>
                    <span className={s.dActSubLight}>{findSub}</span>
                  </span>
                  <ChevronRight size={20} aria-hidden />
                </Link>
                <Link href="/tasks/new" className={s.dPost}>
                  <FilePlus2 size={24} color="var(--brand-600)" aria-hidden />
                  <span className={s.actText}>
                    <span className={s.dActTitle}>{c.postTask}</span>
                    <span className={s.dActSub}>{t.postTaskSub}</span>
                  </span>
                  <ChevronRight size={20} color="var(--ink-500)" aria-hidden />
                </Link>
                <Link href="/tasks" className={s.dTasks}>
                  <BriefcaseBusiness size={20} aria-hidden />
                  <span className={s.dTasksTitle}>{t.findTasks}</span>
                  <span className={s.dTasksSub}>{t.findTasksSub}</span>
                  <ChevronRight size={20} aria-hidden />
                </Link>
              </div>
            </div>

            <div className={s.dLive}>
              <div className={s.dLiveHead}>
                <span className={s.liveDot} />
                <span className={s.dLiveTitle}>
                  {t.live} · {regionName}
                </span>
              </div>
              {!data && [1, 2, 3, 4].map((i) => <div key={i} className={sk(s.skLive)} />)}
              {data &&
                data.tasks.slice(0, 4).map((k) => (
                  <Link key={k.id} href={`/tasks/${k.id}`} className={s.dLiveItem}>
                    <span className={s.taskTop}>
                      <span className={s.taskTitle}>{k.title}</span>
                      <span className={s.taskBudget}>{money(lang, k.budget)}</span>
                    </span>
                    <span className={s.liveMeta}>
                      {taskPlace(k, lang, c.onlineAll)} · {countResponses(lang, k.responses)} · {ago(lang, k.createdAt)}
                    </span>
                  </Link>
                ))}
              <Link href="/tasks" className={s.dAllTasks}>
                {t.allTasks}
                <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <section className={s.dSection} style={{ maxWidth: MAX }}>
          <div className={s.dSecHead}>
            <h2 className={s.dSecTitle}>{t.categories}</h2>
            <Link href="/categories" className={s.dSecLink}>
              {t.allCats}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div className={s.grid4}>
            {cats.map((k) => (
              <Link key={k.key} href={`/masters?cat=${k.key}`} className={s.dCat}>
                <span className={s.dCatIco}>
                  <Icon name={k.icon} size={24} color="var(--brand-600)" />
                </span>
                <span className={s.dCatText}>
                  <span className={s.dCatName}>{k.name[lang]}</span>
                  <span className={s.dCatCount}>{countMasters(lang, k.masters)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={s.dSection} style={{ maxWidth: MAX }}>
          <div className={s.dSecHead}>
            <h2 className={s.dSecTitle}>
              {t.nearbyIn} {regionName}
            </h2>
            <Link href="/masters" className={s.dSecLink}>
              {t.seeAll}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          {empty && (
            <div className={s.dEmpty}>
              <span className={s.dEmptyIco}>
                <MapPinOff size={24} color="#B5651D" aria-hidden />
              </span>
              <div className={s.dEmptyText}>
                <div className={s.dEmptyTitle}>{t.emptyTitle(regionName)}</div>
                <div className={s.dEmptyBody}>{t.emptyBody}</div>
              </div>
              <Link href="/tasks/new" className={s.btnPrimary48}>
                {c.postTask}
              </Link>
            </div>
          )}
          <LoadState phase={phase} retry={retry} />
          <div className={s.grid4}>
            {mastersBusy && [1, 2, 3, 4].map((i) => <MasterCardSkeleton key={i} cls={sk(s.skCard)} />)}
            {!mastersBusy && data.masters.slice(0, 4).map((m) => <MasterCardD key={m.id} m={m} lang={lang} offer={t.offerWork} />)}
          </div>
        </section>

        <section className={s.dSection} style={{ maxWidth: MAX }}>
          <div className={s.dSecHead}>
            <h2 className={s.dSecTitle}>{t.lastReviews}</h2>
            <div className={s.dSecNote}>
              <BadgeCheck size={14} color="var(--success-700)" aria-hidden />
              {t.reviewsNote}
            </div>
          </div>
          <div className={s.grid3}>
            {!data && [1, 2, 3].map((i) => <div key={i} className={sk(s.skReviewD)} />)}
            {data?.reviews.map((v, i) => (
              <div key={i} className={s.dReview}>
                <div className={s.revTop}>
                  <span className={s.stars} style={{ fontSize: 16 }}>
                    {'★'.repeat(v.stars) + '☆'.repeat(5 - v.stars)}
                  </span>
                  <span className={s.muted}>
                    {v.daysAgo} {t.days}
                  </span>
                </div>
                <div className={s.dRevText}>{v.text}</div>
                <div className={s.dRevAuthor}>
                  {v.author} · <span className={s.revTagInline}>{t.reviewTag}</span>
                </div>
                <div className={s.revMaster}>
                  <span className={s.avStriped} style={{ width: 40, height: 40, fontSize: 13 }}>
                    {initials(v.master)}
                  </span>
                  <span className={s.revMasterText}>
                    <span className={s.dRevMasterName}>{v.master}</span>
                    <span className={s.dRevMasterSub}>
                      {v.profession[lang]} · {v.online ? c.online : api.region(v.region!).name[lang]}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={s.dSection} style={{ maxWidth: MAX }}>
          <div className={s.dHow}>
            <div className={s.dHowHead}>
              <h2 className={s.dSecTitle}>{t.how}</h2>
              <Segmented
                size="lg"
                className={s.howSegD}
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'client', label: t.tabClient },
                  { value: 'master', label: t.tabMaster },
                ]}
              />
            </div>
            <div className={s.grid4Steps}>
              {steps.map((x, i) => (
                <div key={i} className={s.dStep}>
                  <span className={s.dStepN}>{i + 1}</span>
                  <span className={s.dStepText}>{x}</span>
                </div>
              ))}
            </div>
            <div className={s.dNoPay}>
              <Info size={20} color="var(--brand-600)" aria-hidden className={s.noShrink} />
              {c.noPay}
            </div>
          </div>
        </section>

        <section className={s.dBottom} style={{ maxWidth: MAX }}>
          <div className={s.dBecome}>
            <div className={s.dBecomeText}>
              <div className={s.dBecomeTitle}>{t.becomeTitle}</div>
              <div className={s.dBecomeSub}>{t.becomeSub}</div>
            </div>
            <Link href="/become-master" className={s.dBecomeBtn}>
              {c.becomeMaster}
            </Link>
          </div>
          <Support t={t} className={s.dSupport} desktop />
        </section>
        <Footer max={MAX} />
      </div>
    </div>
  );
}

/* ---------- части ---------- */

function taskPlace(k: TaskSummary, lang: Lang, onlineAll: string) {
  return k.online ? onlineAll : `${k.district}, ${api.region(k.region!).name[lang]}`;
}

function SectionHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className={s.secHead}>
      <h2 className={s.secTitle}>{title}</h2>
      <Link href={href} className={s.secLink}>
        {link}
      </Link>
    </div>
  );
}

function SearchSuggest({
  variant,
  placeholder,
  noMatch,
  postTask,
  findLabel,
  regionSlot,
}: {
  variant: 'm' | 'd';
  placeholder: string;
  noMatch: string;
  postTask: string;
  findLabel?: string;
  regionSlot?: React.ReactNode;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const sug = useMemo(
    () => (ql ? api.featuredCategories().filter((k) => `${k.name.ru} ${k.name.tj} ${k.synonyms}`.toLowerCase().includes(ql)) : []),
    [ql],
  );
  const show = !!ql && !(sug.length === 1 && sug[0].name[lang] === q);
  const submit = () => router.push(`/masters${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);

  const list = show && (
    <div className={variant === 'm' ? s.mSug : s.dSug}>
      {sug.map((k) => (
        <button key={k.key} type="button" className={s.sugItem} onClick={() => router.push(`/masters?cat=${k.key}`)}>
          <Icon name={k.icon} size={18} color="var(--brand-600)" />
          <span className={s.grow}>{k.name[lang]}</span>
          <span className={s.sugCount}>{countMasters(lang, k.masters)}</span>
        </button>
      ))}
      {sug.length === 0 && (
        <div className={variant === 'm' ? s.mNoSug : s.dNoSug}>
          {noMatch}
          <Link href="/tasks/new" className={s.btnPrimary40}>
            {postTask}
          </Link>
        </div>
      )}
    </div>
  );

  if (variant === 'm')
    return (
      <>
        <label className={s.mSearch}>
          <Search size={20} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={placeholder}
            className={s.mSearchInput}
            enterKeyHint="search"
          />
        </label>
        {list}
      </>
    );

  return (
    <>
      <form
        className={s.dSearch}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Search size={20} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={s.dSearchInput} />
        <span className={s.vsep} />
        {regionSlot}
        <button type="submit" className={s.dFindBtn}>
          {findLabel}
        </button>
      </form>
      {list}
    </>
  );
}

function RegionList({ title, lang, current, onPick, onClose, closeLabel }: { title: string; lang: Lang; current: RegionKey; onPick: (k: RegionKey) => void; onClose: () => void; closeLabel: string }) {
  return (
    <div className={s.region} role="dialog" aria-label={title}>
      <div className={s.regionHead}>
        <div className={s.regionTitle}>{title}</div>
        <button type="button" className={s.regionClose} onClick={onClose} aria-label={closeLabel}>
          <X size={18} aria-hidden />
        </button>
      </div>
      {api.regions().map((r) => {
        const on = r.key === current;
        return (
          <button key={r.key} type="button" className={[s.regionItem, on && s.regionOn].filter(Boolean).join(' ')} onClick={() => onPick(r.key)}>
            <span className={s.regionText}>
              <span className={s.regionName}>{r.name[lang]}</span>
              <span className={s.regionSub}>{r.sub[lang]}</span>
            </span>
            <span className={s.regionCount}>{r.masters || 'онлайн'}</span>
            {on && <Check size={18} color="var(--brand-600)" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function MasterRow({ m, lang }: { m: Master; lang: Lang }) {
  const c = useDict(common);
  return (
    <Link href={`/masters/${m.id}`} className={s.mMaster}>
      <span className={s.avStriped} style={{ width: 56, height: 56, fontSize: 15 }}>
        {initials(m.name)}
      </span>
      <span className={s.mMasterBody}>
        <span className={s.mMasterName}>
          {m.name}
          {m.verified && <VerifiedBadge iconOnly />}
        </span>
        <span className={s.mMasterProf}>
          {m.profession[lang]} · {m.online ? c.onlineAll : `${m.district}, ${api.region(m.region!).name[lang]}`}
        </span>
        <span className={s.mMasterMeta}>
          {m.reviews > 0 ? (
            <span className={s.rate}>
              <Star size={15} color="var(--warn-600)" fill="var(--warn-600)" aria-hidden />
              {rating(m.rating)} · {countReviews(lang, m.reviews)}
            </span>
          ) : (
            <span className={s.muted}>{c.noReviews}</span>
          )}
          <span>{money(lang, m.priceFrom, 'from')}</span>
        </span>
      </span>
    </Link>
  );
}

function MasterCardD({ m, lang, offer }: { m: Master; lang: Lang; offer: string }) {
  const c = useDict(common);
  return (
    <div className={s.dMaster}>
      <div className={s.dMasterTop}>
        <span className={s.avStriped} style={{ width: 64, height: 64, fontSize: 17 }}>
          {initials(m.name)}
        </span>
        {m.available && <span className={s.availBadge}>{c.availableToday}</span>}
      </div>
      <Link href={`/masters/${m.id}`} className={s.dMasterInfo}>
        <span className={s.dMasterName}>
          {m.name}
          {m.verified && <VerifiedBadge iconOnly />}
        </span>
        <span className={s.dMasterSub}>{m.profession[lang]}</span>
        <span className={s.dMasterSub}>{m.online ? c.onlineAll : `${m.district}, ${api.region(m.region!).name[lang]}`}</span>
      </Link>
      <div className={s.dMasterMeta}>
        {m.reviews > 0 ? (
          <span className={s.rate}>
            <Star size={15} color="var(--warn-600)" fill="var(--warn-600)" aria-hidden />
            {rating(m.rating)} · {countReviews(lang, m.reviews)}
          </span>
        ) : (
          <span className={s.muted}>{c.noReviews}</span>
        )}
        <b>{money(lang, m.priceFrom, 'from')}</b>
      </div>
      <Link href={`/invite/${m.id}`} className={s.offerBtn}>
        {offer}
      </Link>
    </div>
  );
}

function MasterRowSkeleton({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className={s.skCircle} style={{ width: 56, height: 56 }} />
      <div className={s.skLines}>
        <div className={s.skLine} style={{ width: '60%', height: 14 }} />
        <div className={s.skLineLight} style={{ width: '40%' }} />
        <div className={s.skLineLight} style={{ width: '75%' }} />
      </div>
    </div>
  );
}

function MasterCardSkeleton({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className={s.skCircle} style={{ width: 64, height: 64 }} />
      <div className={s.skLine} style={{ width: '70%', height: 16 }} />
      <div className={s.skLineLight} style={{ width: '50%' }} />
      <div className={s.skLineLight} style={{ width: '80%' }} />
    </div>
  );
}

function EmptyRegion({ title, body, action }: { title: string; body: string; action: string }) {
  return (
    <div className={s.mEmpty}>
      <span className={s.mEmptyIco}>
        <MapPinOff size={24} color="#B5651D" aria-hidden />
      </span>
      <div className={s.mEmptyTitle}>{title}</div>
      <div className={s.mEmptyBody}>{body}</div>
      <Link href="/tasks/new" className={s.btnPrimary48}>
        {action}
      </Link>
    </div>
  );
}

function Support({ t, className, desktop }: { t: (typeof homeDict)['ru']; className: string; desktop?: boolean }) {
  return (
    <div className={className}>
      <div className={desktop ? s.dSupportTitle : s.supportTitle}>{t.support}</div>
      <div className={s.supportBtns}>
        <a href="https://t.me/ekor_support" target="_blank" rel="noreferrer" className={s.supportBtn}>
          <Send size={18} color="var(--brand-600)" aria-hidden />
          Telegram
        </a>
        <a href="tel:+992446001010" className={s.supportBtn}>
          <Phone size={18} color="var(--brand-600)" aria-hidden />
          {t.call}
        </a>
      </div>
      <div className={desktop ? s.dSupportNote : s.supportNote}>+992 44 600 10 10 · {t.supportHours}</div>
    </div>
  );
}

