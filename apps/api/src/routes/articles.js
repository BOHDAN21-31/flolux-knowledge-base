import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { serializeArticle, serializeComment, serializeSuggestion } from '../serialize.js';
import { wrap, isAdmin, logAction } from '../lib.js';

const router = Router();

const articleInclude = {
  author: true,
  locations: { include: { location: true } },
};

const normalizeTags = (tags) => {
  if (tags === undefined) return undefined;
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

const asStringArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : undefined);

async function approvedLocationIds(userId) {
  const links = await prisma.userLocation.findMany({
    where: { userId, approved: true },
    select: { locationId: true },
  });
  return links.map((l) => l.locationId);
}

// GET /api/articles?topicId=X — фільтр за локаціями користувача (admin бачить усе)
router.get('/', requireAuth, wrap(async (req, res) => {
  const where = {};
  if (req.query.topicId) where.topicId = String(req.query.topicId);

  if (!isAdmin(req.user)) {
    const locIds = await approvedLocationIds(req.user.id);
    where.OR = [
      { locations: { none: {} } }, // глобальна стаття
      { locations: { some: { locationId: { in: locIds } } } },
    ];
  }

  const articles = await prisma.article.findMany({
    where,
    include: articleInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(articles.map(serializeArticle));
}));

// GET /api/articles/:id — стаття з коментарями та пропозиціями
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    include: {
      ...articleInclude,
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      suggestions: { include: { author: true, ratings: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });

  // Перевірка доступу за локаціями (admin — завжди)
  if (!isAdmin(req.user) && article.locations.length > 0) {
    const locIds = await approvedLocationIds(req.user.id);
    const visible = article.locations.some((al) => locIds.includes(al.locationId));
    if (!visible) return res.status(403).json({ error: 'Стаття недоступна для ваших локацій' });
  }

  // Сортування пропозицій: за рейтингом desc -> за датою desc
  const suggestions = article.suggestions
    .map((s) => serializeSuggestion(s, req.user.id))
    .sort((a, b) => b.ratingAvg - a.ratingAvg || b.createdAt - a.createdAt);

  res.json({
    ...serializeArticle(article),
    comments: article.comments.map(serializeComment),
    suggestions,
  });
}));

// POST /api/articles { topicId, section, title, content, tags, locationIds, mediaUrls }
router.post('/', requireAuth, wrap(async (req, res) => {
  if (!req.user.approved && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Акаунт ще не підтверджено' });
  }
  const { topicId, section, title, content } = req.body || {};
  if (!topicId || !title || !content) {
    return res.status(400).json({ error: 'Потрібні topicId, title і content' });
  }
  const locationIds = asStringArray(req.body?.locationIds) || [];
  const mediaUrls = asStringArray(req.body?.mediaUrls) || [];

  const article = await prisma.article.create({
    data: {
      topicId,
      section: section || (String(topicId).startsWith('tc-') ? 'tech' : 'role'),
      title,
      content,
      tags: normalizeTags(req.body.tags) || [],
      mediaUrls,
      authorId: req.user.id,
      locations: { create: locationIds.map((locationId) => ({ locationId })) },
    },
    include: articleInclude,
  });
  res.json(serializeArticle(article));
}));

// PATCH /api/articles/:id — автор або admin
router.patch('/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Статтю не знайдено' });
  if (existing.authorId !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Немає прав на редагування' });
  }
  const data = {};
  if (req.body?.title !== undefined) data.title = req.body.title;
  if (req.body?.content !== undefined) data.content = req.body.content;
  const tags = normalizeTags(req.body?.tags);
  if (tags !== undefined) data.tags = tags;
  const mediaUrls = asStringArray(req.body?.mediaUrls);
  if (mediaUrls !== undefined) data.mediaUrls = mediaUrls;

  const locationIds = asStringArray(req.body?.locationIds);
  if (locationIds !== undefined) {
    data.locations = {
      deleteMany: {},
      create: locationIds.map((locationId) => ({ locationId })),
    };
  }

  const article = await prisma.article.update({
    where: { id: req.params.id },
    data,
    include: articleInclude,
  });
  res.json(serializeArticle(article));
}));

// DELETE /api/articles/:id — автор або admin
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Статтю не знайдено' });
  if (existing.authorId !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Немає прав на видалення' });
  }
  await prisma.article.delete({ where: { id: req.params.id } });
  if (isAdmin(req.user)) {
    await logAction(req.user.id, 'article.deleted', 'article', req.params.id, { title: existing.title });
  }
  res.json({ ok: true });
}));

// POST /api/articles/:id/comments
router.post('/:id/comments', requireAuth, wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Порожній коментар' });
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });
  const comment = await prisma.comment.create({
    data: { articleId: req.params.id, authorId: req.user.id, content },
    include: { author: true },
  });
  res.json(serializeComment(comment));
}));

// POST /api/articles/:id/suggestions
router.post('/:id/suggestions', requireAuth, wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Порожня пропозиція' });
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });
  const suggestion = await prisma.suggestion.create({
    data: { articleId: req.params.id, authorId: req.user.id, content, status: 'pending' },
    include: { author: true },
  });
  res.json(serializeSuggestion(suggestion));
}));

export default router;
