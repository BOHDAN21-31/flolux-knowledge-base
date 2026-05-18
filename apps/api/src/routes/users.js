import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { wrap, logAction } from '../lib.js';

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

export default router;
