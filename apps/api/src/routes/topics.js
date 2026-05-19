import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { wrap, logAction, isAdmin, roleList, restrictedRoleKeys } from '../lib.js';

const router = Router();

const serialize = (t) => ({
  id: t.id,
  roleKey: t.roleKey,
  title: t.title,
  description: t.description,
  icon: t.icon || null,
});

// GET /api/topics?role=florist
router.get('/', requireAuth, wrap(async (req, res) => {
  const where = req.query.role ? { roleKey: String(req.query.role) } : {};
  const topics = await prisma.topic.findMany({ where, orderBy: { id: 'asc' } });
  let list = topics;
  if (!isAdmin(req.user)) {
    const restricted = await restrictedRoleKeys();
    const mine = new Set(roleList(req.user));
    list = topics.filter((t) => !restricted.has(t.roleKey) || mine.has(t.roleKey));
  }
  res.json(list.map(serialize));
}));

// POST /api/topics  { id, roleKey, title, description, icon }
router.post('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { id, roleKey, title, description, icon } = req.body || {};
  if (!id || !roleKey || !title) {
    return res.status(400).json({ error: 'Потрібні id, roleKey і title' });
  }
  const topic = await prisma.topic.create({
    data: { id, roleKey, title, description: description || '', icon: icon || null },
  });
  await logAction(req.user.id, 'topic.created', 'topic', topic.id, { roleKey, title });
  res.json(serialize(topic));
}));

// PATCH /api/topics/:id  { title, description, icon } — admin
router.patch('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const data = {};
  if (req.body?.title !== undefined) data.title = String(req.body.title);
  if (req.body?.description !== undefined) data.description = String(req.body.description);
  if (req.body?.icon !== undefined) data.icon = req.body.icon || null;
  const topic = await prisma.topic.update({ where: { id: req.params.id }, data });
  await logAction(req.user.id, 'topic.updated', 'topic', topic.id, data);
  res.json(serialize(topic));
}));

// DELETE /api/topics/:id
router.delete('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  await prisma.topic.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'topic.deleted', 'topic', req.params.id);
  res.json({ ok: true });
}));

export default router;
