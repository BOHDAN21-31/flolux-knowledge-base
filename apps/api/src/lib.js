// Дрібні спільні утиліти бекенду.

import { prisma } from './db.js';

export const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// Простий slug з назви (підтримує юнікод-літери), з фолбеком.
export function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[\s.]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || `loc-${Date.now()}`;
}

// Список ключів ролей користувача (підтримує і include:{roles}, і масив рядків).
export const roleList = (u) =>
  (u?.roles || []).map((r) => (typeof r === 'string' ? r : r.role));

// admin, якщо є роль 'admin' АБО (зворотна сумісність) assignedRole === 'admin'.
export const isAdmin = (u) => roleList(u).includes('admin') || u?.assignedRole === 'admin';

// Перерахунок "первинної" ролі у застарілий assignedRole:
// admin (якщо є) -> інакше найперша за датою роль -> інакше null.
export async function syncPrimaryRole(userId) {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  const keys = roles.map((r) => r.role);
  const primary = keys.includes('admin') ? 'admin' : (keys[0] || null);
  await prisma.user.update({ where: { id: userId }, data: { assignedRole: primary } });
  return keys;
}

// Запис у журнал дій. Ніколи не валить основний запит.
export async function logAction(actorId, action, targetType, targetId = null, metadata = null) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, targetType, targetId, metadata: metadata ?? undefined },
    });
  } catch (e) {
    console.error('[audit] не вдалося записати дію:', e.message);
  }
}
