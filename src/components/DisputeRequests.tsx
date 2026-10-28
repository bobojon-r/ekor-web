'use client';

import { useEffect, useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { api, apiErrorText, USE_API, type MyDispute } from '@/lib/api';
import { useDict, useLang } from '@/lib/i18n';
import { Button, TextArea, useToast } from '@/components/ui';
import s from './DisputeRequests.module.css';

const dict = {
  ru: {
    h: 'Вопрос модератора по спору', answer: 'Ваш ответ', send: 'Ответить', sent: 'Ответ отправлен модератору', yours: 'Вы ответили', min: 'Ответ — от 5 символов',
    res: { done: 'Решение: работа выполнена', not_done: 'Решение: работа не выполнена', partial: 'Решение: выполнено частично' }, terms: 'Доработать до', waiting: 'Модератор разбирает спор. Решение придёт уведомлением.',
  },
  tj: {
    h: 'Саволи модератор оид ба баҳс', answer: 'Ҷавоби шумо', send: 'Ҷавоб додан', sent: 'Ҷавоб ба модератор фиристода шуд', yours: 'Шумо ҷавоб додед', min: 'Ҷавоб — аз 5 аломат',
    res: { done: 'Қарор: кор иҷро шуд', not_done: 'Қарор: кор иҷро нашуд', partial: 'Қарор: қисман иҷро шуд' }, terms: 'Ислоҳ то', waiting: 'Модератор баҳсро баррасӣ мекунад. Қарор бо огоҳинома меояд.',
  },
};

/** Спор по заказу: запросы модератора стороне с ответом и итоговое решение */
export function DisputeRequests({ disputeId }: { disputeId?: number }) {
  const t = useDict(dict);
  const { lang } = useLang();
  const toast = useToast();
  const [d, setD] = useState<MyDispute | null>(null);
  const [text, setText] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<Record<number, string>>({});

  const load = () => disputeId && api.dispute(disputeId).then(setD, () => {});
  useEffect(() => {
    if (USE_API) load();
  }, [disputeId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;

  const send = async (rid: number) => {
    const v = (text[rid] ?? '').trim();
    if (v.length < 5) return setErr({ ...err, [rid]: t.min });
    setBusy(rid);
    try {
      await api.answerDispute(d.id, rid, v);
      toast(t.sent);
      await load();
    } catch (e) {
      setErr({ ...err, [rid]: apiErrorText(e, lang) });
    }
    setBusy(null);
  };
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'tj' ? 'tg-TJ' : 'ru-RU', { day: 'numeric', month: 'long' });

  return (
    <div className={s.box}>
      {d.status === 'resolved' && d.resolution ? (
        <div className={s.res}>
          <b>{t.res[d.resolution]}</b>
          {d.moderator_comment && <span>«{d.moderator_comment}»</span>}
          {d.terms_deadline && (
            <span>
              {t.terms} {date(d.terms_deadline)}
            </span>
          )}
        </div>
      ) : (
        !d.requests.some((r) => !r.answer) && <span className={s.muted}>{t.waiting}</span>
      )}
      {d.requests.map((r) => (
        <div key={r.id} className={s.req}>
          <span className={s.h}>
            <MessageCircleQuestion size={16} aria-hidden />
            {t.h}
          </span>
          <span className={s.q}>{r.text}</span>
          {r.answer ? (
            <span className={s.muted}>
              {t.yours}: «{r.answer}»
            </span>
          ) : (
            d.status === 'open' && (
              <>
                <TextArea label={t.answer} rows={3} maxLength={1000} value={text[r.id] ?? ''} error={err[r.id]} onChange={(e) => (setText({ ...text, [r.id]: e.target.value }), setErr({ ...err, [r.id]: '' }))} />
                <Button size="md" busy={busy === r.id} onClick={() => send(r.id)}>
                  {t.send}
                </Button>
              </>
            )
          )}
        </div>
      ))}
    </div>
  );
}
