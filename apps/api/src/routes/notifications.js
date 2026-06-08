import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { wrap } from '../lib.js';
import { checkBirthdays, checkOneOnOneReminders } from '../services/notifications.js';

const router = Router();

const serialize = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body || null,
  linkPath: n.linkPath || null,
  metadata: n.metadata || null,
  readAt: n.readAt ? n.readAt.getTime() : null,
  createdAt: n.createdAt.getTime(),
  actor: n.actor ? { id: n.actor.id, name: n.actor.name, avatarUrl: n.actor.avatarUrl || null } : null,
});

// GET /api/notifications?limit=20&before=<ms>&filter=unread
router.get('/', requireAuth, wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const where = { recipientId: req.user.id };
  if (req.query.filter === 'unread') where.readAt = null;
  if (req.query.before) {
    const ms = Number(req.query.before);
    if (!Number.isNaN(ms)) where.createdAt = { lt: new Date(ms) };
  }
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(serialize);
  res.json({ items, nextCursor: hasMore ? items[items.length - 1].createdAt : null });
}));

// GET /api/notifications/unread-count (+ ледача перевірка ДН раз на день)
router.get('/unread-count', requireAuth, wrap(async (req, res) => {
  await checkBirthdays();
  checkOneOnOneReminders().catch(() => {});
  const count = await prisma.notification.count({
    where: { recipientId: req.user.id, readAt: null },
  });
  res.json({ count });
}));

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, wrap(async (req, res) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n || n.recipientId !== req.user.id) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.notification.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, wrap(async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
}));

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n || n.recipientId !== req.user.id) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default router;
