-- Карта доступів: каталог permissions, індивідуальні права, пресети.
CREATE TABLE IF NOT EXISTS "Permission" (
  "key"         TEXT PRIMARY KEY,
  "category"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "protected"   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "UserPermission" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "grantedBy"     TEXT,
  "grantedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3)
);

DO $$ BEGIN
  ALTER TABLE "UserPermission"
    ADD CONSTRAINT "UserPermission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserPermission"
    ADD CONSTRAINT "UserPermission_permissionKey_fkey"
    FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_permissionKey_key"
  ON "UserPermission"("userId", "permissionKey");
CREATE INDEX IF NOT EXISTS "UserPermission_userId_idx" ON "UserPermission"("userId");

CREATE TABLE IF NOT EXISTS "PermissionPreset" (
  "id"             TEXT PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "permissionKeys" TEXT[] NOT NULL,
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
