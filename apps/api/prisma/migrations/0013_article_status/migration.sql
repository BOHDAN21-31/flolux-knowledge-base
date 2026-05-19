-- Статус статті: draft | published | scheduled. Існуючі = published (DEFAULT).
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published';
CREATE INDEX IF NOT EXISTS "Article_status_idx" ON "Article"("status");
