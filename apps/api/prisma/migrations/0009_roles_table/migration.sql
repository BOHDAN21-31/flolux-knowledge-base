-- Ролі у БД (замість хардкоду на фронті). Дефолтні ролі досіває seedRoles().
CREATE TABLE IF NOT EXISTS "Role" (
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "iconKey"     TEXT,
    "color"       TEXT,
    "protected"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("key")
);
