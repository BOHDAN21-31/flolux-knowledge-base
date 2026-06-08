-- LMS: курси з суворо послідовними уроками, ручне призначення HR/admin,
-- трекінг прогресу та сертифікати.

CREATE TABLE IF NOT EXISTS "Course" (
  "id"               TEXT PRIMARY KEY,
  "slug"             TEXT NOT NULL UNIQUE,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "category"         TEXT NOT NULL,
  "iconKey"          TEXT,
  "color"            TEXT,
  "coverUrl"         TEXT,
  "estimatedMinutes" INTEGER,
  "targetRoles"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isOnboarding"     BOOLEAN NOT NULL DEFAULT false,
  "finalQuizId"      TEXT,
  "dueDays"          INTEGER,
  "publishedAt"      TIMESTAMP(3),
  "authorId"         TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Course"
    ADD CONSTRAINT "Course_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Course_category_idx" ON "Course"("category");
CREATE INDEX IF NOT EXISTS "Course_isOnboarding_idx" ON "Course"("isOnboarding");
CREATE INDEX IF NOT EXISTS "Course_publishedAt_idx" ON "Course"("publishedAt");

CREATE TABLE IF NOT EXISTS "Lesson" (
  "id"               TEXT PRIMARY KEY,
  "courseId"         TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "body"             TEXT,
  "videoUrl"         TEXT,
  "attachments"      JSONB,
  "orderIdx"         INTEGER NOT NULL DEFAULT 0,
  "estimatedMinutes" INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Lesson"
    ADD CONSTRAINT "Lesson_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Lesson_courseId_idx" ON "Lesson"("courseId", "orderIdx");

CREATE TABLE IF NOT EXISTS "Enrollment" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "courseId"    TEXT NOT NULL,
  "enrolledBy"  TEXT,
  "enrolledAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt"   TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "dueAt"       TIMESTAMP(3),
  "status"      TEXT NOT NULL DEFAULT 'assigned'
);

DO $$ BEGIN
  ALTER TABLE "Enrollment"
    ADD CONSTRAINT "Enrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Enrollment"
    ADD CONSTRAINT "Enrollment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Enrollment"
    ADD CONSTRAINT "Enrollment_enrolledBy_fkey"
    FOREIGN KEY ("enrolledBy") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");
CREATE INDEX IF NOT EXISTS "Enrollment_userId_idx" ON "Enrollment"("userId");
CREATE INDEX IF NOT EXISTS "Enrollment_status_idx" ON "Enrollment"("status");

CREATE TABLE IF NOT EXISTS "LessonProgress" (
  "id"           TEXT PRIMARY KEY,
  "enrollmentId" TEXT NOT NULL,
  "lessonId"     TEXT NOT NULL,
  "completedAt"  TIMESTAMP(3),
  "secondsSpent" INTEGER NOT NULL DEFAULT 0
);

DO $$ BEGIN
  ALTER TABLE "LessonProgress"
    ADD CONSTRAINT "LessonProgress_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LessonProgress"
    ADD CONSTRAINT "LessonProgress_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_enrollmentId_lessonId_key" ON "LessonProgress"("enrollmentId", "lessonId");
CREATE INDEX IF NOT EXISTS "LessonProgress_enrollmentId_idx" ON "LessonProgress"("enrollmentId");
