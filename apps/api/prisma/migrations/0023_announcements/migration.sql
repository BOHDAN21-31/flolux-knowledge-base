-- Внутрішні оголошення: окрема сутність із пріоритетом і таргетингом.
CREATE TABLE IF NOT EXISTS "Announcement" (
  "id"               TEXT PRIMARY KEY,
  "title"            TEXT NOT NULL,
  "body"             TEXT NOT NULL,
  "category"         TEXT NOT NULL,
  "priority"         TEXT NOT NULL DEFAULT 'normal',
  "authorId"         TEXT NOT NULL,
  "targetRoles"      TEXT[],
  "targetLocations"  TEXT[],
  "expiresAt"        TIMESTAMP(3),
  "pinned"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Announcement"
    ADD CONSTRAINT "Announcement_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Announcement_createdAt_idx" ON "Announcement"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Announcement_pinned_idx" ON "Announcement"("pinned");
CREATE INDEX IF NOT EXISTS "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
  "id"             TEXT PRIMARY KEY,
  "announcementId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "readAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "AnnouncementRead"
    ADD CONSTRAINT "AnnouncementRead_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AnnouncementRead"
    ADD CONSTRAINT "AnnouncementRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_userId_key"
  ON "AnnouncementRead"("announcementId", "userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- Налаштування сповіщень: оголошення (усі / лише urgent).
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "announcementsAll" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "announcementsUrgentOnly" BOOLEAN NOT NULL DEFAULT false;
