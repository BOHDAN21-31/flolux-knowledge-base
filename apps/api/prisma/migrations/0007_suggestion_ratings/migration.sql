-- Рейтинг пропозицій (1..5), один голос на користувача.
CREATE TABLE IF NOT EXISTS "SuggestionRating" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestionRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SuggestionRating_suggestionId_userId_key"
    ON "SuggestionRating"("suggestionId", "userId");

DO $$ BEGIN
    ALTER TABLE "SuggestionRating" ADD CONSTRAINT "SuggestionRating_suggestionId_fkey"
        FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SuggestionRating" ADD CONSTRAINT "SuggestionRating_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
