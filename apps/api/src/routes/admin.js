import { Router } from 'express';
import { prisma } from '../db.js';
import { publicUser, requireAuth, requireAdmin, requireHrOrAdmin } from '../auth.js';
import { wrap, logAction, syncPrimaryRole, slugify, roleExists } from '../lib.js';
import { serializeLocation } from './locations.js';
import { serializeRole } from './roles.js';
import { notifyRoleAssigned, notifyLocationApproved } from '../services/notifications.js';

const router = Router();

// ===== Дні народження (HR/admin) — оголошено ДО глобального requireAdmin =====
router.patch('/users/:id/birthday', requireAuth, requireHrOrAdmin, wrap(async (req, res) => {
  const { birthday } = req.body || {};
  if (!birthday || Number.isNaN(new Date(birthday).getTime())) {
    return res.status(400).json({ error: 'Невірна дата народження' });
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { birthday: new Date(birthday) },
    select: { id: true, birthday: true },
  });
  await logAction(req.user.id, 'user.birthday_set', 'user', req.params.id, { birthday });
  res.json({ id: user.id, birthday: user.birthday });
}));

router.delete('/users/:id/birthday', requireAuth, requireHrOrAdmin, wrap(async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { birthday: null } });
  await logAction(req.user.id, 'user.birthday_cleared', 'user', req.params.id);
  res.json({ ok: true });
}));

// Легкий список користувачів для керування ДН (HR/admin)
router.get('/birthday-list', requireAuth, requireHrOrAdmin, wrap(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, surname: true, birthday: true },
  });
  res.json(users.map((u) => ({
    id: u.id,
    name: `${u.name}${u.surname ? ' ' + u.surname : ''}`,
    birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
  })));
}));

router.use(requireAuth, requireAdmin);

const adminName = (u) => `${u.name}${u.surname ? ' ' + u.surname : ''}`;

// Кількість користувачів-адмінів (за UserRole). Захист від видалення останнього.
const adminCount = () => prisma.userRole.count({ where: { role: 'admin' } });

// ===== Користувачі =====

// GET /api/admin/users
router.get('/users', wrap(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { roles: true },
  });
  res.json(users.map(publicUser));
}));

// GET /api/admin/users/:id — деталі: ролі, локації, статті
router.get('/users/:id', wrap(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      roles: true,
      locations: { include: { location: true }, orderBy: { createdAt: 'asc' } },
      articles: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, topicId: true, createdAt: true } },
    },
  });
  if (!u) return res.status(404).json({ error: 'Користувача не знайдено' });
  res.json({
    ...publicUser(u),
    locations: u.locations.map((ul) => ({
      locationId: ul.locationId,
      name: ul.location.name,
      color: ul.location.color || null,
      isManager: ul.isManager,
      approved: ul.approved,
    })),
    articles: u.articles.map((a) => ({ id: a.id, title: a.title, topicId: a.topicId, createdAt: a.createdAt.getTime() })),
  });
}));

// PATCH /api/admin/users/:id  { assignedRole, approved }
// (legacy: assignedRole встановлює рівно одну роль; нова UI працює через /roles)
router.patch('/users/:id', wrap(async (req, res) => {
  const { assignedRole, approved } = req.body || {};
  if (assignedRole !== undefined) {
    if (assignedRole !== null && !(await roleExists(assignedRole))) {
      return res.status(400).json({ error: 'Невідома роль' });
    }
    await prisma.userRole.deleteMany({ where: { userId: req.params.id } });
    if (assignedRole) {
      await prisma.userRole.create({ data: { userId: req.params.id, role: assignedRole } });
    }
    await syncPrimaryRole(req.params.id);
  }
  if (approved !== undefined) {
    await prisma.user.update({ where: { id: req.params.id }, data: { approved: !!approved } });
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: true } });
  await logAction(req.user.id, 'user.updated', 'user', req.params.id, { assignedRole, approved });
  res.json(publicUser(user));
}));

// POST /api/admin/users/:id/roles { role }
router.post('/users/:id/roles', wrap(async (req, res) => {
  const { role } = req.body || {};
  if (!(await roleExists(role))) return res.status(400).json({ error: 'Невідома роль' });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: req.params.id, role } },
    update: {},
    create: { userId: req.params.id, role },
  });
  await syncPrimaryRole(req.params.id);
  await logAction(req.user.id, 'user.role_added', 'user', req.params.id, { role });
  await notifyRoleAssigned(req.params.id, role, req.user.id);

  const updated = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: true } });
  res.json(publicUser(updated));
}));

// DELETE /api/admin/users/:id/roles/:role
router.delete('/users/:id/roles/:role', wrap(async (req, res) => {
  const { id, role } = req.params;
  if (role === 'admin' && (await adminCount()) <= 1) {
    return res.status(400).json({ error: 'Не можна зняти роль останнього адміністратора' });
  }
  await prisma.userRole.deleteMany({ where: { userId: id, role } });
  await syncPrimaryRole(id);
  await logAction(req.user.id, 'user.role_removed', 'user', id, { role });

  const updated = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
  res.json(publicUser(updated));
}));

// POST /api/admin/users/bulk { action: 'approve' | 'delete', ids: [] }
router.post('/users/bulk', wrap(async (req, res) => {
  const { action } = req.body || {};
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'Не вибрано користувачів' });

  if (action === 'approve') {
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { approved: true } });
    await logAction(req.user.id, 'user.bulk_approved', 'user', null, { ids });
    return res.json({ ok: true, count: ids.length });
  }
  if (action === 'delete') {
    const totalAdmins = await adminCount();
    const deletingAdmins = await prisma.userRole.count({ where: { role: 'admin', userId: { in: ids } } });
    if (deletingAdmins > 0 && totalAdmins - deletingAdmins < 1) {
      return res.status(400).json({ error: 'Не можна видалити всіх адміністраторів' });
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await logAction(req.user.id, 'user.bulk_deleted', 'user', null, { ids });
    return res.json({ ok: true, count: ids.length });
  }
  res.status(400).json({ error: 'Невідома дія' });
}));

// DELETE /api/admin/users/:id — не можна видалити останнього адміна
router.delete('/users/:id', wrap(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: true } });
  if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });

  const isTargetAdmin = target.roles.some((r) => r.role === 'admin');
  if (isTargetAdmin && (await adminCount()) <= 1) {
    return res.status(400).json({ error: 'Не можна видалити останнього адміністратора' });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'user.deleted', 'user', req.params.id, { email: target.email });
  res.json({ ok: true });
}));

// ===== Дашборд / статистика =====

router.get('/stats', wrap(async (req, res) => {
  const [usersTotal, usersPending, articles, comments, suggestionsPending, roleGroups, recentUsers, recentAudit] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { approved: false } }),
      prisma.article.count(),
      prisma.comment.count(),
      prisma.suggestion.count({ where: { status: 'pending' } }),
      prisma.userRole.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } },
        select: { createdAt: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actor: { select: { name: true, surname: true } } },
      }),
    ]);

  const byDay = {};
  for (const u of recentUsers) {
    const k = u.createdAt.toISOString().slice(0, 10);
    byDay[k] = (byDay[k] || 0) + 1;
  }
  const registrations = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    registrations.push({ date: d, count: byDay[d] || 0 });
  }

  res.json({
    usersTotal,
    usersPending,
    articles,
    comments,
    suggestionsPending,
    byRole: Object.fromEntries(roleGroups.map((g) => [g.role, g._count._all])),
    registrations,
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      actorName: a.actor ? adminName(a.actor) : '—',
      createdAt: a.createdAt.getTime(),
    })),
  });
}));

// ===== Журнал дій =====

router.get('/audit-log', wrap(async (req, res) => {
  const where = {};
  if (req.query.actor) where.actorId = String(req.query.actor);
  if (req.query.action) where.action = { contains: String(req.query.action) };
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { name: true, surname: true } } },
  });
  res.json(logs.map((a) => ({
    id: a.id,
    actorId: a.actorId,
    actorName: a.actor ? adminName(a.actor) : '—',
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    metadata: a.metadata || null,
    createdAt: a.createdAt.getTime(),
  })));
}));

// ===== Запити ролей (pending requestedRole) =====

router.get('/role-requests', wrap(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { requestedRole: { not: null }, approved: false },
    orderBy: { createdAt: 'asc' },
    include: { roles: true },
  });
  res.json(users.map((u) => ({
    userId: u.id,
    userName: adminName(u),
    email: u.email,
    requestedRole: u.requestedRole,
    createdAt: u.createdAt.getTime(),
  })));
}));

// ===== Контент: масові дії над статтями =====

// POST /api/admin/articles/bulk { action: 'delete' | 'move', ids: [], targetTopicId }
router.post('/articles/bulk', wrap(async (req, res) => {
  const { action, targetTopicId } = req.body || {};
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'Не вибрано статей' });

  if (action === 'delete') {
    await prisma.article.deleteMany({ where: { id: { in: ids } } });
    await logAction(req.user.id, 'article.bulk_deleted', 'article', null, { ids });
    return res.json({ ok: true, count: ids.length });
  }
  if (action === 'move') {
    const topic = await prisma.topic.findUnique({ where: { id: String(targetTopicId || '') } });
    if (!topic) return res.status(400).json({ error: 'Невідомий цільовий розділ' });
    const section = topic.id.startsWith('tc-') ? 'tech' : 'role';
    await prisma.article.updateMany({ where: { id: { in: ids } }, data: { topicId: topic.id, section } });
    await logAction(req.user.id, 'article.bulk_moved', 'article', null, { ids, targetTopicId: topic.id });
    return res.json({ ok: true, count: ids.length });
  }
  res.status(400).json({ error: 'Невідома дія' });
}));

// ===== Запити локацій =====

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
    userName: adminName(r.user),
    locationId: r.locationId,
    locationName: r.location.name,
    locationColor: r.location.color || null,
  })));
}));

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
    await notifyLocationApproved(lr.userId, lr.locationId, req.user.id);
  }
  await logAction(req.user.id, 'location_request.' + status, 'location', lr.locationId, { userId: lr.userId });
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
  await logAction(req.user.id, 'user.location_assigned', 'user', req.params.id, { locationId, isManager: !!isManager });
  res.json({ id: link.id, userId: link.userId, locationId: link.locationId, isManager: link.isManager, approved: link.approved });
}));

// DELETE /api/admin/users/:id/locations/:locationId — відкріпити
router.delete('/users/:id/locations/:locationId', wrap(async (req, res) => {
  await prisma.userLocation.deleteMany({
    where: { userId: req.params.id, locationId: req.params.locationId },
  });
  await logAction(req.user.id, 'user.location_detached', 'user', req.params.id, { locationId: req.params.locationId });
  res.json({ ok: true });
}));

// ===== Локації (admin CRUD) =====

// POST /api/admin/locations { name, city, address, color }
router.post('/locations', wrap(async (req, res) => {
  const { name, city, address, color } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Вкажіть назву локації' });
  const exists = await prisma.location.findUnique({ where: { name: String(name).trim() } });
  if (exists) return res.status(400).json({ error: 'Локація з такою назвою вже існує' });
  const location = await prisma.location.create({
    data: {
      name: String(name).trim(),
      slug: slugify(name),
      city: city || null,
      address: address || null,
      color: color || null,
    },
  });
  await logAction(req.user.id, 'location.created', 'location', location.id, { name: location.name });
  res.json(serializeLocation(location, 0));
}));

// PATCH /api/admin/locations/:id { name, city, address, color, active }
router.patch('/locations/:id', wrap(async (req, res) => {
  const data = {};
  if (req.body?.name !== undefined) {
    data.name = String(req.body.name).trim();
    data.slug = slugify(req.body.name);
  }
  if (req.body?.city !== undefined) data.city = req.body.city || null;
  if (req.body?.address !== undefined) data.address = req.body.address || null;
  if (req.body?.color !== undefined) data.color = req.body.color || null;
  if (req.body?.active !== undefined) data.active = !!req.body.active;
  const location = await prisma.location.update({ where: { id: req.params.id }, data });
  await logAction(req.user.id, 'location.updated', 'location', location.id, data);
  res.json(serializeLocation(location));
}));

// DELETE /api/admin/locations/:id — лише якщо немає привʼязаних користувачів
router.delete('/locations/:id', wrap(async (req, res) => {
  const linked = await prisma.userLocation.count({ where: { locationId: req.params.id } });
  if (linked > 0) {
    return res.status(400).json({ error: 'Не можна видалити локацію з привʼязаними користувачами' });
  }
  await prisma.location.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'location.deleted', 'location', req.params.id);
  res.json({ ok: true });
}));

// ===== Ролі (admin CRUD) =====

const roleKeyFrom = (s) => {
  const k = String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return k || `role_${Date.now()}`;
};

// POST /api/admin/roles { key?, name, description, iconKey, color, restricted }
router.post('/roles', wrap(async (req, res) => {
  const { name, description, iconKey, color, restricted } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Вкажіть назву ролі' });
  const key = req.body?.key ? roleKeyFrom(req.body.key) : roleKeyFrom(name);
  if (await prisma.role.findUnique({ where: { key } })) {
    return res.status(400).json({ error: 'Роль із таким ключем уже існує' });
  }
  const role = await prisma.role.create({
    data: {
      key,
      name: String(name).trim(),
      description: description || null,
      iconKey: iconKey || null,
      color: color || null,
      restricted: !!restricted,
      protected: false,
    },
  });
  await logAction(req.user.id, 'role.created', 'role', role.key, { name: role.name });
  res.json(serializeRole(role));
}));

// PATCH /api/admin/roles/:key { name, description, iconKey, color, restricted }
// Ключ не редагується (він — посилання у UserRole.role та Topic.roleKey).
router.patch('/roles/:key', wrap(async (req, res) => {
  const existing = await prisma.role.findUnique({ where: { key: req.params.key } });
  if (!existing) return res.status(404).json({ error: 'Роль не знайдено' });
  const data = {};
  if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body?.description !== undefined) data.description = req.body.description || null;
  if (req.body?.iconKey !== undefined) data.iconKey = req.body.iconKey || null;
  if (req.body?.color !== undefined) data.color = req.body.color || null;
  if (req.body?.restricted !== undefined) data.restricted = !!req.body.restricted;
  const role = await prisma.role.update({ where: { key: req.params.key }, data });
  await logAction(req.user.id, 'role.updated', 'role', role.key, data);
  res.json(serializeRole(role));
}));

// DELETE /api/admin/roles/:key — не protected, без призначень і топіків
router.delete('/roles/:key', wrap(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { key: req.params.key } });
  if (!role) return res.status(404).json({ error: 'Роль не знайдено' });
  if (role.protected) return res.status(400).json({ error: 'Системну роль видалити не можна' });

  const usedByUsers = await prisma.userRole.count({ where: { role: req.params.key } });
  if (usedByUsers > 0) return res.status(400).json({ error: 'Роль призначена користувачам — спершу зніміть її' });
  const usedByTopics = await prisma.topic.count({ where: { roleKey: req.params.key } });
  if (usedByTopics > 0) return res.status(400).json({ error: 'Є розділи з цією роллю — спершу видаліть або перенесіть їх' });

  await prisma.role.delete({ where: { key: req.params.key } });
  await logAction(req.user.id, 'role.deleted', 'role', req.params.key);
  res.json({ ok: true });
}));

export default router;
