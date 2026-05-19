// Спільні константи бекенду. DEFAULT_TOPICS / ролі дзеркалять фронтенд (apps/web/src/App.jsx).

export const REFERRAL_WORD = process.env.REFERRAL_WORD || 'Flolux';

// Ключі ролей (історичний фолбек). Джерело істини тепер таблиця Role.
export const ROLE_KEYS = [
  'florist',
  'location_manager',
  'warehouse',
  'accountant',
  'wholesale',
  'courier',
  'logist',
  'barista',
  'driver',
  'tech',
  'admin',
];

// Дефолтні ролі для seedRoles() (upsert лише якщо ключа ще немає — не затирає правки адміна).
export const DEFAULT_ROLES = [
  { key: 'admin', name: 'Адміністратор', description: 'Повний доступ до системи', iconKey: 'Shield', color: '#e11d48', protected: true, restricted: false },
  { key: 'florist', name: 'Флорист', description: 'Робота з квітами, букетами та клієнтом', iconKey: 'Flower2', color: '#ec4899', protected: false, restricted: false },
  { key: 'location_manager', name: 'Управляючий локації', description: 'Управління персоналом і операціями локації', iconKey: 'Users', color: '#a855f7', protected: false, restricted: false },
  { key: 'warehouse', name: 'Складський працівник', description: 'Робота зі складом, прийом і видача товару', iconKey: 'Box', color: '#f59e0b', protected: false, restricted: false },
  { key: 'accountant', name: 'Бухгалтер', description: 'Облік, документи, фінансова звітність', iconKey: 'FileText', color: '#10b981', protected: false, restricted: true },
  { key: 'wholesale', name: 'Оптовий менеджер', description: 'B2B-продажі, оптові клієнти', iconKey: 'Briefcase', color: '#3b82f6', protected: false, restricted: false },
  { key: 'courier', name: 'Курʼєр', description: 'Доставка замовлень клієнтам', iconKey: 'Truck', color: '#f97316', protected: false, restricted: false },
  { key: 'logist', name: 'Логіст', description: 'Координація доставок і перевезень', iconKey: 'MapPin', color: '#06b6d4', protected: false, restricted: false },
  { key: 'barista', name: 'Бариста', description: 'Робота з кавою та напоями', iconKey: 'Coffee', color: '#78716c', protected: false, restricted: false },
  { key: 'driver', name: 'Водій вантажного авто', description: 'Міжміські перевезення', iconKey: 'Truck', color: '#475569', protected: false, restricted: false },
  { key: 'tech', name: 'Технічна підтримка', description: 'Обладнання, ПЗ, віддалена допомога', iconKey: 'Wrench', color: '#6366f1', protected: false, restricted: false },
  { key: 'hr', name: 'HR-менеджер', description: 'Кадрова робота, оголошення, дайджести компанії', iconKey: 'UserCircle2', color: '#d946ef', protected: false, restricted: false },
];

export const DEFAULT_TOPICS = {
  florist: [
    { id: 'fl-1', title: 'Бібліотека квітів', description: 'Сорти, сезонність, догляд та зберігання' },
    { id: 'fl-2', title: 'Складання букетів', description: 'Техніки, композиції, колірні поєднання' },
    { id: 'fl-3', title: 'Робота з клієнтом', description: 'Прийом замовлень, консультації, оформлення' },
    { id: 'fl-4', title: 'Догляд за рослинами', description: 'Полив, обрізка, профілактика хвороб' },
    { id: 'fl-5', title: 'Оформлення вітрини', description: 'Мерчандайзинг та сезонні композиції' },
  ],
  location_manager: [
    { id: 'lm-1', title: 'Управління персоналом', description: 'Графіки, мотивація, контроль роботи' },
    { id: 'lm-2', title: 'KPI та звітність', description: 'Показники локації, аналітика продажів' },
    { id: 'lm-3', title: 'Інвентаризація', description: 'Облік товару, ревізії, списання' },
    { id: 'lm-4', title: 'Робота з клієнтськими скаргами', description: 'Регламенти, скрипти, ескалація' },
  ],
  warehouse: [
    { id: 'wh-1', title: 'Прийом товару', description: 'Перевірка, оприбуткування, документообіг' },
    { id: 'wh-2', title: 'Зберігання квітів', description: 'Температурний режим, обробка, термін свіжості' },
    { id: 'wh-3', title: 'Комплектація замовлень', description: 'Збір, перевірка, передача в доставку' },
    { id: 'wh-4', title: 'Списання та брак', description: 'Процедура, документи, причини' },
  ],
  accountant: [
    { id: 'ac-1', title: 'Облік продажів', description: 'Касові операції, чеки, звірки' },
    { id: 'ac-2', title: 'Робота з постачальниками', description: 'Договори, оплати, акти звірки' },
    { id: 'ac-3', title: 'Зарплата та податки', description: 'Розрахунки, нарахування, звітність' },
    { id: 'ac-4', title: 'Первинні документи', description: 'Накладні, ТТН, акти виконаних робіт' },
  ],
  wholesale: [
    { id: 'ws-1', title: 'Робота з оптовими клієнтами', description: 'B2B-продажі, переговори, договори' },
    { id: 'ws-2', title: 'Прайс-листи та знижки', description: 'Ціноутворення, спецпропозиції' },
    { id: 'ws-3', title: 'Тендери та великі замовлення', description: 'Обробка, логістика, контроль' },
  ],
  courier: [
    { id: 'co-1', title: 'Маршрути доставки', description: 'Планування, оптимізація, навігація' },
    { id: 'co-2', title: 'Спілкування з клієнтом', description: 'Дзвінки, передача букета, фото-звіт' },
    { id: 'co-3', title: 'Робота з делікатним вантажем', description: 'Транспортування квітів, температура' },
  ],
  logist: [
    { id: 'lg-1', title: 'Планування доставок', description: "Розподіл замовлень між кур'єрами" },
    { id: 'lg-2', title: 'Робота з трекінгом', description: 'Моніторинг, статуси, форс-мажори' },
    { id: 'lg-3', title: 'Міжміська логістика', description: 'Транспортні компанії, оформлення' },
  ],
  barista: [
    { id: 'br-1', title: 'Меню та рецепти', description: 'Кава, чай, авторські напої' },
    { id: 'br-2', title: 'Робота з кавомашиною', description: 'Налаштування, обслуговування, чистка' },
    { id: 'br-3', title: 'Стандарти сервісу', description: 'Швидкість, якість, ввічливість' },
    { id: 'br-4', title: 'Облік розхідних матеріалів', description: 'Молоко, зерно, сиропи' },
  ],
  driver: [
    { id: 'dr-1', title: 'Регламент рейсу', description: 'Передрейсовий огляд, документи' },
    { id: 'dr-2', title: 'Завантаження та кріплення', description: 'Безпечне розміщення вантажу' },
    { id: 'dr-3', title: 'Технічне обслуговування авто', description: 'Перевірки, ТО, дрібний ремонт' },
  ],
  admin: [
    { id: 'ad-1', title: 'Управління користувачами', description: 'Призначення ролей, доступи' },
    { id: 'ad-2', title: 'Модерація контенту', description: 'Перевірка статей, правки, видалення' },
    { id: 'ad-3', title: 'Системні налаштування', description: 'Розділи, права, інтеграції' },
  ],
  tech: [
    { id: 'tc-1', title: 'POS-80 принтер Flolux', description: 'Налаштування, ремонт, типові поломки' },
    { id: 'tc-2', title: 'MacBook — діагностика', description: 'Проблеми та рішення' },
    { id: 'tc-3', title: "AnyDesk — підключення", description: "Налаштування, проблеми з'єднання" },
    { id: 'tc-4', title: 'Мережа та інтернет', description: 'Wi-Fi, роутери, діагностика' },
    { id: 'tc-5', title: 'Касове ПЗ', description: 'Помилки, оновлення, фіскалізація' },
  ],
};
