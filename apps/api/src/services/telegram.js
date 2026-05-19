import TelegramBot from 'node-telegram-bot-api';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.ORIGIN ? `${process.env.ORIGIN}/api/telegram/webhook` : null;
export const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || null;

let bot = null;

export function initTelegram() {
  if (!TOKEN) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — Telegram disabled');
    return null;
  }
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log('[telegram] bot initialized');
  return bot;
}

export function getBot() {
  return bot;
}

export async function setupWebhook() {
  if (!bot || !WEBHOOK_URL) {
    if (!WEBHOOK_URL) console.warn('[telegram] ORIGIN not set — webhook skipped');
    return;
  }
  try {
    const info = await bot.getWebHookInfo();
    if (info.url !== WEBHOOK_URL) {
      const opts = WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {};
      await bot.setWebHook(WEBHOOK_URL, opts);
      console.log('[telegram] webhook set to', WEBHOOK_URL);
    } else {
      console.log('[telegram] webhook already configured');
    }
  } catch (e) {
    console.error('[telegram] webhook setup failed', e.message);
  }
}

export async function sendMessage(chatId, text, options = {}) {
  if (!bot) return null;
  try {
    return await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...options,
    });
  } catch (e) {
    console.error('[telegram] send failed', { chatId, error: e.message });
    return null;
  }
}
