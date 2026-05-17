import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';

import { prisma } from './db.js';
import { seedDatabase } from './seed.js';
import { signToken, publicUser, requireAuth, requireAdmin } from './auth.js';
import { REFERRAL_WORD, ROLE_KEYS } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(API_ROOT, 'public');
const PORT = process.env.PORT || 3001;

const ms = (d) => (d instanceof Date ? d.getTime() : d);

const serializeArticle = (a) => ({
  id: a.id,
  topicId: a.topicId,
  section: a.section,
  title: a.title,
  content: a.content,
  tags: a.tags || [],
  author: a.authorId || 'system',
  authorRole: a.author?.assignedRole || 'tech',
  authorName: a.author?.name || 'Система',
  createdAt: ms(a.createdAt),
  updatedAt: ms(a.updatedAt),
});

const serializeComment = (c) => ({
  id: c.id,
  articleId: c.articleId,
  author: c.authorId,
  authorName: c.author?.name || 'Користувач',
  authorRole: c.author?.assignedRole || null,
  content: c.content,
  createdAt: ms(c.createdAt),
});

const serializeSuggestion = (s) => ({
  id: s.id,
  articleId: s.articleId,
  author: s.authorId,
  authorName: s.author?.name || 'Користувач',
  authorRole: s.author?.assignedRole || null,
  content: s.content,
  status: s.status,
  createdAt: ms(s.createdAt),
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// ============ AUTH ============
app.post('/api/auth/register', wrap(async (req, res) => {
  const { referralWord, name, email, password, requestedRole } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Заповніть всі поля' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів' });

  const normEmail = String(email).toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email: normEmail } });
  if (exists) return res.status(409).json({ error: 'Користувач з такою поштою вже існує' });

  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  if (!isFirstUser) {
    if (referralWord !== REFERRAL_WORD) return res.status(400).json({ error: 'Невірне реферальне слово' });
    if (!requestedRole || !ROLE_KEYS.includes(requestedRole) || requestedRole === 'admin') {
      return res.status(400).json({ error: 'Оберіть коректну роль' });
    }
  }

  const user = await prisma.user.create({
    data: {
      email: normEmail,
      passwordHash: await bcrypt.hash(password, 10),
      name,
      requestedRole: isFirstUser ? null : requestedRole,
      assignedRole: isFirstUser ? 'admin' : null,
      approved: isFirstUser,
    },
  });

  if (isFirstUser) {
    return res.json({ token: signToken(user), user: publicUser(user) });
  }
  res.json({ message: 'Реєстрація успішна. Очікуйте підтвердження адміністратора та призначення ролі.' });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Заповніть всі поля' });
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user) return res.status(401).json({ error: 'Користувача не знайдено' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Невірний пароль' });
  if (!user.approved && user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Ваш акаунт ще не підтверджено адміністратором' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ============ ADMIN ============
app.get('/api/admin/users', requireAuth, requireAdmin, wrap(async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(users.map(publicUser));
}));

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { assignedRole, approved } = req.body || {};
  const data = {};
  if (assignedRole !== undefined) {
    if (assignedRole !== null && !ROLE_KEYS.includes(assignedRole)) {
      return res.status(400).json({ error: 'Невідома роль' });
    }
    data.assignedRole = assignedRole || null;
  }
  if (approved !== undefined) data.approved = !!approved;
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(publicUser(user));
}));

// ============ TOPICS ============
app.get('/api/topics', requireAuth, wrap(async (req, res) => {
  const where = req.query.role ? { roleKey: String(req.query.role) } : {};
  const topics = await prisma.topic.findMany({ where, orderBy: { id: 'asc' } });
  res.json(topics.map((t) => ({ id: t.id, roleKey: t.roleKey, title: t.title, description: t.description })));
}));

app.post('/api/topics', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { roleKey, title, description } = req.body || {};
  if (!roleKey || !title) return res.status(400).json({ error: 'roleKey і title обовʼязкові' });
  const topic = await prisma.topic.create({
    data: { id: `${roleKey}-${Date.now()}`, roleKey, title, description: description || '' },
  });
  res.json({ id: topic.id, roleKey: topic.roleKey, title: topic.title, description: topic.description });
}));

app.delete('/api/topics/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  await prisma.topic.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ============ ARTICLES ============
app.get('/api/articles', requireAuth, wrap(async (req, res) => {
  const where = req.query.topicId ? { topicId: String(req.query.topicId) } : {};
  const articles = await prisma.article.findMany({
    where,
    include: { author: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(articles.map(serializeArticle));
}));

app.post('/api/articles', requireAuth, wrap(async (req, res) => {
  if (!req.user.approved && req.user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Акаунт ще не підтверджено' });
  }
  const { topicId, section, title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Заповніть назву та зміст статті' });
  let tags = req.body?.tags ?? [];
  if (typeof tags === 'string') tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const article = await prisma.article.create({
    data: {
      topicId: topicId || null,
      section: section || (String(topicId).startsWith('tc-') ? 'tech' : 'role'),
      title,
      content,
      tags,
      authorId: req.user.id,
    },
    include: { author: true },
  });
  res.json(serializeArticle(article));
}));

app.patch('/api/articles/:id', requireAuth, wrap(async (req, res) => {
  const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Статтю не знайдено' });
  const isOwner = existing.authorId === req.user.id;
  if (!isOwner && req.user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Немає прав на редагування' });
  }
  const data = {};
  if (req.body?.title !== undefined) data.title = req.body.title;
  if (req.body?.content !== undefined) data.content = req.body.content;
  if (req.body?.tags !== undefined) {
    let tags = req.body.tags;
    if (typeof tags === 'string') tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    data.tags = tags;
  }
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data,
    include: { author: true },
  });
  res.json(serializeArticle(article));
}));

// ============ COMMENTS ============
app.get('/api/articles/:id/comments', requireAuth, wrap(async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { articleId: req.params.id },
    include: { author: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(comments.map(serializeComment));
}));

app.post('/api/articles/:id/comments', requireAuth, wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Порожній коментар' });
  const comment = await prisma.comment.create({
    data: { articleId: req.params.id, authorId: req.user.id, content },
    include: { author: true },
  });
  res.json(serializeComment(comment));
}));

// ============ SUGGESTIONS ============
app.get('/api/articles/:id/suggestions', requireAuth, wrap(async (req, res) => {
  const suggestions = await prisma.suggestion.findMany({
    where: { articleId: req.params.id },
    include: { author: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(suggestions.map(serializeSuggestion));
}));

app.post('/api/articles/:id/suggestions', requireAuth, wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Порожня пропозиція' });
  const suggestion = await prisma.suggestion.create({
    data: { articleId: req.params.id, authorId: req.user.id, content, status: 'pending' },
    include: { author: true },
  });
  res.json(serializeSuggestion(suggestion));
}));

app.get('/api/suggestions', requireAuth, wrap(async (req, res) => {
  const where = req.query.status ? { status: String(req.query.status) } : {};
  const suggestions = await prisma.suggestion.findMany({
    where,
    include: { author: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suggestions.map(serializeSuggestion));
}));

app.patch('/api/suggestions/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Невідомий статус' });
  }
  const suggestion = await prisma.suggestion.update({
    where: { id: req.params.id },
    data: { status },
    include: { author: true },
  });
  res.json(serializeSuggestion(suggestion));
}));

// ============ SPA STATIC FALLBACK ============
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexHtml = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
    next();
  });
}

// ============ STARTUP ============
async function start() {
  try {
    console.log('[startup] prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { cwd: API_ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[startup] migrate deploy не вдалося, пробую db push:', e.message);
    try {
      execSync('npx prisma db push --skip-generate', { cwd: API_ROOT, stdio: 'inherit' });
    } catch (e2) {
      console.error('[startup] db push теж не вдалося:', e2.message);
    }
  }

  try {
    await seedDatabase();
  } catch (e) {
    console.error('[startup] seed помилка:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`Flolux API слухає на :${PORT}`);
  });
}

start();
