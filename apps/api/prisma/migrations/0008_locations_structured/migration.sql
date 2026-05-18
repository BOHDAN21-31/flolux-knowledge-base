-- Структуровані локації: name / city / address / active.
-- Ідемпотентно (IF NOT EXISTS). Колонка address уже існує з 0002 —
-- rename/preserve з ТЗ опущено, бо всі рядки нижче все одно видаляються.
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- Повне перезаповнення локацій (нові 17 досіває seedLocations()).
-- Дочірні таблиці перед батьківською (FK).
DELETE FROM "ArticleLocation";
DELETE FROM "LocationRequest";
DELETE FROM "UserLocation";
DELETE FROM "Location";
