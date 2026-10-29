'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, ImagePlus, ShieldCheck, X } from 'lucide-react';
import { api, apiErrorText, uploadPhoto, USE_API, type VerifyReq } from '@/lib/api';
import { useDict, useLang } from '@/lib/i18n';
import { Button, TextArea, useToast } from '@/components/ui';
import s from './VerifyRequest.module.css';

const MAX_PHOTOS = 3;
const dict = {
  ru: {
    h: 'Отметка «Проверен»', p: 'Клиенты чаще выбирают проверенных мастеров. Модератор позвонит вам и сверит документ.', ask: 'Запросить проверку',
    comment: 'Комментарий модератору', commentPh: 'Например: готов показать паспорт по видео', photos: 'Фото документа — по желанию, до 3', send: 'Отправить запрос', cancel: 'Отмена',
    sent: 'Запрос отправлен модератору', pending: 'Запрос отправлен. Модератор свяжется с вами — обычно в течение суток.', declined: 'Модератор отказал', again: 'Запросить снова', upErr: 'Не удалось загрузить фото',
  },
  tj: {
    h: 'Нишони «Санҷидашуда»', p: 'Мизоҷон бештар устоҳои санҷидашударо интихоб мекунанд. Модератор ба шумо занг зада, ҳуҷҷатро месанҷад.', ask: 'Дархости санҷиш',
    comment: 'Шарҳ ба модератор', commentPh: 'Масалан: шиносномаро бо видео нишон дода метавонам', photos: 'Акси ҳуҷҷат — ихтиёрӣ, то 3', send: 'Фиристодани дархост', cancel: 'Бекор',
    sent: 'Дархост ба модератор фиристода шуд', pending: 'Дархост фиристода шуд. Модератор бо шумо тамос мегирад — одатан дар давоми як шабонарӯз.', declined: 'Модератор рад кард', again: 'Боз дархост кардан', upErr: 'Акс бор нашуд',
  },
};

/** Запрос отметки «Проверен» — только для одобренного профиля без отметки; решает модератор */
export function VerifyRequest() {
  const t = useDict(dict);
  const { lang } = useLang();
  const toast = useToast();
  const [req, setReq] = useState<VerifyReq | null | undefined>(undefined);
  const [form, setForm] = useState(false);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<{ id: number; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (USE_API) api.verifyRequest().then(setReq, () => setReq(null));
  }, []);
  if (!USE_API || req === undefined) return null;

  const pending = !!req && !req.resolved_at;
  const declined = !!req && !!req.resolved_at;
  const add = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const p = await uploadPhoto('verify_doc', f);
      setPhotos((l) => [...l, p]);
    } catch {
      setErr(t.upErr);
    }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      setReq(await api.requestVerify(comment.trim() || null, photos.map((p) => p.id)));
      setForm(false);
      toast(t.sent);
    } catch (e) {
      setErr(apiErrorText(e, lang));
    }
    setBusy(false);
  };

  return (
    <section className={s.box}>
      <span className={s.h}>
        {pending ? <Clock size={18} color="var(--warn-800)" aria-hidden /> : <ShieldCheck size={18} color="var(--success-700)" aria-hidden />}
        {t.h}
      </span>
      {pending ? (
        <p className={s.p}>{t.pending}</p>
      ) : (
        <>
          <p className={s.p}>{t.p}</p>
          {declined && !form && (
            <span className={s.declined}>
              {t.declined}
              {req?.decision_comment ? `: «${req.decision_comment}»` : ''}
            </span>
          )}
          {form ? (
            <>
              <TextArea label={t.comment} placeholder={t.commentPh} rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
              <span className={s.p}>{t.photos}</span>
              <div className={s.photos}>
                {photos.map((p) => (
                  <span key={p.id} className={s.photo}>
                    {p.url && <img src={p.url} alt="" />}
                    <button type="button" className={s.del} aria-label="×" onClick={() => setPhotos((l) => l.filter((x) => x.id !== p.id))}>
                      <X size={14} aria-hidden />
                    </button>
                  </span>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" className={s.add} disabled={busy} onClick={() => file.current?.click()} aria-label={t.photos}>
                    <ImagePlus size={22} aria-hidden />
                  </button>
                )}
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => (add(e.target.files?.[0]), (e.target.value = ''))} />
              </div>
              {err && <span className={s.err}>{err}</span>}
              <Button size="md" block busy={busy} onClick={send}>
                {t.send}
              </Button>
              <Button variant="secondary" size="md" block onClick={() => (setForm(false), setErr(null))}>
                {t.cancel}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="md" block onClick={() => setForm(true)}>
              {declined ? t.again : t.ask}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
