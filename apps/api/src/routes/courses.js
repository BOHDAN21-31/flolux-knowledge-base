import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasPermission, requirePermission } from '../permissions.js';
import { wrap, logAction, roleList } from '../lib.js';
import {
  notifyEnrollmentAssigned,
  notifyCourseCompleted,
  notifyCourseReminder,
} from '../services/notifications.js';

const router = Router();

export const COURSE_CATEGORIES = ['onboarding', 'role_specific', 'general', 'advanced'];

const ms = (d) => (d instanceof Date ? d.getTime() : (d ?? null));

// Право керування курсами — як для дайджестів (admin або HR з content.publish_digest).
const canManageCourses = (u) => hasPermission(u, 'content.publish_digest');
const requireManage = requirePermission('content.publish_digest');

const serializeCourse = (c, extra = {}) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  description: c.description || null,
  category: c.category,
  iconKey: c.iconKey || null,
  color: c.color || null,
  coverUrl: c.coverUrl || null,
  estimatedMinutes: c.estimatedMinutes ?? null,
  targetRoles: c.targetRoles || [],
  isOnboarding: !!c.isOnboarding,
  finalQuizId: c.finalQuizId || null,
  dueDays: c.dueDays ?? null,
  publishedAt: ms(c.publishedAt),
  isPublished: !!c.publishedAt,
  authorId: c.authorId || null,
  authorName: c.author?.name || null,
  createdAt: ms(c.createdAt),
  updatedAt: ms(c.updatedAt),
  ...extra,
});

const serializeLesson = (l, extra = {}) => ({
  id: l.id,
  courseId: l.courseId,
  title: l.title,
  body: l.body || '',
  videoUrl: l.videoUrl || null,
  attachments: Array.isArray(l.attachments) ? l.attachments : [],
  orderIdx: l.orderIdx,
  estimatedMinutes: l.estimatedMinutes ?? null,
  createdAt: ms(l.createdAt),
  updatedAt: ms(l.updatedAt),
  ...extra,
});

const serializeEnrollment = (e, extra = {}) => ({
  id: e.id,
  userId: e.userId,
  courseId: e.courseId,
  enrolledBy: e.enrolledBy || null,
  enrolledAt: ms(e.enrolledAt),
  startedAt: ms(e.startedAt),
  completedAt: ms(e.completedAt),
  dueAt: ms(e.dueAt),
  status: e.status,
  ...extra,
});

// Прогрес enrollment — кількість завершених lessons та pct.
function progressFor(enrollment, lessons) {
  const total = lessons.length;
  const done = (enrollment.progress || []).filter((p) => !!p.completedAt).length;
  return {
    total,
    completed: done,
    progressPct: total ? Math.round((done / total) * 100) : 0,
  };
}

// ── GET /api/courses — список ──
// Не-manage: лише опубліковані (інші бачать тільки свої enrollments).
router.get('/', requireAuth, wrap(async (req, res) => {
  const manage = canManageCourses(req.user);
  const where = manage ? {} : { publishedAt: { not: null } };
  if (req.query.category && COURSE_CATEGORIES.includes(req.query.category)) {
    where.category = req.query.category;
  }
  const courses = await prisma.course.findMany({
    where, orderBy: [{ category: 'asc' }, { title: 'asc' }],
    include: {
      author: { select: { id: true, name: true } },
      lessons: { select: { id: true } },
    },
  });
  // Enrollments цього юзера
  const myEnrolls = await prisma.enrollment.findMany({
    where: { userId: req.user.id, courseId: { in: courses.map((c) => c.id) } },
    include: { progress: true },
  });
  const enrollByCourse = new Map(myEnrolls.map((e) => [e.courseId, e]));

  res.json(courses.map((c) => {
    const enr = enrollByCourse.get(c.id) || null;
    const enrollment = enr
      ? { ...serializeEnrollment(enr), ...progressFor(enr, c.lessons) }
      : null;
    return serializeCourse(c, { lessonsCount: c.lessons.length, enrollment });
  }));
}));

// ── GET /api/users/me/courses ──
router.get('/me/list', requireAuth, wrap(async (req, res) => {
  const enrolls = await prisma.enrollment.findMany({
    where: { userId: req.user.id },
    include: {
      course: { include: { lessons: { select: { id: true } }, author: { select: { id: true, name: true } } } },
      progress: true,
    },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json(enrolls.map((e) => ({
    ...serializeEnrollment(e),
    ...progressFor(e, e.course.lessons),
    course: serializeCourse(e.course, { lessonsCount: e.course.lessons.length }),
  })));
}));

// ── GET /api/users/me/onboarding — для HomeView ──
router.get('/me/onboarding', requireAuth, wrap(async (req, res) => {
  const enr = await prisma.enrollment.findFirst({
    where: {
      userId: req.user.id,
      course: { isOnboarding: true, publishedAt: { not: null } },
    },
    include: {
      course: { include: { lessons: { select: { id: true } } } },
      progress: true,
    },
  });
  if (!enr) return res.json(null);
  res.json({
    ...serializeEnrollment(enr),
    ...progressFor(enr, enr.course.lessons),
    course: serializeCourse(enr.course, { lessonsCount: enr.course.lessons.length }),
  });
}));

// ── GET /api/courses/users/:id/completed — публічні завершені курси юзера ──
router.get('/users/:id/completed', requireAuth, wrap(async (req, res) => {
  const enrolls = await prisma.enrollment.findMany({
    where: { userId: req.params.id, status: 'completed' },
    include: { course: { select: { id: true, slug: true, title: true, category: true, color: true, iconKey: true } } },
    orderBy: { completedAt: 'desc' },
  });
  res.json(enrolls.map((e) => ({
    enrollmentId: e.id,
    completedAt: ms(e.completedAt),
    course: {
      id: e.course.id, slug: e.course.slug, title: e.course.title,
      category: e.course.category, color: e.course.color, iconKey: e.course.iconKey,
    },
  })));
}));

// ── GET /api/courses/:slug ──
router.get('/:slug', requireAuth, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { slug: req.params.slug },
    include: {
      author: { select: { id: true, name: true } },
      lessons: { orderBy: { orderIdx: 'asc' } },
    },
  });
  if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
  const manage = canManageCourses(req.user);
  if (!course.publishedAt && !manage) {
    return res.status(403).json({ error: 'Курс ще не опубліковано' });
  }
  const enr = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
    include: { progress: true },
  });

  const progressMap = new Map((enr?.progress || []).map((p) => [p.lessonId, p]));
  // Знаходимо перший незавершений — це current. Усі попередні відкриті, наступні — locked.
  let firstIncomplete = -1;
  const lessons = course.lessons.map((l, idx) => {
    const p = progressMap.get(l.id);
    const completed = !!p?.completedAt;
    if (!completed && firstIncomplete === -1) firstIncomplete = idx;
    return { ...serializeLesson(l), completedAt: ms(p?.completedAt), isCurrent: false, isLocked: false };
  });
  if (enr) {
    lessons.forEach((l, idx) => {
      l.isCurrent = idx === firstIncomplete;
      l.isLocked = firstIncomplete !== -1 && idx > firstIncomplete;
    });
  } else {
    lessons.forEach((l) => { l.isLocked = true; });
  }

  const enrollment = enr
    ? { ...serializeEnrollment(enr), ...progressFor(enr, course.lessons) }
    : null;

  res.json({
    ...serializeCourse(course, { lessonsCount: course.lessons.length, lessons, enrollment }),
  });
}));

// ── GET /api/courses/:slug/lessons/:lessonId ──
// Перевірка: enrollment існує, попередні lessons завершені, lesson належить цьому курсу.
router.get('/:slug/lessons/:lessonId', requireAuth, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { slug: req.params.slug },
    include: { lessons: { orderBy: { orderIdx: 'asc' } } },
  });
  if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
  const lessonIdx = course.lessons.findIndex((l) => l.id === req.params.lessonId);
  if (lessonIdx < 0) return res.status(404).json({ error: 'Урок не належить цьому курсу' });
  const lesson = course.lessons[lessonIdx];

  // Адмін/HR — повний доступ навіть без enrollment (для preview)
  const manage = canManageCourses(req.user);
  if (!manage) {
    const enr = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
      include: { progress: true },
    });
    if (!enr) return res.status(403).json({ error: 'Вам не призначено цей курс' });
    if (!course.publishedAt) return res.status(403).json({ error: 'Курс не опубліковано' });
    // Усі попередні — мають бути completed
    const progressMap = new Map(enr.progress.map((p) => [p.lessonId, p]));
    for (let i = 0; i < lessonIdx; i++) {
      const p = progressMap.get(course.lessons[i].id);
      if (!p?.completedAt) {
        return res.status(403).json({ error: 'Завершіть попередній урок' });
      }
    }
  }

  res.json({
    ...serializeLesson(lesson),
    courseSlug: course.slug,
    courseTitle: course.title,
    isFirst: lessonIdx === 0,
    isLast: lessonIdx === course.lessons.length - 1,
    nextLessonId: lessonIdx < course.lessons.length - 1 ? course.lessons[lessonIdx + 1].id : null,
    prevLessonId: lessonIdx > 0 ? course.lessons[lessonIdx - 1].id : null,
  });
}));

// ── POST /api/courses ──
router.post('/', requireAuth, requireManage, wrap(async (req, res) => {
  const { slug, title, category } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'Потрібні slug і title' });
  if (!COURSE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Невірна категорія' });
  const exists = await prisma.course.findUnique({ where: { slug } });
  if (exists) return res.status(409).json({ error: 'Курс з таким slug вже існує' });
  const course = await prisma.course.create({
    data: {
      slug: String(slug).trim(),
      title: String(title).trim(),
      description: req.body.description || null,
      category,
      iconKey: req.body.iconKey || null,
      color: req.body.color || null,
      coverUrl: req.body.coverUrl || null,
      estimatedMinutes: req.body.estimatedMinutes ? parseInt(req.body.estimatedMinutes, 10) : null,
      targetRoles: Array.isArray(req.body.targetRoles) ? req.body.targetRoles : [],
      isOnboarding: !!req.body.isOnboarding,
      dueDays: req.body.dueDays ? parseInt(req.body.dueDays, 10) : null,
      authorId: req.user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'course.created', 'course', course.id, { title, slug });
  res.json(serializeCourse(course, { lessonsCount: 0 }));
}));

// ── PATCH /api/courses/:id ──
router.patch('/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const data = {};
  for (const key of ['title', 'description', 'iconKey', 'color', 'coverUrl']) {
    if (req.body?.[key] !== undefined) data[key] = req.body[key] || null;
  }
  if (req.body?.category !== undefined) {
    if (!COURSE_CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'Невірна категорія' });
    data.category = req.body.category;
  }
  if (req.body?.estimatedMinutes !== undefined) {
    data.estimatedMinutes = req.body.estimatedMinutes ? parseInt(req.body.estimatedMinutes, 10) : null;
  }
  if (req.body?.dueDays !== undefined) {
    data.dueDays = req.body.dueDays ? parseInt(req.body.dueDays, 10) : null;
  }
  if (req.body?.targetRoles !== undefined) {
    data.targetRoles = Array.isArray(req.body.targetRoles) ? req.body.targetRoles : [];
  }
  if (req.body?.isOnboarding !== undefined) data.isOnboarding = !!req.body.isOnboarding;

  const course = await prisma.course.update({
    where: { id: req.params.id }, data,
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'course.updated', 'course', course.id, data);
  res.json(serializeCourse(course));
}));

// ── DELETE /api/courses/:id — лише admin ──
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  if (!hasPermission(req.user, 'system.manage_topics')) {
    return res.status(403).json({ error: 'Доступ лише для адміністратора' });
  }
  const existing = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.course.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'course.deleted', 'course', req.params.id, { title: existing.title });
  res.json({ ok: true });
}));

// ── POST /api/courses/:id/publish ──
router.post('/:id/publish', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.update({
    where: { id: req.params.id }, data: { publishedAt: new Date() },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'course.published', 'course', course.id);
  res.json(serializeCourse(course));
}));

// ── POST /api/courses/:id/unpublish ──
router.post('/:id/unpublish', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.update({
    where: { id: req.params.id }, data: { publishedAt: null },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAction(req.user.id, 'course.unpublished', 'course', course.id);
  res.json(serializeCourse(course));
}));

// ── POST /api/courses/:id/lessons ──
router.post('/:id/lessons', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return res.status(404).json({ error: 'Не знайдено' });
  const last = await prisma.lesson.findFirst({
    where: { courseId: course.id }, orderBy: { orderIdx: 'desc' }, select: { orderIdx: true },
  });
  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      title: String(req.body?.title || 'Новий урок').slice(0, 200),
      body: req.body?.body || null,
      videoUrl: req.body?.videoUrl || null,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : null,
      orderIdx: (last?.orderIdx ?? -1) + 1,
      estimatedMinutes: req.body?.estimatedMinutes ? parseInt(req.body.estimatedMinutes, 10) : null,
    },
  });
  res.json(serializeLesson(lesson));
}));

// ── PATCH /api/lessons/:id ──
router.patch('/lessons/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const data = {};
  if (req.body?.title !== undefined) data.title = String(req.body.title).slice(0, 200);
  if (req.body?.body !== undefined) data.body = req.body.body || null;
  if (req.body?.videoUrl !== undefined) data.videoUrl = req.body.videoUrl || null;
  if (req.body?.attachments !== undefined) data.attachments = Array.isArray(req.body.attachments) ? req.body.attachments : null;
  if (req.body?.estimatedMinutes !== undefined) {
    data.estimatedMinutes = req.body.estimatedMinutes ? parseInt(req.body.estimatedMinutes, 10) : null;
  }
  const lesson = await prisma.lesson.update({ where: { id: req.params.id }, data });
  res.json(serializeLesson(lesson));
}));

// ── DELETE /api/lessons/:id ──
router.delete('/lessons/:id', requireAuth, requireManage, wrap(async (req, res) => {
  await prisma.lesson.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ── POST /api/courses/:id/lessons/reorder ── {lessonOrders:[{id, orderIdx}]}
router.post('/:id/lessons/reorder', requireAuth, requireManage, wrap(async (req, res) => {
  const orders = Array.isArray(req.body?.lessonOrders) ? req.body.lessonOrders : [];
  for (const o of orders) {
    if (!o?.id) continue;
    await prisma.lesson.update({
      where: { id: o.id }, data: { orderIdx: parseInt(o.orderIdx, 10) || 0 },
    }).catch(() => {});
  }
  res.json({ ok: true });
}));

// ── POST /api/courses/:id/enroll ──
router.post('/:id/enroll', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
  const { userId, dueAt } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Не вказано userId' });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });

  const due = dueAt ? new Date(dueAt) : (course.dueDays ? new Date(Date.now() + course.dueDays * 86400e3) : null);
  const enr = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    update: { enrolledBy: req.user.id, dueAt: due, status: 'assigned' },
    create: { userId, courseId: course.id, enrolledBy: req.user.id, dueAt: due, status: 'assigned' },
  });
  await logAction(req.user.id, 'course.enrolled', 'enrollment', enr.id, { userId, courseId: course.id });
  notifyEnrollmentAssigned(enr, course, user, req.user).catch(() => {});
  res.json(serializeEnrollment(enr));
}));

// ── POST /api/courses/:id/enroll-bulk ──
router.post('/:id/enroll-bulk', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((x) => typeof x === 'string') : [];
  if (userIds.length === 0) return res.status(400).json({ error: 'Не вказано адресатів' });
  const due = req.body?.dueAt
    ? new Date(req.body.dueAt)
    : (course.dueDays ? new Date(Date.now() + course.dueDays * 86400e3) : null);

  const created = [];
  for (const userId of userIds) {
    try {
      const enr = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        update: { enrolledBy: req.user.id, dueAt: due, status: 'assigned' },
        create: { userId, courseId: course.id, enrolledBy: req.user.id, dueAt: due, status: 'assigned' },
      });
      created.push(enr);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) notifyEnrollmentAssigned(enr, course, user, req.user).catch(() => {});
    } catch (e) { /* skip */ }
  }
  await logAction(req.user.id, 'course.enroll_bulk', 'course', course.id, { count: created.length });
  res.json({ ok: true, count: created.length });
}));

// ── DELETE /api/enrollments/:id ──
router.delete('/enrollments/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const existing = await prisma.enrollment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.enrollment.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'course.unenrolled', 'enrollment', req.params.id, { userId: existing.userId });
  res.json({ ok: true });
}));

// ── GET /api/courses/:id/enrollments ──
router.get('/:id/enrollments', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { lessons: { select: { id: true } } },
  });
  if (!course) return res.status(404).json({ error: 'Не знайдено' });
  const list = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    include: {
      user: { select: { id: true, name: true, surname: true, avatarUrl: true, roles: true } },
      progress: true,
    },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json(list.map((e) => ({
    ...serializeEnrollment(e),
    ...progressFor(e, course.lessons),
    user: {
      id: e.user.id,
      name: `${e.user.name}${e.user.surname ? ' ' + e.user.surname : ''}`,
      avatarUrl: e.user.avatarUrl || null,
      roles: (e.user.roles || []).map((r) => r.role),
    },
  })));
}));

// ── POST /api/courses/:id/remind ── надіслати нагадування юзерам
router.post('/:id/remind', requireAuth, requireManage, wrap(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return res.status(404).json({ error: 'Не знайдено' });
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((x) => typeof x === 'string') : [];
  if (userIds.length === 0) return res.status(400).json({ error: 'Не вказано адресатів' });
  notifyCourseReminder(course, userIds, req.user).catch(() => {});
  await logAction(req.user.id, 'course.remind', 'course', course.id, { count: userIds.length });
  res.json({ ok: true, sent: userIds.length });
}));

// ── POST /api/lessons/:lessonId/complete ──
router.post('/lessons/:lessonId/complete', requireAuth, wrap(async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.lessonId },
    include: { course: { include: { lessons: { orderBy: { orderIdx: 'asc' } } } } },
  });
  if (!lesson) return res.status(404).json({ error: 'Урок не знайдено' });

  const enr = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId: lesson.courseId } },
    include: { progress: true },
  });
  if (!enr) return res.status(403).json({ error: 'Вам не призначено цей курс' });

  // Перевірка послідовності
  const lessonIdx = lesson.course.lessons.findIndex((l) => l.id === lesson.id);
  const progressMap = new Map(enr.progress.map((p) => [p.lessonId, p]));
  for (let i = 0; i < lessonIdx; i++) {
    const p = progressMap.get(lesson.course.lessons[i].id);
    if (!p?.completedAt) {
      return res.status(403).json({ error: 'Завершіть попередній урок' });
    }
  }

  // Upsert LessonProgress + бамп enrollment.startedAt
  const completedAt = new Date();
  const progress = await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enr.id, lessonId: lesson.id } },
    update: { completedAt },
    create: { enrollmentId: enr.id, lessonId: lesson.id, completedAt },
  });

  if (!enr.startedAt) {
    await prisma.enrollment.update({ where: { id: enr.id }, data: { startedAt: new Date(), status: 'in_progress' } });
  } else if (enr.status === 'assigned') {
    await prisma.enrollment.update({ where: { id: enr.id }, data: { status: 'in_progress' } });
  }

  // Перевірка завершення курсу
  const totalLessons = lesson.course.lessons.length;
  const updatedProgress = await prisma.lessonProgress.count({
    where: { enrollmentId: enr.id, completedAt: { not: null } },
  });
  let isCourseComplete = false;
  if (updatedProgress >= totalLessons && totalLessons > 0) {
    await prisma.enrollment.update({
      where: { id: enr.id },
      data: { completedAt: new Date(), status: 'completed' },
    });
    isCourseComplete = true;
    notifyCourseCompleted(enr, lesson.course, req.user).catch(() => {});
  }

  res.json({
    ok: true,
    completedAt: ms(progress.completedAt),
    isCourseComplete,
    enrollmentId: enr.id,
  });
}));

// ── GET /api/enrollments/:id/certificate ──
router.get('/enrollments/:id/certificate', requireAuth, wrap(async (req, res) => {
  const enr = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: {
      course: true,
      user: { select: { id: true, name: true, surname: true } },
    },
  });
  if (!enr) return res.status(404).json({ error: 'Не знайдено' });
  if (enr.userId !== req.user.id && !canManageCourses(req.user)) {
    return res.status(403).json({ error: 'Доступ заборонено' });
  }
  if (!enr.completedAt || enr.status !== 'completed') {
    return res.status(400).json({ error: 'Курс не завершено' });
  }
  res.json({
    certificateId: enr.id,
    courseName: enr.course.title,
    courseSlug: enr.course.slug,
    userName: `${enr.user.name}${enr.user.surname ? ' ' + enr.user.surname : ''}`,
    enrolledAt: ms(enr.enrolledAt),
    completedAt: ms(enr.completedAt),
  });
}));

export default router;
