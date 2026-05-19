-- Запланована публікація.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Article_publishAt_idx" ON "Article"("publishAt");
