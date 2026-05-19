// Карта доступів: ролі дають базовий набір прав, поверх — індивідуальні
// permissions (опційно з терміном дії). Перевірка: hasPermission(user, key).
//
// Backward-compat: уся попередня логіка прав працює через ROLE_PERMISSIONS
// (hr/location_manager отримують ті самі права, що й раніше; admin = '*').
export {
  isAdmin,
  isSenior,
  canSeeUserPII,
  canManageUsers,
  canManageSystem,
} from './lib.js';

import { isSenior } from './lib.js';

export const canSeeAllContent = (u) => isSenior(u);

// Дефолтний каталог permissions (seed; усі protected — не видаляються через API).
// users.view_pii / users.reset_password / users.manage_roles та system.*
// НЕ входять у жодну роль — лише admin ('*') або індивідуальний грант.
export const PERMISSION_CATALOG = [
  { key: 'content.edit_any', category: 'content', name: 'Редагувати будь-яку статтю', description: 'Редагування статей інших авторів' },
  { key: 'content.delete_any', category: 'content', name: 'Видаляти будь-яку статтю', description: 'Видалення статей інших авторів' },
  { key: 'content.moderate', category: 'content', name: 'Модерувати пропозиції', description: 'Схвалення/відхилення пропозицій до статей' },
  { key: 'content.publish_digest', category: 'content', name: 'Створювати дайджести', description: 'Публікація корпоративних дайджестів' },
  { key: 'content.view_all', category: 'content', name: 'Бачити весь контент', description: 'Доступ до статей усіх локацій' },
  { key: 'content.view_restricted', category: 'content', name: 'Бачити контент обмежених ролей', description: 'Доступ до розділів restricted-ролей' },
  { key: 'users.view_birthdays', category: 'users', name: 'Керувати днями народження', description: 'Перегляд/редагування дат народження' },
  { key: 'users.view_pii', category: 'users', name: 'Бачити email/телефон', description: 'Доступ до контактних даних користувачів (чутливо)' },
  { key: 'users.reset_password', category: 'users', name: 'Скидати паролі', description: 'Примусова зміна пароля користувача (чутливо)' },
  { key: 'users.manage_roles', category: 'users', name: 'Призначати ролі', description: 'Додавання/зняття ролей користувачам' },
  { key: 'users.manage_locations', category: 'users', name: 'Керувати локаціями користувачів', description: 'Призначення/відкріплення локацій' },
  { key: 'locations.create', category: 'locations', name: 'Створювати локації', description: 'Додавання нових локацій' },
  { key: 'locations.edit', category: 'locations', name: 'Редагувати локації', description: 'Зміна даних локацій' },
  { key: 'locations.delete', category: 'locations', name: 'Видаляти локації', description: 'Видалення локацій' },
  { key: 'system.manage_roles', category: 'system', name: 'Керувати ролями (CRUD)', description: 'Створення/зміна/видалення ролей системи' },
  { key: 'system.manage_topics', category: 'system', name: 'Керувати розділами (CRUD)', description: 'Створення/зміна/видалення розділів' },
  { key: 'system.view_audit_log', category: 'system', name: 'Повний журнал дій', description: 'Перегляд усіх подій адмін-журналу' },
];

export const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));
export const PERMISSION_CATEGORIES = ['content', 'users', 'locations', 'system'];

// Права, що дає роль. admin = '*' (усе). Інші ролі — порожньо.
export const ROLE_PERMISSIONS = {
  admin: ['*'],
  hr: [
    'content.edit_any', 'content.delete_any', 'content.moderate',
    'content.publish_digest', 'content.view_all', 'content.view_restricted',
    'users.view_birthdays',
  ],
  location_manager: ['users.manage_locations', 'content.edit_any'],
};

// Дефолтні пресети (seed за назвою, idempotent — правки адміна не затираються).
export const DEFAULT_PRESETS = [
  {
    name: 'HR-набір',
    description: 'Повний доступ до контенту + дні народження',
    permissionKeys: [
      'content.edit_any', 'content.delete_any', 'content.moderate',
      'content.publish_digest', 'content.view_all', 'content.view_restricted',
      'users.view_birthdays',
    ],
  },
  {
    name: 'Менеджер локації-розширений',
    description: 'Редагування контенту + PII та локації користувачів',
    permissionKeys: ['content.edit_any', 'users.view_pii', 'users.manage_locations'],
  },
  {
    name: 'Модератор контенту',
    description: 'Модерація пропозицій та видалення статей',
    permissionKeys: ['content.moderate', 'content.delete_any'],
  },
];

// Чи має користувач право `key` — через роль АБО індивідуально (не прострочено).
export function hasPermission(user, key) {
  if (!user) return false;
  const roles = (user.roles || []).map((r) => (typeof r === 'string' ? r : r.role));
  if (roles.includes('admin') || user.assignedRole === 'admin') return true;
  for (const role of roles) {
    const rp = ROLE_PERMISSIONS[role] || [];
    if (rp.includes('*') || rp.includes(key)) return true;
  }
  const now = Date.now();
  for (const up of user.permissions || []) {
    if (up.permissionKey !== key) continue;
    if (up.expiresAt && new Date(up.expiresAt).getTime() < now) continue;
    return true;
  }
  return false;
}

// Express-гард на конкретне право.
export const requirePermission = (key) => (req, res, next) => {
  if (!hasPermission(req.user, key)) {
    return res.status(403).json({ error: `Недостатньо прав: ${key}` });
  }
  next();
};

// Джерело права для UI: 'role:<key>' | 'individual' | null.
export function permissionSource(user, key) {
  if (!user) return null;
  const roles = (user.roles || []).map((r) => (typeof r === 'string' ? r : r.role));
  if (roles.includes('admin') || user.assignedRole === 'admin') return 'role:admin';
  for (const role of roles) {
    const rp = ROLE_PERMISSIONS[role] || [];
    if (rp.includes('*') || rp.includes(key)) return `role:${role}`;
  }
  const now = Date.now();
  for (const up of user.permissions || []) {
    if (up.permissionKey !== key) continue;
    if (up.expiresAt && new Date(up.expiresAt).getTime() < now) continue;
    return 'individual';
  }
  return null;
}
