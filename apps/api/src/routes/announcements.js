import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasPermission, requirePermission } from '../permissions.js';
import { wrap, logAction } from '../lib.js';
import { notifyAnnouncement } from '../services/notifications.js';

const router = Router();

export const ANNOUNCEMENT_CATEGORIES = ['urgent', 'process', 'deadline', 'tech_update', 'org_change'];
export const ANNOUNCEMENT_PRIORITIES = ['urgent', 'high', 'normal'];

const ms = (d) => (d instanceof Date ? d.getTime() : (d ?? null));

const serializeAnnouncement = (a, readMap = null) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  category: a.category,
  priority: a.priority,
  authorId: a.authorId,
  authorName: a.author?.name || 'Система',
  targetRoles: Array.isArray(a.targetRoles) ? a.targetRoles : [],
  targetLocations: Array.isArray(a.targetLocations) ? a.targetLocations : [],
  expiresAt: ms(a.expiresAt),
  pinned: !!a.pinned,
  createdAt: ms(a.createdAt),
  updatedAt: ms(a.updatedAt),
  readAt: readMap ? (readMap.get(a.id) ?? null) : (a._readAt ?? null),
});

// Чи показувати оголошення цьому юзеру (за таргетами)
function matchesUser(ann, user) {
  const hasRoles = Array.isArray(ann.targetRoles) && ann.targetRoles.length > 0;
  const hasLocs = Array.isArray(ann.targetLocations) && ann.targetLocations.length > 0;
  if (!hasRoles && !hasLocs) return true;
  const myRoles = (user.roles || []).map((r) => (typeof r === 'string' ? r : r.role));
  if (hasRoles && ann.targetRoles.some((r) => myRoles.includes(r))) return true;
  const myLocs = new Set((user.locations || []).filter((l) => l.approved).map((l) => l.locationId));
  if (hasLocs && ann.targetLocations.some((id) => myLocs.has(id))) return true;
  return false;
}

const canManage = (user) => hasPermission(user, 'content.publish_digest');

const sanitizeStrArr = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];

function validatePayload(body) {
  const title = String(body?.title || '').trim();
  const text = String(body?.body || '').trim();
  if (!title || title.length > 200) return { error: 'Назва обов’язкова (до 200 символів)' };
  if (!text) return { error: 'Текст оголошення обов’язковий' };
  const category = ANNOUNCEMENT_CATEGORIES.includes(body?.category) ? body.category : null;
  if (!category) return { error: 'Невірна категорія' };
  const priority = ANNOUNCEMENT_PRIORITIES.includes(body?.priority) ? body.priority : 'normal';
  const targetRoles = sanitizeStrArr(body?.targetRoles);
  const targetLocations = sanitizeStrArr(body?.targetLocations);
  let expiresAt = null;
  if (body?.expiresAt) {
    const t = new Date(body.expiresAt);
    if (!Number.isNaN(t.getTime())) expiresAt = t;
  }
  const pinned = !!body?.pinned;
  return { data: { title, body: text, category, priority, targetRoles, targetLocations, expiresAt, pinned } };
}

// GET /api/announcements — активні (або всі, якщо ?all=1 і є право)
router.get('/', requireAuth, wrap(async (req, res) => {
  const showAll = req.query.all === '1' && canManage(req.user);
  const where = {};
  if (!showAll) {
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }
  if (req.query.category && ANNOUNCEMENT_CATEGORIES.includes(req.query.category)) {
    where.category = req.query.category;
  }
  const items = await prisma.announcement.findMany({
    where,
    include: { author: { select: { id: true, name: true } } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });

  // Завантажуємо локації користувача (для таргетингу) — req.user не має include локацій
  const userLocs = await prisma.userLocation.findMany({
    where: { userId: req.user.id, approved: true }, select: { locationId: true },
  });
  const userForMatch = { roles: req.user.roles || [], locations: userLocs.map((l) => ({ locationId: l.locationId, approved: true })) };

  const visible = canManage(req.user)
    ? items
    : items.filter((a) => matchesUser(a, userForMatch));

  // Прочитано?
  const reads = visible.length
    ? await prisma.announcementRead.findMany({
        where: { userId: req.user.id, announcementId: { in: visible.map((a) => a.id) } },
        select: { announcementId: true, readAt: true },
      })
    : [];
  const readMap = new Map(reads.map((r) => [r.announcementId, ms(r.readAt)]));

  res.json(visible.map((a) => serializeAnnouncement(a, readMap)));
}));

// GET /api/announcements/:id
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const a = await prisma.announcement.findUnique({
    where: { id: req.params.id },
    include: { author: { select: { id: true, name: true } } },
  });
  if (!a) return res.status(404).json({ error: 'Не знайдено' });

  if (!canManage(req.user)) {
    const userLocs = await prisma.userLocation.findMany({
      where: { userId: req.user.id, approved: true }, select: { locationId: true },
    });
    const userForMatch = { roles: req.user.roles || [], locations: userLocs.map((l) => ({ locationId: l.locationId, approved: true })) };
    if (!matchesUser(a, userForMatch)) return res.status(403).json({ error: 'Недоступно' });
  }

  const read = await prisma.announcementRead.findUnique({
    where: { announcementId_userId: { announcementId: a.id, userId: req.user.id } },
  }).catch(() => null);
  res.json(serializeAnnouncement(a, new Map(read ? [[a.id, ms(read.readAt)]] : [])));
}));

// POST /api/announcements
router.post('/', requireAuth, requirePermission('content.publish_digest'), wrap(async (req, res) => {
  const v = validatePayload(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });

  const created = await prisma.announcement.create({
    data: { ...v.data, authorId: req.user.id },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'announcement.created', 'announcement', created.id, {
    title: created.title, category: created.category, priority: created.priority,
  });
  // Async fire-and-forget. Помилки notify() не валять відповідь.
  notifyAnnouncement(created, req.user).catch(() => {});
  res.json(serializeAnnouncement(created));
}));

// PATCH /api/announcements/:id
router.patch('/:id', requireAuth, requirePermission('content.publish_digest'), wrap(async (req, res) => {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  const v = validatePayload({
    title: req.body?.title ?? existing.title,
    body: req.body?.body ?? existing.body,
    category: req.body?.category ?? existing.category,
    priority: req.body?.priority ?? existing.priority,
    targetRoles: req.body?.targetRoles ?? existing.targetRoles,
    targetLocations: req.body?.targetLocations ?? existing.targetLocations,
    expiresAt: 'expiresAt' in (req.body || {}) ? req.body.expiresAt : existing.expiresAt,
    pinned: 'pinned' in (req.body || {}) ? req.body.pinned : existing.pinned,
  });
  if (v.error) return res.status(400).json({ error: v.error });

  const updated = await prisma.announcement.update({
    where: { id: req.params.id }, data: v.data,
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'announcement.updated', 'announcement', updated.id, v.data);
  res.json(serializeAnnouncement(updated));
}));

// DELETE /api/announcements/:id
router.delete('/:id', requireAuth, requirePermission('content.publish_digest'), wrap(async (req, res) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'announcement.deleted', 'announcement', req.params.id);
  res.json({ ok: true });
}));

// POST /api/announcements/:id/read — позначити прочитаним
router.post('/:id/read', requireAuth, wrap(async (req, res) => {
  const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!ann) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: ann.id, userId: req.user.id } },
    update: {},
    create: { announcementId: ann.id, userId: req.user.id },
  });
  res.json({ ok: true });
}));

export default router;
