'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MapPin, MessageSquarePlus, Search, X } from 'lucide-react';
import { api, type Profession } from '@/lib/api';
import { useDict, useLang, type Lang } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { useRegion } from '@/lib/hooks/useRegion';
import { SiteHeader, TabBar } from '@/components/layout';
import { Icon } from '@/components/ui';
import s from './Categories.module.css';

const dict = {
  ru: {
    title: 'Все категории',
    search: 'Услуга или профессия',
    masters: (n: number) => (n ? `${n} мастеров` : 'пока нет'),
    total: (n: number) => `${n} мастеров в городе`,
    profs: (n: number) => `${n} профессий`,
    noT: 'Ничего не нашли',
    noB: 'Опишите задачу своими словами — мастера сами откликнутся, а модератор подберёт категорию.',
    other: 'Другое',
    otherSub: 'Не нашли нужное — опишите задачу, категорию подберём вручную',
    clear: 'Очистить',
  },
  tj: {
    title: 'Ҳамаи категорияҳо',
    search: 'Хизмат ё касб',
    masters: (n: number) => (n ? `${n} усто` : 'ҳоло нест'),
    total: (n: number) => `${n} усто дар шаҳр`,
    profs: (n: number) => `${n} касб`,
    noT: 'Чизе ёфт нашуд',
    noB: 'Вазифаро бо суханони худ нависед — устоҳо худашон ҷавоб медиҳанд, модератор категорияро интихоб мекунад.',
    other: 'Дигар',
    otherSub: 'Лозимиро наёфтед — вазифаро нависед, категорияро дастӣ интихоб мекунем',
    clear: 'Тоза кардан',
  },
};

const profHref = (p: Profession) => `/masters?q=${encodeURIComponent(p.name.ru)}`;

export function CategoriesView() {
  const t = useDict(dict);
  const c = useDict(common);
  const { lang } = useLang();
  const [region] = useRegion();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>('repair');
  const tree = api.categoryTree();
  const regionName = api.region(region).name[lang];

  const ql = q.trim().toLowerCase();
  const searching = ql.length >= 2;
  const hits = searching
    ? tree.flatMap((k) =>
        k.professions
          .filter((p) => `${p.name.ru} ${p.name.tj} ${p.synonyms} ${k.name.ru} ${k.name.tj}`.toLowerCase().includes(ql))
          .map((p) => ({ p, cat: k.name[lang] })),
      )
    : [];

  const searchBox = (cls: string) => (
    <label className={cls}>
      <Search size={20} color="var(--ink-500)" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className={s.input} type="search" />
      {q && (
        <button type="button" onClick={() => setQ('')} aria-label={t.clear} className={s.clear}>
          <X size={18} color="var(--ink-500)" aria-hidden />
        </button>
      )}
    </label>
  );

  const count = (n: number) => <span className={n ? s.n : s.nZero}>{t.masters(n)}</span>;

  return (
    <div className={s.page}>
      <SiteHeader />

      {/* mobile */}
      <div className="mob-only">
        <div className={s.mHead}>
          <div className={s.mHeadRow}>
            <Link href="/" aria-label={c.back} className={s.back}>
              <ChevronLeft size={24} aria-hidden />
            </Link>
            <span className={s.mTitle}>{t.title}</span>
            <Link href="/" className={s.cityChip}>
              <MapPin size={16} color="var(--brand-600)" aria-hidden />
              {regionName}
            </Link>
          </div>
          {searchBox(s.mSearch)}
        </div>
        <div className={s.mBody}>
          {hits.length > 0 && (
            <div className={s.hitList}>
              {hits.map(({ p, cat }, i) => (
                <Link key={i} href={profHref(p)} className={s.hit}>
                  <span className={s.hitText}>
                    <span className={s.hitName}>{p.name[lang]}</span>
                    <span className={s.hitCat}>{cat}</span>
                  </span>
                  {count(p.masters)}
                  <ChevronRight size={18} color="var(--ink-400)" aria-hidden />
                </Link>
              ))}
            </div>
          )}
          {searching && hits.length === 0 && <NoHits t={t} postTask={c.postTask} />}
          {!searching && (
            <>
              {tree.map((k) => {
                const isOpen = open === k.key;
                const sum = k.professions.reduce((a, p) => a + p.masters, 0);
                return (
                  <div key={k.key} className={s.cat}>
                    <button type="button" className={s.catBtn} onClick={() => setOpen(isOpen ? null : k.key)} aria-expanded={isOpen}>
                      <span className={s.catIco}>
                        <Icon name={k.icon} size={20} color="var(--brand-600)" />
                      </span>
                      <span className={s.catText}>
                        <span className={s.catName}>{k.name[lang]}</span>
                        <span className={s.catSub}>
                          {t.profs(k.professions.length)} · {t.total(sum)}
                        </span>
                      </span>
                      {isOpen ? <ChevronUp size={20} color="var(--ink-400)" aria-hidden /> : <ChevronDown size={20} color="var(--ink-400)" aria-hidden />}
                    </button>
                    {isOpen && (
                      <div className={s.profs}>
                        {k.professions.map((p, i) => (
                          <Link key={i} href={profHref(p)} className={s.prof}>
                            <span className={s.grow}>{p.name[lang]}</span>
                            {count(p.masters)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Other t={t} lang={lang} />
            </>
          )}
        </div>
        <TabBar />
      </div>

      {/* desktop */}
      <div className={`${s.dWrap} desk-only`}>
        <div className={s.dHead}>
          <h1 className={s.dTitle}>
            {t.title} <span className={s.dCity}>· {regionName}</span>
          </h1>
          {searchBox(s.dSearch)}
        </div>
        {hits.length > 0 && (
          <div className={s.dHits}>
            {hits.map(({ p, cat }, i) => (
              <Link key={i} href={profHref(p)} className={s.dHit}>
                <span className={s.hitText}>
                  <span className={s.hitName}>{p.name[lang]}</span>
                  <span className={s.hitCat}>{cat}</span>
                </span>
                {count(p.masters)}
              </Link>
            ))}
          </div>
        )}
        {searching && hits.length === 0 && <NoHits t={t} postTask={c.postTask} desktop />}
        {!searching && (
          <div className={s.dGrid}>
            {tree.map((k) => (
              <div key={k.key} className={s.dCat}>
                <div className={s.dCatHead}>
                  <span className={s.catIco}>
                    <Icon name={k.icon} size={20} color="var(--brand-600)" />
                  </span>
                  <div className={s.catText}>
                    <span className={s.catName}>{k.name[lang]}</span>
                    <span className={s.catSub}>{t.total(k.professions.reduce((a, p) => a + p.masters, 0))}</span>
                  </div>
                </div>
                <div className={s.dProfs}>
                  {k.professions.map((p, i) => (
                    <Link key={i} href={profHref(p)} className={s.dProf}>
                      <span className={s.grow}>{p.name[lang]}</span>
                      {count(p.masters)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Other t={t} lang={lang} desktop />
          </div>
        )}
      </div>
    </div>
  );
}

function NoHits({ t, postTask, desktop }: { t: (typeof dict)['ru']; postTask: string; desktop?: boolean }) {
  return (
    <div className={desktop ? s.dNo : s.no}>
      <div className={s.noText}>
        <span className={s.noT}>{t.noT}</span>
        <span className={s.noB}>{t.noB}</span>
      </div>
      <Link href="/tasks/new" className={s.noBtn}>
        {postTask}
      </Link>
    </div>
  );
}

function Other({ t, desktop }: { t: (typeof dict)['ru']; lang: Lang; desktop?: boolean }) {
  return (
    <Link href="/tasks/new" className={desktop ? s.dOther : s.other}>
      <span className={s.otherIco}>
        <MessageSquarePlus size={20} color="var(--brand-600)" aria-hidden />
      </span>
      <span className={s.otherText}>
        <span className={s.catName}>{t.other}</span>
        <span className={s.otherSub}>{t.otherSub}</span>
      </span>
      {!desktop && <ChevronRight size={18} color="var(--ink-400)" aria-hidden />}
    </Link>
  );
}
