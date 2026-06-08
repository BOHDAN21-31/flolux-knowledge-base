import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasPermission } from '../permissions.js';
import { wrap, logAction, isAdmin, roleList } from '../lib.js';
import {
  notifyOneOnOneScheduled,
  notifyOneOnOneRescheduled,
  notifyOneOnOneCancelled,
  notifyOneOnOneCompleted,
} from '../services/notifications.js';

const router = Router();

export const OO_STATUS = ['scheduled', 'completed', 'cancelled', 'rescheduled'];
export const EMPLOYMENT_STATUS = ['employed', 'intern', 'probation', 'former'];

const ms = (d) => (d instanceof Date ? d.getTime() : (d ?? null));

// HR/admin (через право content.publish_digest) АБО прямий керівник цього employee
function canOrganizeFor(actor, employee) {
  if (isAdmin(actor)) return true;
  if (hasPermission(actor, 'content.publish_digest')) return true; // HR-level
  if (employee?.supervisorId && employee.supervisorId === actor.id) return true;
  return false;
}
// HR/admin — для перегляду всіх
const isHrLevel = (u) => isAdmin(u) || hasPermission(u, 'content.publish_digest');

function publicUserCard(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, surname: u.surname || null, avatarUrl: u.avatarUrl || null };
}

// Серіалізація з контекстом — приховуємо HR-notes від employee
function serializeOO(oo, viewerId, viewerIsHr) {
  const isEmployee = viewerId === oo.employeeId;
  const isOrganizer = viewerId === oo.organizerId;
  const canSeeNotes = viewerIsHr || isOrganizer; // HR/organizer
  return {
    id: oo.id,
    employeeId: oo.employeeId,
    organizerId: oo.organizerId,
    employee: publicUserCard(oo.employee),
    organizer: publicUserCard(oo.organizer),
    scheduledAt: ms(oo.scheduledAt),
    duration: oo.duration,
    location: oo.location || null,
    agenda: oo.agenda || null,
    notes: canSeeNotes ? (oo.notes || null) : null, // employee НЕ бачить HR-нотатки
    employeeNotes: (isEmployee || canSeeNotes) ? (oo.employeeNotes || null) : null,
    status: oo.status,
    outcome: oo.outcome || null,
    createdAt: ms(oo.createdAt),
    updatedAt: ms(oo.updatedAt),
    canEdit: viewerIsHr || isOrganizer,
  };
}

// ── GET /api/one-on-ones/me ── мої зустрічі (як employee і як organizer)
router.get('/me', requireAuth, wrap(async (req, res) => {
  const where = {
    OR: [{ employeeId: req.user.id }, { organizerId: req.user.id }],
  };
  if (req.query.status && OO_STATUS.includes(req.query.status)) {
    where.status = req.query.status;
  }
  if (req.query.upcoming === 'true') {
    where.scheduledAt = { gte: new Date() };
    where.status = where.status || 'scheduled';
  }
  const list = await prisma.oneOnOne.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
    orderBy: { scheduledAt: req.query.upcoming === 'true' ? 'asc' : 'desc' },
  });
  const viewerIsHr = isHrLevel(req.user);
  res.json(list.map((o) => serializeOO(o, req.user.id, viewerIsHr)));
}));

// ── GET /api/one-on-ones/admin ── HR/admin — всі зустрічі
router.get('/admin', requireAuth, wrap(async (req, res) => {
  if (!isHrLevel(req.user)) return res.status(403).json({ error: 'Доступ заборонено' });
  const where = {};
  if (req.query.employeeId) where.employeeId = String(req.query.employeeId);
  if (req.query.organizerId) where.organizerId = String(req.query.organizerId);
  if (req.query.status && OO_STATUS.includes(req.query.status)) where.status = req.query.status;
  if (req.query.upcoming === 'true') where.scheduledAt = { gte: new Date() };
  const list = await prisma.oneOnOne.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 200,
  });
  res.json(list.map((o) => serializeOO(o, req.user.id, true)));
}));

// ── GET /api/one-on-ones/:id ──
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const oo = await prisma.oneOnOne.findUnique({
    where: { id: req.params.id },
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
  });
  if (!oo) return res.status(404).json({ error: 'Не знайдено' });
  const viewerIsHr = isHrLevel(req.user);
  if (!viewerIsHr && oo.employeeId !== req.user.id && oo.organizerId !== req.user.id) {
    return res.status(404).json({ error: 'Не знайдено' });
  }
  res.json(serializeOO(oo, req.user.id, viewerIsHr));
}));

// ── POST /api/one-on-ones ──
router.post('/', requireAuth, wrap(async (req, res) => {
  const { employeeId, scheduledAt } = req.body || {};
  if (!employeeId || !scheduledAt) return res.status(400).json({ error: 'Потрібні employeeId і scheduledAt' });

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) return res.status(404).json({ error: 'Працівника не знайдено' });
  if (!canOrganizeFor(req.user, employee)) return res.status(403).json({ error: 'Доступ заборонено' });

  const at = new Date(scheduledAt);
  if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'Невірна дата' });

  const oo = await prisma.oneOnOne.create({
    data: {
      employeeId,
      organizerId: req.body.organizerId || req.user.id,
      scheduledAt: at,
      duration: parseInt(req.body.duration, 10) || 30,
      location: req.body.location || null,
      agenda: req.body.agenda || null,
      status: 'scheduled',
    },
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
  });
  await logAction(req.user.id, 'oneonone.created', 'oneonone', oo.id, { employeeId });
  notifyOneOnOneScheduled(oo).catch(() => {});
  res.json(serializeOO(oo, req.user.id, isHrLevel(req.user)));
}));

// ── PATCH /api/one-on-ones/:id ──
router.patch('/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.oneOnOne.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });

  const viewerIsHr = isHrLevel(req.user);
  const isOrganizer = existing.organizerId === req.user.id;
  const isEmployee = existing.employeeId === req.user.id;
  const canFullEdit = viewerIsHr || isOrganizer;

  const data = {};
  // Employee може редагувати тільки employeeNotes
  if (req.body?.employeeNotes !== undefined) {
    if (!(isEmployee || canFullEdit)) return res.status(403).json({ error: 'Доступ заборонено' });
    data.employeeNotes = req.body.employeeNotes || null;
  }
  // Решта — лише HR/organizer
  if (canFullEdit) {
    if (req.body?.scheduledAt !== undefined) {
      const at = new Date(req.body.scheduledAt);
      if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'Невірна дата' });
      data.scheduledAt = at;
    }
    if (req.body?.duration !== undefined) data.duration = parseInt(req.body.duration, 10) || 30;
    if (req.body?.location !== undefined) data.location = req.body.location || null;
    if (req.body?.agenda !== undefined) data.agenda = req.body.agenda || null;
    if (req.body?.notes !== undefined) data.notes = req.body.notes || null;
    if (req.body?.status !== undefined && OO_STATUS.includes(req.body.status)) data.status = req.body.status;
    if (req.body?.outcome !== undefined) data.outcome = req.body.outcome || null;
  } else if (Object.keys(data).length === 0) {
    return res.status(403).json({ error: 'Доступ заборонено' });
  }

  const updated = await prisma.oneOnOne.update({
    where: { id: req.params.id }, data,
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
  });
  await logAction(req.user.id, 'oneonone.updated', 'oneonone', updated.id, Object.keys(data));

  // Сповіщення при зміні часу
  if (data.scheduledAt && existing.scheduledAt.getTime() !== data.scheduledAt.getTime()) {
    notifyOneOnOneRescheduled(updated, existing.scheduledAt).catch(() => {});
  }
  res.json(serializeOO(updated, req.user.id, viewerIsHr));
}));

// ── POST /api/one-on-ones/:id/complete ──
router.post('/:id/complete', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.oneOnOne.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  if (!(isHrLevel(req.user) || existing.organizerId === req.user.id)) {
    return res.status(403).json({ error: 'Доступ заборонено' });
  }
  const updated = await prisma.oneOnOne.update({
    where: { id: req.params.id },
    data: {
      status: 'completed',
      notes: req.body?.notes !== undefined ? (req.body.notes || null) : undefined,
      outcome: req.body?.outcome || null,
    },
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
  });
  await logAction(req.user.id, 'oneonone.completed', 'oneonone', updated.id, { outcome: req.body?.outcome });
  notifyOneOnOneCompleted(updated).catch(() => {});
  res.json(serializeOO(updated, req.user.id, isHrLevel(req.user)));
}));

// ── DELETE /api/one-on-ones/:id ── soft cancel
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.oneOnOne.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  if (!(isHrLevel(req.user) || existing.organizerId === req.user.id)) {
    return res.status(403).json({ error: 'Доступ заборонено' });
  }
  const updated = await prisma.oneOnOne.update({
    where: { id: req.params.id }, data: { status: 'cancelled' },
    include: {
      employee: { select: { id: true, name: true, surname: true, avatarUrl: true } },
      organizer: { select: { id: true, name: true, surname: true, avatarUrl: true } },
    },
  });
  await logAction(req.user.id, 'oneonone.cancelled', 'oneonone', updated.id);
  notifyOneOnOneCancelled(updated).catch(() => {});
  res.json({ ok: true });
}));

export default router;
