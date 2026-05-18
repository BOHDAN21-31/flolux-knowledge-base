-- Множинні ролі: UserRole. assignedRole лишається (deprecated, авто-синк).

CREATE TABLE IF NOT EXISTS "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_role_key" ON "UserRole"("userId", "role");

DO $$ BEGIN
    ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Бекфіл: для кожного юзера зі старим assignedRole створюємо рядок UserRole.
-- id детермінований (userId:role) => повторний запуск ідемпотентний.
INSERT INTO "UserRole" ("id", "userId", "role", "createdAt")
SELECT "id" || ':' || "assignedRole", "id", "assignedRole", CURRENT_TIMESTAMP
FROM "User"
WHERE "assignedRole" IS NOT NULL
ON CONFLICT ("userId", "role") DO NOTHING;
