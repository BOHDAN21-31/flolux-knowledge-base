-- Telegram-прив'язка користувача + глобальний перемикач сповіщень у Telegram.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramChatId_key" ON "User"("telegramChatId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramLinkCode_key" ON "User"("telegramLinkCode");
CREATE INDEX IF NOT EXISTS "User_telegramChatId_idx" ON "User"("telegramChatId");

ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "telegramEnabled" BOOLEAN NOT NULL DEFAULT true;
