import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { wrap, isSenior } from '../lib.js';

const router = Router();

export const serializeLocation = (l, userCount) => ({
  id: l.id,
  name: l.name,
  slug: l.slug,
  color: l.color || null,
  city: l.city || null,
  address: l.address || null,
  active: l.active !== false,
  userCount: userCount ?? l._count?.users ?? 0,
});

// GET /api/locations — список (auth), з кількістю підтверджених працівників
router.get('/', requireAuth, wrap(async (req, res) => {
  const locations = await prisma.location.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }] });
  const counts = await prisma.userLocation.groupBy({
    by: ['locationId'],
    where: { approved: true },
    _count: { _all: true },
  });
  const byId = Object.fromEntries(counts.map((c) => [c.locationId, c._count._all]));
  res.json(locations.map((l) => serializeLocation(l, byId[l.id] || 0)));
}));

// GET /api/locations/:id/users — працівники локації
// видно senior=admin|hr (read-only) або підтвердженому учаснику цієї локації
router.get('/:id/users', requireAuth, wrap(async (req, res) => {
  if (!isSenior(req.user)) {
    const member = await prisma.userLocation.findUnique({
      where: { userId_locationId: { userId: req.user.id, locationId: req.params.id } },
    });
    if (!member || !member.approved) {
      return res.status(403).json({ error: 'Немає доступу до працівників цієї локації' });
    }
  }
  const links = await prisma.userLocation.findMany({
    where: { locationId: req.params.id },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(links.map((ul) => ({
    userLocationId: ul.id,
    userId: ul.userId,
    name: ul.user.name,
    surname: ul.user.surname || null,
    avatarUrl: ul.user.avatarUrl || null,
    assignedRole: ul.user.assignedRole || null,
    isManager: ul.isManager,
    approved: ul.approved,
  })));
}));

export default router;
