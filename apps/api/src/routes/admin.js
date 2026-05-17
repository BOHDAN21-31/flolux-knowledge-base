import { Router } from 'express';
import { prisma } from '../db.js';
import { publicUser, requireAuth, requireAdmin } from '../auth.js';
import { ROLE_KEYS } from '../constants.js';
import { wrap } from '../lib.js';

const router = Router();

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

// ===== Запити локацій =====

// GET /api/admin/location-requests?status=pending
router.get('/location-requests', wrap(async (req, res) => {
  const where = req.query.status ? { status: String(req.query.status) } : {};
  const reqs = await prisma.locationRequest.findMany({
    where,
    include: { user: true, location: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reqs.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.getTime(),
    userId: r.userId,
    userName: `${r.user.name}${r.user.surname ? ' ' + r.user.surname : ''}`,
    locationId: r.locationId,
    locationName: r.location.name,
    locationColor: r.location.color || null,
  })));
}));

// PATCH /api/admin/location-requests/:id { status }
// approve -> створює/оновлює UserLocation approved=true; reject -> лишає запис зі статусом rejected
router.patch('/location-requests/:id', wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Невідомий статус' });
  }
  const lr = await prisma.locationRequest.findUnique({ where: { id: req.params.id } });
  if (!lr) return res.status(404).json({ error: 'Запит не знайдено' });

  const updated = await prisma.locationRequest.update({
    where: { id: req.params.id },
    data: { status },
  });

  if (status === 'approved') {
    await prisma.userLocation.upsert({
      where: { userId_locationId: { userId: lr.userId, locationId: lr.locationId } },
      update: { approved: true },
      create: { userId: lr.userId, locationId: lr.locationId, approved: true },
    });
  }
  res.json({ id: updated.id, status: updated.status });
}));

// POST /api/admin/users/:id/locations { locationId, isManager } — примусове призначення
router.post('/users/:id/locations', wrap(async (req, res) => {
  const { locationId, isManager } = req.body || {};
  if (!locationId) return res.status(400).json({ error: 'Вкажіть locationId' });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) return res.status(404).json({ error: 'Локацію не знайдено' });

  const link = await prisma.userLocation.upsert({
    where: { userId_locationId: { userId: req.params.id, locationId } },
    update: { approved: true, isManager: !!isManager },
    create: { userId: req.params.id, locationId, approved: true, isManager: !!isManager },
  });
  res.json({ id: link.id, userId: link.userId, locationId: link.locationId, isManager: link.isManager, approved: link.approved });
}));

// DELETE /api/admin/users/:id/locations/:locationId — відкріпити
router.delete('/users/:id/locations/:locationId', wrap(async (req, res) => {
  await prisma.userLocation.deleteMany({
    where: { userId: req.params.id, locationId: req.params.locationId },
  });
  res.json({ ok: true });
}));

export default router;
