import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { serializeSuggestion } from '../serialize.js';

const router = Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// GET /api/suggestions?status=pending — для модерації (admin)
router.get('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const where = req.query.status ? { status: String(req.query.status) } : {};
  const suggestions = await prisma.suggestion.findMany({
    where,
    include: { author: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suggestions.map(serializeSuggestion));
}));

// PATCH /api/suggestions/:id  { status: "approved" | "rejected" } — admin
router.patch('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Невідомий статус' });
  }
  const suggestion = await prisma.suggestion.update({
    where: { id: req.params.id },
    data: { status },
    include: { author: true },
  });
  res.json(serializeSuggestion(suggestion));
}));

export default router;
