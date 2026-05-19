import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireSenior } from '../auth.js';
import { serializeSuggestion } from '../serialize.js';
import { wrap, logAction } from '../lib.js';
import { notifySuggestionApproved } from '../services/notifications.js';

const router = Router();

// GET /api/suggestions?status=pending — для модерації (senior=admin|hr), за рейтингом
router.get('/', requireAuth, requireSenior, wrap(async (req, res) => {
  const where = req.query.status ? { status: String(req.query.status) } : {};
  const suggestions = await prisma.suggestion.findMany({
    where,
    include: { author: true, ratings: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    suggestions
      .map((s) => serializeSuggestion(s, req.user.id))
      .sort((a, b) => b.ratingAvg - a.ratingAvg || b.createdAt - a.createdAt)
  );
}));

// GET /api/suggestions/:id — одна пропозиція з рейтингом (auth)
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const s = await prisma.suggestion.findUnique({
    where: { id: req.params.id },
    include: { author: true, ratings: true },
  });
  if (!s) return res.status(404).json({ error: 'Пропозицію не знайдено' });
  res.json(serializeSuggestion(s, req.user.id));
}));

// POST /api/suggestions/:id/rate { rating } — будь-хто авторизований, upsert
router.post('/:id/rate', requireAuth, wrap(async (req, res) => {
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Оцінка має бути цілим числом 1..5' });
  }
  const suggestion = await prisma.suggestion.findUnique({ where: { id: req.params.id } });
  if (!suggestion) return res.status(404).json({ error: 'Пропозицію не знайдено' });

  await prisma.suggestionRating.upsert({
    where: { suggestionId_userId: { suggestionId: req.params.id, userId: req.user.id } },
    update: { rating },
    create: { suggestionId: req.params.id, userId: req.user.id, rating },
  });

  // Рейтинг автора пропозиції = кількість отриманих оцінок 4–5 зірок
  const author = await prisma.user.findUnique({
    where: { id: suggestion.authorId },
    include: { suggestions: { include: { ratings: true } } },
  });
  if (author) {
    const totalGoodRatings = author.suggestions.reduce(
      (sum, s) => sum + s.ratings.filter((r) => r.rating >= 4).length,
      0,
    );
    await prisma.user.update({ where: { id: author.id }, data: { rating: totalGoodRatings } });
  }

  const updated = await prisma.suggestion.findUnique({
    where: { id: req.params.id },
    include: { author: true, ratings: true },
  });
  res.json(serializeSuggestion(updated, req.user.id));
}));

// PATCH /api/suggestions/:id  { status } — senior=admin|hr (actorId логуємо)
router.patch('/:id', requireAuth, requireSenior, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Невідомий статус' });
  }
  const suggestion = await prisma.suggestion.update({
    where: { id: req.params.id },
    data: { status },
    include: { author: true, ratings: true },
  });
  await logAction(req.user.id, 'suggestion.' + status, 'suggestion', suggestion.id, { articleId: suggestion.articleId });
  if (status === 'approved') await notifySuggestionApproved(suggestion, req.user.id);
  res.json(serializeSuggestion(suggestion, req.user.id));
}));

export default router;
