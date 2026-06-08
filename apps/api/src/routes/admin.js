import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { publicUser, requireAuth, requireAdmin, requireSenior } from '../auth.js';
import { wrap, logAction, syncPrimaryRole, slugify, roleExists, isAdmin } from '../lib.js';
import {
  hasPermission, requirePermission, permissionSource,
  PERMISSION_CATALOG, PERMISSION_CATEGORIES,
} from '../permissions.js';
import { serializeLocation } from './locations.js';
import { serializeRole } from './roles.js';
import { notifyRoleAssigned, notifyLocationApproved, autoEnrollOnboarding } from '../services/notifications.js';

const router = Router();

const adminName = (u) => `${u.name}${u.surname ? ' ' + u.surname : ''}`;

// Контент-події, видимі HR у журналі. Admin бачить усе.
const SENIOR_AUDIT_PREFIXES = ['article.', 'suggestion.', 'topic.', 'digest.'];
const seniorAuditOnly = () => ({ OR: SENIOR_AUDIT_PREFIXES.map((p) => ({ action: { startsWith: p } })) });

// ===== Дні народження (HR/admin) — оголошено ДО глобального requireAdmin =====
router.patch('/users/:id/birthday', requireAuth, requirePermission('users.view_birthdays'), wrap(async (req, res) => {
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

router.delete('/users/:id/birthday', requireAuth, requirePermission('users.view_birthdays'), wrap(async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { birthday: null } });
  await logAction(req.user.id, 'user.birthday_cleared', 'user', req.params.id);
  res.json({ ok: true });
}));

// Легкий список користувачів для керування ДН (HR/admin)
router.get('/birthday-list', requireAuth, requirePermission('users.view_birthdays'), wrap(async (req, res) => {
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

// ===== Senior (admin|hr): повний доступ до КОНТЕНТУ — ДО глобального requireAdmin.
//       PII користувачів сюди не потрапляє. HR-журнал — лише контент-події. =====

// POST /api/admin/articles/bulk { action: 'delete' | 'move', ids, targetTopicId }
router.post('/articles/bulk', requireAuth, requireSenior, wrap(async (req, res) => {
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

// GET /api/admin/stats — дашборд (senior). Без PII; для HR журнал — лише контент.
router.get('/stats', requireAuth, requireSenior, wrap(async (req, res) => {
  const auditWhere = hasPermission(req.user, 'system.view_audit_log') ? {} : seniorAuditOnly();
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
        where: auditWhere,
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

// GET /api/admin/audit-log — журнал (senior). HR бачить лише контент-події
// (server-enforced: фільтр не залежить від клієнтських параметрів).
router.get('/audit-log', requireAuth, requireSenior, wrap(async (req, res) => {
  const and = [];
  if (req.query.actor) and.push({ actorId: String(req.query.actor) });
  if (req.query.action) and.push({ action: { contains: String(req.query.action) } });
  if (!hasPermission(req.user, 'system.view_audit_log')) and.push(seniorAuditOnly());
  const where = and.length ? { AND: and } : {};
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

// ===== Спільні хелпери (потрібні і до, і після глобального gate) =====
const adminCount = () => prisma.userRole.count({ where: { role: 'admin' } });
const roleKeyFrom = (s) => {
  const k = String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return k || `role_${Date.now()}`;
};

// ===== Per-permission ендпоінти — ДО глобального requireAdmin.
//       Admin проходить через '*'; індивідуально наділені — теж. =====

// POST /api/admin/users/:id/roles { role } — users.manage_roles
router.post('/users/:id/roles', requireAuth, requirePermission('users.manage_roles'), wrap(async (req, res) => {
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

// DELETE /api/admin/users/:id/roles/:role — users.manage_roles
router.delete('/users/:id/roles/:role', requireAuth, requirePermission('users.manage_roles'), wrap(async (req, res) => {
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

// POST /api/admin/users/:id/reset-password — users.reset_password (не з ролей; лише admin/індивід.)
router.post('/users/:id/reset-password', requireAuth, requirePermission('users.reset_password'), wrap(async (req, res) => {
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Пароль має містити мінімум 8 символів' });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  await logAction(req.user.id, 'user.password_reset', 'user', req.params.id, {});
  res.json({ ok: true });
}));

// POST /api/admin/locations — locations.create
router.post('/locations', requireAuth, requirePermission('locations.create'), wrap(async (req, res) => {
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

// PATCH /api/admin/locations/:id — locations.edit
router.patch('/locations/:id', requireAuth, requirePermission('locations.edit'), wrap(async (req, res) => {
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

// DELETE /api/admin/locations/:id — locations.delete
router.delete('/locations/:id', requireAuth, requirePermission('locations.delete'), wrap(async (req, res) => {
  const linked = await prisma.userLocation.count({ where: { locationId: req.params.id } });
  if (linked > 0) {
    return res.status(400).json({ error: 'Не можна видалити локацію з привʼязаними користувачами' });
  }
  await prisma.location.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'location.deleted', 'location', req.params.id);
  res.json({ ok: true });
}));

// POST /api/admin/roles — system.manage_roles
router.post('/roles', requireAuth, requirePermission('system.manage_roles'), wrap(async (req, res) => {
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

// PATCH /api/admin/roles/:key — system.manage_roles
router.patch('/roles/:key', requireAuth, requirePermission('system.manage_roles'), wrap(async (req, res) => {
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

// DELETE /api/admin/roles/:key — system.manage_roles
router.delete('/roles/:key', requireAuth, requirePermission('system.manage_roles'), wrap(async (req, res) => {
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

// PATCH /api/admin/users/:id/employment — HR (через content.publish_digest) або admin.
// Робоча інформація: статус, стажування, керівник, посада, відділ, дата прийому.
const EMPLOYMENT_STATUS = ['employed', 'intern', 'probation', 'former'];
router.patch('/users/:id/employment',
  requireAuth,
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Не авторизовано' });
    if (isAdmin(req.user)) return next();
    if (hasPermission(req.user, 'content.publish_digest')) return next();
    return res.status(403).json({ error: 'Доступ заборонено' });
  },
  wrap(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Не знайдено' });

    const data = {};
    if (req.body?.employmentStatus !== undefined) {
      if (!EMPLOYMENT_STATUS.includes(req.body.employmentStatus)) {
        return res.status(400).json({ error: 'Невідомий статус' });
      }
      data.employmentStatus = req.body.employmentStatus;
    }
    if (req.body?.internshipStartedAt !== undefined) {
      data.internshipStartedAt = req.body.internshipStartedAt ? new Date(req.body.internshipStartedAt) : null;
    }
    if (req.body?.internshipEndsAt !== undefined) {
      data.internshipEndsAt = req.body.internshipEndsAt ? new Date(req.body.internshipEndsAt) : null;
    }
    // Валідація: end має бути після start
    const newStart = data.internshipStartedAt ?? existing.internshipStartedAt;
    const newEnd = data.internshipEndsAt ?? existing.internshipEndsAt;
    if (newStart && newEnd && newEnd <= newStart) {
      return res.status(400).json({ error: 'Кінець стажування має бути після початку' });
    }
    if (req.body?.supervisorId !== undefined) {
      data.supervisorId = req.body.supervisorId || null;
    }
    if (req.body?.department !== undefined) data.department = req.body.department || null;
    if (req.body?.position !== undefined) data.position = req.body.position || null;
    if (req.body?.hiredAt !== undefined) data.hiredAt = req.body.hiredAt ? new Date(req.body.hiredAt) : null;

    const u = await prisma.user.update({ where: { id: req.params.id }, data, include: { roles: true } });
    await logAction(req.user.id, 'user.employment_updated', 'user', u.id, Object.keys(data));
    res.json({
      ...publicUser(u),
      employmentStatus: u.employmentStatus,
      internshipStartedAt: u.internshipStartedAt ? u.internshipStartedAt.getTime() : null,
      internshipEndsAt: u.internshipEndsAt ? u.internshipEndsAt.getTime() : null,
      supervisorId: u.supervisorId || null,
      department: u.department || null,
      position: u.position || null,
      hiredAt: u.hiredAt ? u.hiredAt.getTime() : null,
    });
  }));

router.use(requireAuth, requireAdmin);

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
      supervisor: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
  });
  if (!u) return res.status(404).json({ error: 'Користувача не знайдено' });
  const ms = (d) => (d instanceof Date ? d.getTime() : (d ?? null));
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
    employmentStatus: u.employmentStatus || 'employed',
    internshipStartedAt: ms(u.internshipStartedAt),
    internshipEndsAt: ms(u.internshipEndsAt),
    supervisorId: u.supervisorId || null,
    supervisor: u.supervisor ? { id: u.supervisor.id, name: u.supervisor.name, surname: u.supervisor.surname || null, avatarUrl: u.supervisor.avatarUrl || null } : null,
    department: u.department || null,
    position: u.position || null,
    hiredAt: ms(u.hiredAt),
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
    const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: { approved: true } });
    await prisma.user.update({ where: { id: req.params.id }, data: { approved: !!approved } });
    if (approved && !before?.approved) {
      autoEnrollOnboarding(req.params.id, req.user.id).catch(() => {});
    }
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: true } });
  await logAction(req.user.id, 'user.updated', 'user', req.params.id, { assignedRole, approved });
  res.json(publicUser(user));
}));

// POST /api/admin/users/bulk { action: 'approve' | 'delete', ids: [] }
router.post('/users/bulk', wrap(async (req, res) => {
  const { action } = req.body || {};
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'Не вибрано користувачів' });

  if (action === 'approve') {
    const before = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, approved: true } });
    const newlyApproved = before.filter((u) => !u.approved).map((u) => u.id);
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { approved: true } });
    await logAction(req.user.id, 'user.bulk_approved', 'user', null, { ids });
    for (const uid of newlyApproved) autoEnrollOnboarding(uid, req.user.id).catch(() => {});
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

// ===== Карта доступів (тільки admin — під глобальним requireAdmin) =====

// Завантажує користувача з ролями+правами; повертає каталог із прапорцями.
async function userPermView(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true, permissions: true },
  });
  if (!u) return null;
  const grantorIds = [...new Set(u.permissions.map((p) => p.grantedBy).filter(Boolean))];
  const grantors = grantorIds.length
    ? await prisma.user.findMany({ where: { id: { in: grantorIds } }, select: { id: true, name: true, surname: true } })
    : [];
  const gName = Object.fromEntries(grantors.map((g) => [g.id, adminName(g)]));
  const indiv = Object.fromEntries(u.permissions.map((p) => [p.permissionKey, p]));
  const items = PERMISSION_CATALOG.map((perm) => {
    const enabled = hasPermission(u, perm.key);
    const source = permissionSource(u, perm.key);
    const up = indiv[perm.key];
    return {
      ...perm,
      enabled,
      source,                                   // 'role:<key>' | 'individual' | null
      fromRole: !!source && source.startsWith('role:'),
      roleKey: source?.startsWith('role:') ? source.slice(5) : null,
      individual: !!up,
      grantedBy: up?.grantedBy ? (gName[up.grantedBy] || '—') : null,
      grantedAt: up?.grantedAt ? new Date(up.grantedAt).getTime() : null,
      expiresAt: up?.expiresAt ? new Date(up.expiresAt).getTime() : null,
    };
  });
  return { userId: u.id, items };
}

// GET /api/admin/permissions — каталог (по категоріях)
router.get('/permissions', wrap(async (req, res) => {
  res.json({ categories: PERMISSION_CATEGORIES, permissions: PERMISSION_CATALOG });
}));

// GET /api/admin/permission-matrix — спрощена карта: користувачі + лічильники по категоріях
router.get('/permission-matrix', wrap(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: { roles: true, permissions: true },
  });
  const totals = {};
  for (const c of PERMISSION_CATEGORIES) {
    totals[c] = PERMISSION_CATALOG.filter((p) => p.category === c).length;
  }
  res.json(users.map((u) => {
    const counts = {};
    let any = false;
    for (const c of PERMISSION_CATEGORIES) counts[c] = { have: 0, total: totals[c] };
    for (const perm of PERMISSION_CATALOG) {
      if (hasPermission(u, perm.key)) { counts[perm.category].have += 1; any = true; }
    }
    return {
      id: u.id,
      name: u.name,
      surname: u.surname || null,
      avatarUrl: u.avatarUrl || null,
      roles: u.roles.map((r) => r.role),
      counts,
      hasAny: any,
    };
  }));
}));

// GET /api/admin/users/:id/permissions — каталог із прапорцями для користувача
router.get('/users/:id/permissions', wrap(async (req, res) => {
  const view = await userPermView(req.params.id);
  if (!view) return res.status(404).json({ error: 'Користувача не знайдено' });
  res.json(view);
}));

// POST /api/admin/users/:id/permissions { permissionKey, expiresAt? }
router.post('/users/:id/permissions', wrap(async (req, res) => {
  const { permissionKey } = req.body || {};
  const perm = await prisma.permission.findUnique({ where: { key: String(permissionKey || '') } });
  if (!perm) return res.status(400).json({ error: 'Невідоме право' });
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
  let expiresAt = null;
  if (req.body?.expiresAt) {
    const d = new Date(req.body.expiresAt);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Невірна дата завершення' });
    expiresAt = d;
  }
  await prisma.userPermission.upsert({
    where: { userId_permissionKey: { userId: req.params.id, permissionKey: perm.key } },
    update: { grantedBy: req.user.id, grantedAt: new Date(), expiresAt },
    create: { userId: req.params.id, permissionKey: perm.key, grantedBy: req.user.id, expiresAt },
  });
  await logAction(req.user.id, 'permission.granted', 'user', req.params.id, { permissionKey: perm.key, expiresAt });
  res.json(await userPermView(req.params.id));
}));

// DELETE /api/admin/users/:id/permissions/:key — забрати індивідуальне право
router.delete('/users/:id/permissions/:key', wrap(async (req, res) => {
  await prisma.userPermission.deleteMany({
    where: { userId: req.params.id, permissionKey: req.params.key },
  });
  await logAction(req.user.id, 'permission.revoked', 'user', req.params.id, { permissionKey: req.params.key });
  res.json(await userPermView(req.params.id));
}));

// POST /api/admin/users/:id/apply-preset { presetId }
router.post('/users/:id/apply-preset', wrap(async (req, res) => {
  const preset = await prisma.permissionPreset.findUnique({ where: { id: String(req.body?.presetId || '') } });
  if (!preset) return res.status(404).json({ error: 'Пресет не знайдено' });
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
  const valid = preset.permissionKeys.filter((k) => PERMISSION_CATALOG.some((p) => p.key === k));
  for (const key of valid) {
    await prisma.userPermission.upsert({
      where: { userId_permissionKey: { userId: req.params.id, permissionKey: key } },
      update: { grantedBy: req.user.id, grantedAt: new Date(), expiresAt: null },
      create: { userId: req.params.id, permissionKey: key, grantedBy: req.user.id },
    });
  }
  await logAction(req.user.id, 'preset.applied', 'user', req.params.id, { presetId: preset.id, name: preset.name, count: valid.length });
  res.json(await userPermView(req.params.id));
}));

// ===== Пресети =====

const serializePreset = (p) => ({
  id: p.id, name: p.name, description: p.description || null,
  permissionKeys: p.permissionKeys || [], createdAt: p.createdAt.getTime(),
});

router.get('/permission-presets', wrap(async (req, res) => {
  const presets = await prisma.permissionPreset.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(presets.map(serializePreset));
}));

router.post('/permission-presets', wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Вкажіть назву пресету' });
  const keys = Array.isArray(req.body?.permissionKeys)
    ? req.body.permissionKeys.filter((k) => PERMISSION_CATALOG.some((p) => p.key === k)) : [];
  const preset = await prisma.permissionPreset.create({
    data: { name: String(name).trim(), description: req.body?.description || null, permissionKeys: keys, createdBy: req.user.id },
  });
  await logAction(req.user.id, 'preset.created', 'preset', preset.id, { name: preset.name });
  res.json(serializePreset(preset));
}));

router.patch('/permission-presets/:id', wrap(async (req, res) => {
  const data = {};
  if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body?.description !== undefined) data.description = req.body.description || null;
  if (req.body?.permissionKeys !== undefined) {
    data.permissionKeys = Array.isArray(req.body.permissionKeys)
      ? req.body.permissionKeys.filter((k) => PERMISSION_CATALOG.some((p) => p.key === k)) : [];
  }
  const preset = await prisma.permissionPreset.update({ where: { id: req.params.id }, data });
  await logAction(req.user.id, 'preset.updated', 'preset', preset.id, data);
  res.json(serializePreset(preset));
}));

router.delete('/permission-presets/:id', wrap(async (req, res) => {
  await prisma.permissionPreset.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'preset.deleted', 'preset', req.params.id);
  res.json({ ok: true });
}));

export default router;
