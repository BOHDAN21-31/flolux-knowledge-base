import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { serializeArticle, serializeComment, serializeSuggestion } from '../serialize.js';
import { wrap, isAdmin, logAction, roleList, restrictedRoleKeys } from '../lib.js';

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

// GET /api/articles?topicId=X&roleKey=a,b&locationId=x,y&q=...&sort=new|old|az|rating
router.get('/', requireAuth, wrap(async (req, res) => {
  const csv = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const where = {};
  if (req.query.topicId) where.topicId = String(req.query.topicId);

  const roleKeyFilter = csv(req.query.roleKey);
  if (roleKeyFilter.length) where.topic = { roleKey: { in: roleKeyFilter } };

  const locFilter = csv(req.query.locationId);
  if (locFilter.length) where.locations = { some: { locationId: { in: locFilter } } };

  const q = String(req.query.q || '').trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
    ];
  }

  // Контроль доступу за локаціями (admin бачить усе). AND із фільтрами вище.
  if (!isAdmin(req.user)) {
    const locIds = await approvedLocationIds(req.user.id);
    where.AND = [
      ...(where.AND || []),
      { OR: [{ locations: { none: {} } }, { locations: { some: { locationId: { in: locIds } } } }] },
    ];
  }

  const sort = String(req.query.sort || 'new');
  const orderBy = sort === 'old' ? { createdAt: 'asc' }
    : sort === 'az' ? { title: 'asc' }
    : { createdAt: 'desc' }; // 'new' (default) і 'rating' (досорт нижче)

  const articles = await prisma.article.findMany({
    where,
    include: {
      ...articleInclude,
      topic: { select: { roleKey: true } },
      suggestions: { select: { ratings: { select: { rating: true } } } },
    },
    orderBy,
  });

  // P6: приховати статті обмежених ролей від тих, кому роль не призначена
  let list = articles;
  if (!isAdmin(req.user)) {
    const restricted = await restrictedRoleKeys();
    const mine = new Set(roleList(req.user));
    list = articles.filter((a) => {
      const rk = a.topic?.roleKey;
      return !rk || !restricted.has(rk) || mine.has(rk);
    });
  }

  let out = list.map(serializeArticle);
  if (sort === 'rating') out = out.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0) || b.createdAt - a.createdAt);
  res.json(out);
}));

// GET /api/articles/:id — стаття з коментарями та пропозиціями
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    include: {
      ...articleInclude,
      topic: { select: { roleKey: true } },
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      suggestions: { include: { author: true, ratings: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });

  if (!isAdmin(req.user)) {
    // Перевірка доступу за локаціями
    if (article.locations.length > 0) {
      const locIds = await approvedLocationIds(req.user.id);
      const visible = article.locations.some((al) => locIds.includes(al.locationId));
      if (!visible) return res.status(403).json({ error: 'Стаття недоступна для ваших локацій' });
    }
    // P6: обмежена роль — лише явно призначеним
    const rk = article.topic?.roleKey;
    if (rk) {
      const restricted = await restrictedRoleKeys();
      if (restricted.has(rk) && !roleList(req.user).includes(rk)) {
        return res.status(403).json({ error: 'Стаття доступна лише для відповідної ролі' });
      }
    }
  }

  // Сортування пропозицій: за рейтингом desc -> за датою desc
  const suggestions = article.suggestions
    .map((s) => serializeSuggestion(s, req.user.id))
    .sort((a, b) => b.ratingAvg - a.ratingAvg || b.createdAt - a.createdAt);

  const bookmarked = !!(await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId: req.user.id, articleId: article.id } },
  }));

  res.json({
    ...serializeArticle(article),
    comments: article.comments.map(serializeComment),
    suggestions,
    bookmarked,
  });
}));

// POST /api/articles/:id/bookmark — toggle закладки
router.post('/:id/bookmark', requireAuth, wrap(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });
  const where = { userId_articleId: { userId: req.user.id, articleId: req.params.id } };
  const existing = await prisma.bookmark.findUnique({ where });
  if (existing) {
    await prisma.bookmark.delete({ where });
    return res.json({ bookmarked: false });
  }
  await prisma.bookmark.create({ data: { userId: req.user.id, articleId: req.params.id } });
  res.json({ bookmarked: true });
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
