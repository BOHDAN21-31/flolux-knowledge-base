import { Router } from 'express';
import { prisma } from '../db.js';
import { publicUser, requireAuth, requireAdmin } from '../auth.js';
import { ROLE_KEYS } from '../constants.js';

const router = Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

router.use(requireAuth, requireAdmin);

// GET /api/admin/users
router.get('/users', wrap(async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(users.map(publicUser));
}));

// PATCH /api/admin/users/:id
router.patch('/users/:id', wrap(async (req, res) => {
  const { assignedRole, approved } = req.body || {};
  const data = {};
  if (assignedRole !== undefined) {
    if (assignedRole !== null && !ROLE_KEYS.includes(assignedRole)) {
      return res.status(400).json({ error: 'Невідома роль' });
    }
    data.assignedRole = assignedRole || null;
  }
  if (approved !== undefined) data.approved = !!approved;

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(publicUser(user));
}));

// DELETE /api/admin/users/:id — не можна видалити останнього адміна
router.delete('/users/:id', wrap(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });

  if (target.assignedRole === 'admin') {
    const admins = await prisma.user.count({ where: { assignedRole: 'admin' } });
    if (admins <= 1) return res.status(400).json({ error: 'Не можна видалити останнього адміністратора' });
  }

  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default router;
