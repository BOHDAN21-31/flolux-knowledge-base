-- Категорія дайджесту: company_news | welcome | achievement | process_change | important_date
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "digestCategory" TEXT;
