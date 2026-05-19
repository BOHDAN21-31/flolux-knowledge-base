-- Обмежені ролі: контент видно лише явно призначеним користувачам.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "restricted" BOOLEAN NOT NULL DEFAULT false;
