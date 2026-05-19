import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { isAdmin, roleList } from './lib.js';
import { hasPermission } from './permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'flolux-dev-secret-change-me';
const JWT_EXPIRES = '30d';

export function signToken(user) {
  return jwt.sign({ sub: user.id, roles: roleList(user) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Публічна форма користувача (без passwordHash).
// `role` / `assignedRole` — застарілі (первинна роль), `roles` — масив усіх ролей.
export function publicUser(u) {
  if (!u) return null;
  const roles = roleList(u);
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
    roles,
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
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true, permissions: true },
    });
    if (!user) return res.status(401).json({ error: 'Користувача не знайдено' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Недійсний токен' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Доступ лише для адміністратора' });
  }
  next();
}

// Senior gate — backward-compat. Тепер перевіряє право, а не роль:
// content.view_all (hr має його через ROLE_PERMISSIONS, admin = '*').
// Додатково пропускає індивідуально наділених цим правом.
export function requireSenior(req, res, next) {
  if (!req.user || !hasPermission(req.user, 'content.view_all')) {
    return res.status(403).json({ error: 'Доступ лише для HR або адміністратора' });
  }
  next();
}

export function requireHrOrAdmin(req, res, next) {
  const roles = roleList(req.user || {});
  if (!req.user || !(roles.includes('hr') || roles.includes('admin'))) {
    return res.status(403).json({ error: 'Доступ лише для HR або адміністратора' });
  }
  next();
}
