import React, { useState, useEffect, useRef } from 'react';
import { Flower2, Lock, Mail, User, LogOut, Shield, BookOpen, Plus, MessageSquare, Edit3, Trash2, Check, X, Search, Settings, ChevronRight, Users, FileText, AlertCircle, Send, Eye, EyeOff, Wrench, Printer, Monitor, Wifi, ArrowLeft, Star, Clock, Tag } from 'lucide-react';

// ============ КОНСТАНТИ ============
const REFERRAL_WORD = 'Flolux';
const STORAGE_KEYS = {
  USERS: 'flolux:users',
  SESSIONS: 'flolux:session',
  ARTICLES: 'flolux:articles',
  COMMENTS: 'flolux:comments',
  SUGGESTIONS: 'flolux:suggestions',
  TOPICS: 'flolux:topics',
  ROLE_ASSIGNMENTS: 'flolux:role_assignments'
};

const ROLES = {
  admin: { name: 'Адміністратор', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: Shield },
  florist: { name: 'Флорист', color: 'bg-pink-100 text-pink-800 border-pink-300', icon: Flower2 },
  location_manager: { name: 'Управляючий локації', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Users },
  warehouse: { name: 'Складський працівник', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: FileText },
  accountant: { name: 'Бухгалтер', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: FileText },
  wholesale: { name: 'Оптовий менеджер', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Users },
  courier: { name: 'Кур\'єр', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: Users },
  logist: { name: 'Логіст', color: 'bg-cyan-100 text-cyan-800 border-cyan-300', icon: Users },
  barista: { name: 'Бариста', color: 'bg-stone-100 text-stone-800 border-stone-300', icon: Users },
  driver: { name: 'Водій вантажного авто', color: 'bg-slate-100 text-slate-800 border-slate-300', icon: Users },
  tech: { name: 'Технічна підтримка', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: Wrench }
};

// Топіки для кожної ролі — структура роботи
const DEFAULT_TOPICS = {
  florist: [
    { id: 'fl-1', title: 'Бібліотека квітів', description: 'Сорти, сезонність, догляд та зберігання' },
    { id: 'fl-2', title: 'Складання букетів', description: 'Техніки, композиції, колірні поєднання' },
    { id: 'fl-3', title: 'Робота з клієнтом', description: 'Прийом замовлень, консультації, оформлення' },
    { id: 'fl-4', title: 'Догляд за рослинами', description: 'Полив, обрізка, профілактика хвороб' },
    { id: 'fl-5', title: 'Оформлення вітрини', description: 'Мерчандайзинг та сезонні композиції' }
  ],
  location_manager: [
    { id: 'lm-1', title: 'Управління персоналом', description: 'Графіки, мотивація, контроль роботи' },
    { id: 'lm-2', title: 'KPI та звітність', description: 'Показники локації, аналітика продажів' },
    { id: 'lm-3', title: 'Інвентаризація', description: 'Облік товару, ревізії, списання' },
    { id: 'lm-4', title: 'Робота з клієнтськими скаргами', description: 'Регламенти, скрипти, ескалація' }
  ],
  warehouse: [
    { id: 'wh-1', title: 'Прийом товару', description: 'Перевірка, оприбуткування, документообіг' },
    { id: 'wh-2', title: 'Зберігання квітів', description: 'Температурний режим, обробка, термін свіжості' },
    { id: 'wh-3', title: 'Комплектація замовлень', description: 'Збір, перевірка, передача в доставку' },
    { id: 'wh-4', title: 'Списання та брак', description: 'Процедура, документи, причини' }
  ],
  accountant: [
    { id: 'ac-1', title: 'Облік продажів', description: 'Касові операції, чеки, звірки' },
    { id: 'ac-2', title: 'Робота з постачальниками', description: 'Договори, оплати, акти звірки' },
    { id: 'ac-3', title: 'Зарплата та податки', description: 'Розрахунки, нарахування, звітність' },
    { id: 'ac-4', title: 'Первинні документи', description: 'Накладні, ТТН, акти виконаних робіт' }
  ],
  wholesale: [
    { id: 'ws-1', title: 'Робота з оптовими клієнтами', description: 'B2B-продажі, переговори, договори' },
    { id: 'ws-2', title: 'Прайс-листи та знижки', description: 'Ціноутворення, спецпропозиції' },
    { id: 'ws-3', title: 'Тендери та великі замовлення', description: 'Обробка, логістика, контроль' }
  ],
  courier: [
    { id: 'co-1', title: 'Маршрути доставки', description: 'Планування, оптимізація, навігація' },
    { id: 'co-2', title: 'Спілкування з клієнтом', description: 'Дзвінки, передача букета, фото-звіт' },
    { id: 'co-3', title: 'Робота з делікатним вантажем', description: 'Транспортування квітів, температура' }
  ],
  logist: [
    { id: 'lg-1', title: 'Планування доставок', description: 'Розподіл замовлень між кур\'єрами' },
    { id: 'lg-2', title: 'Робота з трекінгом', description: 'Моніторинг, статуси, форс-мажори' },
    { id: 'lg-3', title: 'Міжміська логістика', description: 'Транспортні компанії, оформлення' }
  ],
  barista: [
    { id: 'br-1', title: 'Меню та рецепти', description: 'Кава, чай, авторські напої' },
    { id: 'br-2', title: 'Робота з кавомашиною', description: 'Налаштування, обслуговування, чистка' },
    { id: 'br-3', title: 'Стандарти сервісу', description: 'Швидкість, якість, ввічливість' },
    { id: 'br-4', title: 'Облік розхідних матеріалів', description: 'Молоко, зерно, сиропи' }
  ],
  driver: [
    { id: 'dr-1', title: 'Регламент рейсу', description: 'Передрейсовий огляд, документи' },
    { id: 'dr-2', title: 'Завантаження та кріплення', description: 'Безпечне розміщення вантажу' },
    { id: 'dr-3', title: 'Технічне обслуговування авто', description: 'Перевірки, ТО, дрібний ремонт' }
  ],
  admin: [
    { id: 'ad-1', title: 'Управління користувачами', description: 'Призначення ролей, доступи' },
    { id: 'ad-2', title: 'Модерація контенту', description: 'Перевірка статей, правки, видалення' },
    { id: 'ad-3', title: 'Системні налаштування', description: 'Розділи, права, інтеграції' }
  ],
  tech: [
    { id: 'tc-1', title: 'POS-80 принтер Flolux', description: 'Налаштування, ремонт, типові поломки' },
    { id: 'tc-2', title: 'MacBook — діагностика', description: 'Проблеми та рішення' },
    { id: 'tc-3', title: 'AnyDesk — підключення', description: 'Налаштування, проблеми з\'єднання' },
    { id: 'tc-4', title: 'Мережа та інтернет', description: 'Wi-Fi, роутери, діагностика' },
    { id: 'tc-5', title: 'Касове ПЗ', description: 'Помилки, оновлення, фіскалізація' }
  ]
};

// Початкові статті для технічного розділу
const DEFAULT_TECH_ARTICLES = [
  {
    id: 'tech-pos-1',
    topicId: 'tc-1',
    section: 'tech',
    title: 'POS-80 не друкує чек — діагностика',
    content: `**Перевірка послідовно:**

1. **Живлення** — переконайтесь що горить зелений світлодіод. Якщо ні — перевірте блок живлення та кабель.

2. **Папір** — відкрийте кришку, перевірте чи рулон вставлений правильно (термошар назовні). Прокрутіть пальцем по рулону — якщо плівка не темніє від тепла, рулон бракований.

3. **USB/LAN кабель** — від'єднайте та під'єднайте знову. На комп'ютері: Налаштування → Принтери → перевірте статус.

4. **Тестова сторінка** — натисніть та утримуйте кнопку FEED при увімкненні. Принтер надрукує самотест з усіма параметрами.

5. **Якщо тест проходить, але з ПЗ не друкує** — проблема в драйвері. Перевстановіть драйвер POS-80 (доступний у внутрішній мережі).

**Коди помилок:**
- 1 спалах червоного — закінчився папір
- 2 спалахи — відкрита кришка
- 3 спалахи — перегрів термоголовки (зачекайте 5 хв)
- Постійне червоне — потрібен сервіс`,
    author: 'system',
    authorRole: 'tech',
    createdAt: Date.now() - 7 * 86400000,
    tags: ['POS-80', 'принтер', 'друк']
  },
  {
    id: 'tech-pos-2',
    topicId: 'tc-1',
    section: 'tech',
    title: 'POS-80 друкує бліді чеки або з пропусками',
    content: `**Причини та рішення:**

1. **Брудна термоголовка** — найчастіша причина. Вимкніть принтер, відкрийте кришку, протріть головку ватним диском зі спиртом (95%+). Дайте висохнути 2-3 хвилини.

2. **Неякісний термопапір** — використовуйте лише рекомендовану касову стрічку 80мм. Дешева стрічка вицвітає та погано пропікається.

3. **Налаштування щільності друку** — у драйвері збільшити Print Density до 12-15 (за замовчуванням 8).

4. **Зношена термоголовка** — якщо смуги з'являються постійно в одному й тому ж місці — головка вимагає заміни (ресурс ~50км стрічки).

**Профілактика:** чистити термоголовку раз на місяць.`,
    author: 'system',
    authorRole: 'tech',
    createdAt: Date.now() - 5 * 86400000,
    tags: ['POS-80', 'друк', 'обслуговування']
  },
  {
    id: 'tech-mac-1',
    topicId: 'tc-2',
    section: 'tech',
    title: 'MacBook не вмикається — алгоритм перевірки',
    content: `**Крок за кроком:**

1. **Перевірте заряд** — підключіть зарядку, зачекайте 10 хвилин. Світлодіод на кабелі MagSafe має горіти (бурштиновий або зелений).

2. **SMC reset** (для Intel-маків):
   - Вимкніть Mac
   - Утримуйте Shift + Control + Option + кнопку живлення 10 секунд
   - Відпустіть та натисніть кнопку живлення

3. **Для Apple Silicon (M1/M2/M3):**
   - Вимкніть повністю (утримуйте кнопку живлення 10 сек)
   - Зачекайте 30 секунд
   - Увімкніть знову

4. **NVRAM/PRAM reset** (тільки Intel):
   - Увімкніть та одразу затисніть Option + Command + P + R
   - Утримуйте до другого звуку запуску

5. **Безпечний режим:**
   - Apple Silicon: утримуйте кнопку живлення до меню запуску, виберіть диск з затиснутим Shift
   - Intel: затисніть Shift при запуску

**Якщо нічого не допомогло** — звертайтесь до техпідтримки через AnyDesk або фізично в офіс.`,
    author: 'system',
    authorRole: 'tech',
    createdAt: Date.now() - 4 * 86400000,
    tags: ['MacBook', 'запуск', 'SMC']
  },
  {
    id: 'tech-mac-2',
    topicId: 'tc-2',
    section: 'tech',
    title: 'MacBook повільно працює — оптимізація',
    content: `**Швидка діагностика:**

1. **Activity Monitor** (Cmd+Space → "Activity Monitor") → перевірте CPU та Memory. Знайдіть процеси, що з'їдають ресурси.

2. **Місце на диску** — Apple menu → About This Mac → Storage. Має бути мінімум 15% вільного.

3. **Перезавантаження** — найпростіше та найефективніше. Не вимикайте Mac тижнями.

4. **Очистка кешу:**
   - Finder → Go → Library → Caches → видалити вміст
   - Перезавантажити

5. **Логін-айтеми** — System Settings → General → Login Items → відключіть зайве.

6. **Оновлення macOS** — System Settings → General → Software Update.

**Якщо проблема в браузері:**
- Закрийте зайві вкладки (кожна = ~150-300MB)
- Очистіть історію та кеш Chrome/Safari
- Перевірте розширення браузера`,
    author: 'system',
    authorRole: 'tech',
    createdAt: Date.now() - 3 * 86400000,
    tags: ['MacBook', 'продуктивність', 'оптимізація']
  },
  {
    id: 'tech-any-1',
    topicId: 'tc-3',
    section: 'tech',
    title: 'AnyDesk — користувач не може підключитися',
    content: `**Найпоширеніші причини відмов з\'єднання:**

1. **AnyDesk не запущений на стороні клієнта** — попросіть користувача відкрити додаток. ID має відображатись у верхньому лівому куті.

2. **Не та версія програми** — обидві сторони мають використовувати AnyDesk 7.0+. Перевірте: меню → About AnyDesk.

3. **Заблокований брандмауером:**
   - macOS: System Settings → Network → Firewall → Options → додайте AnyDesk у винятки
   - Windows: Захисник Windows → Дозволити додаток через брандмауер

4. **Проблема з інтернетом:**
   - Попросіть користувача відкрити speedtest.net
   - Мінімум для AnyDesk: 1 Mbps на download/upload
   - Перевірте ping до anydesk.com (Termial: \`ping anydesk.com\`)

5. **Невірний ID** — ID складається з 9 цифр (наприклад: 123 456 789). Перевірте чи правильно продиктовано.

6. **Сесія таймаут** — AnyDesk автоматично закриває неактивні сесії. Перепідключіться.

7. **Адреса заблокована корпоративним проксі** — спробуйте мобільну точку доступу як тест.

**Чек-лист перед сесією:**
✓ AnyDesk запущений
✓ Інтернет стабільний
✓ ID правильний
✓ Користувач прийме запит на з'єднання
✓ Дозволи на macOS: Screen Recording + Accessibility надано AnyDesk`,
    author: 'system',
    authorRole: 'tech',
    createdAt: Date.now() - 2 * 86400000,
    tags: ['AnyDesk', 'віддалене підключення', 'мережа']
  },
  {
    id: 'tech-any-2',
    topicId: 'tc-3',
    section: 'tech',
    title: 'AnyDesk на macOS — дозволи системи',
    content: `**Перше підключення на новому Mac:**

macOS вимагає окремі дозволи. Без них AnyDesk підключиться, але ви не побачите екран або не зможете керувати мишею.

**Послідовність:**

1. System Settings → Privacy & Security → Screen Recording
   - Додайте AnyDesk у список та увімкніть перемикач

2. System Settings → Privacy & Security → Accessibility
   - Додайте AnyDesk та увімкніть

3. System Settings → Privacy & Security → Input Monitoring
   - Додайте AnyDesk та увімкніть

4. **Перезапустіть AnyDesk** — без перезапуску дозволи не активуються!

**Якщо у списку немає AnyDesk:**
- Натисніть "+" внизу списку
- Перейдіть у Applications → виберіть AnyDesk → Open

**Перевірка:** після перезапуску підключіться знову — все має працювати.`,
    author: 'system',
    authorRole: 'tech',
    createdAt: Date.now() - 1 * 86400000,
    tags: ['AnyDesk', 'macOS', 'дозволи']
  }
];

// ============ ХУКИ ============
function useStorage(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const initialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await Promise.resolve({value: localStorage.getItem(key)});
        if (!cancelled && r) {
          setValue(JSON.parse(r.value));
        }
      } catch (e) {
        // ключа немає — використовуємо defaultValue
      } finally {
        initialized.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  const persist = async (newVal) => {
    setValue(newVal);
    try {
      await Promise.resolve(localStorage.setItem(key, JSON.stringify(newVal)));
    } catch (e) {
      console.error('Storage error:', e);
    }
  };

  return [value, persist, initialized];
}

// ============ ГОЛОВНИЙ КОМПОНЕНТ ============
export default function FloluxKB() {
  const [users, setUsers] = useStorage(STORAGE_KEYS.USERS, []);
  const [session, setSession] = useStorage(STORAGE_KEYS.SESSIONS, null);
  const [articles, setArticles] = useStorage(STORAGE_KEYS.ARTICLES, DEFAULT_TECH_ARTICLES);
  const [comments, setComments] = useStorage(STORAGE_KEYS.COMMENTS, []);
  const [suggestions, setSuggestions] = useStorage(STORAGE_KEYS.SUGGESTIONS, []);
  const [topics, setTopics] = useStorage(STORAGE_KEYS.TOPICS, DEFAULT_TOPICS);

  const [authMode, setAuthMode] = useState('login'); // login | register | reset
  const [view, setView] = useState('home'); // home | tech | admin | topic | article
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [showCreateArticle, setShowCreateArticle] = useState(false);

  // Поточний користувач
  const currentUser = session ? users.find(u => u.id === session.userId) : null;

  if (!currentUser) {
    return <AuthScreen
      mode={authMode}
      setMode={setAuthMode}
      users={users}
      setUsers={setUsers}
      setSession={setSession}
    />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}>
      <Header
        user={currentUser}
        onLogout={() => setSession(null)}
        onNavigate={(v) => { setView(v); setActiveTopic(null); setActiveArticle(null); }}
        view={view}
        isAdmin={isAdmin}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'home' && !activeTopic && !activeArticle && (
          <HomeView
            user={currentUser}
            topics={topics}
            articles={articles}
            onTopicClick={(t) => { setActiveTopic(t); setView('topic'); }}
          />
        )}

        {view === 'tech' && !activeTopic && !activeArticle && (
          <TechView
            topics={topics.tech || []}
            articles={articles.filter(a => a.section === 'tech')}
            onTopicClick={(t) => { setActiveTopic(t); }}
          />
        )}

        {view === 'admin' && isAdmin && (
          <AdminPanel
            users={users}
            setUsers={setUsers}
            topics={topics}
            setTopics={setTopics}
            articles={articles}
            setArticles={setArticles}
            suggestions={suggestions}
            setSuggestions={setSuggestions}
          />
        )}

        {activeTopic && !activeArticle && (
          <TopicView
            topic={activeTopic}
            articles={articles.filter(a => a.topicId === activeTopic.id)}
            user={currentUser}
            onBack={() => { setActiveTopic(null); }}
            onArticleClick={(a) => setActiveArticle(a)}
            onCreate={() => setShowCreateArticle(true)}
          />
        )}

        {activeArticle && (
          <ArticleView
            article={activeArticle}
            user={currentUser}
            users={users}
            comments={comments.filter(c => c.articleId === activeArticle.id)}
            suggestions={suggestions.filter(s => s.articleId === activeArticle.id)}
            articles={articles}
            setArticles={setArticles}
            setComments={setComments}
            allComments={comments}
            setSuggestions={setSuggestions}
            allSuggestions={suggestions}
            onBack={() => setActiveArticle(null)}
            isAdmin={isAdmin}
          />
        )}

        {showCreateArticle && activeTopic && (
          <CreateArticleModal
            topic={activeTopic}
            user={currentUser}
            articles={articles}
            setArticles={setArticles}
            onClose={() => setShowCreateArticle(false)}
          />
        )}
      </main>
    </div>
  );
}

// ============ AUTH ============
function AuthScreen({ mode, setMode, users, setUsers, setSession }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', referral: '', resetEmail: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    setError(''); setSuccess('');
    if (!form.email || !form.password) return setError('Заповніть всі поля');
    const user = users.find(u => u.email.toLowerCase() === form.email.toLowerCase());
    if (!user) return setError('Користувача не знайдено');
    if (user.password !== form.password) return setError('Невірний пароль');
    if (!user.approved && user.role !== 'admin') return setError('Ваш акаунт ще не підтверджено адміністратором');
    setSession({ userId: user.id, loggedAt: Date.now() });
  };

  const handleRegister = () => {
    setError(''); setSuccess('');
    if (!form.email || !form.password || !form.name || !form.referral)
      return setError('Заповніть всі поля');
    if (form.referral !== REFERRAL_WORD)
      return setError('Невірне реферальне слово');
    if (users.some(u => u.email.toLowerCase() === form.email.toLowerCase()))
      return setError('Користувач з такою поштою вже існує');
    if (form.password.length < 6)
      return setError('Пароль має містити мінімум 6 символів');

    const isFirstUser = users.length === 0;
    const newUser = {
      id: `u-${Date.now()}`,
      email: form.email,
      password: form.password,
      name: form.name,
      role: isFirstUser ? 'admin' : null,
      approved: isFirstUser,
      createdAt: Date.now()
    };
    setUsers([...users, newUser]);
    if (isFirstUser) {
      setSession({ userId: newUser.id, loggedAt: Date.now() });
    } else {
      setSuccess('Реєстрація успішна. Очікуйте підтвердження адміністратора та призначення ролі.');
      setForm({ email: '', password: '', name: '', referral: '', resetEmail: '' });
      setTimeout(() => setMode('login'), 3000);
    }
  };

  const handleReset = () => {
    setError(''); setSuccess('');
    if (!form.resetEmail) return setError('Введіть e-mail');
    const user = users.find(u => u.email.toLowerCase() === form.resetEmail.toLowerCase());
    if (!user) return setError('Користувача з такою поштою не знайдено');
    // Симуляція відправки листа
    setSuccess(`Інструкції з відновлення паролю надіслано на ${form.resetEmail}. (Демо-режим: ваш пароль — ${user.password})`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'linear-gradient(135deg, #fdf2f8 0%, #fff7ed 50%, #f0fdf4 100%)',
      fontFamily: 'Georgia, "Playfair Display", serif'
    }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-sm mb-4 border border-rose-200">
            <Flower2 className="w-10 h-10 text-rose-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl tracking-wide text-stone-800 mb-2" style={{ letterSpacing: '0.1em' }}>FLOLUX</h1>
          <p className="text-stone-500 text-sm italic">База знань компанії</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 border border-stone-100">
          <div className="flex gap-1 mb-6 bg-stone-50 rounded-md p-1">
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-3 text-sm rounded transition ${mode === 'login' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}
            >Вхід</button>
            <button
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-3 text-sm rounded transition ${mode === 'register' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}
            >Реєстрація</button>
            <button
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-3 text-sm rounded transition ${mode === 'reset' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}
            >Відновити</button>
          </div>

          {mode === 'login' && (
            <div className="space-y-4">
              <Field icon={Mail} label="E-mail" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              <Field icon={Lock} label="Пароль" type={showPassword ? 'text' : 'password'} value={form.password} onChange={v => setForm({ ...form, password: v })}
                rightIcon={showPassword ? EyeOff : Eye} onRightClick={() => setShowPassword(!showPassword)} />
              <button onClick={handleLogin} className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-md transition tracking-wider text-sm">
                УВІЙТИ
              </button>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-4">
              <Field icon={User} label="Ім'я" type="text" value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <Field icon={Mail} label="E-mail" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              <Field icon={Lock} label="Пароль" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} />
              <Field icon={Shield} label="Реферальне слово" type="text" value={form.referral} onChange={v => setForm({ ...form, referral: v })} hint="Запитайте у керівництва" />
              <button onClick={handleRegister} className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-md transition tracking-wider text-sm">
                ЗАРЕЄСТРУВАТИСЬ
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600 italic">Введіть e-mail, прив'язаний до акаунту. Ми надішлемо інструкції з відновлення паролю.</p>
              <Field icon={Mail} label="E-mail" type="email" value={form.resetEmail} onChange={v => setForm({ ...form, resetEmail: v })} />
              <button onClick={handleReset} className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-md transition tracking-wider text-sm">
                ВІДНОВИТИ ПАРОЛЬ
              </button>
            </div>
          )}

          {error && <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}
          {success && <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded flex gap-2"><Check className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}</div>}
        </div>

        <p className="text-center text-xs text-stone-400 mt-6 italic">
          Доступ до сайту лише для співробітників Flolux після авторизації
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, type, value, onChange, hint, rightIcon: RightIcon, onRightClick }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 text-stone-800 bg-stone-50/50"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        />
        {RightIcon && (
          <button type="button" onClick={onRightClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            <RightIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-stone-400 mt-1 italic">{hint}</p>}
    </div>
  );
}

// ============ HEADER ============
function Header({ user, onLogout, onNavigate, view, isAdmin }) {
  const RoleIcon = ROLES[user.role]?.icon || User;
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-200 group-hover:bg-rose-100 transition">
              <Flower2 className="w-5 h-5 text-rose-500" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl tracking-widest text-stone-800">FLOLUX</div>
              <div className="text-xs text-stone-400 italic -mt-0.5">База знань</div>
            </div>
          </button>

          <nav className="flex items-center gap-1">
            <NavBtn active={view === 'home'} onClick={() => onNavigate('home')} icon={BookOpen}>Моя бібліотека</NavBtn>
            <NavBtn active={view === 'tech'} onClick={() => onNavigate('tech')} icon={Wrench}>Технічка</NavBtn>
            {isAdmin && <NavBtn active={view === 'admin'} onClick={() => onNavigate('admin')} icon={Shield}>Адмін</NavBtn>}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-stone-700" style={{ fontFamily: 'system-ui, sans-serif' }}>{user.name}</div>
            <div className="text-xs text-stone-500">{ROLES[user.role]?.name || 'Без ролі'}</div>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${ROLES[user.role]?.color || 'bg-stone-100 text-stone-600'} border`}>
            <RoleIcon className="w-4 h-4" />
          </div>
          <button onClick={onLogout} className="p-2 text-stone-400 hover:text-rose-500 transition" title="Вийти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition ${active ? 'bg-stone-100 text-stone-800' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ============ ГОЛОВНА ============
function HomeView({ user, topics, articles, onTopicClick }) {
  if (!user.role) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl text-stone-800 mb-2">Очікування призначення ролі</h2>
        <p className="text-stone-500 max-w-md mx-auto italic">
          Ваш акаунт зареєстровано, але адміністратор ще не призначив вам роль.
          Зверніться до керівництва.
        </p>
      </div>
    );
  }

  const userTopics = topics[user.role] || [];
  const recentArticles = articles
    .filter(a => userTopics.some(t => t.id === a.topicId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  return (
    <div>
      <div className="mb-10 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Вітаємо</p>
        <h1 className="text-4xl text-stone-800 mb-2">{user.name}</h1>
        <p className="text-stone-500 italic">Ваш робочий простір — {ROLES[user.role]?.name.toLowerCase()}</p>
      </div>

      <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4">Розділи знань для вашої ролі</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-12">
        {userTopics.map(topic => {
          const count = articles.filter(a => a.topicId === topic.id).length;
          return (
            <button
              key={topic.id}
              onClick={() => onTopicClick(topic)}
              className="text-left bg-white border border-stone-200 rounded-lg p-6 hover:border-rose-300 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl text-stone-800 group-hover:text-rose-600 transition">{topic.title}</h3>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-rose-400 group-hover:translate-x-1 transition" />
              </div>
              <p className="text-sm text-stone-500 italic mb-3">{topic.description}</p>
              <p className="text-xs text-stone-400">{count} {count === 1 ? 'стаття' : count >= 2 && count <= 4 ? 'статті' : 'статей'}</p>
            </button>
          );
        })}
      </div>

      {recentArticles.length > 0 && (
        <>
          <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4">Останні матеріали</h2>
          <div className="space-y-3">
            {recentArticles.map(a => (
              <div key={a.id} className="bg-white border border-stone-200 rounded p-4 hover:border-stone-300 transition cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                  <Clock className="w-3 h-3" />
                  {new Date(a.createdAt).toLocaleDateString('uk-UA')}
                </div>
                <h3 className="text-stone-800">{a.title}</h3>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============ ТЕХНІЧНА БАЗА ============
function TechView({ topics, articles, onTopicClick }) {
  const techTopics = DEFAULT_TOPICS.tech;

  return (
    <div>
      <div className="mb-10 pb-6 border-b border-stone-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-200">
            <Wrench className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Спеціалізований розділ</p>
            <h1 className="text-3xl text-stone-800">Технічна база Flolux</h1>
          </div>
        </div>
        <p className="text-stone-500 italic max-w-2xl">
          Діагностика обладнання, рішення типових проблем з принтерами POS-80,
          MacBook, AnyDesk та іншою технікою. Доступно всім співробітникам.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {techTopics.map(topic => {
          const count = articles.filter(a => a.topicId === topic.id).length;
          const iconMap = {
            'tc-1': Printer,
            'tc-2': Monitor,
            'tc-3': Wifi,
            'tc-4': Wifi,
            'tc-5': Settings
          };
          const Icon = iconMap[topic.id] || Wrench;
          return (
            <button
              key={topic.id}
              onClick={() => onTopicClick(topic)}
              className="text-left bg-white border border-stone-200 rounded-lg p-6 hover:border-indigo-300 hover:shadow-md transition group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition">
                  <Icon className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl text-stone-800 mb-2 group-hover:text-indigo-600 transition">{topic.title}</h3>
                  <p className="text-sm text-stone-500 italic mb-2">{topic.description}</p>
                  <p className="text-xs text-stone-400">{count} {count === 1 ? 'стаття' : count >= 2 && count <= 4 ? 'статті' : 'статей'}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ ТОПІК ============
function TopicView({ topic, articles, user, onBack, onArticleClick, onCreate }) {
  const [search, setSearch] = useState('');
  const filtered = articles.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-8 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Розділ</p>
        <h1 className="text-3xl text-stone-800 mb-2">{topic.title}</h1>
        <p className="text-stone-500 italic">{topic.description}</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Пошук статей..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400 bg-white"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          />
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition text-sm"
        >
          <Plus className="w-4 h-4" /> Створити статтю
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 italic">
          {search ? 'Нічого не знайдено за вашим запитом' : 'У цьому розділі ще немає статей. Створіть першу!'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <button
              key={a.id}
              onClick={() => onArticleClick(a)}
              className="block w-full text-left bg-white border border-stone-200 rounded-lg p-5 hover:border-rose-300 hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg text-stone-800 group-hover:text-rose-600 transition mb-1">{a.title}</h3>
                  <p className="text-sm text-stone-500 line-clamp-2 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    {a.content.replace(/[*#]/g, '').substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span>{new Date(a.createdAt).toLocaleDateString('uk-UA')}</span>
                    {a.tags && a.tags.length > 0 && (
                      <div className="flex gap-1.5">
                        {a.tags.slice(0, 3).map(t => (
                          <span key={t} className="px-2 py-0.5 bg-stone-100 rounded text-stone-600">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-rose-400 transition flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ СТАТТЯ ============
function ArticleView({ article, user, users, comments, suggestions, articles, setArticles, setComments, allComments, setSuggestions, allSuggestions, onBack, isAdmin }) {
  const [commentText, setCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: article.title, content: article.content });

  const canEdit = isAdmin || article.author === user.id;

  const handleComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: `c-${Date.now()}`,
      articleId: article.id,
      author: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: commentText,
      createdAt: Date.now()
    };
    setComments([...allComments, newComment]);
    setCommentText('');
  };

  const handleSuggestion = () => {
    if (!suggestionText.trim()) return;
    const newSugg = {
      id: `s-${Date.now()}`,
      articleId: article.id,
      author: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: suggestionText,
      status: 'pending',
      createdAt: Date.now()
    };
    setSuggestions([...allSuggestions, newSugg]);
    setSuggestionText('');
    setShowSuggest(false);
  };

  const handleSaveEdit = () => {
    setArticles(articles.map(a => a.id === article.id ? { ...a, ...editForm, updatedAt: Date.now() } : a));
    setEditMode(false);
    Object.assign(article, editForm);
  };

  const handleSuggApprove = (sugg) => {
    setSuggestions(allSuggestions.map(s => s.id === sugg.id ? { ...s, status: 'approved' } : s));
  };

  const handleSuggReject = (sugg) => {
    setSuggestions(allSuggestions.map(s => s.id === sugg.id ? { ...s, status: 'rejected' } : s));
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> До розділу
      </button>

      <article className="bg-white border border-stone-200 rounded-lg p-8 mb-6">
        {editMode ? (
          <div className="space-y-4">
            <input
              type="text"
              value={editForm.title}
              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full text-3xl border-b-2 border-stone-200 focus:border-rose-400 focus:outline-none pb-2"
              style={{ fontFamily: 'Georgia, serif' }}
            />
            <textarea
              value={editForm.content}
              onChange={e => setEditForm({ ...editForm, content: e.target.value })}
              rows={15}
              className="w-full p-3 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-500 text-white rounded text-sm">Зберегти</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl text-stone-800">{article.title}</h1>
              {canEdit && (
                <button onClick={() => setEditMode(true)} className="text-stone-400 hover:text-rose-500 transition">
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-400 mb-6 pb-6 border-b border-stone-100">
              <Clock className="w-3 h-3" />
              {new Date(article.createdAt).toLocaleDateString('uk-UA')}
              {article.author !== 'system' && (
                <>
                  <span>·</span>
                  <span>{users.find(u => u.id === article.author)?.name || 'Користувач'}</span>
                </>
              )}
              {article.tags && article.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex gap-1.5">
                    {article.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-stone-100 rounded text-stone-600 flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="prose max-w-none text-stone-700 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'system-ui, sans-serif', fontSize: '15px', lineHeight: '1.75' }}>
              {renderMarkdown(article.content)}
            </div>
          </>
        )}
      </article>

      {/* Пропозиції правок */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Пропозиції покращень <span className="text-stone-400 text-sm">({suggestions.length})</span>
          </h3>
          <button
            onClick={() => setShowSuggest(!showSuggest)}
            className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Запропонувати правку
          </button>
        </div>

        {showSuggest && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded">
            <textarea
              value={suggestionText}
              onChange={e => setSuggestionText(e.target.value)}
              placeholder="Опишіть пропозицію щодо покращення статті..."
              rows={3}
              className="w-full p-3 border border-amber-200 rounded text-sm focus:outline-none focus:border-amber-400"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSuggestion} className="px-4 py-1.5 bg-amber-500 text-white rounded text-sm">Надіслати</button>
              <button onClick={() => setShowSuggest(false)} className="px-4 py-1.5 bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
            </div>
          </div>
        )}

        {suggestions.length === 0 ? (
          <p className="text-sm text-stone-400 italic">Поки що немає пропозицій. Будьте першим!</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className={`p-4 rounded border ${s.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : s.status === 'rejected' ? 'bg-rose-50 border-rose-200 opacity-60' : 'bg-stone-50 border-stone-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm text-stone-700">{s.authorName}</span>
                    <span className="text-xs text-stone-400 ml-2">{ROLES[s.authorRole]?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === 'approved' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Прийнято</span>}
                    {s.status === 'rejected' && <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded">Відхилено</span>}
                    {s.status === 'pending' && isAdmin && (
                      <>
                        <button onClick={() => handleSuggApprove(s)} className="text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                        <button onClick={() => handleSuggReject(s)} className="text-rose-500 hover:text-rose-600"><X className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-stone-700" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Коментарі */}
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg text-stone-800 flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-stone-500" />
          Обговорення <span className="text-stone-400 text-sm">({comments.length})</span>
        </h3>

        <div className="space-y-3 mb-4">
          {comments.length === 0 ? (
            <p className="text-sm text-stone-400 italic">Поки що немає коментарів</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-3 p-3 bg-stone-50 rounded">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${ROLES[c.authorRole]?.color || 'bg-stone-100'}`}>
                  {c.authorName[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-stone-700">{c.authorName}</span>
                    <span className="text-xs text-stone-400">{ROLES[c.authorRole]?.name}</span>
                    <span className="text-xs text-stone-400">· {new Date(c.createdAt).toLocaleDateString('uk-UA')}</span>
                  </div>
                  <p className="text-sm text-stone-700" style={{ fontFamily: 'system-ui, sans-serif' }}>{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleComment()}
            placeholder="Написати коментар..."
            className="flex-1 px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          />
          <button onClick={handleComment} className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-md transition">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Простий markdown-рендеринг
function renderMarkdown(text) {
  if (!text) return null;
  const parts = text.split('\n');
  return parts.map((line, i) => {
    // Bold
    const processed = line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="text-stone-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} className="mb-2">{processed}</p>;
  });
}

// ============ СТВОРЕННЯ СТАТТІ ============
function CreateArticleModal({ topic, user, articles, setArticles, onClose }) {
  const [form, setForm] = useState({ title: '', content: '', tags: '' });
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Заповніть назву та зміст статті');
      return;
    }
    const newArticle = {
      id: `a-${Date.now()}`,
      topicId: topic.id,
      section: topic.id.startsWith('tc-') ? 'tech' : 'role',
      title: form.title,
      content: form.content,
      author: user.id,
      authorRole: user.role,
      createdAt: Date.now(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
    };
    setArticles([...articles, newArticle]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Нова стаття в розділі</p>
            <h2 className="text-xl text-stone-800">{topic.title}</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Заголовок</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400"
              style={{ fontFamily: 'system-ui, sans-serif' }}
              placeholder="Назва статті"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Зміст</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400"
              style={{ fontFamily: 'system-ui, sans-serif' }}
              placeholder="Текст статті. Можна використовувати **жирний** текст."
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Теги (через кому)</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400"
              style={{ fontFamily: 'system-ui, sans-serif' }}
              placeholder="наприклад: троянди, догляд, поради"
            />
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>

        <div className="p-6 border-t border-stone-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-md text-sm">Скасувати</button>
          <button onClick={handleSave} className="px-4 py-2 bg-rose-500 text-white rounded-md text-sm">Опублікувати</button>
        </div>
      </div>
    </div>
  );
}

// ============ АДМІН-ПАНЕЛЬ ============
function AdminPanel({ users, setUsers, topics, setTopics, articles, setArticles, suggestions, setSuggestions }) {
  const [tab, setTab] = useState('users');

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-stone-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-200">
            <Shield className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Управління системою</p>
            <h1 className="text-3xl text-stone-800">Адмін-панель</h1>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-stone-100 rounded-md p-1 w-fit">
        <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>Користувачі</TabBtn>
        <TabBtn active={tab === 'topics'} onClick={() => setTab('topics')}>Розділи</TabBtn>
        <TabBtn active={tab === 'moderation'} onClick={() => setTab('moderation')}>Модерація</TabBtn>
      </div>

      {tab === 'users' && <UsersTab users={users} setUsers={setUsers} />}
      {tab === 'topics' && <TopicsTab topics={topics} setTopics={setTopics} />}
      {tab === 'moderation' && <ModerationTab suggestions={suggestions} setSuggestions={setSuggestions} articles={articles} setArticles={setArticles} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded text-sm transition ${active ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
      {children}
    </button>
  );
}

function UsersTab({ users, setUsers }) {
  const updateUser = (id, changes) => {
    setUsers(users.map(u => u.id === id ? { ...u, ...changes } : u));
  };

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Користувач</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Роль</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Статус</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Дії</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-stone-100 last:border-0">
              <td className="px-4 py-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <div className="text-sm text-stone-800">{u.name}</div>
                <div className="text-xs text-stone-500">{u.email}</div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={u.role || ''}
                  onChange={e => updateUser(u.id, { role: e.target.value || null })}
                  className="text-sm border border-stone-200 rounded px-2 py-1 bg-white"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  <option value="">— без ролі —</option>
                  {Object.entries(ROLES).map(([key, r]) => (
                    <option key={key} value={key}>{r.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                {u.approved ? (
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Підтверджений</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200">Очікує</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {!u.approved && u.role && (
                    <button onClick={() => updateUser(u.id, { approved: true })} className="text-xs px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600">
                      Підтвердити
                    </button>
                  )}
                  {u.approved && u.role !== 'admin' && (
                    <button onClick={() => updateUser(u.id, { approved: false })} className="text-xs px-3 py-1 bg-stone-100 text-stone-700 rounded hover:bg-stone-200">
                      Заблокувати
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <div className="p-8 text-center text-stone-400 italic">Користувачів ще немає</div>}
    </div>
  );
}

function TopicsTab({ topics, setTopics }) {
  const [selectedRole, setSelectedRole] = useState('florist');
  const [newTopic, setNewTopic] = useState({ title: '', description: '' });

  const handleAdd = () => {
    if (!newTopic.title.trim()) return;
    const id = `${selectedRole}-${Date.now()}`;
    const updated = { ...topics };
    updated[selectedRole] = [...(updated[selectedRole] || []), { id, ...newTopic }];
    setTopics(updated);
    setNewTopic({ title: '', description: '' });
  };

  const handleDelete = (id) => {
    const updated = { ...topics };
    updated[selectedRole] = updated[selectedRole].filter(t => t.id !== id);
    setTopics(updated);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg text-stone-800 mb-4">Управління розділами знань</h3>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-md"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {Object.entries(ROLES).map(([key, r]) => (
              <option key={key} value={key}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {(topics[selectedRole] || []).map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 rounded">
              <div>
                <div className="text-sm text-stone-800">{t.title}</div>
                <div className="text-xs text-stone-500 italic">{t.description}</div>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-rose-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">Додати новий розділ</p>
          <div className="space-y-2">
            <input
              type="text"
              value={newTopic.title}
              onChange={e => setNewTopic({ ...newTopic, title: e.target.value })}
              placeholder="Назва розділу"
              className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            />
            <input
              type="text"
              value={newTopic.description}
              onChange={e => setNewTopic({ ...newTopic, description: e.target.value })}
              placeholder="Опис"
              className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            />
            <button onClick={handleAdd} className="px-4 py-2 bg-rose-500 text-white rounded text-sm hover:bg-rose-600">
              <Plus className="w-4 h-4 inline mr-1" />Додати розділ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModerationTab({ suggestions, setSuggestions, articles, setArticles }) {
  const pending = suggestions.filter(s => s.status === 'pending');

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-6">
      <h3 className="text-lg text-stone-800 mb-4">Пропозиції на модерацію ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="text-sm text-stone-400 italic">Усі пропозиції розглянуті</p>
      ) : (
        <div className="space-y-3">
          {pending.map(s => {
            const article = articles.find(a => a.id === s.articleId);
            return (
              <div key={s.id} className="p-4 bg-stone-50 rounded border border-stone-200">
                <div className="text-xs text-stone-500 mb-1">До статті: <span className="text-stone-700">{article?.title || '—'}</span></div>
                <div className="text-sm text-stone-700 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-stone-500">{s.authorName} · {ROLES[s.authorRole]?.name}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setSuggestions(suggestions.map(x => x.id === s.id ? { ...x, status: 'approved' } : x))} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Прийняти</button>
                    <button onClick={() => setSuggestions(suggestions.map(x => x.id === s.id ? { ...x, status: 'rejected' } : x))} className="px-3 py-1 bg-stone-200 text-stone-700 rounded text-xs">Відхилити</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
