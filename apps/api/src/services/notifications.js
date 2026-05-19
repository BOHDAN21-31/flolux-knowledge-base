import { prisma } from '../db.js';

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
    if (ids.length === 0) return [];
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
    return allowed;
  } catch (e) {
    console.error('[notify]', type, e.message);
    return [];
  }
}

async function allUserIdsExcept(exceptId) {
  const users = await prisma.user.findMany({ select: { id: true } });
  return users.map((u) => u.id).filter((id) => id !== exceptId);
}

export async function notifyNewArticle(article, actor) {
  try {
    const mode = article.notifyMode;
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
