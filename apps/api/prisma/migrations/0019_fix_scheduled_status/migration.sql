-- Прибираємо окремий статус 'scheduled': запланована = published з майбутнім publishAt.
UPDATE "Article" SET "status" = 'published' WHERE "status" = 'scheduled';

-- Поле для відкладеного оповіщення про заплановану публікацію.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
