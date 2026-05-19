import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import topicRoutes from './routes/topics.js';
import articleRoutes from './routes/articles.js';
import suggestionRoutes from './routes/suggestions.js';
import locationRoutes from './routes/locations.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import uploadRoutes, { UPLOAD_DIR } from './routes/upload.js';
import webauthnRoutes from './routes/webauthn.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/upload', uploadRoutes);

// Невідомий /api маршрут -> 404 JSON (щоб не повертати SPA)
app.use('/api', (req, res) => res.status(404).json({ error: 'Не знайдено' }));

// Завантажені файли (Railway Volume або ./uploads).
// Явні Content-Type для відео — інакше Safari/Chrome можуть не програвати.
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
    if (filePath.endsWith('.mov')) res.setHeader('Content-Type', 'video/quicktime');
    if (filePath.endsWith('.webm')) res.setHeader('Content-Type', 'video/webm');
  },
}));

// Статика фронтенду + SPA fallback
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Flolux API слухає на :${PORT}`);
});

export default app;
