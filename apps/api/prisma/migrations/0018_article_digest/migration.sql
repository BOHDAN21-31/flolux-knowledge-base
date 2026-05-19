-- HR-дайджест як спец-стаття.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "isDigest" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Article_isDigest_idx" ON "Article"("isDigest");
