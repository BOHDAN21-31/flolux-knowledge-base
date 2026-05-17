import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'flolux-dev-secret-change-me';
const JWT_EXPIRES = '30d';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Публічна форма користувача (без passwordHash). `role` — аліас assignedRole,
// щоб фронтенд (currentUser.role) працював без переписування всіх перевірок.
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    surname: u.surname || null,
    avatarUrl: u.avatarUrl || null,
    phone: u.phone || null,
    rating: u.rating ?? 0,
    role: u.assignedRole || null,
    assignedRole: u.assignedRole || null,
    requestedRole: u.requestedRole || null,
    approved: u.approved,
    createdAt: u.createdAt instanceof Date ? u.createdAt.getTime() : u.createdAt,
  };
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Не авторизовано' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'Користувача не знайдено' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Недійсний токен' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Доступ лише для адміністратора' });
  }
  next();
}
