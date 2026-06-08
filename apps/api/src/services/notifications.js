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
  // announcement — спеціальна перевірка announcementsAll/UrgentOnly у notifyAnnouncement
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

// Категорії документів — для людських заголовків сповіщень.
const DOC_CATEGORY_LABELS = {
  conduct: 'Правила поведінки',
  schedule: 'Графік',
  communication: 'Комунікація',
  policies: 'Політика',
};

// Hr-set + admin отримають це сповіщення, тому що вони керують документами,
// проте якщо вони ж і обов'язкові читачі — вони отримають його як звичайні.
function docIsMandatoryFor(doc, roles, locIds) {
  const hasRoles = (doc.mandatoryForRoles || []).length > 0;
  const hasLocs = (doc.mandatoryForLocations || []).length > 0;
  if (!hasRoles && !hasLocs) return false;
  if (hasRoles && doc.mandatoryForRoles.some((r) => roles.includes(r))) return true;
  if (hasLocs && doc.mandatoryForLocations.some((l) => locIds.includes(l))) return true;
  return false;
}

// notify обов'язковим читачам про публікацію/нову версію документа.
export async function notifyDocPublished(doc, actor, firstPublish) {
  try {
    const users = await prisma.user.findMany({
      where: { approved: true, id: { not: actor?.id || undefined } },
      include: {
        roles: { select: { role: true } },
        locations: { where: { approved: true }, select: { locationId: true } },
      },
    });
    const recipientIds = users
      .filter((u) => docIsMandatoryFor(doc, u.roles.map((r) => r.role), u.locations.map((l) => l.locationId)))
      .map((u) => u.id);
    if (recipientIds.length === 0) return;
    const catLabel = DOC_CATEGORY_LABELS[doc.category] || 'Документ';
    await notify({
      recipientIds,
      type: 'doc_published',
      title: firstPublish ? `[${catLabel}] Новий документ` : `[${catLabel}] Документ оновлено`,
      body: firstPublish
        ? doc.title
        : `${doc.title} — потрібне повторне підтвердження`,
      linkPath: `/docs/${doc.slug}`,
      actorId: actor?.id || null,
      metadata: { docId: doc.id, version: doc.currentVersion, firstPublish: !!firstPublish },
    });
  } catch (e) { console.error('[notifyDocPublished]', e.message); }
}

// Нагадування юзерам, що не підтвердили прочитання.
export async function notifyDocAckReminder(doc, userIds, actor) {
  try {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) return;
    const catLabel = DOC_CATEGORY_LABELS[doc.category] || 'Документ';
    await notify({
      recipientIds: ids,
      type: 'doc_reminder',
      title: `[${catLabel}] Нагадування про документ`,
      body: `Будь ласка, ознайомтесь: ${doc.title}`,
      linkPath: `/docs/${doc.slug}`,
      actorId: actor?.id || null,
      metadata: { docId: doc.id, version: doc.currentVersion },
    });
  } catch (e) { console.error('[notifyDocAckReminder]', e.message); }
}

// Заголовки/мітки категорій оголошень.
const ANNOUNCEMENT_LABELS = {
  urgent: 'Терміново',
  process: 'Зміни в процесах',
  deadline: 'Дедлайн',
  tech_update: 'Технічне оновлення',
  org_change: 'Організаційне',
};

// Сповіщення про оголошення.
// Враховує announcementsAll/UrgentOnly та targetRoles/targetLocations.
export async function notifyAnnouncement(ann, actor) {
  try {
    // Список усіх потенційних адресатів за таргетингом.
    const hasRoles = Array.isArray(ann.targetRoles) && ann.targetRoles.length > 0;
    const hasLocs = Array.isArray(ann.targetLocations) && ann.targetLocations.length > 0;

    let recipientIds = [];
    if (!hasRoles && !hasLocs) {
      recipientIds = await allUserIdsExcept(ann.authorId);
    } else {
      const idSets = [];
      if (hasRoles) {
        const rows = await prisma.userRole.findMany({
          where: { role: { in: ann.targetRoles } }, select: { userId: true },
        });
        idSets.push(new Set(rows.map((r) => r.userId)));
      }
      if (hasLocs) {
        const rows = await prisma.userLocation.findMany({
          where: { locationId: { in: ann.targetLocations }, approved: true }, select: { userId: true },
        });
        idSets.push(new Set(rows.map((r) => r.userId)));
      }
      // Об'єднання таргетів (роль АБО локація)
      const merged = new Set();
      idSets.forEach((s) => s.forEach((id) => merged.add(id)));
      recipientIds = [...merged].filter((id) => id !== ann.authorId);
    }
    if (recipientIds.length === 0) return;

    // Фільтр за announcementsAll / announcementsUrgentOnly
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: recipientIds } },
      select: { userId: true, announcementsAll: true, announcementsUrgentOnly: true },
    });
    const prefMap = new Map(prefs.map((p) => [p.userId, p]));
    const isUrgent = ann.priority === 'urgent';
    const allowed = recipientIds.filter((id) => {
      const p = prefMap.get(id);
      if (!p) return true; // дефолт — все увімкнено
      if (p.announcementsAll === false) return false;
      if (p.announcementsUrgentOnly === true && !isUrgent) return false;
      return true;
    });
    if (allowed.length === 0) return;

    const catLabel = ANNOUNCEMENT_LABELS[ann.category] || 'Оголошення';
    await notify({
      recipientIds: allowed,
      type: 'announcement',
      title: `[${catLabel}] ${ann.title}`,
      body: String(ann.body || '').slice(0, 240),
      linkPath: `/announcements/${ann.id}`,
      actorId: actor?.id || ann.authorId,
      metadata: { announcementId: ann.id, category: ann.category, priority: ann.priority },
    });
  } catch (e) { console.error('[notifyAnnouncement]', e.message); }
}

// ─── 1:1 зустрічі (HR/manager ↔ працівник) ───
const fmtDateTime = (d) => new Date(d).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
const TYPE_PREF_OO = 'oneOnOnesEnabled';

export async function notifyOneOnOneScheduled(oo) {
  try {
    if (!oo?.employeeId || oo.employeeId === oo.organizerId) return;
    const organizer = oo.organizer || await prisma.user.findUnique({ where: { id: oo.organizerId }, select: { name: true } });
    await notify({
      recipientIds: [oo.employeeId],
      type: 'one_on_one_scheduled',
      title: '📅 Заплановано зустріч 1:1',
      body: `${fmtDateTime(oo.scheduledAt)} · ${oo.duration || 30} хв${organizer?.name ? ' · з ' + organizer.name : ''}`,
      linkPath: '/profile',
      actorId: oo.organizerId,
      metadata: { oneOnOneId: oo.id },
      prefKey: TYPE_PREF_OO,
    });
  } catch (e) { console.error('[notifyOneOnOneScheduled]', e.message); }
}

export async function notifyOneOnOneRescheduled(oo, prevAt) {
  try {
    if (!oo?.employeeId) return;
    await notify({
      recipientIds: [oo.employeeId],
      type: 'one_on_one_rescheduled',
      title: '📅 Зустріч 1:1 перенесено',
      body: `Новий час: ${fmtDateTime(oo.scheduledAt)} (було ${fmtDateTime(prevAt)})`,
      linkPath: '/profile',
      actorId: oo.organizerId,
      metadata: { oneOnOneId: oo.id },
      prefKey: TYPE_PREF_OO,
    });
  } catch (e) { console.error('[notifyOneOnOneRescheduled]', e.message); }
}

export async function notifyOneOnOneCancelled(oo) {
  try {
    if (!oo?.employeeId) return;
    await notify({
      recipientIds: [oo.employeeId],
      type: 'one_on_one_cancelled',
      title: '📅 Зустріч 1:1 скасовано',
      body: `Скасовано на ${fmtDateTime(oo.scheduledAt)}`,
      linkPath: '/profile',
      actorId: oo.organizerId,
      metadata: { oneOnOneId: oo.id },
      prefKey: TYPE_PREF_OO,
    });
  } catch (e) { console.error('[notifyOneOnOneCancelled]', e.message); }
}

export async function notifyOneOnOneCompleted(oo) {
  try {
    if (!oo?.employeeId) return;
    await notify({
      recipientIds: [oo.employeeId],
      type: 'one_on_one_completed',
      title: '✅ Зустріч 1:1 завершено',
      body: oo.outcome ? `Результат: ${oo.outcome}` : 'Зустріч позначено як завершену',
      linkPath: '/profile',
      actorId: oo.organizerId,
      metadata: { oneOnOneId: oo.id },
      prefKey: TYPE_PREF_OO,
    });
  } catch (e) { console.error('[notifyOneOnOneCompleted]', e.message); }
}

// Лінивий планувальник — нагадування за день до зустрічі (запускати з checkBirthdays/Publishing).
let lastOoReminderCheck = 0;
export async function checkOneOnOneReminders() {
  try {
    if (Date.now() - lastOoReminderCheck < 60 * 60 * 1000) return; // раз на годину
    lastOoReminderCheck = Date.now();
    const inDay = new Date(Date.now() + 24 * 3600e3);
    const inDayLater = new Date(Date.now() + 26 * 3600e3); // вікно 2 години
    const due = await prisma.oneOnOne.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { gte: inDay, lt: inDayLater },
      },
      include: { organizer: { select: { name: true } } },
      take: 50,
    });
    for (const oo of due) {
      const existing = await prisma.notification.findFirst({
        where: { type: 'one_on_one_reminder', metadata: { path: ['oneOnOneId'], equals: oo.id } },
      });
      if (existing) continue;
      await notify({
        recipientIds: [oo.employeeId],
        type: 'one_on_one_reminder',
        title: '⏰ Завтра у вас 1:1',
        body: `${fmtDateTime(oo.scheduledAt)}${oo.organizer?.name ? ' · з ' + oo.organizer.name : ''}`,
        linkPath: '/profile',
        actorId: oo.organizerId,
        metadata: { oneOnOneId: oo.id },
        prefKey: TYPE_PREF_OO,
      });
    }
  } catch (e) { console.error('[checkOneOnOneReminders]', e.message); }
}

// Автозапис юзера на onboarding-курси при першому approve.
// Знаходимо опубліковані курси з isOnboarding=true, де targetRoles порожнє
// АБО містить хоча б одну роль юзера.
export async function autoEnrollOnboarding(userId, actorId = null) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }, include: { roles: true },
    });
    if (!user) return;
    const userRoles = (user.roles || []).map((r) => r.role);
    const courses = await prisma.course.findMany({
      where: { isOnboarding: true, publishedAt: { not: null } },
    });
    for (const c of courses) {
      const targets = c.targetRoles || [];
      const matches = targets.length === 0 || targets.some((r) => userRoles.includes(r));
      if (!matches) continue;
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: c.id } },
      });
      if (existing) continue;
      const due = c.dueDays ? new Date(Date.now() + c.dueDays * 86400e3) : null;
      const enr = await prisma.enrollment.create({
        data: { userId, courseId: c.id, enrolledBy: actorId, dueAt: due, status: 'assigned' },
      });
      notifyEnrollmentAssigned(enr, c, user, actorId ? { id: actorId } : null).catch(() => {});
    }
  } catch (e) { console.error('[autoEnrollOnboarding]', e.message); }
}

// ─── LMS: курси ───
export async function notifyEnrollmentAssigned(enrollment, course, user, actor) {
  try {
    if (!user || user.id === actor?.id) return;
    const dueText = enrollment.dueAt
      ? `Дедлайн: ${new Date(enrollment.dueAt).toLocaleDateString('uk-UA')}`
      : (course.estimatedMinutes ? `~${course.estimatedMinutes} хв` : null);
    await notify({
      recipientIds: [user.id],
      type: 'course_assigned',
      title: `🎓 Вам призначено курс`,
      body: `${course.title}${dueText ? ' · ' + dueText : ''}`,
      linkPath: `/courses/${course.slug}`,
      actorId: actor?.id || null,
      metadata: { courseId: course.id, enrollmentId: enrollment.id },
    });
  } catch (e) { console.error('[notifyEnrollmentAssigned]', e.message); }
}

export async function notifyCourseCompleted(enrollment, course, user) {
  try {
    if (!user) return;
    await notify({
      recipientIds: [user.id],
      type: 'course_completed',
      title: `🎉 Ви завершили курс`,
      body: `${course.title} — сертифікат доступний у профілі`,
      linkPath: `/courses/${course.slug}`,
      metadata: { courseId: course.id, enrollmentId: enrollment.id },
    });
  } catch (e) { console.error('[notifyCourseCompleted]', e.message); }
}

export async function notifyCourseReminder(course, userIds, actor) {
  try {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) return;
    await notify({
      recipientIds: ids,
      type: 'course_due_soon',
      title: `🎓 Нагадування про курс`,
      body: `Не забудьте пройти: ${course.title}`,
      linkPath: `/courses/${course.slug}`,
      actorId: actor?.id || null,
      metadata: { courseId: course.id },
    });
  } catch (e) { console.error('[notifyCourseReminder]', e.message); }
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
