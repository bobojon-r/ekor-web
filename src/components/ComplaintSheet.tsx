'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session/SessionProvider';
import { api, apiErrorText } from '@/lib/api';
import { pick, useDict, useLang, type L10n } from '@/lib/i18n';
import { Button, RadioCard, Sheet, TextArea, useToast } from '@/components/ui';
import s from './ComplaintSheet.module.css';

export type ComplaintTarget = { subject: 'task' | 'master_profile' | 'review'; id: number };

const KIND = { task: 'task_report', master_profile: 'profile_report', review: 'review_report' } as const;
const dict = {
  ru: {
    h: { task: 'Пожаловаться на задание', master_profile: 'Пожаловаться на мастера', review: 'Пожаловаться на отзыв' },
    sub: 'Модератор проверит в течение суток. Автор не узнает, кто пожаловался.', comment: 'Что случилось', commentHint: 'Обязательно для «Другое»',
    err: 'Выберите причину', errComment: 'Опишите, что случилось', send: 'Отправить жалобу', cancel: 'Отмена', sent: 'Жалоба отправлена модератору', loadErr: 'Не удалось загрузить причины',
  },
  tj: {
    h: { task: 'Шикоят аз супориш', master_profile: 'Шикоят аз усто', review: 'Шикоят аз шарҳ' },
    sub: 'Модератор дар давоми як шабонарӯз месанҷад. Муаллиф намедонад, ки кӣ шикоят кард.', comment: 'Чӣ шуд', commentHint: 'Барои «Дигар» ҳатмист',
    err: 'Сабабро интихоб кунед', errComment: 'Нависед, ки чӣ шуд', send: 'Фиристодани шикоят', cancel: 'Бекор', sent: 'Шикоят ба модератор фиристода шуд', loadErr: 'Сабабҳо бор нашуданд',
  },
};

/** Жалоба на задание, профиль мастера или отзыв: причины — из справочника бэкенда, «Другое» — с комментарием */
export function ComplaintSheet({ target, onClose }: { target: ComplaintTarget | null; onClose: () => void }) {
  const t = useDict(dict);
  const { lang } = useLang();
  const toast = useToast();
  const [reasons, setReasons] = useState<{ id: number; code: string; label: L10n }[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useSession();
  const router = useRouter();
  const kind = target ? KIND[target.subject] : null;

  useEffect(() => {
    if (!kind) return;
    // Жалоба — только от вошедшего пользователя: после входа вернёмся на эту же страницу
    if (!user) return (onClose(), router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`));
    setSel(null);
    setComment('');
    setErr(null);
    api.reasons(kind).then(setReasons, () => (setReasons([]), setErr(t.loadErr)));
  }, [kind, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const other = reasons?.find((r) => r.id === sel)?.code === 'other';
  const send = async () => {
    if (!target) return;
    if (sel === null) return setErr(t.err);
    if (other && comment.trim().length < 5) return setErr(t.errComment);
    setBusy(true);
    try {
      await api.complain(target.subject, target.id, sel, comment.trim() || null);
      toast(t.sent);
      onClose();
    } catch (e) {
      setErr(apiErrorText(e, lang));
    }
    setBusy(false);
  };

  return (
    <Sheet open={!!target} onClose={onClose} width={480} closeLabel={t.cancel}>
      {target && (
        <div className={s.box}>
          <div className={s.h}>{t.h[target.subject]}</div>
          <div className={s.sub}>{t.sub}</div>
          {reasons?.map((r) => (
            <RadioCard key={r.id} tone="danger" selected={sel === r.id} onClick={() => (setSel(r.id), setErr(null))}>
              {pick(r.label, lang)}
            </RadioCard>
          ))}
          {sel !== null && <TextArea label={t.comment} hint={other ? t.commentHint : undefined} rows={3} maxLength={1000} value={comment} onChange={(e) => (setComment(e.target.value), setErr(null))} />}
          {err && <span className={s.err}>{err}</span>}
          <Button variant="danger" size="lg" block disabled={busy || !reasons?.length} onClick={send}>
            {t.send}
          </Button>
          <Button variant="secondary" size="md" block onClick={onClose}>
            {t.cancel}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
