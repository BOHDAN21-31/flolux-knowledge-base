-- Налаштування оповіщення про публікацію статті.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "notifyMode" TEXT;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "notifyTargets" JSONB;
