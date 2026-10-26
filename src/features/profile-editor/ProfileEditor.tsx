'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Check, ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import { masterProfile, type MasterProfileData } from '@/lib/api';
import { initials, num, useDict, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session/SessionProvider';
import { Button, useToast } from '@/components/ui';
import { PROFS } from '@/features/onboarding/i18n';
import { LANGS, TONES, editorDict } from './i18n';
import s from './Editor.module.css';

type Prof = { id: string; price: string; neg: boolean };
type Photo = { id: number; url?: string; loading?: boolean };
type State = { avatar: string | null; bio: string; exp: number; profs: Prof[]; langs: string[]; photos: Photo[] };

const DEMO: MasterProfileData = {
  status: 'approved', profs: ['electric', 'furniture'], city: 'Душанбе', areas: ['Сино'], online: false, prices: { electric: 50, furniture: null }, exp: 2,
  about: '8 лет делаю электрику в квартирах и частных домах. Работаю аккуратно, свой инструмент, на работу даю гарантию 6 месяцев.', showPhone: false, langs: ['ru', 'tj'], photos: [1, 2, 3, 4],
};

function fromProfile(p: MasterProfileData): State {
  return {
    avatar: p.avatar ? 'stored' : null,
    bio: p.about,
    exp: p.exp,
    profs: p.profs.map((id) => ({ id, price: p.prices[id] == null ? '' : String(p.prices[id]), neg: p.prices[id] == null })),
    langs: p.langs ?? ['ru', 'tj'],
    photos: (p.photos ?? []).map((id) => ({ id })),
  };
}

export function ProfileEditor() {
  const t = useDict(editorDict);
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useSession();
  const [base, setBase] = useState<MasterProfileData | null>(null);
  const [st, setSt] = useState<State | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newProfs, setNewProfs] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = masterProfile.get() ?? DEMO;
    setBase(p);
    setSt(fromProfile(p));
  }, []);
  useEffect(() => {
    if (ready && !user) router.replace('/login?next=/master/profile');
  }, [ready, user, router]);
  // Несохранённые изменения: предупреждаем при закрытии вкладки
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!st || !base) return <div className={s.page} />;

  const ch = (p: Partial<State>) => {
    setSt({ ...st, ...p });
    setDirty(true);
  };
  const pName = (id: string) => {
    const p = PROFS.find((x) => x[0] === id);
    return p ? p[lang === 'tj' ? 2 : 1] : id;
  };
  const priceOf = (p: Prof) => (p.neg ? t.neg : +p.price > 0 ? `${t.from} ${num(+p.price)} смн` : '—');
  const bioBad = st.bio.trim().length < 30;
  const pending = [...(base.pendingProfs ?? []), ...newProfs.filter((x) => st.profs.some((p) => p.id === x))];

  const setProf = (id: string, p: Partial<Prof>) => ch({ profs: st.profs.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const removeProf = (id: string) => (st.profs.length === 1 ? toast(t.minProf, 'info') : ch({ profs: st.profs.filter((x) => x.id !== id) }));
  const addProf = (id: string) => {
    ch({ profs: [...st.profs, { id, price: '', neg: true }] });
    setNewProfs([...newProfs, id]);
    setAddOpen(false);
  };
  const toggleLang = (k: string) => {
    const on = st.langs.includes(k);
    if (on && st.langs.length === 1) return toast(t.minLang, 'info');
    ch({ langs: on ? st.langs.filter((x) => x !== k) : [...st.langs, k] });
  };
  const onPhotos = (files: File[]) => {
    const room = 10 - st.photos.length;
    if (room <= 0) return toast(t.maxPhoto, 'info');
    const added = files.slice(0, room).map((f, i) => ({ id: Date.now() + i, url: URL.createObjectURL(f), loading: true }));
    ch({ photos: [...st.photos, ...added] });
    // имитация загрузки на сервер
    setTimeout(() => setSt((x) => (x ? { ...x, photos: x.photos.map((p) => (added.some((a) => a.id === p.id) ? { ...p, loading: false } : p)) } : x)), 900);
    if (files.length > room) toast(t.maxPhoto, 'info');
  };

  const save = async () => {
    if (saving) return;
    if (bioBad) return toast(t.fixErr, 'info');
    setSaving(true);
    const review = newProfs.filter((x) => st.profs.some((p) => p.id === x));
    const next: MasterProfileData = {
      ...base,
      about: st.bio.trim(),
      exp: st.exp,
      profs: st.profs.map((p) => p.id),
      prices: Object.fromEntries(st.profs.map((p) => [p.id, p.neg || !(+p.price > 0) ? null : +p.price])),
      langs: st.langs,
      avatar: !!st.avatar,
      photos: st.photos.map((p) => p.id),
      pendingProfs: Array.from(new Set([...(base.pendingProfs ?? []), ...review])),
    };
    await masterProfile.save(next);
    setBase(next);
    setNewProfs([]);
    setDirty(false);
    setSaving(false);
    toast(review.length ? t.savedReview : t.saved);
  };

  const name = user?.name ?? 'Фаррух Назаров';
  const avatar = (size: number) => (
    <span className={s.avatar} style={{ width: size, height: size, fontSize: size / 3, borderColor: st.avatar ? 'var(--brand-300)' : 'transparent', background: st.avatar && st.avatar !== 'stored' ? `center/cover url(${st.avatar})` : st.avatar ? 'repeating-linear-gradient(135deg,#DCE6F7 0 8px,#fff 8px 10px)' : undefined }}>
      {!st.avatar && initials(name)}
    </span>
  );

  const photoCard = (p: Photo, i: number, small?: boolean) => (
    <div key={p.id} className={s.photo} style={{ background: p.url ? `center/cover url(${p.url})` : `repeating-linear-gradient(135deg, ${TONES[i % 6]} 0 10px, #fff 10px 12px)` }}>
      {!p.url && <span className={s.photoLabel}>IMG_{String(i + 1).padStart(2, '0')}</span>}
      {p.loading && <div className={s.photoLoading}>{t.uploading}</div>}
      {!small && (
        <button type="button" aria-label="remove" className={s.photoX} onClick={() => ch({ photos: st.photos.filter((x) => x.id !== p.id) })}>
          <X size={16} color="#fff" aria-hidden />
        </button>
      )}
    </div>
  );

  const photoBlock = (
    <section className={s.card}>
      <div className={s.cardHead}>
        <span className={s.cardT}>{t.portfolio}</span>
        <span className={s.muted13}>{st.photos.length} / 10</span>
      </div>
      <span className={s.hint}>{t.portHint}</span>
      <div className={s.photos}>
        {st.photos.map((p, i) => photoCard(p, i))}
        {st.photos.length < 10 && (
          <button type="button" className={s.addPhoto} onClick={() => photoRef.current?.click()}>
            <Plus size={18} aria-hidden />
            {t.addPhoto}
          </button>
        )}
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onPhotos(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </section>
  );

  const langChips = (
    <div className={s.chips}>
      {LANGS.map(([k, l]) => {
        const on = st.langs.includes(k);
        return (
          <button key={k} type="button" aria-pressed={on} onClick={() => toggleLang(k)} className={[s.chip, on && s.on].filter(Boolean).join(' ')}>
            {on && <Check size={16} aria-hidden />}
            {l}
          </button>
        );
      })}
    </div>
  );

  const profsBlock = (desktop: boolean) => (
    <section className={s.card}>
      <div className={s.cardHead}>
        <span className={s.cardT}>{t.profs}</span>
        {pending.length > 0 && <span className={s.badgeWarn}>{t.onReview}</span>}
        <span className={s.muted13}>{st.profs.length} / 3</span>
      </div>
      {st.profs.map((p) => (
        <div key={p.id} className={desktop ? s.profRowD : s.profRow}>
          <span className={s.profName}>
            {pName(p.id)}
            {pending.includes(p.id) && <span className={s.newDot} title={t.onReview} />}
          </span>
          <label className={[s.priceBox, p.neg && s.off].filter(Boolean).join(' ')}>
            <span className={s.affix}>{t.from}</span>
            <input value={p.neg ? '' : p.price} disabled={p.neg} inputMode="numeric" onChange={(e) => setProf(p.id, { price: e.target.value.replace(/\D/g, '').slice(0, 5) })} className={s.priceInput} />
            <span className={s.affix}>смн</span>
          </label>
          <button type="button" aria-pressed={p.neg} onClick={() => setProf(p.id, { neg: !p.neg })} className={[s.negBtn, p.neg && s.on].filter(Boolean).join(' ')}>
            {t.neg}
          </button>
          <button type="button" aria-label="remove" className={s.trash} onClick={() => removeProf(p.id)}>
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
      ))}
      {st.profs.length < 3 && (
        <button type="button" className={s.addProf} onClick={() => setAddOpen(!addOpen)}>
          <Plus size={18} aria-hidden />
          {t.addProf}
        </button>
      )}
      {addOpen && st.profs.length < 3 && (
        <div className={s.chips}>
          {PROFS.filter((p) => !st.profs.some((x) => x.id === p[0])).map((p) => (
            <button key={p[0]} type="button" className={s.chipSm} onClick={() => addProf(p[0])}>
              {p[lang === 'tj' ? 2 : 1]}
            </button>
          ))}
        </div>
      )}
      <span className={s.hint}>{t.profsNote}</span>
    </section>
  );

  const avatarBlock = (desktop: boolean) => (
    <section className={[s.card, s.avatarCard].join(' ')}>
      {avatar(desktop ? 80 : 72)}
      <div className={s.avatarText}>
        <span className={s.cardT}>{t.photo}</span>
        <span className={s.hint}>{t.photoHint}</span>
        <button type="button" className={s.uploadBtn} onClick={() => avatarRef.current?.click()}>
          <Camera size={18} aria-hidden />
          {st.avatar ? t.replace : t.upload}
        </button>
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) ch({ avatar: URL.createObjectURL(f) });
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );

  const aboutBlock = (desktop: boolean) => (
    <section className={s.card}>
      <span className={s.cardT}>{t.about}</span>
      <textarea value={st.bio} onChange={(e) => ch({ bio: e.target.value.slice(0, 600) })} rows={desktop ? 5 : 4} className={[s.textarea, bioBad && s.invalid].filter(Boolean).join(' ')} />
      <div className={s.msgRow}>
        <span className={s.err}>{bioBad ? t.errBio : ''}</span>
        <span className={s.muted13}>{st.bio.length} / 600</span>
      </div>
      <span className={s.label}>{t.exp}</span>
      <div className={desktop ? s.grid4 : s.grid2}>
        {t.expO.map((l, i) => (
          <button key={l} type="button" aria-pressed={st.exp === i} onClick={() => ch({ exp: i })} className={[s.expBtn, st.exp === i && s.on].filter(Boolean).join(' ')}>
            {l}
          </button>
        ))}
      </div>
      {desktop && (
        <>
          <span className={`${s.label} ${s.pt6}`}>{t.langs}</span>
          {langChips}
        </>
      )}
    </section>
  );

  const status = <span className={s.dirty} style={{ color: dirty ? 'var(--warn-800)' : 'var(--ink-500)' }}>{dirty ? t.dirty : t.clean}</span>;
  const saveBtn = (size: 'md' | 'sm') => (
    <Button size={size} busy={saving} onClick={save} className={dirty ? undefined : s.saveIdle}>
      {t.save}
    </Button>
  );
  const goBack = (e: React.MouseEvent) => {
    if (dirty && !confirm(lang === 'tj' ? 'Тағйироти захиранашуда гум мешаванд. Баромадан?' : 'Несохранённые изменения пропадут. Выйти?')) e.preventDefault();
  };

  return (
    <div className={s.page}>
      {/* mobile */}
      <div className="mob-only">
        <div className={s.mTop}>
          <Link href="/master/settings" aria-label={t.toSettings} className={s.iconBtn} onClick={goBack}>
            <ChevronLeft size={24} aria-hidden />
          </Link>
          <span className={s.mTitle}>{t.title}</span>
        </div>
        <div className={s.mBody}>
          {avatarBlock(false)}
          {aboutBlock(false)}
          {profsBlock(false)}
          <section className={s.card}>
            <span className={s.cardT}>{t.langs}</span>
            {langChips}
          </section>
          {photoBlock}
        </div>
        <div className={s.mBar}>
          {status}
          {saveBtn('md')}
        </div>
      </div>

      {/* desktop */}
      <div className="desk-only">
        <header className={s.dHeader}>
          <div className={s.dHeaderIn}>
            <Link href="/" className={s.logo}>
              eKor
            </Link>
            <Link href="/master/settings" className={s.backLink} onClick={goBack}>
              <ChevronLeft size={18} aria-hidden />
              {t.toSettings}
            </Link>
            <span className={s.grow} />
            {status}
            {saveBtn('sm')}
          </div>
        </header>
        <div className={s.dGrid}>
          <div className={s.dCol}>
            {avatarBlock(true)}
            {aboutBlock(true)}
          </div>
          <div className={s.dCol}>
            {profsBlock(true)}
            {photoBlock}
          </div>
          <aside className={s.preview}>
            <span className={s.overline}>{t.preview}</span>
            <div className={s.pvRow}>
              {avatar(48)}
              <div className={s.pvText}>
                <span className={s.pvName}>{name}</span>
                <span className={s.pvProf}>
                  {st.profs.map((p) => pName(p.id)).join(' · ')} · {base.city}
                </span>
              </div>
            </div>
            <div className={s.pvPrice}>{st.profs.map((p) => `${pName(p.id)} — ${priceOf(p)}`).join(' · ')}</div>
            {st.bio.trim() && <div className={s.pvBio}>{st.bio.trim()}</div>}
            <div className={s.muted13}>
              {t.expW}: {t.expO[st.exp]} · {t.langW}: {st.langs.map((k) => LANGS.find((x) => x[0] === k)![1]).join(', ')}
            </div>
            {st.photos.length > 0 && <div className={s.pvPhotos}>{st.photos.slice(0, 3).map((p, i) => photoCard(p, i, true))}</div>}
          </aside>
        </div>
      </div>
    </div>
  );
}
