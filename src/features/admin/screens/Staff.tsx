'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, LogOut, Minus, Monitor, Pencil, Plus, RefreshCw, UserX, X } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { ref } from '@/lib/api/ref';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import { fieldErrors } from '../data/http';
import { demoCities } from '../data/demo';
import type { SessionV, StaffV } from '../data/types';
import { cx, Head, Loading, Modal, Pill, Switch, useHotkeys } from '../ui';
import s from '../Admin.module.css';
import st from './Staff.module.css';
import { copyText } from '@/lib/browser';

const COLS = 'minmax(0,1fr) minmax(0,1fr) 136px 110px 92px 32px';
const ROLES: [string, string, string][] = [['moderator', 'moderator', 'Очереди своих регионов'], ['senior_moderator', 'senior', 'Споры, отзывы, чаты'], ['admin', 'admin', 'Всё, включая сотрудников']];
const PERMS: [string, number, number, number][] = [
  ['Модерация заданий и профилей', 1, 1, 1], ['Только своих регионов', 1, 0, 0], ['Споры', 0, 1, 1], ['Отзывы и жалобы', 0, 1, 1], ['Просмотр чатов по жалобе', 0, 1, 1], ['Блокировка до 30 дней', 1, 1, 1],
  ['Блокировка навсегда', 0, 1, 1], ['Отметка «Проверен»', 0, 1, 1], ['Справочники', 0, 0, 1], ['Лимиты и шаблоны', 0, 0, 1], ['Сотрудники и роли', 0, 0, 1], ['Выгрузка CSV', 0, 1, 1],
];
const roleTone = (r: string): [string, string] => (r === 'admin' ? ['#0F1B2A', '#fff'] : r.startsWith('senior') ? ['#EAEEFC', '#1F3BB8'] : ['#F5F7F9', '#3B4756']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Правила пароля из API: ≥ 10 символов, буквы и цифры, не совпадает с почтой */
function pwError(pw: string, email: string) {
  if (pw.length < 10) return 'Не короче 10 символов';
  if (!/\p{L}/u.test(pw) || !/\d/.test(pw)) return 'Нужны буквы и цифры';
  if (email && pw.toLowerCase() === email.trim().toLowerCase()) return 'Не должен совпадать с почтой';
  return null;
}
function genPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const d = '23456789';
  const pick = (src: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => src[x % src.length]).join('');
  return `${pick(a, 4)}-${pick(a + d, 4)}-${pick(d, 2)}${pick(a, 2)}`;
}

type Form = { name: string; email: string; phone: string; role: string; regions: number[]; password: string; active: boolean };
type Panel = { mode: 'new' } | { mode: 'edit'; staff: StaffV };

/** 11 — сотрудники и роли (admin); 20 — добавить; 21 — редактировать; 22 — удалить / отключить */
export function Staff({ open }: { open?: 'new' | number }) {
  const { me } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState<StaffV[] | null>(null);
  const [panel, setPanelState] = useState<Panel | null>(open === 'new' ? { mode: 'new' } : null);
  // Адрес панели как в макете: /admin/staff/new (20), /admin/staff/:id (21) — без перезагрузки раздела
  const setPanel = (p: Panel | null) => {
    setPanelState(p);
    const url = !p ? '/admin/staff' : p.mode === 'new' ? '/admin/staff/new' : `/admin/staff/${p.staff.id}`;
    if (location.pathname !== url) history.replaceState(history.state, '', url);
  };
  const cities = (ref.get()?.cities ?? []).length ? ref.get()!.cities.map((c) => ({ id: c.id, ru: c.name.ru })) : demoCities.map((c) => ({ id: c.id, ru: c.ru }));

  const load = () => adminApi.staff().then(setRows, (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof open !== 'number' || !rows || panel) return;
    const x = rows.find((r) => r.id === open);
    if (x) setPanelState({ mode: 'edit', staff: x });
    else (toast('Сотрудник не найден'), setPanel(null));
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = rows?.filter((r) => r.active).length ?? 0;
  const selId = panel?.mode === 'edit' ? panel.staff.id : null;

  return (
    <>
      <Head title="Сотрудники и роли">
        <span className={s.muted}>{rows ? `${rows.length} сотрудников · ${active} активных` : ''}</span>
        <span className={s.grow} />
        <button type="button" className={s.hprimary} style={{ gap: 6 }} onClick={() => setPanel({ mode: 'new' })}>
          <Plus size={15} aria-hidden />
          Добавить сотрудника
        </button>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 480px', position: 'relative' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
              <span>Сотрудник</span>
              <span>Почта</span>
              <span>Роль</span>
              <span>Регионы</span>
              <span>Статус</span>
              <span />
            </div>
            <div className={s.scroll}>
              {rows.map((p) => (
                <div key={p.id} role="button" tabIndex={0} onClick={() => setPanel({ mode: 'edit', staff: p })} onKeyDown={(e) => e.key === 'Enter' && setPanel({ mode: 'edit', staff: p })} className={cx(s.row, s.rowTall, selId === p.id && s.rowOn)} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
                  <span className={s.cell} style={{ fontWeight: 600 }}>
                    {p.name}
                  </span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {p.email}
                  </span>
                  <span>
                    <Pill big mono tone={roleTone(p.role)}>
                      {p.role}
                    </Pill>
                  </span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {p.regions}
                  </span>
                  <span>
                    <Pill tone={p.tone}>{p.status}</Pill>
                  </span>
                  <span className={st.pen} aria-label={`Изменить ${p.name}`}>
                    <Pencil size={15} aria-hidden />
                  </span>
                </div>
              ))}
              <div className={st.info}>
                <span className={st.infoT}>Как добавить сотрудника</span>
                <span>Admin создаёт учётную запись: ФИО, почта, роль, регионы. Admin задаёт пароль и передаёт его сотруднику лично. Отключённый теряет доступ сразу; удалить можно только того, кто ещё не принимал решений.</span>
              </div>
            </div>
          </div>
          <Matrix />
          {panel && (
            <>
              <div className={st.dim} onClick={() => setPanel(null)} aria-hidden />
              <StaffPanel
                key={panel.mode === 'edit' ? panel.staff.id : 'new'}
                panel={panel}
                meId={me.userId}
                cities={cities}
                onClose={() => setPanel(null)}
                onSaved={async (msg) => {
                  toast(msg);
                  setPanel(null);
                  await load();
                }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function Matrix() {
  return (
    <div className={s.panel}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #E1E6EC' }}>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Матрица прав</span>
        <span className={s.muted}>изменяется только в коде</span>
      </div>
      <div style={{ height: 34, flex: 'none', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 72px 72px 72px', gap: 6, alignItems: 'center', padding: '0 18px', font: "600 10px 'JetBrains Mono', monospace", color: '#5B6878', borderBottom: '1px solid #E1E6EC', background: '#F7F9FB' }}>
        <span className={s.label}>Действие</span>
        <span style={{ textAlign: 'center' }}>moderator</span>
        <span style={{ textAlign: 'center' }}>senior</span>
        <span style={{ textAlign: 'center' }}>admin</span>
      </div>
      <div className={s.scroll}>
        {PERMS.map(([l, ...cells]) => (
          <div key={l} style={{ height: 36, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 72px 72px 72px', gap: 6, alignItems: 'center', padding: '0 18px', borderBottom: '1px solid #EEF1F4' }}>
            <span>{l}</span>
            {cells.map((v, i) => (
              <span key={i} style={{ display: 'flex', justifyContent: 'center' }} aria-label={v ? 'есть' : 'нет'}>
                {v ? <Check size={15} color="#0B6E5E" aria-hidden /> : <Minus size={15} color="#C9D1DB" aria-hidden />}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffPanel({ panel, meId, cities, onClose, onSaved }: { panel: Panel; meId?: number; cities: { id: number; ru: string }[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const toast = useToast();
  const edit = panel.mode === 'edit' ? panel.staff : null;
  const [f, setF] = useState<Form>(() =>
    edit ? { name: edit.name, email: edit.email, phone: edit.phone, role: edit.role, regions: edit.regionIds, password: '', active: edit.active } : { name: '', email: '', phone: '', role: 'moderator', regions: [], password: genPassword(), active: true },
  );
  const [showPw, setShowPw] = useState(!edit);
  const [mail, setMail] = useState<'idle' | 'checking' | 'free' | 'taken' | 'bad'>('idle');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<SessionV[] | null>(null);
  const [newPw, setNewPw] = useState<string | null>(null);
  const [del, setDel] = useState<null | 'ask' | 'disable'>(null);
  const seq = useRef(0);
  useHotkeys({ Escape: onClose });

  useEffect(() => {
    if (edit) adminApi.sessions(edit).then(setSessions, () => setSessions([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Почта: формат и занятость при вводе, задержка 300 мс
  useEffect(() => {
    if (edit) return;
    const v = f.email.trim();
    if (!v) return setMail('idle');
    if (!EMAIL.test(v)) return setMail('bad');
    setMail('checking');
    const n = ++seq.current;
    const id = setTimeout(() => adminApi.emailAvailable(v).then((ok) => n === seq.current && setMail(ok ? 'free' : 'taken'), () => n === seq.current && setMail('idle')), 300);
    return () => clearTimeout(id);
  }, [f.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (p: Partial<Form>) => (setF({ ...f, ...p }), setErr(null), setFe({}));
  const pwErr = !edit ? pwError(f.password, f.email) : null;
  const regionsErr = f.role === 'moderator' && f.regions.length === 0;
  const nameErr = f.name.trim().length < 2;
  const invalid = nameErr || regionsErr || (!edit && (mail !== 'free' || !!pwErr));

  const save = async () => {
    setTried(true);
    if (invalid || busy) return;
    setBusy(true);
    try {
      if (edit) {
        await adminApi.patchStaff(edit, { name: f.name.trim(), phone: f.phone.trim(), role: f.role, regionIds: f.regions, active: f.active });
        onSaved(f.active === edit.active ? 'Сохранено' : f.active ? 'Доступ включён' : 'Сотрудник отключён — все сессии завершены');
      } else {
        await adminApi.createStaff({ name: f.name, email: f.email, password: f.password, phone: f.phone, role: f.role, regionIds: f.regions });
        onSaved('Сотрудник создан. Передайте пароль лично — больше он не покажется');
      }
    } catch (e) {
      const x = e as { code?: string };
      // 422 — ошибки показываем под полями, общий текст — только если поле не распознали
      const byField = fieldErrors(e);
      setFe(byField);
      if (Object.keys(byField).length) return setBusy(false);
      setErr(
        x.code === 'last_admin' ? 'Это последний активный admin — его нельзя понизить или отключить' : x.code === 'email_taken' ? 'Почта уже занята' : edit && edit.id === meId && !f.active ? 'Себя отключить нельзя' : apiErrorText(e, 'ru'),
      );
    }
    setBusy(false);
  };

  const field = (label: string, req: boolean, el: React.ReactNode, hint?: React.ReactNode, error?: string | false | null) => (
    <label className={st.field}>
      <span className={s.fieldT}>
        {label} {req && <span style={{ color: '#B03A2E' }}>*</span>}
      </span>
      {el}
      {error ? <span className={s.err}>{error}</span> : hint && <span className={st.hint}>{hint}</span>}
    </label>
  );

  return (
    <aside className={st.panel} role="dialog" aria-label={edit ? edit.name : 'Новый сотрудник'}>
      <div className={st.pHead}>
        <div className={s.col4} style={{ gap: 2 }}>
          <span className={st.pTitle}>{edit ? edit.name : 'Новый сотрудник'}</span>
          <span className={s.muted}>{edit ? `${edit.email} · создан ${edit.created}` : 'учётная запись для входа в админку'}</span>
        </div>
        <button type="button" className={st.x} aria-label="Закрыть" onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className={st.pBody}>
        {edit && (
          <div className={st.access}>
            <div className={s.col4} style={{ gap: 2 }}>
              <span className={s.fieldT}>{f.active ? 'Доступ включён' : 'Доступ отключён'}</span>
              <span className={s.muted}>Выключение сразу завершает все сессии</span>
            </div>
            <span className={s.grow} />
            <Switch on={f.active} onClick={() => set({ active: !f.active })} label="Доступ" />
          </div>
        )}
        {field('ФИО', true, <input className={cx(s.input, ((tried && nameErr) || fe.name) && s.invalid)} value={f.name} onChange={(e) => set({ name: e.target.value.slice(0, 80) })} autoFocus={!edit} />, null, (tried && nameErr && 'Укажите ФИО') || fe.name)}
        {field(
          'Эл. почта',
          !edit,
          <span className={cx(st.mailBox, edit && st.ro, !edit && (mail === 'taken' || (tried && mail === 'bad')) && s.invalid)}>
            <input type="email" value={f.email} readOnly={!!edit} onChange={(e) => set({ email: e.target.value.slice(0, 120) })} autoComplete="off" />
            {!edit && mail !== 'idle' && <span className={mail === 'free' ? st.free : mail === 'taken' || mail === 'bad' ? st.taken : st.checking}>{mail === 'free' ? 'свободна' : mail === 'taken' ? 'занята' : mail === 'bad' ? 'неверный формат' : 'проверяем…'}</span>}
          </span>,
          edit ? 'Почта не меняется — на неё ссылается аудит' : 'Рабочая почта — используется для входа. Изменить потом нельзя',
          fe.email,
        )}
        {!edit && field('Телефон для связи', false, <input className={s.input} inputMode="tel" value={f.phone} placeholder="+992 92 118 40 56" onChange={(e) => set({ phone: e.target.value.slice(0, 20) })} />, 'Не используется для входа', fe.contact_phone)}
        <div className={st.field}>
          <span className={s.fieldT}>
            Роль <span style={{ color: '#B03A2E' }}>*</span>
          </span>
          <div className={st.roles}>
            {ROLES.map(([k, name, d]) => (
              <button key={k} type="button" aria-pressed={f.role === k} className={cx(st.role, f.role === k && st.roleOn)} onClick={() => set({ role: k })}>
                <span className={st.roleName}>{name}</span>
                <span className={st.roleD}>{d}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={st.field}>
          <span className={s.fieldT}>Регионы {f.role === 'moderator' && <span style={{ color: '#B03A2E' }}>*</span>}</span>
          <div className={s.wrap4} style={{ gap: 6 }}>
            {cities.map((c) => {
              const on = f.regions.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} className={cx(st.chip, on && st.chipOn)} onClick={() => set({ regions: on ? f.regions.filter((x) => x !== c.id) : [...f.regions, c.id] })}>
                  {c.ru}
                </button>
              );
            })}
          </div>
          {tried && regionsErr ? <span className={s.err}>Для moderator выберите хотя бы один регион</span> : <span className={st.hint}>Для moderator — обязательно. Видит задания и профили только этих городов</span>}
        </div>
        {!edit && (
          <div className={st.field}>
            <span className={s.fieldT}>
              Пароль <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <PasswordInput value={f.password} show={showPw} setShow={setShowPw} onChange={(v) => set({ password: v })} invalid={tried && !!pwErr} />
            {(tried && pwErr) || fe.password ? <span className={s.err}>{(tried && pwErr) || fe.password}</span> : <span className={st.hint}>Не короче 10 символов, буквы и цифры. Не совпадает с почтой. Передайте сотруднику лично — в системе пароль больше не показывается.</span>}
          </div>
        )}
        {edit && (
          <div className={st.field}>
            <span className={s.fieldT}>Безопасность</span>
            {newPw === null ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className={s.btn} onClick={() => setNewPw(genPassword())}>
                  <KeyRound size={15} aria-hidden />
                  Задать новый пароль
                </button>
                <button
                  type="button"
                  className={s.btn}
                  disabled={!sessions?.filter((x) => !x.revoked).length}
                  onClick={() =>
                    adminApi.revokeSessions(edit).then(
                      () => (toast('Все сеансы завершены'), setSessions((l) => l?.map((x) => ({ ...x, revoked: true })) ?? l)),
                      (e) => toast(apiErrorText(e, 'ru')),
                    )
                  }
                >
                  <LogOut size={15} aria-hidden />
                  Завершить сессии · {sessions?.filter((x) => !x.revoked).length ?? 0}
                </button>
              </div>
            ) : (
              <div className={s.col6}>
                <PasswordInput value={newPw} show onChange={setNewPw} invalid={!!pwError(newPw, f.email)} />
                <span className={pwError(newPw, f.email) ? s.err : st.hint}>{pwError(newPw, f.email) ?? 'Все сессии сотрудника завершатся. Передайте пароль лично.'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={s.btn} onClick={() => setNewPw(null)}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={cx(s.btn, s.btnBlue)}
                    disabled={!!pwError(newPw, f.email)}
                    onClick={() =>
                      adminApi.setPassword(edit, newPw).then(
                        () => (toast('Пароль задан, сессии завершены'), setNewPw(null), setSessions((l) => l?.map((x) => ({ ...x, revoked: true })) ?? l)),
                        (e) => toast(apiErrorText(e, 'ru')),
                      )
                    }
                  >
                    Задать пароль
                  </button>
                </div>
              </div>
            )}
            {sessions?.map((x) => (
              <div key={x.id} className={st.session} style={{ opacity: x.revoked ? 0.5 : 1 }}>
                <Monitor size={16} color="#5B6878" aria-hidden />
                <div className={s.grow} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontWeight: 600 }}>{x.device}</span>
                  <span className={s.muted} style={{ fontSize: 12 }}>
                    {x.where || '—'}
                  </span>
                </div>
                <span className={s.muted}>{x.revoked ? 'завершён' : x.current ? 'сейчас' : x.when}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={st.pFoot}>
        {edit && (
          <button type="button" className={cx(s.btn, s.btnGhost)} style={{ color: '#B03A2E' }} disabled={edit.id === meId} title={edit.id === meId ? 'Себя удалить нельзя' : ''} onClick={() => setDel('ask')}>
            Удалить…
          </button>
        )}
        <span className={s.grow} style={{ color: '#B03A2E', fontSize: 12, lineHeight: 1.35 }}>
          {err}
        </span>
        <button type="button" className={s.btn} onClick={onClose}>
          Отмена
        </button>
        <button type="button" className={cx(s.btn, s.btnBlue)} disabled={busy || (tried && invalid)} onClick={save}>
          {busy ? 'Сохраняем…' : edit ? 'Сохранить' : 'Создать сотрудника'}
        </button>
      </div>
      {del === 'ask' && edit && (
        <Modal
          icon={UserX}
          tone="red"
          title={`Удалить ${edit.name}?`}
          sub={`Учётная запись будет удалена, почта ${edit.email} освободится. Удалить можно только сотрудника без решений.`}
          okText="Удалить"
          okTone="red"
          busy={busy}
          onClose={() => setDel(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.deleteStaff(edit);
              setDel(null);
              onSaved('Сотрудник удалён');
            } catch (e) {
              if ((e as { code?: string }).code === 'has_decisions') setDel('disable');
              else toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <span className={s.muted}>Действие необратимо и записывается в аудит-лог.</span>
        </Modal>
      )}
      {del === 'disable' && edit && (
        <Modal
          icon={UserX}
          tone="red"
          title="Удалить нельзя — только отключить"
          sub={`У ${edit.name} есть решения в аудит-логе. Чтобы история осталась проверяемой, учётная запись сохраняется.`}
          okText="Отключить сотрудника"
          okTone="red"
          busy={busy}
          onClose={() => setDel(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.patchStaff(edit, { active: false });
              setDel(null);
              onSaved('Сотрудник отключён — все сессии завершены');
            } catch (e) {
              toast((e as { code?: string }).code === 'last_admin' ? 'Это последний активный admin — отключить нельзя' : apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.bullets}>
            <b>При отключении</b>
            <span>· Все сессии завершаются сразу, вход невозможен</span>
            <span>· Задания, которые он сейчас открыл, вернутся в общую очередь</span>
            <span>· Включить обратно можно в карточке — с новым паролем</span>
          </div>
        </Modal>
      )}
    </aside>
  );
}

function PasswordInput({ value, onChange, show = true, setShow, invalid }: { value: string; onChange: (v: string) => void; show?: boolean; setShow?: (v: boolean) => void; invalid?: boolean }) {
  const toast = useToast();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span className={cx(st.mailBox, invalid && s.invalid)} style={{ flex: 1 }}>
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value.slice(0, 64))} autoComplete="new-password" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }} />
        <button type="button" className={st.icon} aria-label="Сгенерировать" title="Сгенерировать" onClick={() => onChange(genPassword())}>
          <RefreshCw size={15} aria-hidden />
        </button>
        {setShow && (
          <button type="button" className={st.icon} aria-label={show ? 'Скрыть' : 'Показать'} onClick={() => setShow(!show)}>
            {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        )}
      </span>
      <button
        type="button"
        className={st.copy}
        onClick={() =>
          copyText(value).then(
            () => toast('Пароль скопирован'),
            () => toast('Не удалось скопировать — выделите вручную', 'info'),
          )
        }
      >
        <Copy size={15} aria-hidden />
        Копировать
      </button>
    </div>
  );
}
