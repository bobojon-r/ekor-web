'use client';

import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { USE_API } from '@/lib/api';
import { useToast } from '@/components/ui';
import { cx, Head, Label } from '../ui';
import s from '../Admin.module.css';

type Ch = 'SMS' | 'Push';
type Tpl = { code: string; title: string; ch: Ch[]; ru: string; tj: string; vars: string[] };

const TPL: Tpl[] = [
  { code: 'auth.otp', title: 'Код входа', ch: ['SMS'], ru: '{code} — код входа в {app}. Никому не сообщайте его.', tj: '{code} — рамзи воридшавӣ ба {app}. Онро ба ҳеҷ кас нагӯед.', vars: ['{code}', '{minutes}', '{app}'] },
  { code: 'master.approved', title: 'Профиль мастера одобрен', ch: ['SMS', 'Push'], ru: '{app}: профиль одобрен. Вы в каталоге и можете откликаться.', tj: '{app}: профил тасдиқ шуд. Шумо дар каталог ҳастед.', vars: ['{app}'] },
  { code: 'master.rejected', title: 'Профиль отклонён', ch: ['SMS', 'Push'], ru: '{app}: профиль не прошёл проверку — {reason}. Исправьте в приложении.', tj: '{app}: профил аз санҷиш нагузашт — {reason}.', vars: ['{reason}', '{app}'] },
  { code: 'invite.new', title: 'Новое приглашение', ch: ['SMS', 'Push'], ru: '{app}: {name} предлагает работу «{task}». Ответьте за 24 ч.', tj: '{app}: {name} кор пешниҳод мекунад «{task}».', vars: ['{name}', '{task}', '{app}'] },
  { code: 'order.chosen', title: 'Вас выбрали', ch: ['SMS', 'Push'], ru: '{app}: вас выбрали — «{task}». Адрес и телефон в приложении.', tj: '{app}: шуморо интихоб карданд — «{task}».', vars: ['{task}', '{app}'] },
  { code: 'order.done', title: 'Мастер отметил «выполнено»', ch: ['SMS', 'Push'], ru: '{app}: мастер отметил «{task}» выполненным. Подтвердите.', tj: '{app}: усто «{task}»-ро иҷрошуда қайд кард.', vars: ['{task}', '{app}'] },
  { code: 'response.new', title: 'Новый отклик', ch: ['Push'], ru: 'Новый отклик: {name} · {price} смн', tj: 'Ҷавоби нав: {name} · {price} смн', vars: ['{name}', '{price}'] },
  { code: 'task.approved', title: 'Задание одобрено', ch: ['Push'], ru: 'Задание «{task}» опубликовано — мастера уже видят его', tj: 'Супориши «{task}» нашр шуд', vars: ['{task}'] },
  { code: 'task.no_responses', title: 'Нет откликов 24 ч', ch: ['Push'], ru: 'На «{task}» пока нет откликов. Поднимите бюджет или уточните описание', tj: 'Ба «{task}» ҳоло ҷавоб нест', vars: ['{task}'] },
  { code: 'response.closed', title: 'Выбран другой мастер', ch: ['Push'], ru: 'Клиент выбрал другого мастера — «{task}»', tj: 'Мизоҷ устои дигарро интихоб кард — «{task}»', vars: ['{task}'] },
  { code: 'chat.message', title: 'Новое сообщение', ch: ['Push'], ru: '{name}: {text}', tj: '{name}: {text}', vars: ['{name}', '{text}'] },
  { code: 'dispute.resolved', title: 'Спор решён', ch: ['SMS', 'Push'], ru: '{app}: спор по «{task}» решён — {result}. Подробности в приложении.', tj: '{app}: баҳс оид ба «{task}» ҳал шуд — {result}.', vars: ['{task}', '{result}', '{app}'] },
];
/** Переменная считается по максимальной длине значения */
const MAXLEN: Record<string, number> = { '{code}': 6, '{minutes}': 2, '{app}': 4, '{name}': 16, '{task}': 24, '{reason}': 20, '{price}': 5, '{result}': 12, '{text}': 40 };
const SAMPLE: Record<string, string> = { '{code}': '482917', '{minutes}': '5', '{app}': 'eKor', '{name}': 'Фаррух Н.', '{task}': 'Заменить 3 розетки', '{reason}': 'нет фото работ', '{price}': '120', '{result}': 'выполнено', '{text}': 'Выезжаю в 14:30' };
const KEY = 'ekor_admin_templates';

const len = (t: string) => t.replace(/\{\w+\}/g, (v) => 'x'.repeat(MAXLEN[v] ?? 10)).length;
const parts = (n: number) => (n <= 70 ? 1 : Math.ceil(n / 67));
const fill = (t: string) => t.replace(/\{\w+\}/g, (v) => SAMPLE[v] ?? v);


/** 10 — шаблоны SMS и уведомлений (admin). API шаблонов нет — правки хранятся в браузере */
export function Templates() {
  const toast = useToast();
  const [list, setList] = useState<Tpl[]>(TPL);
  const [sel, setSel] = useState(0);
  const [ru, setRu] = useState(TPL[0].ru);
  const [tj, setTj] = useState(TPL[0].tj);
  const [phone, setPhone] = useState('+992 93 ••• 18 04');
  const last = useRef<'ru' | 'tj'>('ru');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved: Record<string, [string, string]> = JSON.parse(raw);
        setList(TPL.map((t) => (saved[t.code] ? { ...t, ru: saved[t.code][0], tj: saved[t.code][1] } : t)));
      }
    } catch {}
  }, []);
  const cur = list[sel];
  useEffect(() => {
    setRu(cur.ru);
    setTj(cur.tj);
  }, [sel, cur.ru, cur.tj]);

  const sms = cur.ch.includes('SMS');
  const counter = (t: string) => {
    const n = len(t);
    return { n, p: parts(n), over: sms && n > 70 };
  };
  const cr = counter(ru);
  const ct = counter(tj);
  const save = () => {
    const next = list.map((t, i) => (i === sel ? { ...t, ru, tj } : t));
    setList(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(next.map((t) => [t.code, [t.ru, t.tj]]))));
    } catch {}
    toast(USE_API ? 'Сохранено в браузере — API шаблонов пока нет' : 'Шаблон сохранён');
  };
  const insert = (v: string) => (last.current === 'ru' ? setRu((x) => `${x}${x.endsWith(' ') ? '' : ' '}${v}`) : setTj((x) => `${x}${x.endsWith(' ') ? '' : ' '}${v}`));

  const area = (lang: 'ru' | 'tj', v: string, set: (x: string) => void, c: ReturnType<typeof counter>) => (
    <div className={s.col6}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className={s.fieldT}>{lang === 'ru' ? 'Русский' : 'Тоҷикӣ'}</span>
        <span style={{ font: "600 12px 'JetBrains Mono', monospace", color: c.over ? '#8A4B0D' : '#0B6E5E' }}>{sms ? `${c.n} / 70 · ${c.p} SMS` : `${c.n} симв.`}</span>
      </div>
      <textarea
        value={v}
        onFocus={() => (last.current = lang)}
        onChange={(e) => set(e.target.value.slice(0, 300))}
        rows={2}
        style={{ padding: '10px 12px', borderRadius: 7, border: `1.5px solid ${c.over ? '#D9822B' : '#2647D9'}`, lineHeight: 1.5, fontSize: 14, minHeight: 44, resize: 'vertical', outline: 'none' }}
      />
      {c.over && <span style={{ color: '#8A4B0D' }}>Превышает 70 символов — отправится {c.p === 2 ? 'двумя' : `${c.p}`} SMS и стоит {c.p === 2 ? 'вдвое' : `в ${c.p} раза`} дороже. Сократите текст.</span>}
    </div>
  );

  return (
    <>
      <Head title="Шаблоны уведомлений">
        <span className={s.muted}>{list.length} событий · SMS — только критичные</span>
        <span className={s.grow} />
        <span className={s.muted}>{USE_API ? 'API шаблонов пока нет — правки хранятся в браузере' : 'Расход SMS за 7 дней: 18 420'}</span>
      </Head>
      <div className={s.split} style={{ gridTemplateColumns: '340px minmax(0,1fr) 320px' }}>
        <div className={s.list}>
          <div className={s.scroll}>
            {list.map((t, i) => (
              <div key={t.code} role="button" tabIndex={0} onClick={() => setSel(i)} onKeyDown={(e) => e.key === 'Enter' && setSel(i)} className={cx(s.row, i === sel && s.rowOn)} style={{ height: 52, display: 'flex', padding: '0 16px', gap: 10 }}>
                <div className={s.grow} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className={s.cell} style={{ fontWeight: i === sel ? 600 : 400 }}>
                    {t.title}
                  </span>
                  <span style={{ font: "500 11px 'JetBrains Mono', monospace", color: '#5B6878' }}>{t.code}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {t.ch.map((c) => (
                    <span key={c} className={s.pill} style={{ background: c === 'SMS' ? '#FBEBDA' : '#EAEEFC', color: c === 'SMS' ? '#8A4B0D' : '#1F3BB8' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={s.panel}>
          <div className={s.panelBody} style={{ padding: '16px 22px', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={s.h18}>{cur.title}</span>
              <span className={s.metaLine}>{cur.code}</span>
              {cur.ch.map((c) => (
                <span key={c} className={s.pill} style={{ background: c === 'SMS' ? '#FBEBDA' : '#EAEEFC', color: c === 'SMS' ? '#8A4B0D' : '#1F3BB8' }}>
                  {c}
                </span>
              ))}
            </div>
            {area('ru', ru, setRu, cr)}
            {area('tj', tj, setTj, ct)}
            <div className={s.col6}>
              <span className={s.fieldT}>Переменные</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cur.vars.map((v) => (
                  <button key={v} type="button" onClick={() => insert(v)} style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid #DCE3EA', background: '#fff', font: "500 12px 'JetBrains Mono', monospace" }}>
                    {v}
                  </button>
                ))}
              </div>
              <span className={s.muted}>Кириллица: 70 символов на SMS, при склейке — 67. Переменная считается по максимальной длине значения.</span>
            </div>
            <div className={s.alertWarn}>
              <TriangleAlert size={15} aria-hidden />
              <span>Тексты TJ — черновик, нужна вычитка носителем перед запуском</span>
            </div>
          </div>
          <div className={s.panelFoot} style={{ padding: '12px 22px' }}>
            <input className={s.input} value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: 150, height: 34, font: "500 12px 'JetBrains Mono', monospace" }} aria-label="Номер для теста" />
            <button type="button" className={s.btn} style={{ height: 34 }} onClick={() => toast(USE_API ? 'Тестовая отправка появится вместе с API шаблонов' : `Тест отправлен на ${phone}`, 'info')}>
              Отправить тест
            </button>
            <span className={s.grow} />
            <button type="button" className={cx(s.btn, s.btnBlue)} disabled={ru === cur.ru && tj === cur.tj} onClick={save}>
              Сохранить
            </button>
          </div>
        </div>
        <div className={s.panelBody} style={{ borderLeft: '1px solid #E1E6EC', background: '#F7F9FB', alignItems: 'center' }}>
          <span style={{ alignSelf: 'flex-start' }}>
            <Label>Предпросмотр</Label>
          </span>
          <div style={{ width: 260, borderRadius: 28, background: '#0F1B2A', padding: 10 }}>
            <div style={{ borderRadius: 20, background: '#E9EDF1', padding: '18px 12px 60px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ alignSelf: 'center', fontSize: 11, color: '#5B6878' }}>eKor · сейчас</span>
              {[ru, tj].map((t, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: '14px 14px 14px 4px', background: '#fff', fontSize: 14, lineHeight: 1.45 }}>
                  {fill(t)}
                </div>
              ))}
            </div>
          </div>
          <span className={s.muted} style={{ textAlign: 'center', lineHeight: 1.45 }}>
            Язык выбирается по профилю пользователя, при входе — по языку приложения
          </span>
        </div>
      </div>
    </>
  );
}
