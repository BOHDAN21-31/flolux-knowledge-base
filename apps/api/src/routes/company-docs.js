import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasPermission, requirePermission } from '../permissions.js';
import { wrap, logAction, roleList } from '../lib.js';
import { notifyDocPublished, notifyDocAckReminder } from '../services/notifications.js';

const router = Router();

export const DOC_CATEGORIES = ['conduct', 'schedule', 'communication', 'policies'];

const ms = (d) => (d instanceof Date ? d.getTime() : (d ?? null));

// Право на керування документами — admin або hr (через content.publish_digest).
// Документи — критичні регуляторні матеріали, тому використовуємо те ж право,
// що й для дайджестів (HR-level).
const canManageDocs = (u) => hasPermission(u, 'content.publish_digest');
const requireManage = requirePermission('content.publish_digest');

// Чи цей документ обов'язковий для юзера.
// Якщо обидва списки порожні — НЕ обов'язковий (інформативний).
// Якщо хоч один заповнено — обов'язковий для тих, хто збігається або за роллю, АБО за локацією.
function isMandatoryFor(doc, userRoles, userLocationIds) {
  const hasRoles = (doc.mandatoryForRoles || []).length > 0;
  const hasLocs = (doc.mandatoryForLocations || []).length > 0;
  if (!hasRoles && !hasLocs) return false;
  if (hasRoles && doc.mandatoryForRoles.some((r) => userRoles.includes(r))) return true;
  if (hasLocs && doc.mandatoryForLocations.some((l) => userLocationIds.includes(l))) return true;
  return false;
}

const serializeDoc = (d, extra = {}) => ({
  id: d.id,
  slug: d.slug,
  title: d.title,
  description: d.description || null,
  category: d.category,
  iconKey: d.iconKey || null,
  color: d.color || null,
  currentVersion: d.currentVersion,
  publishedAt: ms(d.publishedAt),
  isPublished: !!d.publishedAt,
  mandatoryForRoles: d.mandatoryForRoles || [],
  mandatoryForLocations: d.mandatoryForLocations || [],
  authorId: d.authorId || null,
  authorName: d.author?.name || null,
  createdAt: ms(d.createdAt),
  updatedAt: ms(d.updatedAt),
  ...extra,
});

const serializeSection = (s) => ({
  id: s.id,
  docId: s.docId,
  parentId: s.parentId || null,
  title: s.title,
  body: s.body || '',
  orderIdx: s.orderIdx,
  level: s.level,
  createdAt: ms(s.createdAt),
});

// Знімок sections (плоский масив, ієрархію відновимо за parentId/orderIdx).
async function snapshotSections(docId) {
  const sections = await prisma.docSection.findMany({
    where: { docId }, orderBy: [{ level: 'asc' }, { orderIdx: 'asc' }],
  });
  return sections.map((s) => ({
    id: s.id, parentId: s.parentId, title: s.title, body: s.body,
    orderIdx: s.orderIdx, level: s.level,
  }));
}

// Створює DocVersion(currentVersion) як snapshot ПЕРЕД редагуванням.
// Викликати у точках, де admin/hr змінює sections опублікованого документа.
async function ensureVersionSnapshot(docId, actorId, note) {
  const doc = await prisma.companyDoc.findUnique({ where: { id: docId } });
  if (!doc) return null;
  const existing = await prisma.docVersion.findUnique({
    where: { docId_version: { docId, version: doc.currentVersion } },
  });
  if (existing) return existing;
  const snap = await snapshotSections(docId);
  return prisma.docVersion.create({
    data: {
      docId, version: doc.currentVersion, snapshot: snap,
      changedBy: actorId || null, changeNote: note || null,
    },
  });
}

async function userLocationIds(userId) {
  const rows = await prisma.userLocation.findMany({
    where: { userId, approved: true }, select: { locationId: true },
  });
  return rows.map((r) => r.locationId);
}

// ── GET /api/docs — список доступних користувачу ──
// Не-manage: лише опубліковані. Mandatory + isRead обчислюється на льоту.
router.get('/', requireAuth, wrap(async (req, res) => {
  const manage = canManageDocs(req.user);
  const where = manage ? {} : { publishedAt: { not: null } };
  if (req.query.category && DOC_CATEGORIES.includes(req.query.category)) {
    where.category = req.query.category;
  }
  const docs = await prisma.companyDoc.findMany({
    where, orderBy: [{ category: 'asc' }, { title: 'asc' }],
    include: { author: { select: { id: true, name: true } } },
  });
  const roles = roleList(req.user);
  const locIds = await userLocationIds(req.user.id);
  const acks = docs.length
    ? await prisma.docAcknowledgement.findMany({
        where: { userId: req.user.id, docId: { in: docs.map((d) => d.id) } },
        orderBy: { acknowledgedAt: 'desc' },
      })
    : [];
  // Найновіший ack кожного юзера на документ
  const ackByDoc = new Map();
  for (const a of acks) {
    if (!ackByDoc.has(a.docId)) ackByDoc.set(a.docId, a);
  }
  res.json(docs.map((d) => {
    const isMandatory = isMandatoryFor(d, roles, locIds);
    const ack = ackByDoc.get(d.id) || null;
    const isRead = !!ack;
    const needsReack = !!ack && ack.versionAcknowledged < d.currentVersion;
    return serializeDoc(d, { isMandatory, isRead, needsReack, lastAckAt: ms(ack?.acknowledgedAt) });
  }));
}));

// ── GET /api/docs/me/mandatory-unread ── (для онбординг-карти на HomeView)
router.get('/me/mandatory-unread', requireAuth, wrap(async (req, res) => {
  const docs = await prisma.companyDoc.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { updatedAt: 'desc' },
  });
  const roles = roleList(req.user);
  const locIds = await userLocationIds(req.user.id);
  const acks = docs.length
    ? await prisma.docAcknowledgement.findMany({
        where: { userId: req.user.id, docId: { in: docs.map((d) => d.id) } },
        orderBy: { acknowledgedAt: 'desc' },
      })
    : [];
  const latestByDoc = new Map();
  for (const a of acks) if (!latestByDoc.has(a.docId)) latestByDoc.set(a.docId, a);
  const unread = docs
    .filter((d) => isMandatoryFor(d, roles, locIds))
    .filter((d) => {
      const a = latestByDoc.get(d.id);
      return !a || a.versionAcknowledged < d.currentVersion;
    })
    .map((d) => {
      const a = latestByDoc.get(d.id);
      return serializeDoc(d, { isMandatory: true, isRead: !!a, needsReack: !!a && a.versionAcknowledged < d.currentVersion });
    });
  res.json(unread);
}));

// ── GET /api/docs/:slug ──
router.get('/:slug', requireAuth, wrap(async (req, res) => {
  const doc = await prisma.companyDoc.findUnique({
    where: { slug: req.params.slug },
    include: {
      author: { select: { id: true, name: true } },
      sections: { orderBy: [{ level: 'asc' }, { orderIdx: 'asc' }] },
    },
  });
  if (!doc) return res.status(404).json({ error: 'Документ не знайдено' });
  if (!doc.publishedAt && !canManageDocs(req.user)) {
    return res.status(403).json({ error: 'Документ ще не опубліковано' });
  }
  const roles = roleList(req.user);
  const locIds = await userLocationIds(req.user.id);
  const isMandatory = isMandatoryFor(doc, roles, locIds);
  const ack = await prisma.docAcknowledgement.findFirst({
    where: { docId: doc.id, userId: req.user.id },
    orderBy: { acknowledgedAt: 'desc' },
  });
  res.json({
    ...serializeDoc(doc, {
      isMandatory,
      isRead: !!ack,
      lastAckAt: ms(ack?.acknowledgedAt),
      lastAckVersion: ack?.versionAcknowledged || null,
      needsReack: !!ack && ack.versionAcknowledged < doc.currentVersion,
    }),
    sections: (doc.sections || []).map(serializeSection),
  });
}));

// ── POST /api/docs ──
router.post('/', requireAuth, requireManage, wrap(async (req, res) => {
  const { slug, title, category } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'Потрібні slug і title' });
  if (!DOC_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Невірна категорія' });
  const existing = await prisma.companyDoc.findUnique({ where: { slug } });
  if (existing) return res.status(409).json({ error: 'Документ з таким slug вже існує' });
  const doc = await prisma.companyDoc.create({
    data: {
      slug: String(slug).trim(),
      title: String(title).trim(),
      description: req.body.description || null,
      category,
      iconKey: req.body.iconKey || null,
      color: req.body.color || null,
      mandatoryForRoles: Array.isArray(req.body.mandatoryForRoles) ? req.body.mandatoryForRoles : [],
      mandatoryForLocations: Array.isArray(req.body.mandatoryForLocations) ? req.body.mandatoryForLocations : [],
      authorId: req.user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'doc.created', 'doc', doc.id, { title, slug });
  res.json(serializeDoc(doc));
}));

// ── PATCH /api/docs/:id ── (мета-дані)
router.patch('/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const existing = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  const data = {};
  if (req.body.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.category !== undefined) {
    if (!DOC_CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'Невірна категорія' });
    data.category = req.body.category;
  }
  if (req.body.iconKey !== undefined) data.iconKey = req.body.iconKey || null;
  if (req.body.color !== undefined) data.color = req.body.color || null;
  if (req.body.mandatoryForRoles !== undefined) {
    data.mandatoryForRoles = Array.isArray(req.body.mandatoryForRoles) ? req.body.mandatoryForRoles : [];
  }
  if (req.body.mandatoryForLocations !== undefined) {
    data.mandatoryForLocations = Array.isArray(req.body.mandatoryForLocations) ? req.body.mandatoryForLocations : [];
  }
  const doc = await prisma.companyDoc.update({
    where: { id: req.params.id }, data,
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'doc.updated', 'doc', doc.id, data);
  res.json(serializeDoc(doc));
}));

// ── DELETE /api/docs/:id — лише admin ──
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  if (!hasPermission(req.user, 'system.manage_topics')) {
    return res.status(403).json({ error: 'Доступ лише для адміністратора' });
  }
  const existing = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.companyDoc.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'doc.deleted', 'doc', req.params.id, { title: existing.title });
  res.json({ ok: true });
}));

// ── POST /api/docs/:id/publish ──
router.post('/:id/publish', requireAuth, requireManage, wrap(async (req, res) => {
  const existing = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  const wasPublished = !!existing.publishedAt;
  const doc = await prisma.companyDoc.update({
    where: { id: req.params.id },
    data: { publishedAt: new Date() },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'doc.published', 'doc', doc.id, { firstPublish: !wasPublished });
  // Fire-and-forget сповіщення обов'язковим
  notifyDocPublished(doc, req.user, !wasPublished).catch(() => {});
  res.json(serializeDoc(doc));
}));

// ── POST /api/docs/:id/unpublish ──
router.post('/:id/unpublish', requireAuth, requireManage, wrap(async (req, res) => {
  const doc = await prisma.companyDoc.update({
    where: { id: req.params.id }, data: { publishedAt: null },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'doc.unpublished', 'doc', doc.id);
  res.json(serializeDoc(doc));
}));

// ── POST /api/docs/:id/version ── створює знімок поточного стану і бампить currentVersion
router.post('/:id/version', requireAuth, requireManage, wrap(async (req, res) => {
  const existing = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  const note = String(req.body?.changeNote || '').slice(0, 500);
  await ensureVersionSnapshot(existing.id, req.user.id, note);
  const doc = await prisma.companyDoc.update({
    where: { id: req.params.id },
    data: { currentVersion: existing.currentVersion + 1 },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'doc.new_version', 'doc', doc.id, { version: doc.currentVersion, note });
  if (doc.publishedAt) notifyDocPublished(doc, req.user, false).catch(() => {});
  res.json(serializeDoc(doc));
}));

// ── GET /api/docs/:id/versions ──
router.get('/:id/versions', requireAuth, requireManage, wrap(async (req, res) => {
  const versions = await prisma.docVersion.findMany({
    where: { docId: req.params.id }, orderBy: { version: 'desc' },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json(versions.map((v) => ({
    id: v.id, version: v.version, changeNote: v.changeNote || null,
    changedBy: v.changedBy || null, changedByName: v.user?.name || null,
    createdAt: ms(v.createdAt),
  })));
}));

// ── GET /api/docs/:id/versions/:version — повний знімок ──
router.get('/:id/versions/:version', requireAuth, requireManage, wrap(async (req, res) => {
  const ver = await prisma.docVersion.findUnique({
    where: { docId_version: { docId: req.params.id, version: parseInt(req.params.version, 10) } },
  });
  if (!ver) return res.status(404).json({ error: 'Версію не знайдено' });
  res.json({ version: ver.version, snapshot: ver.snapshot, createdAt: ms(ver.createdAt) });
}));

// ── POST /api/docs/:id/sections ──
router.post('/:id/sections', requireAuth, requireManage, wrap(async (req, res) => {
  const doc = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Документ не знайдено' });
  const level = Math.max(1, Math.min(3, parseInt(req.body?.level, 10) || 1));
  // Якщо вказано parentId — підняти level до parent.level + 1.
  let parentId = req.body?.parentId || null;
  let actualLevel = level;
  if (parentId) {
    const parent = await prisma.docSection.findUnique({ where: { id: parentId } });
    if (!parent || parent.docId !== doc.id) return res.status(400).json({ error: 'Невірний parent' });
    actualLevel = Math.min(3, parent.level + 1);
  }
  // Останній orderIdx у межах parent
  const last = await prisma.docSection.findFirst({
    where: { docId: doc.id, parentId }, orderBy: { orderIdx: 'desc' }, select: { orderIdx: true },
  });
  const orderIdx = (last?.orderIdx ?? -1) + 1;
  const section = await prisma.docSection.create({
    data: {
      docId: doc.id,
      parentId,
      title: String(req.body?.title || 'Без назви').slice(0, 200),
      body: req.body?.body || null,
      orderIdx,
      level: actualLevel,
    },
  });
  res.json(serializeSection(section));
}));

// ── PATCH /api/docs/sections/:id ──
router.patch('/sections/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const data = {};
  if (req.body?.title !== undefined) data.title = String(req.body.title).slice(0, 200);
  if (req.body?.body !== undefined) data.body = req.body.body || null;
  const section = await prisma.docSection.update({ where: { id: req.params.id }, data });
  res.json(serializeSection(section));
}));

// ── DELETE /api/docs/sections/:id ──
router.delete('/sections/:id', requireAuth, requireManage, wrap(async (req, res) => {
  await prisma.docSection.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ── POST /api/docs/:id/sections/reorder ── {sectionOrders:[{id, orderIdx, parentId?}]}
router.post('/:id/sections/reorder', requireAuth, requireManage, wrap(async (req, res) => {
  const orders = Array.isArray(req.body?.sectionOrders) ? req.body.sectionOrders : [];
  for (const o of orders) {
    if (!o?.id) continue;
    const upd = { orderIdx: parseInt(o.orderIdx, 10) || 0 };
    if ('parentId' in o) upd.parentId = o.parentId || null;
    await prisma.docSection.update({ where: { id: o.id }, data: upd }).catch(() => {});
  }
  res.json({ ok: true });
}));

// ── POST /api/docs/:id/acknowledge ──
router.post('/:id/acknowledge', requireAuth, wrap(async (req, res) => {
  const doc = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Не знайдено' });
  if (!doc.publishedAt) return res.status(400).json({ error: 'Документ не опубліковано' });
  const version = parseInt(req.body?.versionAcknowledged, 10) || doc.currentVersion;
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || null;
  const ack = await prisma.docAcknowledgement.upsert({
    where: {
      docId_userId_versionAcknowledged: {
        docId: doc.id, userId: req.user.id, versionAcknowledged: version,
      },
    },
    update: { acknowledgedAt: new Date(), ipAddress: ip },
    create: { docId: doc.id, userId: req.user.id, versionAcknowledged: version, ipAddress: ip },
  });
  await logAction(req.user.id, 'doc.acknowledged', 'doc', doc.id, { version });
  res.json({ ok: true, acknowledgedAt: ms(ack.acknowledgedAt), versionAcknowledged: version });
}));

// ── GET /api/docs/:id/acknowledgements — звіт ──
router.get('/:id/acknowledgements', requireAuth, requireManage, wrap(async (req, res) => {
  const doc = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Не знайдено' });

  // Усі approved юзери + їх ролі/локації
  const users = await prisma.user.findMany({
    where: { approved: true },
    include: {
      roles: { select: { role: true } },
      locations: { where: { approved: true }, select: { locationId: true } },
    },
  });

  const acks = await prisma.docAcknowledgement.findMany({
    where: { docId: doc.id }, orderBy: { acknowledgedAt: 'desc' },
  });
  const latestAckByUser = new Map();
  for (const a of acks) if (!latestAckByUser.has(a.userId)) latestAckByUser.set(a.userId, a);

  const read = [];
  const unread = [];
  for (const u of users) {
    const roles = u.roles.map((r) => r.role);
    const locIds = u.locations.map((l) => l.locationId);
    const mandatory = isMandatoryFor(doc, roles, locIds);
    if (!mandatory) continue;
    const a = latestAckByUser.get(u.id);
    const upToDate = a && a.versionAcknowledged >= doc.currentVersion;
    const row = {
      userId: u.id, name: `${u.name}${u.surname ? ' ' + u.surname : ''}`,
      roles, locations: locIds,
      acknowledgedAt: a ? ms(a.acknowledgedAt) : null,
      versionAcknowledged: a?.versionAcknowledged || null,
    };
    if (upToDate) read.push(row); else unread.push(row);
  }

  const totalMandatory = read.length + unread.length;
  res.json({
    doc: serializeDoc(doc),
    read, unread,
    stats: { totalMandatory, totalRead: read.length, pct: totalMandatory ? read.length / totalMandatory : 0 },
  });
}));

// ── POST /api/docs/:id/remind ── надіслати нагадування непрочитавшим
router.post('/:id/remind', requireAuth, requireManage, wrap(async (req, res) => {
  const doc = await prisma.companyDoc.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Не знайдено' });
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((x) => typeof x === 'string') : [];
  if (userIds.length === 0) return res.status(400).json({ error: 'Не вказано адресатів' });
  notifyDocAckReminder(doc, userIds, req.user).catch(() => {});
  await logAction(req.user.id, 'doc.remind', 'doc', doc.id, { count: userIds.length });
  res.json({ ok: true, sent: userIds.length });
}));

export default router;
