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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/suggestions', suggestionRoutes);

// Невідомий /api маршрут -> 404 JSON (щоб не повертати SPA)
app.use('/api', (req, res) => res.status(404).json({ error: 'Не знайдено' }));

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
