import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasPermission, requirePermission } from '../permissions.js';
import { serializeArticle } from '../serialize.js';
import { wrap, logAction } from '../lib.js';
import { notifyDigest } from '../services/notifications.js';

const router = Router();

const DIGEST_TOPIC = 'hr-digests';
const articleInclude = { author: true, locations: { include: { location: true } } };

export const DIGEST_CATEGORIES = ['company_news', 'welcome', 'achievement', 'process_change', 'important_date'];
const normalizeCategory = (v) => (DIGEST_CATEGORIES.includes(v) ? v : null);

// GET /api/digests — усі бачать опубліковані; HR/admin — усі. ?category= для фільтра.
router.get('/', requireAuth, wrap(async (req, res) => {
  const canSeeDrafts = hasPermission(req.user, 'content.publish_digest');
  const where = { isDigest: true };
  if (!canSeeDrafts) {
    where.status = 'published';
    where.OR = [{ publishAt: null }, { publishAt: { lte: new Date() } }];
  }
  const cat = normalizeCategory(req.query.category);
  if (cat) where.digestCategory = cat;

  const items = await prisma.article.findMany({
    where, include: articleInclude, orderBy: { createdAt: 'desc' },
  });
  res.json(items.map(serializeArticle));
}));

// POST /api/digests — створити дайджест (HR/admin)
router.post('/', requireAuth, requirePermission('content.publish_digest'), wrap(async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Потрібні title і content' });

  // Гарантуємо наявність топіка дайджестів
  await prisma.topic.upsert({
    where: { id: DIGEST_TOPIC },
    update: {},
    create: { id: DIGEST_TOPIC, roleKey: 'hr', title: 'Дайджести компанії', description: 'Загальнокорпоративні новини' },
  });

  const tags = typeof req.body.tags === 'string'
    ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : (Array.isArray(req.body.tags) ? req.body.tags : []);
  const mediaUrls = Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls.filter((x) => typeof x === 'string') : [];
  const locationIds = Array.isArray(req.body.locationIds) ? req.body.locationIds.filter((x) => typeof x === 'string') : [];
  const isDraft = req.body.status === 'draft';
  const digestCategory = normalizeCategory(req.body.digestCategory);

  const article = await prisma.article.create({
    data: {
      topicId: DIGEST_TOPIC,
      section: 'role',
      title,
      content,
      tags,
      mediaUrls,
      authorId: req.user.id,
      isDigest: true,
      digestCategory,
      status: isDraft ? 'draft' : 'published',
      locations: { create: locationIds.map((locationId) => ({ locationId })) },
    },
    include: articleInclude,
  });

  await logAction(req.user.id, 'digest.created', 'article', article.id, { title, draft: isDraft, category: digestCategory });
  if (!isDraft) await notifyDigest(article, req.user);
  res.json(serializeArticle(article));
}));

// PATCH /api/digests/:id — оновити (тільки категорію через цей роут, для решти — звичайні article-роутирути)
router.patch('/:id', requireAuth, requirePermission('content.publish_digest'), wrap(async (req, res) => {
  const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!existing || !existing.isDigest) return res.status(404).json({ error: 'Дайджест не знайдено' });

  const data = {};
  if ('digestCategory' in (req.body || {})) {
    data.digestCategory = normalizeCategory(req.body.digestCategory);
  }
  if (Object.keys(data).length === 0) return res.json(serializeArticle(existing));

  const updated = await prisma.article.update({
    where: { id: req.params.id }, data, include: articleInclude,
  });
  await logAction(req.user.id, 'digest.updated', 'article', updated.id, data);
  res.json(serializeArticle(updated));
}));

export default router;
