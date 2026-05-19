-- Дефолтні ролі (таблиця Role створена міграцією 0009). Ідемпотентно.
-- Дублює seedRoles() — обидва ON CONFLICT DO NOTHING, існуючі рядки не чіпаються.
INSERT INTO "Role" ("key", "name", "description", "iconKey", "color", "protected", "restricted") VALUES
('admin', 'Адміністратор', 'Повний доступ до системи', 'Shield', '#e11d48', true, false),
('florist', 'Флорист', 'Робота з квітами, букетами та клієнтом', 'Flower2', '#ec4899', false, false),
('location_manager', 'Управляючий локації', 'Управління персоналом і операціями локації', 'Users', '#a855f7', false, false),
('warehouse', 'Складський працівник', 'Робота зі складом, прийом і видача товару', 'Box', '#f59e0b', false, false),
('accountant', 'Бухгалтер', 'Облік, документи, фінансова звітність', 'FileText', '#10b981', false, true),
('wholesale', 'Оптовий менеджер', 'B2B-продажі, оптові клієнти', 'Briefcase', '#3b82f6', false, false),
('courier', 'Курʼєр', 'Доставка замовлень клієнтам', 'Truck', '#f97316', false, false),
('logist', 'Логіст', 'Координація доставок і перевезень', 'MapPin', '#06b6d4', false, false),
('barista', 'Бариста', 'Робота з кавою та напоями', 'Coffee', '#78716c', false, false),
('driver', 'Водій вантажного авто', 'Міжміські перевезення', 'Truck', '#475569', false, false),
('tech', 'Технічна підтримка', 'Обладнання, ПЗ, віддалена допомога', 'Wrench', '#6366f1', false, false),
('hr', 'HR-менеджер', 'Кадрова робота, оголошення, дайджести компанії', 'UserCircle2', '#d946ef', false, false)
ON CONFLICT ("key") DO NOTHING;
