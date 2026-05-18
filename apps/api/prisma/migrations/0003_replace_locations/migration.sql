-- Повна заміна локацій. Дочірні таблиці перед батьківською (FK).
DELETE FROM "ArticleLocation";
DELETE FROM "LocationRequest";
DELETE FROM "UserLocation";
DELETE FROM "Location";
-- Нові локації досіваються seedLocations() при старті (таблиця тепер порожня).
