'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { apiErrorText } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useAdmin } from '../AdminShell';
import { adminApi } from '../data/api';
import type { UserCard, UserV } from '../data/types';
import { initials, num } from '../core';
import { cx, Head, Label, Loading, Modal, Pill, SearchBox, SelectChip, ToggleChip, useHotkeys } from '../ui';
import s from '../Admin.module.css';

const COLS = '72px minmax(0,1fr) 140px 92px 92px 92px 50px 90px';
const REASONS = ['Мошенничество: предоплата', 'Оскорбления и угрозы', 'Спам и реклама', 'Фейковый профиль', 'Обход правил платформы'];
const TERMS: [string, number | null][] = [['24 ч', 1], ['7 дней', 7], ['30 дней', 30], ['Навсегда', null]];

/** 06 — пользователи и блокировки; 16 — подтверждение вечной блокировки */
export function Users({ initialId }: { initialId?: number }) {
  const { me } = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [withC, setWithC] = useState(false);
  const [city, setCity] = useState('all');
  const [data, setData] = useState<{ items: UserV[]; total: number; masters: number } | null>(null);
  const [selKey, setSelKey] = useState<number | null>(initialId ?? null);
  const [card, setCard] = useState<UserCard | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [term, setTerm] = useState<number | null>(7);
  const [comment, setComment] = useState('');
  const [forever, setForever] = useState(false);
  const [digits, setDigits] = useState('');
  const [unblock, setUnblock] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const senior = me.role !== 'moderator';

  useEffect(() => {
    const id = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const load = () => adminApi.users({ q: qDeb, role, status, complaints: withC, city }).then(setData, (e) => (setData({ items: [], total: 0, masters: 0 }), toast(apiErrorText(e, 'ru'))));
  useEffect(() => {
    load();
  }, [qDeb, role, status, withC, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.items ?? [];
  const cur = rows.find((u) => u.key === selKey) ?? rows[0] ?? null;
  useEffect(() => {
    setCard(null);
    setComment('');
    setTerm(7);
    if (cur) adminApi.user(cur).then(setCard, (e) => toast(apiErrorText(e, 'ru')));
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const idx = cur ? rows.indexOf(cur) : -1;
  useHotkeys(cur ? { j: () => rows[idx + 1] && setSelKey(rows[idx + 1].key), k: () => idx > 0 && setSelKey(rows[idx - 1].key) } : {});

  const block = async () => {
    if (!cur) return;
    setBusy(true);
    try {
      await adminApi.block(cur, reason, term, comment.trim());
      setForever(false);
      setDigits('');
      toast(term ? `Заблокирован на ${TERMS.find((t) => t[1] === term)?.[0]}` : 'Заблокирован навсегда');
      await load();
      adminApi.user({ ...cur, blocked: true }).then(setCard, () => {});
    } catch (e) {
      toast(apiErrorText(e, 'ru'));
    }
    setBusy(false);
  };
  const last4 = cur ? cur.phone.replace(/\D/g, '').slice(-4) : '';
  const cities = [...new Set(rows.map((u) => u.city))];

  return (
    <>
      <Head title="Пользователи">
        <span className={s.muted}>{data ? `${num(data.total)} · мастеров ${num(data.masters)}` : ''}</span>
        <span className={s.grow} />
        <SearchBox value={q} onChange={setQ} placeholder="Телефон, имя, ID" width={300} slash />
      </Head>
      <div className={s.filters}>
        <SelectChip label="Роль" value={role} onChange={setRole} options={[['all', 'все'], ['Клиент', 'клиент'], ['Мастер', 'мастер']]} />
        <SelectChip label="Статус" value={status} onChange={setStatus} options={[['all', 'все'], ['active', 'активен'], ['blocked', 'заблокирован']]} />
        <ToggleChip on={withC} onClick={() => setWithC(!withC)}>
          С жалобами
        </ToggleChip>
        <SelectChip label="Город" value={city} onChange={setCity} options={[['all', 'все'], ...cities.map((c): [string, string] => [c, c])]} />
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className={s.split} style={{ gridTemplateColumns: 'minmax(0,1fr) 420px' }}>
          <div className={s.list}>
            <div className={s.thead} style={{ gridTemplateColumns: COLS }}>
              <span>ID</span>
              <span>Имя</span>
              <span>Телефон</span>
              <span>Роль</span>
              <span>Город</span>
              <span>Статус</span>
              <span className={s.right}>Жал.</span>
              <span className={s.right}>Вход</span>
            </div>
            <div className={s.scroll}>
              {rows.length === 0 && <div className={s.hint} style={{ padding: 16 }}>Никого не нашли. Поиск — по телефону, имени или ID.</div>}
              {rows.map((u) => (
                <div key={u.key} role="button" tabIndex={0} onClick={() => setSelKey(u.key)} onKeyDown={(e) => e.key === 'Enter' && setSelKey(u.key)} className={cx(s.row, cur?.key === u.key && s.rowOn)} style={{ gridTemplateColumns: COLS }}>
                  <span className={s.id}>{u.id}</span>
                  <span className={s.cell} style={{ fontWeight: 500 }}>
                    {u.name}
                  </span>
                  <span className={cx(s.mono, s.cell)} style={{ fontSize: 12, fontWeight: 500 }}>
                    {u.phone}
                  </span>
                  <span style={{ color: '#3B4756' }}>{u.role}</span>
                  <span className={s.cell} style={{ color: '#3B4756' }}>
                    {u.city}
                  </span>
                  <span>
                    <Pill tone={u.tone}>{u.status}</Pill>
                  </span>
                  <span className={s.num} style={{ color: u.complaints >= 3 ? '#B03A2E' : '#0F1B2A' }}>
                    {u.complaints}
                  </span>
                  <span className={s.right} style={{ color: '#5B6878' }}>
                    {u.seen}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {cur && card ? (
            <div className={s.panel}>
              <div className={s.panelBody} style={{ padding: '16px 20px', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#EAEEFC', color: '#2647D9', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(cur.name)}</span>
                  <div className={s.col4} style={{ gap: 2 }}>
                    <span className={s.h17}>{cur.name}</span>
                    <span className={s.metaLine}>
                      {cur.id} · {cur.phone}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {card.stats.map(([v, l, red]) => (
                    <div key={l} style={{ padding: '8px 10px', borderRadius: 8, background: '#F7F9FB', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: red ? '#B03A2E' : '#0F1B2A', whiteSpace: 'nowrap' }}>{v}</span>
                      <span className={s.muted} style={{ fontSize: 12 }}>
                        {l}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={s.col6}>
                  <Label>Сигналы</Label>
                  <span style={{ lineHeight: 1.5 }}>{card.signals}</span>
                </div>
                {cur.blocked ? (
                  <div style={{ border: '1.5px solid #DCE3EA', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#F7F9FB' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Пользователь заблокирован · {cur.status}</span>
                    {card.blockReason && <span className={s.muted}>Причина: {card.blockReason}</span>}
                    {cur.status === 'Навсегда' && me.role !== 'admin' ? (
                      <div className={s.alertWarn}>
                        <TriangleAlert size={15} aria-hidden />
                        <span>Снять вечную блокировку может только admin</span>
                      </div>
                    ) : (
                      <button type="button" className={s.btn} onClick={() => setUnblock('')}>
                        Разблокировать…
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ border: '1.5px solid #E8C4BE', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#FFF9F8' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#A5281B' }}>Заблокировать пользователя</span>
                    <label className={s.col4}>
                      <span className={s.fieldT}>Причина</span>
                      <select className={s.select} value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: 34 }}>
                        {REASONS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <div className={s.col4}>
                      <span className={s.fieldT}>Срок</span>
                      <div style={{ display: 'flex', background: '#fff', border: '1px solid #C9D1DB', borderRadius: 7, padding: 2 }}>
                        {TERMS.map(([l, v]) => {
                          const on = term === v;
                          const locked = v === null && !senior;
                          return (
                            <button
                              key={l}
                              type="button"
                              disabled={locked}
                              title={locked ? 'Блокировка навсегда — senior_moderator и admin' : ''}
                              onClick={() => setTerm(v)}
                              style={{ flex: 1, height: 28, borderRadius: 5, border: 'none', background: on ? (v === null ? '#B03A2E' : '#0F1B2A') : 'transparent', color: on ? '#fff' : locked ? '#9AA5B4' : '#0F1B2A', fontWeight: on ? 600 : 400, fontSize: 13 }}
                            >
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea className={s.textarea} rows={2} value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder="Основание: номер жалобы, чат, факты (обязательно)" />
                    {term === null && (
                      <div className={s.alertWarn}>
                        <TriangleAlert size={15} aria-hidden />
                        <span>{card.activeTasks ? `${card.activeTasks} активн. заданий будет снято, мастера с откликами получат уведомление. ` : ''}Номер нельзя будет зарегистрировать снова.</span>
                      </div>
                    )}
                    <button type="button" className={cx(s.btn, s.btnRed)} disabled={comment.trim().length < 5 || busy} onClick={() => (term === null ? setForever(true) : block())}>
                      {term === null ? 'Заблокировать навсегда' : `Заблокировать на ${TERMS.find((t) => t[1] === term)?.[0]}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Loading />
          )}
        </div>
      )}
      {forever && cur && (
        <Modal
          icon={TriangleAlert}
          tone="red"
          title={`Заблокировать ${cur.name} навсегда?`}
          sub={`${cur.id} · ${cur.phone} · ${cur.role.toLowerCase()} · ${cur.city}`}
          okText="Заблокировать навсегда"
          okTone="red"
          okDisabled={digits !== last4}
          busy={busy}
          onClose={() => (setForever(false), setDigits(''))}
          onOk={block}
        >
          <div className={s.bullets}>
            <b>Что произойдёт сразу</b>
            <span>· Выход со всех устройств, вход по этому номеру невозможен</span>
            <span>· Открытые задания снимаются, мастера с откликами получат уведомление</span>
            <span>· Отзывы пользователя скрываются, переписка сохраняется для споров</span>
            <span>· Пользователь получит SMS с причиной и способом обжалования</span>
          </div>
          <div className={s.softBox}>
            <span>Причина</span>
            <b>{reason}</b>
            <span>Основание</span>
            <span>{comment.trim()}</span>
          </div>
          <div className={s.col4}>
            <span className={s.fieldT}>Для подтверждения введите последние 4 цифры номера</span>
            <input
              className={cx(s.input, digits.length > 0 && digits !== last4 && s.invalid)}
              style={{ width: 140, height: 40, font: "600 16px 'JetBrains Mono', monospace", letterSpacing: '0.2em' }}
              inputMode="numeric"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
              aria-label="Последние 4 цифры номера"
            />
            <span className={s.muted}>{digits.length < 4 ? `Нужна ${digits.length + 1}-я цифра` : digits === last4 ? 'Совпадает' : 'Цифры не совпадают'}</span>
          </div>
          <div className={s.alertWarn}>
            <TriangleAlert size={15} aria-hidden />
            <span>Снять вечную блокировку может только admin, через карточку пользователя</span>
          </div>
        </Modal>
      )}
      {unblock !== null && cur && (
        <Modal
          icon={TriangleAlert}
          tone="blue"
          title={`Разблокировать ${cur.name}?`}
          sub={`${cur.id} · ${cur.status}`}
          okText="Разблокировать"
          okDisabled={unblock.trim().length < 5}
          busy={busy}
          onClose={() => setUnblock(null)}
          onOk={async () => {
            setBusy(true);
            try {
              await adminApi.unblock(cur, unblock.trim());
              setUnblock(null);
              toast('Пользователь разблокирован');
              await load();
            } catch (e) {
              toast(apiErrorText(e, 'ru'));
            }
            setBusy(false);
          }}
        >
          <div className={s.col4}>
            <span className={s.fieldT}>
              Основание <span style={{ color: '#B03A2E' }}>*</span>
            </span>
            <textarea className={s.textarea} rows={3} value={unblock} onChange={(e) => setUnblock(e.target.value.slice(0, 500))} autoFocus />
            <span className={s.muted}>Попадёт в аудит-лог</span>
          </div>
        </Modal>
      )}
    </>
  );
}
