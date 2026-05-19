import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { serializeArticle, serializeComment, serializeSuggestion } from '../serialize.js';
import { wrap, isAdmin, logAction, roleList, restrictedRoleKeys } from '../lib.js';
import { notifyNewArticle, notifyComment, notifySuggestion, checkScheduledPublishing } from '../services/notifications.js';

const asJsonArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : undefined);

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

// Видимість у загальних списках: НЕ чернетка і час публікації настав.
// Чернетки/незаплановані не показуємо навіть автору в "Моя бібліотека"
// (автор бачить їх окремо через ?status=draft та GET /:id).
function statusVisibility() {
  return {
    status: 'published',
    OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
  };
}

// Нормалізація status/publishAt для POST/PATCH.
// status тепер тільки 'draft' | 'published'. Запланована = published з майбутнім publishAt.
function normalizePublication(body) {
  const out = {};
  const hasPublishAt = body?.publishAt !== undefined;
  const pa = hasPublishAt && body.publishAt ? new Date(body.publishAt) : null;
  const future = pa && !Number.isNaN(pa.getTime()) && pa.getTime() > Date.now();
  if (body?.status === 'draft') {
    out.status = 'draft';
    out.publishAt = null;
  } else if (future) {
    out.status = 'published';
    out.publishAt = pa;
  } else if (body?.status !== undefined || hasPublishAt) {
    out.status = 'published';
    out.publishAt = null;
  }
  return out;
}

// GET /api/articles?topicId=X&roleKey=a,b&locationId=x,y&q=...&sort=new|old|az|rating
router.get('/', requireAuth, wrap(async (req, res) => {
  await checkScheduledPublishing(); // лінивий планувальник (throttled 60с)
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

  // Фільтрація за статусом публікації
  const statusQ = String(req.query.status || '');
  if (statusQ === 'draft') {
    // лише власні чернетки
    where.AND = [...(where.AND || []), { authorId: req.user.id, status: 'draft' }];
  } else if (!isAdmin(req.user)) {
    // звичайний список: опубліковані (час настав) або власні
    where.AND = [...(where.AND || []), statusVisibility()];
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

// GET /api/articles/popular?limit=10 — топ за переглядами за 30 днів
// (оголошено ДО /:id, інакше "popular" матчиться як :id)
router.get('/popular', requireAuth, wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 30);
  const since = new Date(Date.now() - 30 * 864e5);
  const grouped = await prisma.articleView.groupBy({
    by: ['articleId'],
    where: { viewedAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { articleId: 'desc' } },
    take: 100,
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.articleId, g._count._all]));
  const ids = grouped.map((g) => g.articleId);
  if (ids.length === 0) return res.json([]);

  const where = { id: { in: ids } };
  if (!isAdmin(req.user)) {
    const locIds = await approvedLocationIds(req.user.id);
    where.AND = [
      { OR: [{ locations: { none: {} } }, { locations: { some: { locationId: { in: locIds } } } }] },
      statusVisibility(),
    ];
  }
  const articles = await prisma.article.findMany({
    where,
    include: { ...articleInclude, topic: { select: { roleKey: true } } },
  });
  let list = articles;
  if (!isAdmin(req.user)) {
    const restricted = await restrictedRoleKeys();
    const mine = new Set(roleList(req.user));
    list = articles.filter((a) => {
      const rk = a.topic?.roleKey;
      return !rk || !restricted.has(rk) || mine.has(rk);
    });
  }
  const out = list
    .map((a) => ({ ...serializeArticle(a), viewsCount: counts[a.id] || 0 }))
    .sort((a, b) => b.viewsCount - a.viewsCount)
    .slice(0, limit);
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

  const isAuthor = article.authorId === req.user.id;
  const adminUser = isAdmin(req.user);
  // Чернетку / незаплановану-ще бачить лише автор або admin
  const notLive = article.status === 'draft'
    || (article.publishAt && new Date(article.publishAt).getTime() > Date.now());
  if (notLive && !isAuthor && !adminUser) {
    return res.status(404).json({ error: 'Статтю не знайдено' });
  }

  if (!adminUser) {
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

  const [viewsCount, myView] = await Promise.all([
    prisma.articleView.count({ where: { articleId: article.id } }),
    prisma.articleView.findUnique({
      where: { articleId_userId: { articleId: article.id, userId: req.user.id } },
    }),
  ]);

  // Список переглядачів — admin / автор / керівник локації статті
  let canSeeViewers = adminUser || isAuthor;
  if (!canSeeViewers && article.locations.length > 0) {
    const mgr = await prisma.userLocation.findFirst({
      where: {
        userId: req.user.id,
        isManager: true,
        locationId: { in: article.locations.map((al) => al.locationId) },
      },
    });
    canSeeViewers = !!mgr;
  }
  let viewers = [];
  if (canSeeViewers) {
    const rows = await prisma.articleView.findMany({
      where: { articleId: article.id },
      orderBy: { viewedAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, name: true, surname: true, avatarUrl: true } } },
    });
    viewers = rows.map((v) => ({
      id: v.user.id,
      name: `${v.user.name}${v.user.surname ? ' ' + v.user.surname : ''}`,
      avatarUrl: v.user.avatarUrl || null,
      viewedAt: v.viewedAt.getTime(),
    }));
  }

  res.json({
    ...serializeArticle(article),
    comments: article.comments.map(serializeComment),
    suggestions,
    bookmarked,
    viewsCount,
    viewedByMe: !!myView,
    viewers,
  });
}));

// POST /api/articles/:id/view — фіксує унікальний перегляд
router.post('/:id/view', requireAuth, wrap(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: 'Статтю не знайдено' });
  await prisma.articleView.upsert({
    where: { articleId_userId: { articleId: req.params.id, userId: req.user.id } },
    update: {},
    create: { articleId: req.params.id, userId: req.user.id },
  });
  const viewsCount = await prisma.articleView.count({ where: { articleId: req.params.id } });
  res.json({ ok: true, viewsCount });
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

  const pub = normalizePublication(req.body);
  const notifyMode = ['all', 'roles', 'locations'].includes(req.body?.notifyMode) ? req.body.notifyMode : null;
  const notifyTargets = notifyMode === 'all' ? [] : (asJsonArray(req.body?.notifyTargets) || []);
  const article = await prisma.article.create({
    data: {
      topicId,
      section: section || (String(topicId).startsWith('tc-') ? 'tech' : 'role'),
      title,
      content,
      tags: normalizeTags(req.body.tags) || [],
      mediaUrls,
      authorId: req.user.id,
      status: pub.status || 'published',
      publishAt: pub.publishAt ?? null,
      notifyMode,
      notifyTargets: notifyMode ? notifyTargets : undefined,
      locations: { create: locationIds.map((locationId) => ({ locationId })) },
    },
    include: articleInclude,
  });
  // Оповіщаємо лише якщо стаття вже "жива" (published і час настав).
  // Запланована (майбутній publishAt) — оповіститься планувальником пізніше.
  const liveNow = article.status === 'published'
    && (!article.publishAt || new Date(article.publishAt).getTime() <= Date.now());
  if (liveNow && article.notifyMode) {
    try { await notifyNewArticle(article, req.user); } catch (e) { console.error('[POST /articles] notify failed', e); }
    await prisma.article.update({ where: { id: article.id }, data: { notifiedAt: new Date() } });
  }
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
  if (req.body?.status !== undefined || req.body?.publishAt !== undefined) {
    const pub = normalizePublication(req.body);
    if (pub.status !== undefined) data.status = pub.status;
    if (pub.publishAt !== undefined) data.publishAt = pub.publishAt;
  }

  if (req.body?.notifyMode !== undefined) {
    const nm = ['all', 'roles', 'locations'].includes(req.body.notifyMode) ? req.body.notifyMode : null;
    data.notifyMode = nm;
    data.notifyTargets = nm && nm !== 'all' ? (asJsonArray(req.body?.notifyTargets) || []) : (nm === 'all' ? [] : undefined);
  }

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

  // Перехід у "живий" стан → оповістити (одноразово, якщо ще не оповіщено)
  const wasLive = (existing.status || 'published') === 'published'
    && (!existing.publishAt || new Date(existing.publishAt).getTime() <= Date.now());
  const nowLive = article.status === 'published'
    && (!article.publishAt || new Date(article.publishAt).getTime() <= Date.now());
  if (!wasLive && nowLive && article.notifyMode && !article.notifiedAt) {
    try { await notifyNewArticle(article, req.user); } catch (e) { console.error('[PATCH /articles] notify failed', e); }
    await prisma.article.update({ where: { id: article.id }, data: { notifiedAt: new Date() } });
  }
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
  await notifyComment(article, req.user);
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
  await notifySuggestion(article, req.user);
  res.json(serializeSuggestion(suggestion));
}));

export default router;
