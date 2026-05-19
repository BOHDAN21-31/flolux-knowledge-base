import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { wrap, isAdmin, roleList, restrictedRoleKeys } from '../lib.js';
import { hasPermission } from '../permissions.js';

const router = Router();

// GET /api/search?q=... — глобальний пошук (auth), по 5 на тип, з повагою прав
router.get('/', requireAuth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ articles: [], users: [], locations: [], topics: [] });
  const like = { contains: q, mode: 'insensitive' };

  const [restricted, mineRoles] = await Promise.all([
    restrictedRoleKeys(),
    Promise.resolve(new Set(roleList(req.user))),
  ]);
  const admin = isAdmin(req.user);
  const viewAll = hasPermission(req.user, 'content.view_all');
  const viewRestricted = hasPermission(req.user, 'content.view_restricted');
  const liveOnly = { status: 'published', OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] };

  let locIds = [];
  if (!viewAll) {
    const links = await prisma.userLocation.findMany({
      where: { userId: req.user.id, approved: true }, select: { locationId: true },
    });
    locIds = links.map((l) => l.locationId);
  }

  const [articlesRaw, users, locations, topicsRaw] = await Promise.all([
    prisma.article.findMany({
      where: {
        OR: [{ title: like }, { content: like }],
        ...(admin ? {} : viewAll ? { AND: [liveOnly] } : {
          AND: [
            { OR: [{ locations: { none: {} } }, { locations: { some: { locationId: { in: locIds } } } }] },
            liveOnly,
          ],
        }),
      },
      include: { topic: { select: { roleKey: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.user.findMany({
      where: { OR: [{ name: like }, { surname: like }, { email: like }] },
      include: { roles: true },
      orderBy: { name: 'asc' },
      take: 5,
    }),
    prisma.location.findMany({
      where: { OR: [{ name: like }, { city: like }, { address: like }] },
      orderBy: { name: 'asc' },
      take: 5,
    }),
    prisma.topic.findMany({
      where: { OR: [{ title: like }, { description: like }] },
      orderBy: { title: 'asc' },
      take: 25,
    }),
  ]);

  const allowedRole = (rk) => viewRestricted || !rk || !restricted.has(rk) || mineRoles.has(rk);

  const articles = articlesRaw
    .filter((a) => allowedRole(a.topic?.roleKey))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: String(a.content || '').replace(/[*#>`]/g, '').slice(0, 60),
    }));

  const topics = topicsRaw
    .filter((t) => allowedRole(t.roleKey))
    .slice(0, 5)
    .map((t) => ({ id: t.id, title: t.title, roleKey: t.roleKey }));

  res.json({
    articles,
    topics,
    users: users.map((u) => ({
      id: u.id,
      name: `${u.name}${u.surname ? ' ' + u.surname : ''}`,
      roles: roleList(u),
    })),
    locations: locations.map((l) => ({ id: l.id, name: l.name, city: l.city || null })),
  });
}));

export default router;
