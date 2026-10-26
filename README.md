# eKor — мастер по вызову · web (Next.js)

Реализация дизайна из `../designs` на Next.js 15 (App Router) + TypeScript + CSS Modules.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
```

## Структура
- `src/styles/tokens.css` — токены 1:1 из `../tokens.css`; `globals.css` — производные значения из макетов, брейкпоинт 1024px (`.mob-only` / `.desk-only`).
- `src/components/ui` — библиотека по дизайн-системе: Button (primary/secondary/danger/danger-outline/success, lg/md/sm/xs, busy «Отправляем…»), поля (TextField, TextArea, PhoneField +992 2-3-2-2, PriceField + «Договорная», OtpInput, SearchField), Chip, Segmented, LangSwitch, Switch/SwitchRow, Checkbox, RadioCard, StatusBadge (единый словарь статусов, подписи по роли), VerifiedBadge, Rating, Banner, Toast (2.4 с), Sheet/ConfirmSheet (шторка на мобильном, диалог на десктопе), EmptyState, Skeleton, Avatar, Card, Stepper.
- `src/components/layout` — SiteHeader 72px, AppBar 56px, TabBar 64px, SideNav 232px, Footer, Shell.
- `src/lib/i18n` — RU/TJ (cookie для SSR), плюрализация, форматтеры денег («до 1 500 смн», «Договорная»), «N мин назад», маска телефона.
- `src/lib/api` — типы + мок-данные из макетов. При подключении бэкенда заменить тела функций в `api/index.ts` на fetch, сигнатуры не трогать.
- `src/lib/hooks/useLoad` — правила загрузки: < 300 мс ничего, затем скелетон, 15 с «дольше обычного», 30 с «сервер не ответил».
- `src/lib/session` — мок-сессия (гость / клиент / мастер).
- `src/features/<экран>` — экраны: View + словарь + стили.

## Статус экранов
| Экран | Маршрут | Статус |
|---|---|---|
| Главная | `/` | ✅ mobile + desktop, регион, поиск с подсказками, скелетоны, пустое состояние |
| Категории | `/categories` | ✅ дерево, поиск по синонимам RU/TJ/лат., «0 мастеров» серым |
| Мастера: каталог и профиль | `/masters`, `/masters/[id]` | ✅ фильтры (шторка / панель), сортировка, пустое состояние с соседними городами, профиль, отзывы, «Показать телефон» |
| Вход по SMS | `/login?next=…` | ✅ +992, проверка оператора, OTP, таймер, 3 попытки, имя. Демо-код 123456 |
| Создание задания | `/tasks/new` | ⏳ |
| Лента заданий, отклик | `/tasks`, `/tasks/[id]` | ⏳ |
| Кабинет клиента / моё задание | `/client`, `/client/tasks/[id]` | ⏳ |
| Приглашение | `/invite/[masterId]` | ⏳ |
| Кабинет мастера, стать мастером, профиль, настройки | `/master…`, `/become-master` | ⏳ |
| Чаты, уведомления, помощь | `/chats`, `/notifications`, `/help` | ⏳ |
| Админ-панель | `/admin` | ⏳ |

## Отклонения от handoff
- Шрифт самохостится через `@fontsource/golos-text`, а не грузится с Google Fonts: так он не зависит от доступности Google.
- `../backend/README.md` в поставке нет, поэтому контракт API пока выведен из данных в макетах.
