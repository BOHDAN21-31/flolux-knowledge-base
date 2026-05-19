import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();

const card = (u) => ({
  id: u.id,
  name: `${u.name}${u.surname ? ' ' + u.surname : ''}`,
  avatarUrl: u.avatarUrl || null,
  birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
});

// GET /api/birthdays/today
router.get('/today', requireAuth, wrap(async (req, res) => {
  const now = new Date();
  const m = now.getMonth();
  const d = now.getDate();
  const users = await prisma.user.findMany({
    where: { birthday: { not: null } },
    select: { id: true, name: true, surname: true, avatarUrl: true, birthday: true },
  });
  res.json(users.filter((u) => {
    const b = new Date(u.birthday);
    return b.getMonth() === m && b.getDate() === d;
  }).map(card));
}));

// GET /api/birthdays/upcoming?days=7
router.get('/upcoming', requireAuth, wrap(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60);
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { birthday: { not: null } },
    select: { id: true, name: true, surname: true, avatarUrl: true, birthday: true },
  });
  const within = users
    .map((u) => {
      const b = new Date(u.birthday);
      const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        next.setFullYear(now.getFullYear() + 1);
      }
      const diff = Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      return { u, diff };
    })
    .filter((x) => x.diff >= 0 && x.diff <= days)
    .sort((a, b) => a.diff - b.diff)
    .map((x) => ({ ...card(x.u), inDays: x.diff }));
  res.json(within);
}));

export default router;
