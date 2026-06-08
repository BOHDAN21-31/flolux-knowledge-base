-- Розширений профіль: статус зайнятості, стажування, керівник, посада
-- + сутність 1:1 зустрічей HR ↔ працівник.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employmentStatus"    TEXT NOT NULL DEFAULT 'employed';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "internshipStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "internshipEndsAt"    TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supervisorId"        TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department"          TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position"            TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hiredAt"             TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_supervisorId_fkey"
    FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "User_employmentStatus_idx" ON "User"("employmentStatus");
CREATE INDEX IF NOT EXISTS "User_supervisorId_idx"     ON "User"("supervisorId");

CREATE TABLE IF NOT EXISTS "OneOnOne" (
  "id"            TEXT PRIMARY KEY,
  "employeeId"    TEXT NOT NULL,
  "organizerId"   TEXT NOT NULL,
  "scheduledAt"   TIMESTAMP(3) NOT NULL,
  "duration"      INTEGER NOT NULL DEFAULT 30,
  "location"      TEXT,
  "agenda"        TEXT,
  "notes"         TEXT,
  "employeeNotes" TEXT,
  "status"        TEXT NOT NULL DEFAULT 'scheduled',
  "outcome"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "OneOnOne"
    ADD CONSTRAINT "OneOnOne_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OneOnOne"
    ADD CONSTRAINT "OneOnOne_organizerId_fkey"
    FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OneOnOne_employeeId_idx" ON "OneOnOne"("employeeId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "OneOnOne_organizerId_idx" ON "OneOnOne"("organizerId");
CREATE INDEX IF NOT EXISTS "OneOnOne_status_idx" ON "OneOnOne"("status");

-- Настройка сповіщень: 1:1
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "oneOnOnesEnabled" BOOLEAN NOT NULL DEFAULT true;
