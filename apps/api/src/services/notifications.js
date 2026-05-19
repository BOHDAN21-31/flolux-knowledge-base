import { prisma } from '../db.js';
import { sendMessage } from './telegram.js';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Дзеркалення сповіщення в Telegram. Fire-and-forget, ніколи не валить notify().
function dispatchTelegram(recipient, { title, body, linkPath }) {
  try {
    if (!recipient?.telegramChatId) return;
    if (recipient.notificationPref && recipient.notificationPref.telegramEnabled === false) return;
    const origin = process.env.ORIGIN || '';
    const link = origin + (linkPath || '/');
    const text = `<b>${esc(title)}</b>\n${esc(body || '')}\n\n<a href="${esc(link)}">Відкрити на сайті</a>`;
    sendMessage(recipient.telegramChatId, text).catch((e) => console.error('[telegram dispatch] failed', e.message));
  } catch (e) {
    console.error('[telegram dispatch]', e.message);
  }
}

// type -> поле NotificationPreference, яке вмикає/вимикає цей тип.
const TYPE_PREF = {
  comment: 'comments',
  suggestion: 'suggestions',
  suggestion_approved: 'suggestionApproved',
  birthday_today: 'birthdays',
  birthday_soon: 'birthdays',
  digest: 'digests',
  role_assigned: 'roleChanges',
  location_approved: 'locationChanges',
  // new_article — prefKey передається явно (newArticleAll|MyRole|MyLocation)
};

// Базовий генератор. Ніколи не кидає — провал не валить мутацію.
export async function notify({ recipientIds, type, title, body, linkPath, actorId, metadata, prefKey }) {
  try {
    const ids = [...new Set((recipientIds || []).filter(Boolean))];
    console.log('[notify] called', { type, recipientCount: ids.length, actorId });
    if (ids.length === 0) { console.log('[notify] no recipients — skip'); return []; }
    const key = prefKey || TYPE_PREF[type] || null;

    let allowed = ids;
    if (key) {
      const prefs = await prisma.notificationPreference.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, [key]: true },
      });
      const off = new Set(prefs.filter((p) => p[key] === false).map((p) => p.userId));
      allowed = ids.filter((id) => !off.has(id)); // відсутній рядок = дефолт true
    }
    if (allowed.length === 0) return [];

    await prisma.notification.createMany({
      data: allowed.map((recipientId) => ({
        recipientId, type, title,
        body: body || null,
        linkPath: linkPath || null,
        actorId: actorId || null,
        metadata: metadata ?? undefined,
      })),
    });
    console.log('[notify] created', allowed.length);

    // Дзеркалення у Telegram (fire-and-forget, не блокує і не валить notify)
    prisma.user.findMany({
      where: { id: { in: allowed }, telegramChatId: { not: null } },
      select: { telegramChatId: true, notificationPref: { select: { telegramEnabled: true } } },
    }).then((rcpts) => {
      rcpts.forEach((r) => dispatchTelegram(r, { title, body, linkPath }));
    }).catch((e) => console.error('[notify] telegram fanout', e.message));

    return allowed;
  } catch (e) {
    console.error('[notify]', type, e.message);
    return [];
  }
}

async function allUserIdsExcept(exceptId) {
  const users = await prisma.user.findMany({
    where: { id: { not: exceptId }, approved: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function notifyNewArticle(article, actor) {
  try {
    const mode = article.notifyMode;
    console.log('[notifyNewArticle]', { articleId: article.id, notifyMode: mode, notifyTargets: article.notifyTargets });
    if (!mode) return;
    const targets = Array.isArray(article.notifyTargets) ? article.notifyTargets : [];
    let recipientIds = [];
    let prefKey = 'newArticleAll';

    if (mode === 'all') {
      recipientIds = await allUserIdsExcept(article.authorId);
      prefKey = 'newArticleAll';
    } else if (mode === 'roles' && targets.length) {
      const rows = await prisma.userRole.findMany({
        where: { role: { in: targets } }, select: { userId: true },
      });
      recipientIds = rows.map((r) => r.userId);
      prefKey = 'newArticleMyRole';
    } else if (mode === 'locations' && targets.length) {
      const rows = await prisma.userLocation.findMany({
        where: { locationId: { in: targets }, approved: true }, select: { userId: true },
      });
      recipientIds = rows.map((r) => r.userId);
      prefKey = 'newArticleMyLocation';
    }
    recipientIds = recipientIds.filter((id) => id !== article.authorId);
    console.log('[notifyNewArticle] recipients before filter', recipientIds.length);
    await notify({
      recipientIds,
      type: 'new_article',
      title: 'Нова стаття',
      body: article.title,
      linkPath: `/articles/${article.id}`,
      actorId: actor?.id || article.authorId,
      metadata: { articleId: article.id },
      prefKey,
    });
  } catch (e) { console.error('[notifyNewArticle]', e.message); }
}

export async function notifyComment(article, commentAuthor) {
  try {
    if (!article.authorId || article.authorId === commentAuthor.id) return;
    await notify({
      recipientIds: [article.authorId],
      type: 'comment',
      title: 'Новий коментар',
      body: `${commentAuthor.name} прокоментував(ла) «${article.title}»`,
      linkPath: `/articles/${article.id}`,
      actorId: commentAuthor.id,
      metadata: { articleId: article.id },
    });
  } catch (e) { console.error('[notifyComment]', e.message); }
}

export async function notifySuggestion(article, suggestionAuthor) {
  try {
    if (!article.authorId || article.authorId === suggestionAuthor.id) return;
    await notify({
      recipientIds: [article.authorId],
      type: 'suggestion',
      title: 'Нова пропозиція правки',
      body: `${suggestionAuthor.name} запропонував(ла) правку до «${article.title}»`,
      linkPath: `/articles/${article.id}`,
      actorId: suggestionAuthor.id,
      metadata: { articleId: article.id },
    });
  } catch (e) { console.error('[notifySuggestion]', e.message); }
}

export async function notifySuggestionApproved(suggestion, actorId) {
  try {
    if (!suggestion.authorId) return;
    await notify({
      recipientIds: [suggestion.authorId],
      type: 'suggestion_approved',
      title: 'Вашу пропозицію прийнято',
      body: 'Пропозицію правки схвалено',
      linkPath: suggestion.articleId ? `/articles/${suggestion.articleId}` : null,
      actorId: actorId || null,
      metadata: { suggestionId: suggestion.id, articleId: suggestion.articleId },
    });
  } catch (e) { console.error('[notifySuggestionApproved]', e.message); }
}

export async function notifyRoleAssigned(userId, roleKey, actorId) {
  try {
    await notify({
      recipientIds: [userId],
      type: 'role_assigned',
      title: 'Вам призначено роль',
      body: `Нова роль: ${roleKey}`,
      linkPath: '/profile',
      actorId: actorId || null,
      metadata: { roleKey },
    });
  } catch (e) { console.error('[notifyRoleAssigned]', e.message); }
}

export async function notifyLocationApproved(userId, locationId, actorId) {
  try {
    await notify({
      recipientIds: [userId],
      type: 'location_approved',
      title: 'Локацію підтверджено',
      body: 'Вас підтверджено на локації',
      linkPath: '/profile/locations',
      actorId: actorId || null,
      metadata: { locationId },
    });
  } catch (e) { console.error('[notifyLocationApproved]', e.message); }
}

export async function notifyDigest(article, actor) {
  try {
    const recipientIds = await allUserIdsExcept(article.authorId);
    await notify({
      recipientIds,
      type: 'digest',
      title: '📢 Дайджест компанії',
      body: article.title,
      linkPath: `/articles/${article.id}`,
      actorId: actor?.id || article.authorId,
      metadata: { articleId: article.id },
    });
  } catch (e) { console.error('[notifyDigest]', e.message); }
}

// Раз на день генерує сповіщення про сьогоднішні дні народження.
// Лінивий "планувальник": запланована стаття стала видимою → оповістити (1 раз).
let lastScheduledCheck = 0;
export async function checkScheduledPublishing() {
  try {
    if (Date.now() - lastScheduledCheck < 60000) return;
    lastScheduledCheck = Date.now();
    const due = await prisma.article.findMany({
      where: {
        status: 'published',
        notifiedAt: null,
        notifyMode: { not: null },
        publishAt: { not: null, lte: new Date() },
      },
      include: { author: true },
      take: 50,
    });
    for (const a of due) {
      await notifyNewArticle(a, a.author || { id: a.authorId });
      await prisma.article.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
    }
  } catch (e) { console.error('[checkScheduledPublishing]', e.message); }
}

let lastBirthdayCheck = null;
export async function checkBirthdays() {
  try {
    const today = new Date();
    const dayKey = today.toISOString().slice(0, 10);
    if (lastBirthdayCheck === dayKey) return;
    lastBirthdayCheck = dayKey;

    const withBd = await prisma.user.findMany({
      where: { birthday: { not: null } },
      select: { id: true, name: true, birthday: true },
    });
    const m = today.getMonth();
    const d = today.getDate();
    const celebrants = withBd.filter((u) => {
      const b = new Date(u.birthday);
      return b.getMonth() === m && b.getDate() === d;
    });
    if (celebrants.length === 0) return;

    const startOfDay = new Date(today.getFullYear(), m, d);
    for (const c of celebrants) {
      const already = await prisma.notification.findFirst({
        where: { type: 'birthday_today', createdAt: { gte: startOfDay }, metadata: { path: ['userId'], equals: c.id } },
      });
      if (already) continue;
      const recipientIds = await allUserIdsExcept(c.id);
      await notify({
        recipientIds,
        type: 'birthday_today',
        title: '🎂 День народження',
        body: `Сьогодні святкує ${c.name}`,
        linkPath: `/users/${c.id}`,
        metadata: { userId: c.id },
      });
    }
  } catch (e) { console.error('[checkBirthdays]', e.message); }
}
