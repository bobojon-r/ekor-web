'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ChevronLeft, Flag, Info, Languages, MapPin, Phone, Share2, ShieldCheck, Star, UserSearch } from 'lucide-react';
import { api, type Master, type Review } from '@/lib/api';
import { countReviews, initials, money, phoneMask, rating, useDict, useLang, type Lang } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useLoad } from '@/lib/hooks/useLoad';
import { SiteHeader } from '@/components/layout';
import { ButtonLink, EmptyState, Skeleton, useToast } from '@/components/ui';
import { InviteSheet } from '@/features/invite/InviteSheet';
import { mastersDict } from './i18n';
import s from './Profile.module.css';

type T = (typeof mastersDict)['ru'];

/** Распределение оценок: из API приходит готовым; здесь — приближение по среднему, как в макете */
function distribution(m: Master) {
  const share5 = Math.min(0.95, Math.max(0.3, (m.rating - 3.8) / 1.2));
  const rest = 1 - share5;
  return [share5, rest * 0.7, rest * 0.2, rest * 0.07, rest * 0.03].map((v, i) => ({ n: 5 - i, w: Math.round(v * 100), c: Math.round(v * m.reviews) }));
}

/** inviteOpen — открыт по адресу /invite/[id]: профиль + шторка «Предложить работу» */
export function MasterProfile({ id, inviteOpen = false }: { id: number; inviteOpen?: boolean }) {
  const t = useDict(mastersDict);
  const c = useDict(common);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { data, loading, showSkeleton } = useLoad(() => api.master(id), [id]);
  const [phoneShown, setPhoneShown] = useState(false);
  const [invite, setInvite] = useState(inviteOpen);
  const closeInvite = () => {
    setInvite(false);
    if (inviteOpen) router.replace(`/masters/${id}`, { scroll: false });
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: data?.master.name, url: location.href });
      else {
        await navigator.clipboard.writeText(location.href);
        toast(t.linkCopied);
      }
    } catch {}
  };
  const complain = () => toast(t.complaintSent, 'info');

  if (!loading && !data)
    return (
      <div className={s.page}>
        <SiteHeader max={1200} />
        <div className={s.notFound}>
          <EmptyState icon={<UserSearch size={32} aria-hidden />} title={t.notFound} text={t.notFoundBody} action={<ButtonLink href="/masters" size="sm">{t.masters}</ButtonLink>} />
        </div>
      </div>
    );

  const m = data?.master;
  const reviews = (data?.reviews ?? []).slice(0, m ? Math.min(m.reviews, m.id % 2 ? 3 : 2) : 0);
  const priceShort = m ? money(lang, m.priceFrom, 'from') : '';
  const langs = m ? m.langs.map((l) => t.lg[l]).join(', ') : '';
  const areas = m ? (m.online ? [c.onlineAll] : m.areas) : [];
  const place = m ? (m.online ? c.onlineAll : `${m.district}, ${api.region(m.region!).name[lang]}`) : '';
  const phoneBtn = m?.phone && (
    <button type="button" className={s.phoneBtn} onClick={() => setPhoneShown(true)}>
      <Phone size={18} color="var(--brand-600)" aria-hidden />
      {phoneShown ? <a href={`tel:+992${m.phone}`}>+992 {phoneMask(m.phone)}</a> : t.showPhone}
    </button>
  );

  return (
    <div className={s.page}>
      <SiteHeader max={1200} />

      {m && <InviteSheet master={m} open={invite} onClose={closeInvite} />}

      {/* ============ MOBILE ============ */}
      <div className="mob-only">
        <div className={s.mTop}>
          <button type="button" className={s.backBtn} onClick={() => (history.length > 1 ? router.back() : router.push('/masters'))}>
            <ChevronLeft size={24} aria-hidden />
            {c.back}
          </button>
          <span className={s.grow} />
          <button type="button" className={s.iconBtn} onClick={share} aria-label={t.share}>
            <Share2 size={20} aria-hidden />
          </button>
        </div>

        {showSkeleton && <ProfileSkeleton />}
        {m && (
          <>
            <div className={s.mHero}>
              <div className={s.mHeroRow}>
                <span className={s.av} style={{ width: 80, height: 80, fontSize: 22 }}>
                  {initials(m.name)}
                </span>
                <div className={s.mHeroText}>
                  <h1 className={s.mName}>{m.name}</h1>
                  <div className={s.mProf}>{m.profession[lang]}</div>
                  <RatingBig m={m} lang={lang} size={15} />
                </div>
              </div>
              <div className={s.badges}>
                <AvailBadge m={m} t={t} />
                {m.verified && <VerifiedPill label={c.verified} title={t.verifiedLong} />}
              </div>
              <div className={s.stats}>
                <Stat label={t.priceFrom} value={priceShort} />
                <Stat label={t.exp} value={t.years(m.years)} />
                <Stat label={t.portfolio} value={m.works ? String(m.works) : '—'} />
              </div>
            </div>

            <section className={s.mSec}>
              <h2 className={s.mSecTitle}>{t.about}</h2>
              <p className={s.bio}>{m.bio}</p>
              <div className={s.langs}>
                <Languages size={16} color="var(--ink-500)" aria-hidden />
                {langs}
              </div>
            </section>

            <section className={s.mSecLg}>
              <h2 className={s.mSecTitle}>{t.services}</h2>
              <div className={s.services}>
                {m.services.map((sv) => (
                  <div key={sv.name} className={s.service}>
                    <span>{sv.name}</span>
                    <span className={s.servicePrice}>{money(lang, sv.price, 'from')}</span>
                  </div>
                ))}
              </div>
            </section>

            {m.portfolio.length > 0 && (
              <section className={s.mSecLg}>
                <h2 className={s.mSecTitle}>
                  {t.portfolio} · {m.works}
                </h2>
                <div className={s.gallery2}>
                  {m.portfolio.map((p, i) => (
                    <Work key={i} cap={p} src={m.portfolioImg?.[i]} ph={t.photoPh} />
                  ))}
                </div>
              </section>
            )}

            <section className={s.mSecLg}>
              <h2 className={s.mSecTitle}>{t.areas}</h2>
              <div className={s.areas}>
                {areas.map((a) => (
                  <span key={a} className={s.area}>
                    <MapPin size={14} color="var(--brand-600)" aria-hidden />
                    {a}
                  </span>
                ))}
              </div>
            </section>

            <section className={s.mSecLg} style={{ gap: 12 }}>
              <h2 className={s.mSecTitle}>{t.reviews}</h2>
              <Reviews m={m} reviews={reviews} t={t} lang={lang} />
            </section>

            <div className={s.mNoPayWrap}>
              <div className={s.noPay}>
                <Info size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />
                <span>{c.noPay}</span>
              </div>
            </div>
            <div className={s.mComplain}>
              <button type="button" className={s.complain} onClick={complain}>
                <Flag size={16} aria-hidden />
                {t.complain}
              </button>
            </div>

            <div className={s.mBottom}>
              {phoneShown && <div className={s.phoneNote}>{t.phoneNote}</div>}
              <div className={s.mBottomRow}>
                {phoneBtn}
                <button type="button" onClick={() => setInvite(true)} className={s.offerM}>
                  {t.offer}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============ DESKTOP ============ */}
      <div className={`${s.dWrap} desk-only`}>
        <div className={s.crumbs}>
          <Link href="/">{t.home}</Link> / <Link href="/masters">{t.masters}</Link>
          {m && (
            <>
              {' '}
              / {m.profession[lang]} / {m.name}
            </>
          )}
        </div>
        {showSkeleton && <ProfileSkeleton desktop />}
        {m && (
          <div className={s.dGrid}>
            <div className={s.dMain}>
              <div className={s.dHero}>
                <span className={s.av} style={{ width: 120, height: 120, fontSize: 30 }}>
                  {initials(m.name)}
                </span>
                <div className={s.dHeroText}>
                  <h1 className={s.dName}>{m.name}</h1>
                  <div className={s.dProf}>
                    {m.profession[lang]} · {place}
                  </div>
                  <div className={s.dBadges}>
                    <RatingBig m={m} lang={lang} size={16} />
                    <AvailBadge m={m} t={t} big />
                    {m.verified && <VerifiedPill label={c.verified} title={t.verifiedLong} big />}
                  </div>
                </div>
              </div>
              <div className={s.dCard}>
                <h2 className={s.dSecTitle}>{t.about}</h2>
                <p className={s.dBio}>{m.bio}</p>
              </div>
              <div className={s.dCard} style={{ gap: 8 }}>
                <h2 className={s.dSecTitle} style={{ marginBottom: 6 }}>
                  {t.services}
                </h2>
                {m.services.map((sv) => (
                  <div key={sv.name} className={s.dService}>
                    <span>{sv.name}</span>
                    <span className={s.servicePrice}>{money(lang, sv.price, 'from')}</span>
                  </div>
                ))}
              </div>
              {m.portfolio.length > 0 && (
                <div className={s.dCard} style={{ gap: 14 }}>
                  <h2 className={s.dSecTitle}>
                    {t.portfolio} · {m.works}
                  </h2>
                  <div className={s.gallery4}>
                    {m.portfolio.map((p, i) => (
                      <Work key={i} cap={p} src={m.portfolioImg?.[i]} ph={t.photoPh} desktop />
                    ))}
                  </div>
                </div>
              )}
              <div className={s.dCard} style={{ gap: 16 }}>
                <h2 className={s.dSecTitle}>{t.reviews}</h2>
                <Reviews m={m} reviews={reviews} t={t} lang={lang} desktop />
              </div>
            </div>

            <aside className={s.dSide}>
              <div className={s.dPriceCard}>
                <div className={s.dPriceBlock}>
                  <span className={s.dPriceLabel}>{t.priceFrom}</span>
                  <span className={s.dPrice}>{priceShort}</span>
                </div>
                <button type="button" onClick={() => setInvite(true)} className={s.offerD}>
                  {t.offer}
                </button>
                {phoneBtn && <div className={s.dPhone}>{phoneBtn}</div>}
                {phoneShown && <div className={s.phoneNoteD}>{t.phoneNote}</div>}
                <div className={s.dFacts}>
                  <div className={s.fact}>
                    <span className={s.factLabel}>{t.exp}</span>
                    <span className={s.factVal}>{t.years(m.years)}</span>
                  </div>
                  <div className={s.fact}>
                    <span className={s.factLabel}>{t.langs}</span>
                    <span className={s.factVal}>{langs}</span>
                  </div>
                </div>
              </div>
              <div className={s.dAreas}>
                <div className={s.dAreasTitle}>{t.areas}</div>
                <div className={s.areas}>
                  {areas.map((a) => (
                    <span key={a} className={s.areaD}>
                      <MapPin size={14} color="var(--brand-600)" aria-hidden />
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div className={s.noPay}>
                <Info size={18} color="var(--brand-600)" aria-hidden className={s.noShrink} />
                <span>{c.noPay}</span>
              </div>
              <button type="button" className={s.complain} onClick={complain}>
                <Flag size={16} aria-hidden />
                {t.complain}
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statVal}>{value}</span>
    </div>
  );
}

function RatingBig({ m, lang, size }: { m: Master; lang: Lang; size: number }) {
  const c = useDict(common);
  if (!m.reviews) return <span className={s.noRev} style={{ fontSize: size }}>{c.noReviews}</span>;
  return (
    <span className={s.rateBig} style={{ fontSize: size }}>
      <Star size={15} color="var(--warn-600)" fill="var(--warn-600)" aria-hidden />
      {rating(m.rating)} · {countReviews(lang, m.reviews)}
    </span>
  );
}

function AvailBadge({ m, t, big }: { m: Master; t: T; big?: boolean }) {
  return <span className={[m.available ? s.avOn : s.avOff, big && s.badgeBig].filter(Boolean).join(' ')}>{m.available ? t.avail : t.busy}</span>;
}

function VerifiedPill({ label, title, big }: { label: string; title: string; big?: boolean }) {
  return (
    <span className={[s.verified, big && s.badgeBig].filter(Boolean).join(' ')} title={title}>
      <ShieldCheck size={16} color="var(--success-btn)" aria-hidden />
      {label}
    </span>
  );
}

function Work({ cap, src, ph, desktop }: { cap: string; src?: string; ph: string; desktop?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={s.work}>
      <div className={s.workImg}>
        {src && !broken ? <img src={src} alt={cap} loading="lazy" className={s.workPhoto} onError={() => setBroken(true)} /> : ph}
      </div>
      {cap && <span className={desktop ? s.workCapD : s.workCap}>{cap}</span>}
    </div>
  );
}

function Reviews({ m, reviews, t, lang, desktop }: { m: Master; reviews: Review[]; t: T; lang: Lang; desktop?: boolean }) {
  if (!m.reviews)
    return (
      <div className={desktop ? s.noRevBoxD : s.noRevBox}>
        <span className={s.noRevTitle}>{t.noReviewsTitle}</span>
        <span className={s.noRevBody}>{t.noReviewsBody}</span>
      </div>
    );
  const dist = distribution(m);
  return (
    <>
      <div className={desktop ? s.summaryD : s.summary}>
        <div className={desktop ? s.avgD : s.avg}>
          <span className={s.avgNum}>{rating(m.rating)}</span>
          <span className={s.avgCount}>{countReviews(lang, m.reviews)}</span>
        </div>
        <div className={s.bars}>
          {dist.map((d) => (
            <div key={d.n} className={s.barRow}>
              <span className={s.barN}>{d.n}</span>
              <span className={s.barTrack}>
                <span className={s.barFill} style={{ width: `${d.w}%` }} />
              </span>
              <span className={s.barC}>{d.c}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={desktop ? s.revGrid : s.revList}>
        {reviews.map((r, i) => (
          <div key={i} className={desktop ? s.reviewD : s.review}>
            <div className={s.revHead}>
              <span className={s.revAuthor}>{r.author}</span>
              <span className={s.revDate}>
                {t.months[r.month]} {r.year}
              </span>
            </div>
            <div className={s.revStars}>
              <span className={s.stars}>{'★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)}</span>
              <span className={s.revTag}>
                <BadgeCheck size={14} aria-hidden />
                {t.reviewTag}
              </span>
            </div>
            <div className={s.revText}>{r.text}</div>
            {r.reply && i !== 1 && (
              <div className={s.reply}>
                <b>{t.reply}:</b> {r.reply}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ProfileSkeleton({ desktop }: { desktop?: boolean }) {
  return (
    <div className={desktop ? s.skD : s.skM}>
      <Skeleton w={desktop ? 120 : 80} h={desktop ? 120 : 80} r={999} />
      <div className={s.skLines}>
        <Skeleton w="50%" h={20} />
        <Skeleton w="35%" light />
        <Skeleton w="25%" light />
      </div>
    </div>
  );
}
