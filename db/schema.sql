-- Flolux Knowledge Base — схема БД (PostgreSQL)
-- Генерує таблиці, що відповідають структурам даних із src/App.jsx
-- (наразі застосунок зберігає ці сутності в localStorage через useStorage).
--
-- Застосувати:  psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

-- ============ topics ============
CREATE TABLE IF NOT EXISTS topics (
  id          TEXT PRIMARY KEY,
  role_key    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ users ============
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  requested_role TEXT,
  assigned_role  TEXT,
  approved       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ articles ============
CREATE TABLE IF NOT EXISTS articles (
  id         TEXT PRIMARY KEY,
  topic_id   TEXT REFERENCES topics(id) ON DELETE SET NULL,
  section    TEXT NOT NULL CHECK (section IN ('tech', 'role')),
  title      TEXT NOT NULL,
  content    TEXT,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_section  ON articles(section);

-- ============ comments ============
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);

-- ============ suggestions ============
CREATE TABLE IF NOT EXISTS suggestions (
  id         TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_article_id ON suggestions(article_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status     ON suggestions(status);

COMMIT;
