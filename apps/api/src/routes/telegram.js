import { Router } from 'express';
import { prisma } from '../db.js';
import { getBot, WEBHOOK_SECRET } from '../services/telegram.js';

const router = Router();

// POST /api/telegram/webhook — без auth. Завжди 200, щоб Telegram не ретраїв.
router.post('/webhook', async (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const secret = req.headers['x-telegram-bot-api-secret-token'];
      if (secret !== WEBHOOK_SECRET) return res.status(401).end();
    }

    const bot = getBot();
    const msg = req.body?.message;
    const text = (msg?.text || '').trim();
    const chatId = msg?.chat?.id;
    const from = msg?.from || {};
    if (!bot || !chatId || !text) return res.json({ ok: true });

    const reply = (t) => bot.sendMessage(chatId, t, { parse_mode: 'HTML' }).catch(() => {});

    if (text.startsWith('/start ')) {
      const code = text.split(' ')[1]?.trim();
      const user = code ? await prisma.user.findUnique({ where: { telegramLinkCode: code } }) : null;
      if (!user) {
        await reply('❌ Невірний код. Перейдіть у профіль на сайті, секція «Telegram», скопіюйте поточний код і спробуйте знову.');
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            telegramChatId: String(chatId),
            telegramUsername: from.username || null,
            telegramLinkedAt: new Date(),
            telegramLinkCode: null,
          },
        });
        await reply(`✅ Готово, ${user.name}! Ваш Telegram прив'язано до акаунту Flolux. Я надсилатиму вам сповіщення про нові статті, коментарі та інші події. Щоб налаштувати — зайдіть у профіль на сайті.`);
      }
    } else if (text === '/status') {
      const u = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } });
      await reply(u ? `✅ Прив'язано до ${u.name} (${u.email})` : '❌ Не прив\'язано. Надішліть /start КОД');
    } else if (text === '/unlink') {
      await prisma.user.updateMany({
        where: { telegramChatId: String(chatId) },
        data: { telegramChatId: null, telegramUsername: null, telegramLinkedAt: null },
      });
      await reply('🔓 Telegram відв\'язано. До побачення!');
    } else {
      await reply("👋 Привіт! Це бот сповіщень Flolux.\n\nЩоб прив'язати акаунт:\n1. Зайдіть на сайт\n2. Профіль → Telegram\n3. Скопіюйте код\n4. Надішліть мені: /start КОД\n\nКоманди:\n/status — перевірити прив'язку\n/unlink — відв'язати\n/help — допомога");
    }
  } catch (e) {
    console.error('[telegram webhook]', e.message);
  }
  return res.json({ ok: true });
});

export default router;
