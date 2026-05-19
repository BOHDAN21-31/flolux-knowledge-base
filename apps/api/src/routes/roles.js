import { Router } from 'express';
import { prisma } from '../db.js';
import { wrap } from '../lib.js';

const router = Router();

export const serializeRole = (r, counts) => ({
  key: r.key,
  name: r.name,
  description: r.description || null,
  iconKey: r.iconKey || null,
  color: r.color || null,
  protected: !!r.protected,
  restricted: !!r.restricted,
  userCount: counts?.users?.[r.key] || 0,
  topicCount: counts?.topics?.[r.key] || 0,
});

// GET /api/roles — усі ролі з лічильниками користувачів і розділів
// (публічно: потрібні й на екрані реєстрації).
router.get('/', wrap(async (req, res) => {
  const [roles, userGroups, topicGroups] = await Promise.all([
    prisma.role.findMany({ orderBy: [{ protected: 'desc' }, { name: 'asc' }] }),
    prisma.userRole.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.topic.groupBy({ by: ['roleKey'], _count: { _all: true } }),
  ]);
  const counts = {
    users: Object.fromEntries(userGroups.map((g) => [g.role, g._count._all])),
    topics: Object.fromEntries(topicGroups.map((g) => [g.roleKey, g._count._all])),
  };
  res.json(roles.map((r) => serializeRole(r, counts)));
}));

export default router;
