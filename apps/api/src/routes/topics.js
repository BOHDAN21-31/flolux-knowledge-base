import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

const serialize = (t) => ({ id: t.id, roleKey: t.roleKey, title: t.title, description: t.description });

// GET /api/topics?role=florist
router.get('/', requireAuth, wrap(async (req, res) => {
  const where = req.query.role ? { roleKey: String(req.query.role) } : {};
  const topics = await prisma.topic.findMany({ where, orderBy: { id: 'asc' } });
  res.json(topics.map(serialize));
}));

// POST /api/topics  { id, roleKey, title, description }
router.post('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { id, roleKey, title, description } = req.body || {};
  if (!id || !roleKey || !title) {
    return res.status(400).json({ error: 'Потрібні id, roleKey і title' });
  }
  const topic = await prisma.topic.create({
    data: { id, roleKey, title, description: description || '' },
  });
  res.json(serialize(topic));
}));

// DELETE /api/topics/:id
router.delete('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  await prisma.topic.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default router;
