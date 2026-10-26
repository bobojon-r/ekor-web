import type { CategoryNode, FeaturedCategory, HomeReview, Master, Region, Review, TaskSummary } from './types';

export const REGIONS: Region[] = [
  { key: 'dushanbe', name: { ru: 'Душанбе', tj: 'Душанбе' }, sub: { ru: 'Столица', tj: 'Пойтахт' }, masters: 846 },
  { key: 'khujand', name: { ru: 'Худжанд', tj: 'Хуҷанд' }, sub: { ru: 'Согдийская обл.', tj: 'Вил. Суғд' }, masters: 412 },
  { key: 'isfara', name: { ru: 'Исфара', tj: 'Исфара' }, sub: { ru: 'Согдийская обл.', tj: 'Вил. Суғд' }, masters: 71 },
  { key: 'bokhtar', name: { ru: 'Бохтар', tj: 'Бохтар' }, sub: { ru: 'Хатлонская обл.', tj: 'Вил. Хатлон' }, masters: 158 },
  { key: 'kulob', name: { ru: 'Куляб', tj: 'Кӯлоб' }, sub: { ru: 'Хатлонская обл.', tj: 'Вил. Хатлон' }, masters: 97 },
  { key: 'vahdat', name: { ru: 'Вахдат', tj: 'Ваҳдат' }, sub: { ru: 'Районы респ. подчинения', tj: 'НТҶ' }, masters: 88 },
  { key: 'khorog', name: { ru: 'Хорог', tj: 'Хоруғ' }, sub: { ru: 'ГБАО', tj: 'ВМКБ' }, masters: 0 },
];

export const FEATURED: FeaturedCategory[] = [
  { key: 'repair', icon: 'Wrench', name: { ru: 'Ремонт и строительство', tj: 'Таъмир ва сохтмон' }, masters: 312, synonyms: 'ремонт плитка плиточник штукатур маляр таъмир сохтмон' },
  { key: 'plumbing', icon: 'Droplets', name: { ru: 'Сантехника', tj: 'Сантехника' }, masters: 186, synonyms: 'сантехник труба кран смеситель' },
  { key: 'electric', icon: 'Zap', name: { ru: 'Электрика', tj: 'Барқкашӣ' }, masters: 204, synonyms: 'электрик свет розетка барқ барқчӣ' },
  { key: 'appliances', icon: 'WashingMachine', name: { ru: 'Бытовая техника', tj: 'Техникаи маишӣ' }, masters: 128, synonyms: 'кондиционер холодильник стиральная кондитсионер' },
  { key: 'cleaning', icon: 'Sparkles', name: { ru: 'Уборка', tj: 'Тозакунӣ' }, masters: 96, synonyms: 'уборка клининг тоза' },
  { key: 'cargo', icon: 'Truck', name: { ru: 'Грузоперевозки', tj: 'Боркашонӣ' }, masters: 94, synonyms: 'переезд грузчик газель бор' },
  { key: 'tutors', icon: 'GraduationCap', name: { ru: 'Обучение', tj: 'Таълим' }, masters: 77, synonyms: 'репетитор английский математика омӯзгор забон' },
  { key: 'beauty', icon: 'Scissors', name: { ru: 'Красота', tj: 'Зебоӣ' }, masters: 143, synonyms: 'маникюр парикмахер визаж зебо' },
];

type P = [string, string, number, string];
const tree = (key: string, ru: string, tj: string, icon: string, items: P[]): CategoryNode => ({
  key,
  icon,
  name: { ru, tj },
  professions: items.map(([r, t, n, syn]) => ({ name: { ru: r, tj: t }, masters: n, synonyms: syn })),
});

export const CATEGORY_TREE: CategoryNode[] = [
  tree('repair', 'Ремонт и отделка', 'Таъмир ва ороиш', 'PaintRoller', [['Электрик', 'Барқчӣ', 64, 'elektrik barq'], ['Сантехник', 'Сантехник', 58, 'santehnik'], ['Плиточник', 'Сафолчин', 31, 'plitochnik kafel'], ['Маляр', 'Ранггар', 27, 'malyar kraska'], ['Ремонт под ключ', 'Таъмири пурра', 12, 'remont']]),
  tree('build', 'Строительство', 'Сохтмон', 'HardHat', [['Каменщик', 'Сангтарош', 14, 'kamenshik'], ['Сварщик', 'Кафшергар', 19, 'svarshik payvand'], ['Кровельщик', 'Боми', 6, 'krovlya'], ['Бетонные работы', 'Корҳои бетонӣ', 9, 'beton']]),
  tree('tech', 'Бытовая техника', 'Техникаи маишӣ', 'WashingMachine', [['Ремонт стиральных машин', 'Таъмири мошини ҷомашӯӣ', 22, 'stiralka'], ['Холодильники', 'Яхдонҳо', 17, 'holodilnik'], ['Кондиционеры', 'Кондитсионерҳо', 25, 'kondicioner konditsioner'], ['Телевизоры', 'Телевизорҳо', 8, 'televizor']]),
  tree('transport', 'Транспорт и переезд', 'Нақлиёт ва кӯчидан', 'Truck', [['Грузоперевозки', 'Боркашонӣ', 33, 'gruz gazel'], ['Грузчики', 'Боркашҳо', 21, 'gruzchik hammol'], ['Эвакуатор', 'Эвакуатор', 4, 'evakuator']]),
  tree('edu', 'Обучение', 'Таълим', 'GraduationCap', [['Английский язык', 'Забони англисӣ', 18, 'english angliyskiy'], ['Математика', 'Математика', 15, 'matematika'], ['Русский язык', 'Забони русӣ', 11, 'russkiy'], ['Подготовка к экзаменам', 'Тайёрӣ ба имтиҳон', 9, 'ekzamen']]),
  tree('beauty', 'Красота', 'Зебоӣ', 'Sparkles', [['Маникюр', 'Маникюр', 24, 'manikyur'], ['Парикмахер', 'Сартарош', 19, 'parikmaher'], ['Визажист', 'Визажист', 7, 'vizazh']]),
  tree('events', 'Мероприятия', 'Чорабиниҳо', 'PartyPopper', [['Фотограф', 'Суратгир', 16, 'fotograf'], ['Видеооператор', 'Видеооператор', 9, 'video'], ['Ведущий на той', 'Баранда барои той', 5, 'vedushiy toy'], ['Аренда звука', 'Иҷораи садо', 0, 'zvuk']]),
  tree('it', 'IT и дизайн', 'IT ва дизайн', 'Laptop', [['Веб-разработка', 'Барномасозии веб', 13, 'sayt web'], ['Ремонт компьютеров', 'Таъмири компютер', 20, 'kompyuter noutbuk'], ['Дизайн и логотипы', 'Дизайн ва логотип', 11, 'dizayn logo']]),
  tree('clean', 'Уборка', 'Тозакунӣ', 'Sparkle', [['Уборка квартир', 'Тозакунии хона', 26, 'uborka'], ['Мойка окон', 'Шустани тиреза', 10, 'okna'], ['Химчистка мебели', 'Тозакунии кимиёвии мебел', 6, 'himchistka divan']]),
];

const pr = (ru: string, tj: string) => ({ ru, tj });

export const MASTERS: Master[] = [
  { id: 1, name: 'Фаррух Назаров', profession: pr('Электрик', 'Барқчӣ'), category: 'electric', region: 'dushanbe', district: 'Сино', rating: 4.9, reviews: 37, priceFrom: 80, verified: true, available: true, years: 9, works: 24, phone: '935551247', langs: ['tj', 'ru'], areas: ['Сино', 'Фирдавсӣ', 'Шохмансур', 'Исмоили Сомонӣ'],
    bio: 'Электромонтажные работы в квартирах и частных домах. Замена проводки, установка щитков, розеток и люстр. Работаю со своим инструментом, даю гарантию 6 месяцев.',
    services: [{ name: 'Замена розетки или выключателя', price: 30 }, { name: 'Установка люстры', price: 80 }, { name: 'Замена проводки в комнате', price: 600 }, { name: 'Сборка электрощитка', price: null }], portfolio: ['Щиток в новостройке, Сино', 'Проводка в частном доме', 'Подсветка потолка', 'Освещение двора'] },
  { id: 2, name: 'Сухроб Алиев', profession: pr('Ремонт кондиционеров', 'Таъмири кондитсионер'), category: 'appliances', region: 'dushanbe', district: 'Шохмансур', rating: 4.6, reviews: 14, priceFrom: 100, verified: false, available: false, years: 6, works: 11, langs: ['tj', 'ru', 'uz'], areas: ['Шохмансур', 'Сино'],
    bio: 'Ремонт, чистка и заправка кондиционеров всех марок. Установка сплит-систем. Выезд в день обращения.', services: [{ name: 'Чистка кондиционера', price: 100 }, { name: 'Заправка фреоном', price: 250 }, { name: 'Установка сплит-системы', price: 400 }], portfolio: ['Установка сплит-системы', 'Чистка внутреннего блока'] },
  { id: 3, name: 'Нигина Юсупова', profession: pr('Уборка квартир', 'Тозакунии хона'), category: 'cleaning', region: 'dushanbe', district: 'Фирдавсӣ', rating: 4.8, reviews: 9, priceFrom: 200, verified: false, available: true, years: 4, works: 8, langs: ['tj', 'ru'], areas: ['Фирдавсӣ', 'Сино', 'Исмоили Сомонӣ'],
    bio: 'Генеральная уборка, уборка после ремонта, мытьё окон. Работаем вдвоём с сестрой, свои средства и инвентарь.', services: [{ name: 'Генеральная уборка, 2 комнаты', price: 350 }, { name: 'Мытьё окон', price: null }, { name: 'Уборка после ремонта', price: 500 }], portfolio: ['Квартира после ремонта', 'Кухня, генеральная уборка'] },
  { id: 4, name: 'Далер Шарипов', profession: pr('Грузоперевозки', 'Боркашонӣ'), category: 'cargo', region: 'dushanbe', district: 'Исмоили Сомонӣ', rating: 0, reviews: 0, priceFrom: 150, verified: false, available: true, years: 3, works: 0, phone: '901124508', langs: ['tj', 'ru'], areas: ['Весь Душанбе', 'Вахдат', 'Гиссар'],
    bio: 'Газель и двое грузчиков. Переезды по Душанбе и в районы, вывоз мусора.', services: [{ name: 'Переезд по городу', price: 150 }, { name: 'Грузчик, час', price: 50 }], portfolio: [] },
  { id: 5, name: 'Шерзод Каримов', profession: pr('Плиточник', 'Сафолчин'), category: 'repair', region: 'dushanbe', district: 'Сино', rating: 4.7, reviews: 23, priceFrom: null, verified: false, available: false, years: 12, works: 30, langs: ['tj', 'ru'], areas: ['Сино', 'Фирдавсӣ'],
    bio: 'Укладка кафеля и керамогранита, ванные под ключ. Аккуратно и без спешки, вывожу мусор сам.', services: [{ name: 'Укладка плитки, м²', price: 60 }, { name: 'Ванная под ключ', price: null }], portfolio: ['Ванная комната, Сино', 'Фартук на кухне', 'Пол из керамогранита'] },
  { id: 6, name: 'Мунира Сафарова', profession: pr('Репетитор русского языка', 'Омӯзгори забони русӣ'), category: 'tutors', region: 'dushanbe', district: 'Фирдавсӣ', rating: 5.0, reviews: 4, priceFrom: 40, verified: false, available: true, years: 7, works: 0, langs: ['tj', 'ru'], areas: ['Фирдавсӣ', 'Сино'],
    bio: 'Учитель русского языка и литературы. Подготовка к поступлению, занятия у меня дома или у ученика.', services: [{ name: 'Урок 60 минут', price: 40 }, { name: 'Подготовка к экзамену, месяц', price: 400 }], portfolio: [] },
  { id: 7, name: 'Джамшед Раджабов', profession: pr('Сантехник', 'Сантехник'), category: 'plumbing', region: 'dushanbe', district: 'Исмоили Сомонӣ', rating: 4.4, reviews: 19, priceFrom: 50, verified: false, available: false, years: 15, works: 9, langs: ['tj', 'ru'], areas: ['Исмоили Сомонӣ', 'Шохмансур'],
    bio: 'Сантехнические работы любой сложности: трубы, смесители, бойлеры, тёплый пол.', services: [{ name: 'Установка смесителя', price: 50 }, { name: 'Замена труб в ванной', price: null }, { name: 'Установка бойлера', price: 150 }], portfolio: ['Разводка труб в ванной', 'Установка бойлера'] },
  { id: 8, name: 'Шахноза Валиева', profession: pr('Визажист', 'Ороишгар'), category: 'beauty', region: 'dushanbe', district: 'Сино', rating: 4.9, reviews: 41, priceFrom: 150, verified: true, available: true, years: 5, works: 36, langs: ['tj', 'ru'], areas: ['Весь Душанбе'],
    bio: 'Ороиши тӯёна ва шомгоҳӣ, ба хонаи арӯс меоям. Танҳо бо косметикаи боэътимод кор мекунам.', services: [{ name: 'Свадебный макияж', price: 400 }, { name: 'Вечерний макияж', price: 150 }], portfolio: ['Свадебный образ', 'Вечерний макияж', 'Образ на Наврӯз'] },
  { id: 9, name: 'Бахтиёр Саидов', profession: pr('Сантехник', 'Сантехник'), category: 'plumbing', region: 'khujand', district: '12 мкр.', rating: 4.8, reviews: 52, priceFrom: 60, verified: true, available: true, years: 11, works: 18, langs: ['tj', 'uz', 'ru'], areas: ['12 мкр.', '19 мкр.', 'Пахтакор'],
    bio: 'Сантехник в Худжанде. Установка и замена смесителей, унитазов, бойлеров. Приезжаю в течение часа.', services: [{ name: 'Установка смесителя', price: 60 }, { name: 'Установка унитаза', price: 120 }], portfolio: ['Ванная, 12 мкр.', 'Бойлер в частном доме'] },
  { id: 10, name: 'Умед Рахмонов', profession: pr('Плиточник', 'Сафолчин'), category: 'repair', region: 'khujand', district: 'Пахтакор', rating: 4.9, reviews: 29, priceFrom: null, verified: false, available: false, years: 10, works: 22, langs: ['tj', 'uz'], areas: ['Пахтакор', '12 мкр.'],
    bio: 'Сафолкорӣ ва таъмири ҳаммом. Кори тоза ва саривақтӣ.', services: [{ name: 'Укладка плитки, м²', price: 55 }], portfolio: ['Ҳаммом', 'Ошхона'] },
  { id: 11, name: 'Шахром Мирзоев', profession: pr('Сантехник', 'Сантехник'), category: 'plumbing', region: 'isfara', district: 'Центр', rating: 4.7, reviews: 11, priceFrom: 50, verified: false, available: true, years: 8, works: 5, langs: ['tj', 'uz'], areas: ['Исфара', 'Ворух'],
    bio: 'Сантехника и отопление в Исфаре и районе.', services: [{ name: 'Вызов мастера', price: 50 }], portfolio: ['Отопление в доме'] },
  { id: 12, name: 'Зарина Каримова', profession: pr('Мастер маникюра', 'Устои маникюр'), category: 'beauty', region: 'bokhtar', district: 'Центр', rating: 4.7, reviews: 21, priceFrom: 40, verified: false, available: true, years: 4, works: 40, langs: ['tj', 'ru'], areas: ['Бохтар'],
    bio: 'Маникюр, покрытие гель-лаком, наращивание. Стерильные инструменты.', services: [{ name: 'Маникюр с покрытием', price: 80 }, { name: 'Наращивание', price: 150 }], portfolio: ['Гель-лак', 'Наращивание'] },
  { id: 13, name: 'Рустам Холов', profession: pr('Электрик', 'Барқчӣ'), category: 'electric', region: 'kulob', district: 'Центр', rating: 4.5, reviews: 6, priceFrom: 70, verified: false, available: false, years: 6, works: 3, langs: ['tj'], areas: ['Кӯлоб', 'Восеъ'],
    bio: 'Барқкашӣ дар хонаҳо ва мағозаҳо.', services: [{ name: 'Вызов мастера', price: 70 }], portfolio: ['Щиток'] },
  { id: 14, name: 'Парвиз Ахмедов', profession: pr('Сварщик', 'Кафшергар'), category: 'repair', region: 'vahdat', district: 'Центр', rating: 4.8, reviews: 17, priceFrom: 90, verified: true, available: true, years: 14, works: 12, langs: ['tj', 'ru'], areas: ['Вахдат', 'Душанбе'],
    bio: 'Ворота, навесы, решётки, лестницы. Изготовление и монтаж.', services: [{ name: 'Ворота под ключ', price: null }, { name: 'Навес, м²', price: 120 }], portfolio: ['Кованые ворота', 'Навес во дворе'] },
  { id: 15, name: 'Мадина Рахимова', profession: pr('Репетитор английского', 'Омӯзгори забони англисӣ'), category: 'tutors', online: true, rating: 4.9, reviews: 18, priceFrom: 50, verified: true, available: true, years: 8, works: 0, langs: ['tj', 'ru', 'en'], areas: [],
    bio: 'IELTS 8.0. Готовлю к IELTS и к поступлению за рубеж, занятия по видеосвязи.', services: [{ name: 'Урок 60 минут', price: 50 }, { name: 'Подготовка к IELTS, месяц', price: 600 }], portfolio: [] },
  { id: 16, name: 'Илхом Турсунов', profession: pr('Веб-разработчик', 'Барномасози веб'), category: 'it', online: true, rating: 0, reviews: 0, priceFrom: null, verified: false, available: true, years: 3, works: 4, langs: ['tj', 'ru'], areas: [],
    bio: 'Сайты-визитки и интернет-магазины для малого бизнеса, настройка Telegram-ботов.', services: [{ name: 'Сайт-визитка', price: null }, { name: 'Telegram-бот', price: null }], portfolio: ['Сайт кафе', 'Бот для доставки'] },
];

export const MASTER_REVIEWS: Review[] = [
  { author: 'Мавзуна Р.', month: 2, year: 2026, stars: 5, text: 'Пришёл в назначенное время, всё объяснил и сделал аккуратно. Убрал за собой.', reply: 'Спасибо! Обращайтесь.' },
  { author: 'Рустам Х.', month: 1, year: 2026, stars: 5, text: 'Хуб кор кард, нарх ҳамон тавре ки гуфта буд. Тавсия медиҳам.', reply: null },
  { author: 'Ольга С.', month: 0, year: 2026, stars: 4, text: 'Работа хорошая, но задержался на час — предупредил заранее.', reply: 'Извините за задержку, была пробка на Рудаки.' },
  { author: 'Далер М.', month: 11, year: 2025, stars: 5, text: 'Быстро нашёл проблему, цена честная.', reply: null },
];

const minAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

export const HOME_TASKS: TaskSummary[] = [
  { id: 101, title: 'Ремонт кондиционера Samsung, не охлаждает', region: 'dushanbe', district: 'Сино', budget: 300, responses: 4, createdAt: minAgo(40), status: 'open' },
  { id: 102, title: 'Тоза кардани хонаи 3-ҳуҷрагӣ пеш аз Наврӯз', region: 'dushanbe', district: 'Фирдавсӣ', budget: null, responses: 1, createdAt: minAgo(60), status: 'open' },
  { id: 103, title: 'Установить смеситель на кухне', region: 'khujand', district: '12 мкр.', budget: 250, responses: 2, createdAt: minAgo(15), status: 'open' },
  { id: 104, title: 'Перевезти холодильник и диван', region: 'bokhtar', district: 'Центр', budget: 200, responses: 0, createdAt: minAgo(120), status: 'open' },
  { id: 105, title: 'Репетитор по математике для 9 класса', online: true, budget: 60, responses: 3, createdAt: minAgo(180), status: 'open' },
  { id: 106, title: 'Заменить проводку в двух комнатах', region: 'kulob', district: 'Центр', budget: 900, responses: 1, createdAt: minAgo(300), status: 'open' },
];

export const HOME_REVIEWS: HomeReview[] = [
  { author: 'Мавзуна Р.', master: 'Фаррух Назаров', profession: pr('Электрик', 'Барқчӣ'), region: 'dushanbe', stars: 5, daysAgo: 1, text: 'Пришёл в назначенное время, заменил проводку на кухне и всё объяснил. Убрал за собой.' },
  { author: 'Ғулом С.', master: 'Бахтиёр Саидов', profession: pr('Сантехник', 'Сантехник'), region: 'khujand', stars: 5, daysAgo: 1, text: 'Зуд омад, обмехкунакро иваз кард. Нарх ҳамон тавре ки гуфта буд.' },
  { author: 'Ольга С.', master: 'Сухроб Алиев', profession: pr('Ремонт кондиционеров', 'Таъмири кондитсионер'), region: 'dushanbe', stars: 4, daysAgo: 2, text: 'Кондиционер снова холодит. Задержался на час, но предупредил заранее.' },
  { author: 'Нилуфар К.', master: 'Зарина Каримова', profession: pr('Мастер маникюра', 'Устои маникюр'), region: 'bokhtar', stars: 5, daysAgo: 3, text: 'Очень аккуратно и стерильно, держится уже третью неделю.' },
  { author: 'Фирӯз А.', master: 'Мадина Рахимова', profession: pr('Репетитор английского', 'Омӯзгори забони англисӣ'), online: true, stars: 5, daysAgo: 4, text: 'Писарам IELTS-ро бо 7.0 супорид. Ташаккур барои сабр!' },
];
