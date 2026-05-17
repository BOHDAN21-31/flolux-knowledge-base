import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { serializeArticle, serializeComment, serializeSuggestion } from '../serialize.js';

const router = Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

const normalizeTags = (tags) => {
  if (tags === undefined) return undefined;
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// GET /api/articles?topicId=X
router.get('/', requireAuth, wrap(async (req, res) => {
  const where = req.query.topicId ? { topicId: String(req.query.topicId) } : {};
  const articles = await prisma.article.findMany({
    where,
    include: { author: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(articles.map(serializeArticle));
}));

// GET /api/articles/:id — стаття з коментарями та пропозиціями
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    include: {
      author: true,
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      suggestions: { include: { author: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });
  res.json({
    ...serializeArticle(article),
    comments: article.comments.map(serializeComment),
    suggestions: article.suggestions.map(serializeSuggestion),
  });
}));

// POST /api/articles
router.post('/', requireAuth, wrap(async (req, res) => {
  if (!req.user.approved && req.user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Акаунт ще не підтверджено' });
  }
  const { topicId, section, title, content } = req.body || {};
  if (!topicId || !title || !content) {
    return res.status(400).json({ error: 'Потрібні topicId, title і content' });
  }
  const article = await prisma.article.create({
    data: {
      topicId,
      section: section || (String(topicId).startsWith('tc-') ? 'tech' : 'role'),
      title,
      content,
      tags: normalizeTags(req.body.tags) || [],
      authorId: req.user.id,
    },
    include: { author: true },
  });
  res.json(serializeArticle(article));
}));

// PATCH /api/articles/:id — автор або admin
router.patch('/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Статтю не знайдено' });
  if (existing.authorId !== req.user.id && req.user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Немає прав на редагування' });
  }
  const data = {};
  if (req.body?.title !== undefined) data.title = req.body.title;
  if (req.body?.content !== undefined) data.content = req.body.content;
  const tags = normalizeTags(req.body?.tags);
  if (tags !== undefined) data.tags = tags;

  const article = await prisma.article.update({
    where: { id: req.params.id },
    data,
    include: { author: true },
  });
  res.json(serializeArticle(article));
}));

// DELETE /api/articles/:id — автор або admin
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Статтю не знайдено' });
  if (existing.authorId !== req.user.id && req.user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Немає прав на видалення' });
  }
  await prisma.article.delete({ where: { id: req.params.id } });
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
