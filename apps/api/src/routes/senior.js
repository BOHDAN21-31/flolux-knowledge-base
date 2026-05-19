import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireSenior } from '../auth.js';
import { wrap, roleList } from '../lib.js';

const router = Router();

// GET /api/senior/users — список працівників для HR/admin.
// БЕЗ PII: НЕ повертаємо email / phone / passwordHash.
// Анти-tampering: ролі беруться з БД (requireAuth перечитує user.roles),
// requireSenior повторно перевіряє admin|hr перед видачею.
router.get('/users', requireAuth, requireSenior, wrap(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ name: 'asc' }, { surname: 'asc' }],
    select: {
      id: true,
      name: true,
      surname: true,
      avatarUrl: true,
      rating: true,
      birthday: true,
      approved: true,
      roles: { select: { role: true } },
      locations: {
        where: { approved: true },
        select: { isManager: true, location: { select: { id: true, name: true, color: true } } },
      },
    },
  });
  res.json(users.map((u) => ({
    id: u.id,
    name: u.name,
    surname: u.surname || null,
    avatarUrl: u.avatarUrl || null,
    rating: u.rating ?? 0,
    approved: u.approved,
    birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
    roles: roleList(u),
    locations: u.locations.map((ul) => ({
      locationId: ul.location.id,
      name: ul.location.name,
      color: ul.location.color || null,
      isManager: ul.isManager,
    })),
  })));
}));

export default router;
