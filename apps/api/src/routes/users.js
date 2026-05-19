import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { wrap, logAction, roleList, isAdmin, restrictedRoleKeys } from '../lib.js';
import { serializeArticle } from '../serialize.js';

const router = Router();

async function fullProfile(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      locations: { include: { location: true }, orderBy: { createdAt: 'asc' } },
      locationReqs: { include: { location: true }, orderBy: { createdAt: 'desc' } },
      webauthn: true,
      roles: true,
    },
  });
  if (!u) return null;
  return {
    ...publicUser(u),
    locations: u.locations.map((ul) => ({
      locationId: ul.locationId,
      name: ul.location.name,
      slug: ul.location.slug,
      color: ul.location.color || null,
      isManager: ul.isManager,
      approved: ul.approved,
    })),
    locationRequests: u.locationReqs
      .filter((r) => r.status === 'pending')
      .map((r) => ({ id: r.id, locationId: r.locationId, locationName: r.location.name, status: r.status })),
    webauthn: u.webauthn.map((w) => ({
      id: w.id,
      deviceName: w.deviceName || 'Пристрій',
      createdAt: w.createdAt.getTime(),
    })),
  };
}

// GET /api/users/me
router.get('/me', requireAuth, wrap(async (req, res) => {
  res.json(await fullProfile(req.user.id));
}));

// PATCH /api/users/me { name, surname, email, phone, avatarUrl }
router.patch('/me', requireAuth, wrap(async (req, res) => {
  const data = {};
  if (req.body?.name !== undefined) {
    if (!String(req.body.name).trim()) return res.status(400).json({ error: 'Імʼя не може бути порожнім' });
    data.name = String(req.body.name).trim();
  }
  if (req.body?.surname !== undefined) data.surname = req.body.surname || null;
  if (req.body?.phone !== undefined) data.phone = req.body.phone || null;
  if (req.body?.avatarUrl !== undefined) data.avatarUrl = req.body.avatarUrl || null;
  if (req.body?.email !== undefined) {
    const email = String(req.body.email).toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'E-mail не може бути порожнім' });
    const other = await prisma.user.findUnique({ where: { email } });
    if (other && other.id !== req.user.id) return res.status(400).json({ error: 'E-mail вже зайнятий' });
    data.email = email;
  }
  await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(await fullProfile(req.user.id));
}));

// POST /api/users/me/password { currentPassword, newPassword }
router.post('/me/password', requireAuth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Заповніть усі поля' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'Новий пароль мінімум 6 символів' });
  const ok = await bcrypt.compare(String(currentPassword), req.user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Поточний пароль невірний' });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: await bcrypt.hash(String(newPassword), 10) },
  });
  res.json({ ok: true });
}));

// DELETE /api/users/me/webauthn/:id
router.delete('/me/webauthn/:id', requireAuth, wrap(async (req, res) => {
  const cred = await prisma.webAuthnCredential.findUnique({ where: { id: req.params.id } });
  if (!cred || cred.userId !== req.user.id) return res.status(404).json({ error: 'Пристрій не знайдено' });
  await prisma.webAuthnCredential.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// POST /api/users/me/locations/request { locationId }
router.post('/me/locations/request', requireAuth, wrap(async (req, res) => {
  const { locationId } = req.body || {};
  if (!locationId) return res.status(400).json({ error: 'Вкажіть locationId' });
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) return res.status(404).json({ error: 'Локацію не знайдено' });

  const existingMember = await prisma.userLocation.findUnique({
    where: { userId_locationId: { userId: req.user.id, locationId } },
  });
  if (existingMember?.approved) return res.status(400).json({ error: 'Ви вже на цій локації' });

  const pending = await prisma.locationRequest.findFirst({
    where: { userId: req.user.id, locationId, status: 'pending' },
  });
  if (pending) return res.status(400).json({ error: 'Запит уже надіслано й очікує розгляду' });

  const created = await prisma.locationRequest.create({
    data: { userId: req.user.id, locationId, status: 'pending' },
  });
  res.json({ id: created.id, locationId, status: created.status });
}));

// DELETE /api/users/me/locations/:locationId — користувач сам відкріплює локацію
router.delete('/me/locations/:locationId', requireAuth, wrap(async (req, res) => {
  const { count } = await prisma.userLocation.deleteMany({
    where: { userId: req.user.id, locationId: req.params.locationId },
  });
  if (count === 0) return res.status(404).json({ error: 'Локацію не знайдено серед ваших' });
  // Прибираємо й застряглі pending-запити на цю локацію
  await prisma.locationRequest.deleteMany({
    where: { userId: req.user.id, locationId: req.params.locationId, status: 'pending' },
  });
  await logAction(req.user.id, 'user.location_left', 'location', req.params.locationId);
  res.json({ ok: true });
}));

// GET /api/users/me/bookmarks — закладки поточного користувача
router.get('/me/bookmarks', requireAuth, wrap(async (req, res) => {
  const rows = await prisma.bookmark.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { article: { select: { id: true, title: true, topicId: true, content: true, createdAt: true } } },
  });
  res.json(rows
    .filter((b) => b.article)
    .map((b) => ({
      id: b.article.id,
      title: b.article.title,
      topicId: b.article.topicId,
      excerpt: String(b.article.content || '').replace(/[*#>`]/g, '').slice(0, 140),
      createdAt: b.article.createdAt.getTime(),
      bookmarkedAt: b.createdAt.getTime(),
    })));
}));

// GET /api/users/me/birthday
router.get('/me/birthday', requireAuth, wrap(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { birthday: true } });
  res.json({ birthday: u?.birthday ? u.birthday.toISOString().slice(0, 10) : null });
}));

// ===== Telegram прив'язка =====
router.get('/me/telegram', requireAuth, wrap(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { telegramChatId: true, telegramUsername: true, telegramLinkedAt: true },
  });
  res.json({
    linked: !!u?.telegramChatId,
    username: u?.telegramUsername || null,
    linkedAt: u?.telegramLinkedAt ? u.telegramLinkedAt.getTime() : null,
  });
}));

router.post('/me/telegram/generate-code', requireAuth, wrap(async (req, res) => {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 символів
  await prisma.user.update({ where: { id: req.user.id }, data: { telegramLinkCode: code } });
  res.json({ code, botUsername: 'Flolux_Librarybot' });
}));

router.delete('/me/telegram', requireAuth, wrap(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { telegramChatId: null, telegramUsername: null, telegramLinkCode: null, telegramLinkedAt: null },
  });
  res.json({ ok: true });
}));

const PREF_FIELDS = [
  'newArticleAll', 'newArticleMyRole', 'newArticleMyLocation', 'comments',
  'suggestions', 'suggestionApproved', 'birthdays', 'digests', 'roleChanges', 'locationChanges',
  'telegramEnabled',
];

// GET /api/users/me/notification-preferences (створює дефолт якщо немає)
router.get('/me/notification-preferences', requireAuth, wrap(async (req, res) => {
  const pref = await prisma.notificationPreference.upsert({
    where: { userId: req.user.id },
    update: {},
    create: { userId: req.user.id },
  });
  res.json(pref);
}));

// PATCH /api/users/me/notification-preferences
router.patch('/me/notification-preferences', requireAuth, wrap(async (req, res) => {
  const data = {};
  for (const f of PREF_FIELDS) {
    if (req.body?.[f] !== undefined) data[f] = !!req.body[f];
  }
  const pref = await prisma.notificationPreference.upsert({
    where: { userId: req.user.id },
    update: data,
    create: { userId: req.user.id, ...data },
  });
  res.json(pref);
}));

// GET /api/users/:id/activity — хронологічна стрічка дій користувача
router.get('/:id/activity', requireAuth, wrap(async (req, res) => {
  const uid = req.params.id;
  const [articles, comments, suggestions] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: uid },
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: uid },
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, createdAt: true, article: { select: { id: true, title: true } } },
    }),
    prisma.suggestion.findMany({
      where: { authorId: uid },
      orderBy: { createdAt: 'desc' }, take: 10,
      include: { ratings: true, article: { select: { id: true, title: true } } },
    }),
  ]);

  const items = [
    ...articles.map((a) => ({
      type: 'article', at: a.createdAt.getTime(),
      articleId: a.id, articleTitle: a.title,
    })),
    ...comments.filter((c) => c.article).map((c) => ({
      type: 'comment', at: c.createdAt.getTime(),
      articleId: c.article.id, articleTitle: c.article.title,
    })),
    ...suggestions.filter((s) => s.article).map((s) => {
      const cnt = s.ratings.length;
      const avg = cnt ? Math.round((s.ratings.reduce((x, r) => x + r.rating, 0) / cnt) * 10) / 10 : 0;
      return {
        type: 'suggestion', at: s.createdAt.getTime(),
        articleId: s.article.id, articleTitle: s.article.title,
        ratingAvg: avg, ratingCount: cnt,
      };
    }),
  ].sort((a, b) => b.at - a.at).slice(0, 30);

  res.json(items);
}));

// GET /api/users/:id/public — публічна картка користувача
router.get('/:id/public', requireAuth, wrap(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { roles: true },
  });
  if (!u) return res.status(404).json({ error: 'Користувача не знайдено' });

  const [articlesCount, commentsCount, suggestionsCount] = await Promise.all([
    prisma.article.count({ where: { authorId: u.id } }),
    prisma.comment.count({ where: { authorId: u.id } }),
    prisma.suggestion.count({ where: { authorId: u.id } }),
  ]);

  res.json({
    id: u.id,
    name: u.name,
    surname: u.surname || null,
    avatarUrl: u.avatarUrl || null,
    rating: u.rating ?? 0,
    roles: roleList(u),
    createdAt: u.createdAt instanceof Date ? u.createdAt.getTime() : u.createdAt,
    articlesCount,
    commentsCount,
    suggestionsCount,
  });
}));

// GET /api/users/me/home-data — один запит замість 5–6 для HomeView
router.get('/me/home-data', requireAuth, wrap(async (req, res) => {
  const uid = req.user.id;
  const admin = isAdmin(req.user);
  const now = new Date();
  const inc = { author: true, locations: { include: { location: true } } };

  const [draftRows, bookmarkRows, digestRows, bdUsers, viewGroups] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: uid, status: 'draft' },
      orderBy: { createdAt: 'desc' }, take: 12,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.bookmark.findMany({
      where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 12,
      include: { article: { select: { id: true, title: true, content: true, createdAt: true } } },
    }),
    prisma.article.findMany({
      where: admin ? { isDigest: true } : { isDigest: true, status: 'published', OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      orderBy: { createdAt: 'desc' }, take: 4, include: inc,
    }),
    prisma.user.findMany({
      where: { birthday: { not: null } },
      select: { id: true, name: true, surname: true, avatarUrl: true, birthday: true },
    }),
    prisma.articleView.groupBy({
      by: ['articleId'], where: { viewedAt: { gte: new Date(Date.now() - 30 * 864e5) } },
      _count: { _all: true }, orderBy: { _count: { articleId: 'desc' } }, take: 60,
    }),
  ]);

  // Найпопулярніші — з повагою до прав
  const counts = Object.fromEntries(viewGroups.map((g) => [g.articleId, g._count._all]));
  let popular = [];
  if (viewGroups.length) {
    const where = { id: { in: viewGroups.map((g) => g.articleId) } };
    if (!admin) {
      const links = await prisma.userLocation.findMany({ where: { userId: uid, approved: true }, select: { locationId: true } });
      const locIds = links.map((l) => l.locationId);
      where.AND = [
        { OR: [{ locations: { none: {} } }, { locations: { some: { locationId: { in: locIds } } } }] },
        { status: 'published', OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      ];
    }
    const arts = await prisma.article.findMany({ where, include: { ...inc, topic: { select: { roleKey: true } } } });
    let list = arts;
    if (!admin) {
      const restricted = await restrictedRoleKeys();
      const mine = new Set(roleList(req.user));
      list = arts.filter((a) => { const rk = a.topic?.roleKey; return !rk || !restricted.has(rk) || mine.has(rk); });
    }
    popular = list
      .map((a) => ({ ...serializeArticle(a), viewsCount: counts[a.id] || 0 }))
      .sort((a, b) => b.viewsCount - a.viewsCount).slice(0, 8);
  }

  const m = now.getMonth();
  const d = now.getDate();
  const bdCard = (u, extra = {}) => ({
    id: u.id, name: `${u.name}${u.surname ? ' ' + u.surname : ''}`,
    avatarUrl: u.avatarUrl || null, ...extra,
  });
  const birthdaysToday = bdUsers.filter((u) => {
    const b = new Date(u.birthday); return b.getMonth() === m && b.getDate() === d;
  }).map((u) => bdCard(u));
  const startToday = new Date(now.getFullYear(), m, d);
  const birthdaysUpcoming = bdUsers.map((u) => {
    const b = new Date(u.birthday);
    let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < startToday) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    return { u, diff: Math.round((next - startToday) / 864e5) };
  }).filter((x) => x.diff > 0 && x.diff <= 7).sort((a, b) => a.diff - b.diff)
    .map((x) => bdCard(x.u, { inDays: x.diff }));

  res.json({
    drafts: draftRows.map((a) => ({ id: a.id, title: a.title, status: 'draft', createdAt: a.createdAt.getTime() })),
    bookmarks: bookmarkRows.filter((b) => b.article).map((b) => ({
      id: b.article.id, title: b.article.title,
      excerpt: String(b.article.content || '').replace(/[*#>`]/g, '').slice(0, 140),
      createdAt: b.article.createdAt.getTime(),
    })),
    popular,
    digests: digestRows.map(serializeArticle),
    birthdaysToday,
    birthdaysUpcoming,
  });
}));

export default router;
