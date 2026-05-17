import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { signToken, publicUser, requireAuth } from '../auth.js';
import { REFERRAL_WORD, ROLE_KEYS } from '../constants.js';

const router = Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// POST /api/auth/register
router.post('/register', wrap(async (req, res) => {
  const { name, email, password, referralWord, requestedRole } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Заповніть усі поля' });
  if (referralWord !== REFERRAL_WORD) return res.status(400).json({ error: 'Невірне реферальне слово' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів' });

  const normEmail = String(email).toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email: normEmail } });
  if (exists) return res.status(400).json({ error: 'Користувач з такою поштою вже існує' });

  const isFirstUser = (await prisma.user.count()) === 0;

  if (!isFirstUser && (!requestedRole || !ROLE_KEYS.includes(requestedRole) || requestedRole === 'admin')) {
    return res.status(400).json({ error: 'Оберіть коректну роль' });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normEmail,
      passwordHash: await bcrypt.hash(String(password), 10),
      requestedRole: isFirstUser ? null : requestedRole,
      assignedRole: isFirstUser ? 'admin' : null,
      approved: isFirstUser,
    },
  });

  res.json({ id: user.id, email: user.email, name: user.name, approved: user.approved });
}));

// POST /api/auth/login
router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Заповніть усі поля' });

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user) return res.status(401).json({ error: 'Користувача не знайдено' });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Невірний пароль' });

  if (!user.approved && user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Ваш акаунт ще не підтверджено адміністратором' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
}));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
