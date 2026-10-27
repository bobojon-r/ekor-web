'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, ShieldCheck } from 'lucide-react';
import { apiErrorText, USE_API } from '@/lib/api';
import { ref } from '@/lib/api/ref';
import { useToast } from '@/components/ui';
import { adminApi } from '../data/api';
import { demoCities } from '../data/demo';
import type { StaffV } from '../data/types';
import { cx, Head, Loading, Modal, Pill } from '../ui';
import s from '../Admin.module.css';

const COLS = 'minmax(0,1fr) 150px 150px 92px 80px 80px';
const ROLES = ['moderator', 'senior_moderator', 'admin'];
const PERMS: [string, number, number, number][] = [
  ['Модерация заданий и профилей', 1, 1, 1], ['Только своих регионов', 1, 0, 0], ['Споры', 0, 1, 1], ['Отзывы и жалобы', 0, 1, 1], ['Просмотр чатов по жалобе', 0, 1, 1], ['Блокировка до 30 дней', 1, 1, 1],
  ['Блокировка навсегда', 0, 1, 1], ['Отметка «Проверен»', 0, 1, 1], ['Справочники', 0, 0, 1], ['Лимиты и шаблоны', 0, 0, 1], ['Сотрудники и роли', 0, 0, 1], ['Выгрузка CSV', 0, 1, 1],
];
const roleTone = (r: string): [string, string] => (r === 'admin' ? ['#0F1B2A', '#fff'] : r.startsWith('senior') ? ['#EAEEFC', '#1F3BB8'] : ['#F5F7F9', '#3B4756']);
type Form = { mode: 'invite' | 'edit'; phone: string; role: string; regions: number[]; active: boolean };

/** 11 — сотрудники и роли (admin): матрица прав меняется только в коде */
export function Staff() {
  const toast = useToast();
  const [rows, setRows] = useState<StaffV[] | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const cities = (ref.get()?.cities ?? []).length ? ref.get()!.cities.map((c) => ({ id: c.id, ru: c.name.ru })) : demoCities.map((c) => ({ id: c.id, ru: c.ru }));

  const load = () => adminApi.staff().then(setRows, (e) => (setRows([]), toast(apiErrorText(e, 'ru'))));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = rows?.find((r) => r.userId === selId) ?? null;

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    try {
      if (form.mode === 'invite') await adminApi.inviteStaff(`+992${form.phone.replace(/\D/g, '').slice(-9)}`, form.role, form.regions);
      else if (sel) await adminApi.patchStaff(sel, { role: form.role, regionIds: form.regions, active: form.active });
      toast(form.mode === 'invite' ? 'Приглашение отправлено по SMS' : 'Доступ изменён');
      setForm(null);
      await load();
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const phoneOk = form?.mode === 'edit' || (form?.phone.replace(/\D/g, '').length ?? 0) >= 9;

  return (
    <>
      <Head title="Сотрудники и роли">
        <span className={s.muted}>{rows ? `${rows.length} сотрудников · ${rows.filter((r) => r.active && r.status === 'Активен').length} активных` : ''}</span>
        <span className={s.grow} />
        <button type="button" className={s.hprimary} onClick={() => setForm({ mode: 'invite', phone: '', role: 'moderator', regions: [], active: true })}>
          Пригласить сотрудника
        </button>
      </Head>
      {!rows ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 480px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS, padding: '0 16px' }}>
              <span>Сотрудник</span>
              <span>Роль</span>
              <span>Регионы</span>
              <span>Статус</span>
              <span className={s.right}>Решений 7д</span>
              <span className={s.right}>Вход</span>
            </div>
            <div className={s.scroll}>
              {rows.map((p) => (
                <div
                  key={p.userId}
                  role="button"
                  tabIndex={0}
                  title="Изменить доступ"
                  onClick={() => (setSelId(p.userId), setForm({ mode: 'edit', phone: p.phone, role: p.role, regions: p.regionIds, active: p.active }))}
                  onKeyDown={(e) => e.key === 'Enter' && (setSelId(p.userId), setForm({ mode: 'edit', phone: p.phone, role: p.role, regions: p.regionIds, active: p.active }))}
                  className={cx(s.row, s.rowTall, selId === p.userId && s.rowOn)}
                  style={{ gridTemplateColumns: COLS, padding: '0 16px' }}
                >
                  <span className={s.cell} style={{ fontWeight: 600 }}>
                    {p.name}
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
                  <span className={s.num}>{p.decisions}</span>
                  <span className={s.right} style={{ color: '#5B6878' }}>
                    {p.seen}
                  </span>
                </div>
              ))}
              <div style={{ margin: 16, padding: 14, borderRadius: 10, border: '1px dashed #C9D1DB', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5, color: '#3B4756' }}>
                <span style={{ fontWeight: 600, color: '#0F1B2A' }}>Как работает приглашение</span>
                <span>
                  Admin указывает номер, роль и регионы → сотрудник получает SMS со ссылкой → входит по коду. Вход в админку — только с номера сотрудника и с подтверждением на каждом новом устройстве. Отключённый сотрудник теряет доступ сразу; его решения остаются в аудите.
                </span>
              </div>
            </div>
          </div>
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
        </div>
      )}
      {form && (
        <Modal
          icon={ShieldCheck}
          tone="blue"
          title={form.mode === 'invite' ? 'Пригласить сотрудника' : `Доступ: ${sel?.name ?? ''}`}
          sub={form.mode === 'invite' ? 'Сотрудник получит SMS со ссылкой и войдёт по коду' : sel?.phone}
          okText={form.mode === 'invite' ? 'Отправить приглашение' : 'Сохранить'}
          okDisabled={!phoneOk || (form.role === 'moderator' && form.regions.length === 0)}
          busy={busy}
          onClose={() => (setForm(null), setSelId(null))}
          onOk={submit}
        >
          {form.mode === 'invite' && (
            <label className={s.col4}>
              <span className={s.fieldT}>Номер сотрудника</span>
              <input className={s.input} inputMode="tel" placeholder="+992 93 512 44 07" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.slice(0, 20) })} autoFocus />
            </label>
          )}
          <div className={s.col4}>
            <span className={s.fieldT}>Роль</span>
            <div className={s.wrap4} style={{ gap: 6 }}>
              {ROLES.map((r) => (
                <button key={r} type="button" aria-pressed={form.role === r} className={cx(s.reason, form.role === r && s.reasonOn)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, borderColor: form.role === r ? '#2647D9' : undefined, background: form.role === r ? '#F7F9FF' : undefined }} onClick={() => setForm({ ...form, role: r })}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className={s.col4}>
            <span className={s.fieldT}>Регионы {form.role === 'moderator' && <span style={{ color: '#B03A2E' }}>*</span>}</span>
            <div className={s.wrap4} style={{ gap: 6 }}>
              {cities.map((c) => {
                const on = form.regions.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} className={s.reason} style={{ borderColor: on ? '#2647D9' : undefined, background: on ? '#F7F9FF' : undefined, fontWeight: on ? 600 : 400 }} onClick={() => setForm({ ...form, regions: on ? form.regions.filter((x) => x !== c.id) : [...form.regions, c.id] })}>
                    {c.ru}
                  </button>
                );
              })}
            </div>
            <span className={s.muted}>{form.role === 'moderator' ? 'Модератор видит очереди только своих регионов' : 'Пусто — все регионы'}</span>
          </div>
          {form.mode === 'edit' && (
            <label className={s.checkRow} style={{ cursor: 'pointer', borderColor: form.active ? '#DCE3EA' : '#E8C4BE', background: form.active ? '#fff' : '#FFF9F8' }}>
              <input type="checkbox" checked={!form.active} onChange={() => setForm({ ...form, active: !form.active })} />
              <span>Отключить доступ — сотрудник теряет доступ сразу, решения остаются в аудите</span>
            </label>
          )}
          {!USE_API && form.mode === 'invite' && <span className={s.muted}>Демо: приглашение появится в списке со статусом «Приглашён»</span>}
        </Modal>
      )}
    </>
  );
}
