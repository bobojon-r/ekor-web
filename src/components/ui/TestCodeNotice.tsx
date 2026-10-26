'use client';

import { FlaskConical } from 'lucide-react';
import { IS_MOCK, TEST_OTP } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import s from './TestCodeNotice.module.css';

/**
 * Тестовый режим входа, пока не подключён SMS-шлюз.
 * step='phone' — предупреждаем заранее; step='code' — плюс кнопка «Подставить код».
 * Исчезает сама, когда NEXT_PUBLIC_SMS_ENABLED=true.
 */
export function TestCodeNotice({ step, onFill }: { step: 'phone' | 'code'; onFill?: (code: string) => void }) {
  const { lang } = useLang();
  if (!IS_MOCK) return null;
  const tj = lang === 'tj';
  return (
    <div className={s.box} role="note">
      <FlaskConical size={18} aria-hidden className={s.icon} />
      <div className={s.body}>
        <span className={s.title}>{tj ? 'Реҷаи санҷишӣ' : 'Тестовый режим'}</span>
        <span>
          {tj ? 'SMS ҳоло фиристода намешаванд. Барои ворид шудан рамзи ' : 'SMS пока не отправляются. Для входа используйте код '}
          <b className={s.code}>{TEST_OTP}</b>
          {step === 'phone' && (tj ? ' — онро дар қадами навбатӣ ворид кунед.' : ' — его нужно ввести на следующем шаге.')}
        </span>
        {step === 'code' && onFill && (
          <button type="button" className={s.fill} onClick={() => onFill(TEST_OTP)}>
            {tj ? `Гузоштани ${TEST_OTP}` : `Подставить ${TEST_OTP}`}
          </button>
        )}
      </div>
    </div>
  );
}
