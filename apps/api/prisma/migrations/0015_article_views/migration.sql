-- Унікальні перегляди статей (один на користувача). Ідемпотентно.
CREATE TABLE IF NOT EXISTS "ArticleView" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleView_articleId_userId_key" ON "ArticleView"("articleId", "userId");
CREATE INDEX IF NOT EXISTS "ArticleView_articleId_idx" ON "ArticleView"("articleId");
CREATE INDEX IF NOT EXISTS "ArticleView_userId_idx" ON "ArticleView"("userId");

DO $$ BEGIN
    ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_articleId_fkey"
        FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
