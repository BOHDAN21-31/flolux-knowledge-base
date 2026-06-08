-- Quiz / Тести: фінальний тест курсу або урок-тест, з типами single/multi/text.

CREATE TABLE IF NOT EXISTS "Quiz" (
  "id"                 TEXT PRIMARY KEY,
  "title"              TEXT NOT NULL,
  "description"        TEXT,
  "courseId"           TEXT,
  "lessonId"           TEXT,
  "passingScore"       INTEGER NOT NULL DEFAULT 80,
  "maxAttempts"        INTEGER NOT NULL DEFAULT 3,
  "timeLimit"          INTEGER,
  "shuffleQuestions"   BOOLEAN NOT NULL DEFAULT true,
  "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT true,
  "createdBy"          TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Quiz"
    ADD CONSTRAINT "Quiz_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Quiz"
    ADD CONSTRAINT "Quiz_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Quiz"
    ADD CONSTRAINT "Quiz_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Quiz_courseId_idx" ON "Quiz"("courseId");
CREATE INDEX IF NOT EXISTS "Quiz_lessonId_idx" ON "Quiz"("lessonId");

CREATE TABLE IF NOT EXISTS "Question" (
  "id"            TEXT PRIMARY KEY,
  "quizId"        TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "text"          TEXT NOT NULL,
  "explanation"   TEXT,
  "options"       JSONB,
  "correctAnswer" TEXT,
  "points"        INTEGER NOT NULL DEFAULT 1,
  "orderIdx"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Question"
    ADD CONSTRAINT "Question_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Question_quizId_idx" ON "Question"("quizId", "orderIdx");

CREATE TABLE IF NOT EXISTS "QuizAttempt" (
  "id"            TEXT PRIMARY KEY,
  "quizId"        TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "enrollmentId"  TEXT,
  "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt"   TIMESTAMP(3),
  "score"         INTEGER,
  "passed"        BOOLEAN,
  "answers"       JSONB,
  "attemptNumber" INTEGER NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "QuizAttempt"
    ADD CONSTRAINT "QuizAttempt_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuizAttempt"
    ADD CONSTRAINT "QuizAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuizAttempt"
    ADD CONSTRAINT "QuizAttempt_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_enrollmentId_idx" ON "QuizAttempt"("enrollmentId");

-- finalQuizId на Course — раніше було тільки TEXT без FK. Додаємо FK SET NULL.
DO $$ BEGIN
  ALTER TABLE "Course"
    ADD CONSTRAINT "Course_finalQuizId_fkey"
    FOREIGN KEY ("finalQuizId") REFERENCES "Quiz"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
