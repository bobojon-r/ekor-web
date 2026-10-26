'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Check, ChevronDown, ClipboardList, Flag, History, KeyRound, LayoutDashboard, Monitor, ShieldCheck, SlidersHorizontal, Star, TriangleAlert, Users, X, type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/components/ui';
import { REASONS, SEC, SEED, STRUCT } from './data';
import s from './Admin.module.css';

type Item = (typeof SEED.queue)[number];
type Audit = { t: string; who: string; act: string; obj: string; fresh?: boolean };
type Store = { queue: Item[]; audit: Audit[]; disp: { open: boolean; result: string } };

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, ShieldCheck, Users, ClipboardList, Star, Flag, BookOpen, KeyRound, SlidersHorizontal, History };
const KEY = 'ekor_admin';
const ME = 'Дилноза С.';
const SUBS: Record<string, string> = {
  dash: 'Обновлено только что', mod: 'Задания — SLA 30 мин · профили — 24 ч', disp: 'Старший модератор', audit: 'Неизменяемый журнал действий',
};
const DEC: [string, string, string][] = [
  ['client', 'В пользу клиента', 'Заказ — «не выполнен», отзыв клиента разрешён, мастеру — отметка в истории'],
  ['master', 'Работа выполнена', 'Заказ закрывается как завершённый, клиент может оставить отзыв'],
  ['info', 'Запросить информацию', 'Обе стороны получат вопрос; спор остаётся открытым 48 ч'],
];
const FUNNEL: [string, number, string, string][] = [['Заданий создано', 412, '100%', ''], ['Получили отклик', 318, '77%', '77% от созданных'], ['Мастер выбран', 241, '58%', '76% от получивших отклик'], ['Завершено', 196, '48%', '81% от выбранных']];
const REGIONS: [string, number, number, number, number][] = [['Душанбе', 268, 221, 142, 9], ['Худжанд', 71, 52, 31, 6], ['Бохтар', 34, 22, 12, 5], ['Куляб', 23, 15, 8, 4], ['Хорог', 16, 8, 3, 6]];
const TRANSCRIPT: [string, string, string][] = [
  ['20 окт 10:05', 'Мастер', 'Плитку уложил, завтра затирка.'], ['21 окт 18:40', 'Мастер', 'Всё готово. Затирку можно мыть через сутки.'], ['21 окт 18:52', 'Клиент', 'Пол не затёрт, только стена. Когда доделаете?'],
  ['21 окт 19:05', 'Клиент', 'Ответьте, пожалуйста.'], ['21 окт 19:10', 'Система', 'Клиент открыл спор: «Сделано плохо или не полностью»'],
];

const ageTxt = (a: number) => (a < 60 ? `${a} мин` : `${Math.floor(a / 60)} ч ${a % 60} мин`);
const now = () => {
  const d = new Date();
  return `${d.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fresh = (): Store => JSON.parse(JSON.stringify(SEED));

/** Раздел — в адресе: /admin#mod, /admin#audit … */
function useSection(): [string, (k: string) => void] {
  const [sec, setSec] = useState('mod');
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1);
      setSec(SEC.some((x) => x[0] === h) ? h : 'mod');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return [sec, (k) => (history.replaceState(null, '', `#${k}`), setSec(k))];
}

export function AdminPanel() {
  const toast = useToast();
  const [sec, setSec] = useSection();
  const [st, setSt] = useState<Store | null>(null);
  const [modTab, setModTab] = useState<'task' | 'master'>('task');
  const [selId, setSelId] = useState<string | null>('q1');
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [rejErr, setRejErr] = useState<null | 'reason' | 'comment'>(null);
  const [dec, setDec] = useState<string | null>(null);
  const [dComment, setDComment] = useState('');
  const [dErr, setDErr] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setSt(raw ? JSON.parse(raw) : fresh());
    } catch {
      setSt(fresh());
    }
  }, []);
  if (!st) return <div className={s.page} />;

  const save = (next: Store) => {
    setSt(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...next, audit: next.audit.map((a) => ({ ...a, fresh: false })) }));
    } catch {}
  };
  const resetSel = () => (setReason(null), setComment(''), setRejErr(null));

  const inTab = st.queue.filter((q) => q.type === modTab).sort((a, b) => b.age - a.age);
  const item = inTab.find((q) => q.id === selId) ?? inTab[0];
  const r = REASONS.find((x) => x[0] === reason);
  const counts: Record<string, number> = { mod: st.queue.length, disp: st.disp.open ? 1 : 0 };
  const secRow = SEC.find((x) => x[0] === sec)!;

  const resolve = (ok: boolean) => {
    if (!item) return;
    const kind = item.type === 'task' ? 'задание' : 'профиль';
    const queue = st.queue.filter((q) => q.id !== item.id);
    const next = queue.filter((q) => q.type === modTab).sort((a, b) => b.age - a.age)[0];
    const entry: Audit = {
      t: now(),
      who: ME,
      act: ok ? `Одобрила ${kind}` : `Отклонила ${kind}`,
      obj: `«${item.title}» · ` + (ok ? `На проверке → ${item.type === 'task' ? 'Открыто' : 'Одобрен'}` : `причина: ${r![1]}${comment.trim() ? ' — ' + comment.trim() : ''}`),
      fresh: true,
    };
    save({ ...st, queue, audit: [entry, ...st.audit] });
    setSelId(next?.id ?? null);
    resetSel();
    toast(ok ? `Одобрено: «${item.title}»` : 'Отклонено. Автор получил уведомление с причиной');
  };
  const reject = () => {
    if (!reason) return setRejErr('reason');
    if (reason === 'other' && comment.trim().length < 5) return setRejErr('comment');
    resolve(false);
  };
  const decide = () => {
    if (!dec || dComment.trim().length < 15) return setDErr(true);
    const d = DEC.find((x) => x[0] === dec)!;
    if (dec === 'info') {
      save({ ...st, audit: [{ t: now(), who: ME, act: 'Запросила информацию', obj: 'Спор #A-2041 · остаётся открытым', fresh: true }, ...st.audit] });
      setDec(null);
      setDComment('');
      return toast('Вопрос отправлен обеим сторонам');
    }
    save({ ...st, disp: { open: false, result: d[1].toLowerCase() }, audit: [{ t: now(), who: ME, act: 'Закрыла спор', obj: `#A-2041 «Плитка в ванной» · Спор → ${d[1]}`, fresh: true }, ...st.audit] });
    toast('Спор закрыт. Стороны получили решение');
  };

  return (
    <div className={s.page}>
      <div className={`${s.mobile} mob-only`}>
        <Monitor size={40} color="var(--brand-600)" aria-hidden />
        <h1 className={s.mobileT}>Админ-панель — только на компьютере</h1>
        <p className={s.mobileB}>Откройте eKor admin на экране шире 1024 px: модерация, споры и журнал рассчитаны на десктоп.</p>
        <Link href="/" className={s.mobileLink}>
          На главную
        </Link>
      </div>

      <div className={`${s.shell} desk-only`}>
        <aside className={s.side}>
          <div className={s.brand}>
            <Link href="/" className={s.logo}>
              eKor
            </Link>
            <span className={s.admin}>admin</span>
          </div>
          <nav className={s.nav}>
            {SEC.map(([k, l, i]) => {
              const I = ICONS[i] ?? ShieldCheck;
              const on = sec === k;
              const c = counts[k] ?? 0;
              return (
                <button key={k} type="button" aria-current={on ? 'page' : undefined} onClick={() => setSec(k)} className={[s.navItem, on && s.navOn].filter(Boolean).join(' ')}>
                  <I size={18} aria-hidden />
                  <span className={s.grow}>{l}</span>
                  {c > 0 && <span className={s.navCount} style={{ background: k === 'disp' ? 'var(--danger-600)' : 'var(--brand-600)' }}>{c}</span>}
                </button>
              );
            })}
          </nav>
          <div className={s.me}>
            <span className={s.meAv}>ДС</span>
            <div className={s.meText}>
              <span className={s.meName}>{ME}</span>
              <span className={s.meRole}>Модератор · Душанбе, Вахдат</span>
            </div>
          </div>
        </aside>

        <main className={s.main}>
          <div className={s.head}>
            <h1 className={s.h}>{secRow[1]}</h1>
            <span className={s.muted14}>{SUBS[sec] ?? 'Структура раздела'}</span>
            <button type="button" className={s.reset} onClick={() => (save(fresh()), setSelId('q1'), resetSel(), setDec(null), setDComment(''))}>
              Сбросить демо
            </button>
          </div>

          {sec === 'dash' && (
            <>
              <div className={s.filters}>
                {[['Период', '30 дней'], ['Регион', 'Весь Таджикистан'], ['Категория', 'Все']].map(([k, v]) => (
                  <span key={k} className={s.filter}>
                    <span className={s.muted}>{k}</span>
                    <b>{v}</b>
                    <ChevronDown size={16} color="var(--ink-500)" aria-hidden />
                  </span>
                ))}
              </div>
              <div className={s.card}>
                <span className={s.cardT}>Воронка: задание → отклик → выбор → завершение</span>
                <div className={s.funnel}>
                  {FUNNEL.map(([label, n, w, conv]) => (
                    <div key={label} className={s.fStep}>
                      <span className={s.muted14}>{label}</span>
                      <span className={s.fNum}>{n}</span>
                      <div className={s.fBar}>
                        <span style={{ width: w }} />
                      </div>
                      <span className={s.muted13}>{conv || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={s.dashGrid}>
                <div className={s.table}>
                  <div className={s.tHead} style={{ gridTemplateColumns: '1.4fr repeat(4,1fr)' }}>
                    <span>Город</span>
                    <span>Задания</span>
                    <span>С откликом</span>
                    <span>Завершено</span>
                    <span>Без откликов 24 ч</span>
                  </div>
                  {REGIONS.map(([c, a, b, d, e]) => (
                    <div key={c} className={s.tRow} style={{ gridTemplateColumns: '1.4fr repeat(4,1fr)' }}>
                      <b>{c}</b>
                      <span>{a}</span>
                      <span>{b}</span>
                      <span>{d}</span>
                      <span style={{ color: e / a > 0.15 ? 'var(--danger-700)' : undefined, fontWeight: e / a > 0.15 ? 600 : 400 }}>{e}</span>
                    </div>
                  ))}
                </div>
                <div className={s.ops}>
                  {[
                    ['Медиана модерации задания', '14 мин', 'SLA 30 мин', 'var(--success-700)'],
                    ['В очереди сейчас', String(st.queue.length), st.queue.length ? `старейшее — ${ageTxt(Math.max(...st.queue.map((q) => q.age)))}` : 'пусто', 'var(--warn-800)'],
                    ['Открытых споров', String(counts.disp), counts.disp ? 'SLA: 1 рабочий день' : 'нет', 'var(--ink-500)'],
                  ].map(([k, v, note, fg]) => (
                    <div key={k} className={s.op}>
                      <div className={s.opText}>
                        <span className={s.muted14}>{k}</span>
                        <span className={s.opV}>{v}</span>
                      </div>
                      <span className={s.opNote} style={{ color: fg }}>
                        {note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {sec === 'mod' && (
            <>
              <div className={s.tabs}>
                {(
                  [
                    ['task', 'Задания'],
                    ['master', 'Профили мастеров'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={modTab === k} onClick={() => (setModTab(k), setSelId(null), resetSel())} className={[s.tab, modTab === k && s.tabOn].filter(Boolean).join(' ')}>
                    {l} · {st.queue.filter((q) => q.type === k).length}
                  </button>
                ))}
              </div>
              <div className={s.modGrid}>
                <div className={s.queue}>
                  {inTab.length === 0 && (
                    <div className={s.empty}>
                      <span className={s.emptyT}>Очередь пуста</span>
                      <span className={s.muted14}>Новые задания и профили появятся здесь автоматически.</span>
                    </div>
                  )}
                  {inTab.map((q) => (
                    <button key={q.id} type="button" onClick={() => (setSelId(q.id), resetSel())} className={[s.qItem, item?.id === q.id && s.qOn].filter(Boolean).join(' ')}>
                      <span className={s.qTop}>
                        <span className={s.qKind}>
                          {q.type === 'task' ? 'Задание' : 'Профиль'} · {q.city}
                        </span>
                        <span className={s.qAge} style={{ color: q.age > (q.type === 'task' ? 30 : 1440) ? 'var(--danger-700)' : 'var(--ink-500)' }}>
                          {ageTxt(q.age)}
                        </span>
                      </span>
                      <span className={s.qTitle}>{q.title}</span>
                      {q.flags.length > 0 && (
                        <span className={s.flags}>
                          {q.flags.map((f) => (
                            <span key={f} className={s.flag}>
                              {f}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {item && (
                  <div className={s.detail}>
                    <div className={s.dMeta}>
                      <span className={s.badge}>{item.type === 'task' ? 'Задание' : 'Профиль мастера'}</span>
                      <span className={s.muted13}>
                        {item.city} · в очереди {ageTxt(item.age)}
                      </span>
                    </div>
                    <h2 className={s.dTitle}>{item.title}</h2>
                    <div className={s.facts}>
                      {(item.type === 'task'
                        ? [['Автор', item.author], ['Категория', item.cat], ['Бюджет', item.budget]]
                        : [['Профессии', item.cat], ['Цена', item.budget], ['Телефон подтверждён', 'Да, SMS']]
                      ).map(([k, v]) => (
                        <div key={k} className={s.fact}>
                          <span className={s.muted12}>{k}</span>
                          <b>{v}</b>
                        </div>
                      ))}
                    </div>
                    <div className={s.textBlock}>
                      <span className={s.label}>Текст</span>
                      <div className={s.text}>
                        {item.pre}
                        {item.hl && <mark className={s.mark}>{item.hl}</mark>}
                        {item.post}
                      </div>
                    </div>
                    {item.flags.length > 0 && (
                      <div className={s.auto}>
                        <TriangleAlert size={18} aria-hidden className={s.noShrink} />
                        <span>Автопроверка: {item.flags.join(', ')}</span>
                      </div>
                    )}
                    <div className={s.rejBlock}>
                      <span className={s.label}>Причина отклонения — увидит автор</span>
                      <div className={s.reasons}>
                        {REASONS.map(([k, l]) => (
                          <button key={k} type="button" aria-pressed={reason === k} onClick={() => (setReason(k), setRejErr(null))} className={[s.reason, reason === k && s.reasonOn].filter(Boolean).join(' ')}>
                            {l}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={comment}
                        onChange={(e) => (setComment(e.target.value.slice(0, 300)), setRejErr(null))}
                        rows={2}
                        placeholder="Комментарий автору (обязателен для «Другое»)"
                        className={[s.textarea, rejErr === 'comment' && s.invalid].filter(Boolean).join(' ')}
                      />
                      {rejErr && <span className={s.err}>{rejErr === 'comment' ? 'Для «Другое» напишите комментарий автору' : 'Выберите причину — без неё отклонить нельзя'}</span>}
                      {r && (
                        <div className={s.preview}>
                          <b>Автор получит:</b> {`«${item.title}» не прошло проверку. ${r[2] || ''} ${comment.trim()}`.trim()}
                        </div>
                      )}
                    </div>
                    <div className={s.actions}>
                      <button type="button" className={s.approve} onClick={() => resolve(true)}>
                        <Check size={18} aria-hidden />
                        Одобрить
                      </button>
                      <button type="button" className={s.rejectBtn} onClick={reject}>
                        <X size={18} aria-hidden />
                        Отклонить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {sec === 'disp' &&
            (st.disp.open ? (
              <div className={s.dispGrid}>
                <div className={s.detail}>
                  <div className={s.dMeta}>
                    <span className={s.badgeRed}>Спор</span>
                    <span className={s.muted13}>#A-2041 · открыт 21 окт, 19:10 · SLA: ответ до 22 окт, 19:10</span>
                  </div>
                  <h2 className={s.dTitle}>Плитка в ванной, 6 м² · 330 смн</h2>
                  <div className={s.parties}>
                    <div className={s.fact}>
                      <span className={s.muted12}>Клиент · заявитель</span>
                      <b>Мадина Рахимова</b>
                      <span className={s.muted13}>+992 90 771 22 13 · 4 заказа</span>
                    </div>
                    <div className={s.fact}>
                      <span className={s.muted12}>Мастер</span>
                      <b>Шерзод Каримов</b>
                      <span className={s.muted13}>★ 4,7 · 23 отзыва · споров: 0</span>
                    </div>
                  </div>
                  <div className={s.claim}>
                    <span className={s.claimT}>Причина: Сделано плохо или не полностью</span>
                    <span>«Затирка осталась только на стене, пол не затёрт. Мастер отметил работу выполненной и не отвечает.»</span>
                  </div>
                  <div className={s.textBlock}>
                    <span className={s.label}>Переписка по заказу · доступ записан в лог</span>
                    <div className={s.transcript}>
                      {TRANSCRIPT.map(([t, who, x]) => (
                        <div key={t + x} className={s.tLine}>
                          <span className={s.tTime}>{t}</span>
                          <span>
                            <b style={{ color: who === 'Клиент' ? 'var(--brand-700)' : who === 'Мастер' ? 'var(--success-700)' : 'var(--ink-500)' }}>{who}:</b> {x}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={s.decision}>
                  <span className={s.cardT}>Решение</span>
                  {DEC.map(([k, label, sub]) => (
                    <button key={k} type="button" role="radio" aria-checked={dec === k} onClick={() => (setDec(k), setDErr(false))} className={[s.dec, dec === k && s.decOn].filter(Boolean).join(' ')}>
                      <span className={s.radio}>
                        <span />
                      </span>
                      <span className={s.decText}>
                        <b>{label}</b>
                        <span className={s.muted13}>{sub}</span>
                      </span>
                    </button>
                  ))}
                  <textarea value={dComment} onChange={(e) => (setDComment(e.target.value.slice(0, 600)), setDErr(false))} rows={3} placeholder="Обоснование — увидят обе стороны" className={[s.textarea, dErr && s.invalid].filter(Boolean).join(' ')} />
                  {dErr && <span className={s.err}>Выберите решение и напишите обоснование (от 15 символов)</span>}
                  <button type="button" className={s.primary} onClick={decide}>
                    Принять решение
                  </button>
                  <span className={s.muted12}>eKor не возвращает деньги — оплата шла напрямую. Решение влияет на статус заказа, право на отзыв и рейтинг мастера.</span>
                </div>
              </div>
            ) : (
              <div className={s.empty} style={{ maxWidth: 560, textAlign: 'left', alignItems: 'flex-start' }}>
                <span className={s.emptyT}>Открытых споров нет</span>
                <span className={s.muted14}>Спор #A-2041 закрыт: {st.disp.result}. Запись — в аудит-логе.</span>
              </div>
            ))}

          {sec === 'audit' && (
            <div className={s.table}>
              <div className={s.tHead} style={{ gridTemplateColumns: '120px 160px 200px minmax(0,1fr)' }}>
                <span>Когда</span>
                <span>Кто</span>
                <span>Действие</span>
                <span>Объект · было → стало</span>
              </div>
              {st.audit.map((a, i) => (
                <div key={i} className={s.tRow} style={{ gridTemplateColumns: '120px 160px 200px minmax(0,1fr)', background: a.fresh ? 'var(--brand-50)' : undefined }}>
                  <span className={s.muted}>{a.t}</span>
                  <span>{a.who}</span>
                  <b>{a.act}</b>
                  <span className={s.ink700}>{a.obj}</span>
                </div>
              ))}
            </div>
          )}

          {STRUCT[sec] && (
            <div className={s.struct}>
              {STRUCT[sec].map(([h, items]) => (
                <div key={h} className={s.card}>
                  <span className={s.overline}>{h}</span>
                  <ul className={s.list}>
                    {items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
