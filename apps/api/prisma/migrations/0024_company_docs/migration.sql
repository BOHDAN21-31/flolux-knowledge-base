-- Корпоративні документи (правила/SOP): окремий тип контенту з версіонуванням
-- та обов'язковим підтвердженням прочитання.

CREATE TABLE IF NOT EXISTS "CompanyDoc" (
  "id"                    TEXT PRIMARY KEY,
  "slug"                  TEXT NOT NULL UNIQUE,
  "title"                 TEXT NOT NULL,
  "description"           TEXT,
  "category"              TEXT NOT NULL,
  "iconKey"               TEXT,
  "color"                 TEXT,
  "currentVersion"        INTEGER NOT NULL DEFAULT 1,
  "publishedAt"           TIMESTAMP(3),
  "mandatoryForRoles"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "mandatoryForLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "authorId"              TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "CompanyDoc"
    ADD CONSTRAINT "CompanyDoc_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CompanyDoc_category_idx" ON "CompanyDoc"("category");
CREATE INDEX IF NOT EXISTS "CompanyDoc_publishedAt_idx" ON "CompanyDoc"("publishedAt");

-- Дерево розділів: parentId = null означає верхній рівень.
CREATE TABLE IF NOT EXISTS "DocSection" (
  "id"        TEXT PRIMARY KEY,
  "docId"     TEXT NOT NULL,
  "parentId"  TEXT,
  "title"     TEXT NOT NULL,
  "body"      TEXT,
  "orderIdx"  INTEGER NOT NULL DEFAULT 0,
  "level"     INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "DocSection"
    ADD CONSTRAINT "DocSection_docId_fkey"
    FOREIGN KEY ("docId") REFERENCES "CompanyDoc"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DocSection"
    ADD CONSTRAINT "DocSection_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "DocSection"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "DocSection_docId_parent_idx" ON "DocSection"("docId", "parentId", "orderIdx");

-- Версіонування: знімок sections як JSONB.
CREATE TABLE IF NOT EXISTS "DocVersion" (
  "id"         TEXT PRIMARY KEY,
  "docId"      TEXT NOT NULL,
  "version"    INTEGER NOT NULL,
  "snapshot"   JSONB NOT NULL,
  "changedBy"  TEXT,
  "changeNote" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "DocVersion"
    ADD CONSTRAINT "DocVersion_docId_fkey"
    FOREIGN KEY ("docId") REFERENCES "CompanyDoc"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DocVersion"
    ADD CONSTRAINT "DocVersion_changedBy_fkey"
    FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DocVersion_docId_version_key" ON "DocVersion"("docId", "version");
CREATE INDEX IF NOT EXISTS "DocVersion_docId_idx" ON "DocVersion"("docId", "version" DESC);

-- Підтвердження прочитання конкретної версії документа.
CREATE TABLE IF NOT EXISTS "DocAcknowledgement" (
  "id"                  TEXT PRIMARY KEY,
  "docId"               TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "versionAcknowledged" INTEGER NOT NULL,
  "acknowledgedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress"           TEXT
);

DO $$ BEGIN
  ALTER TABLE "DocAcknowledgement"
    ADD CONSTRAINT "DocAcknowledgement_docId_fkey"
    FOREIGN KEY ("docId") REFERENCES "CompanyDoc"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DocAcknowledgement"
    ADD CONSTRAINT "DocAcknowledgement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DocAcknowledgement_unique_key"
  ON "DocAcknowledgement"("docId", "userId", "versionAcknowledged");
CREATE INDEX IF NOT EXISTS "DocAcknowledgement_docId_idx" ON "DocAcknowledgement"("docId");
CREATE INDEX IF NOT EXISTS "DocAcknowledgement_userId_idx" ON "DocAcknowledgement"("userId");
