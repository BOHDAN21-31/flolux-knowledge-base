import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasPermission, requirePermission } from '../permissions.js';
import { wrap, logAction } from '../lib.js';
import { notifyCourseCompleted } from '../services/notifications.js';

const router = Router();

export const QUESTION_TYPES = ['single', 'multi', 'text'];

const ms = (d) => (d instanceof Date ? d.getTime() : (d ?? null));

const canManageQuizzes = (u) => hasPermission(u, 'content.publish_digest');
const requireManage = requirePermission('content.publish_digest');

const serializeQuiz = (q, extra = {}) => ({
  id: q.id,
  title: q.title,
  description: q.description || null,
  courseId: q.courseId || null,
  lessonId: q.lessonId || null,
  passingScore: q.passingScore,
  maxAttempts: q.maxAttempts,
  timeLimit: q.timeLimit ?? null,
  shuffleQuestions: !!q.shuffleQuestions,
  showCorrectAnswers: !!q.showCorrectAnswers,
  createdAt: ms(q.createdAt),
  updatedAt: ms(q.updatedAt),
  ...extra,
});

// Question у "публічній" формі — БЕЗ correctAnswer/explanation/isCorrect.
function publicQuestion(q) {
  const opts = Array.isArray(q.options)
    ? q.options.map((o) => ({ id: o.id, text: o.text }))
    : null;
  return {
    id: q.id,
    quizId: q.quizId,
    type: q.type,
    text: q.text,
    options: opts,
    points: q.points,
    orderIdx: q.orderIdx,
  };
}

// Question у повній формі (для admin/preview або після submit з showCorrectAnswers).
function adminQuestion(q) {
  return {
    id: q.id,
    quizId: q.quizId,
    type: q.type,
    text: q.text,
    explanation: q.explanation || null,
    options: Array.isArray(q.options) ? q.options : null,
    correctAnswer: q.correctAnswer || null,
    points: q.points,
    orderIdx: q.orderIdx,
  };
}

const serializeAttempt = (a, extra = {}) => ({
  id: a.id,
  quizId: a.quizId,
  userId: a.userId,
  enrollmentId: a.enrollmentId || null,
  startedAt: ms(a.startedAt),
  submittedAt: ms(a.submittedAt),
  score: a.score ?? null,
  passed: a.passed ?? null,
  attemptNumber: a.attemptNumber,
  ...extra,
});

// Логіка оцінювання одного питання.
// answer для single: string id; multi: array of ids; text: string.
function gradeAnswer(question, answer) {
  if (question.type === 'single') {
    const correct = (question.options || []).find((o) => o.isCorrect)?.id || null;
    const ok = !!correct && answer === correct;
    return { isCorrect: ok, pointsEarned: ok ? question.points : 0 };
  }
  if (question.type === 'multi') {
    const correctSet = new Set((question.options || []).filter((o) => o.isCorrect).map((o) => o.id));
    const given = new Set(Array.isArray(answer) ? answer : []);
    const ok = correctSet.size === given.size && [...correctSet].every((x) => given.has(x));
    return { isCorrect: ok, pointsEarned: ok ? question.points : 0 };
  }
  if (question.type === 'text') {
    const exp = String(question.correctAnswer || '').trim();
    const got = String(answer || '').trim();
    if (!exp) return { isCorrect: false, pointsEarned: 0 };
    // Підтримка regex: якщо починається з / і має закриваючий /flags
    const reMatch = exp.match(/^\/(.+)\/([gimsy]*)$/);
    let ok = false;
    if (reMatch) {
      try { ok = new RegExp(reMatch[1], reMatch[2] || 'i').test(got); }
      catch { ok = false; }
    } else {
      ok = got.toLowerCase() === exp.toLowerCase();
    }
    return { isCorrect: ok, pointsEarned: ok ? question.points : 0 };
  }
  return { isCorrect: false, pointsEarned: 0 };
}

// Якщо це final-quiz курсу й пройдено — завершити курс (якщо всі lessons завершені).
async function maybeCompleteCourseAfterFinalQuiz(attempt, quiz, actor) {
  try {
    if (!attempt.enrollmentId) return;
    // Перевірка: цей quiz є finalQuizId хоча б одного курсу
    const course = await prisma.course.findFirst({
      where: { finalQuizId: quiz.id },
      include: { lessons: { select: { id: true } } },
    });
    if (!course) return;

    const enr = await prisma.enrollment.findUnique({
      where: { id: attempt.enrollmentId },
      include: { progress: true },
    });
    if (!enr || enr.courseId !== course.id) return;
    if (enr.status === 'completed') return;

    const totalLessons = course.lessons.length;
    const doneLessons = enr.progress.filter((p) => p.completedAt).length;
    if (doneLessons < totalLessons) return; // ще не всі уроки

    if (!attempt.passed) return;

    await prisma.enrollment.update({
      where: { id: enr.id },
      data: { completedAt: new Date(), status: 'completed' },
    });
    const user = await prisma.user.findUnique({ where: { id: enr.userId } });
    if (user) notifyCourseCompleted(enr, course, user).catch(() => {});
  } catch (e) { console.error('[maybeCompleteCourseAfterFinalQuiz]', e.message); }
}

// ─── GET /api/quizzes/by-lesson/:lessonId ───
// Повертає quiz прив'язаний до уроку, або null.
router.get('/by-lesson/:lessonId', requireAuth, wrap(async (req, res) => {
  const quiz = await prisma.quiz.findFirst({
    where: { lessonId: req.params.lessonId },
    include: { questions: { select: { id: true } } },
  });
  if (!quiz) return res.json(null);
  res.json(serializeQuiz(quiz, { questionsCount: quiz.questions.length }));
}));

// ─── GET /api/quizzes/by-course/:courseId ───
// Повертає quiz прив'язані до курсу (всі) — наприклад final-quiz або інші.
router.get('/by-course/:courseId', requireAuth, wrap(async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: req.params.courseId },
    include: { questions: { select: { id: true } } },
  });
  res.json(quizzes.map((q) => serializeQuiz(q, { questionsCount: q.questions.length })));
}));

// ─── GET /api/quizzes/:id ───
// Юзер бачить публічну версію (без відповідей).
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { orderIdx: 'asc' } } },
  });
  if (!quiz) return res.status(404).json({ error: 'Тест не знайдено' });
  const manage = canManageQuizzes(req.user);
  const attemptsCount = await prisma.quizAttempt.count({
    where: { quizId: quiz.id, userId: req.user.id, submittedAt: { not: null } },
  });
  res.json(serializeQuiz(quiz, {
    questions: (quiz.questions || []).map(manage ? adminQuestion : publicQuestion),
    questionsCount: quiz.questions?.length || 0,
    myAttempts: attemptsCount,
    attemptsLeft: Math.max(0, quiz.maxAttempts - attemptsCount),
  }));
}));

// ─── GET /api/quizzes/:id/preview ───
router.get('/:id/preview', requireAuth, requireManage, wrap(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { orderIdx: 'asc' } } },
  });
  if (!quiz) return res.status(404).json({ error: 'Не знайдено' });
  res.json(serializeQuiz(quiz, {
    questions: (quiz.questions || []).map(adminQuestion),
    questionsCount: quiz.questions?.length || 0,
  }));
}));

// ─── POST /api/quizzes ─── створити quiz
router.post('/', requireAuth, requireManage, wrap(async (req, res) => {
  const { title, courseId, lessonId } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Потрібний title' });
  if (courseId && lessonId) return res.status(400).json({ error: 'Quiz може бути або курсу, або урока' });
  const quiz = await prisma.quiz.create({
    data: {
      title: String(title).trim(),
      description: req.body.description || null,
      courseId: courseId || null,
      lessonId: lessonId || null,
      passingScore: parseInt(req.body.passingScore, 10) || 80,
      maxAttempts: parseInt(req.body.maxAttempts, 10) || 3,
      timeLimit: req.body.timeLimit ? parseInt(req.body.timeLimit, 10) : null,
      shuffleQuestions: req.body.shuffleQuestions !== false,
      showCorrectAnswers: req.body.showCorrectAnswers !== false,
      createdBy: req.user.id,
    },
  });
  await logAction(req.user.id, 'quiz.created', 'quiz', quiz.id, { title });
  res.json(serializeQuiz(quiz, { questions: [], questionsCount: 0 }));
}));

// ─── PATCH /api/quizzes/:id ───
router.patch('/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const data = {};
  if (req.body?.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body?.description !== undefined) data.description = req.body.description || null;
  if (req.body?.passingScore !== undefined) data.passingScore = parseInt(req.body.passingScore, 10) || 80;
  if (req.body?.maxAttempts !== undefined) data.maxAttempts = parseInt(req.body.maxAttempts, 10) || 3;
  if (req.body?.timeLimit !== undefined) data.timeLimit = req.body.timeLimit ? parseInt(req.body.timeLimit, 10) : null;
  if (req.body?.shuffleQuestions !== undefined) data.shuffleQuestions = !!req.body.shuffleQuestions;
  if (req.body?.showCorrectAnswers !== undefined) data.showCorrectAnswers = !!req.body.showCorrectAnswers;
  if (req.body?.courseId !== undefined) data.courseId = req.body.courseId || null;
  if (req.body?.lessonId !== undefined) data.lessonId = req.body.lessonId || null;
  const quiz = await prisma.quiz.update({ where: { id: req.params.id }, data });
  await logAction(req.user.id, 'quiz.updated', 'quiz', quiz.id, data);
  res.json(serializeQuiz(quiz));
}));

// ─── DELETE /api/quizzes/:id ───
router.delete('/:id', requireAuth, requireManage, wrap(async (req, res) => {
  await prisma.quiz.delete({ where: { id: req.params.id } });
  await logAction(req.user.id, 'quiz.deleted', 'quiz', req.params.id);
  res.json({ ok: true });
}));

// ─── POST /api/quizzes/:id/questions ───
router.post('/:id/questions', requireAuth, requireManage, wrap(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  if (!quiz) return res.status(404).json({ error: 'Не знайдено' });
  const type = QUESTION_TYPES.includes(req.body?.type) ? req.body.type : 'single';
  const last = await prisma.question.findFirst({
    where: { quizId: quiz.id }, orderBy: { orderIdx: 'desc' }, select: { orderIdx: true },
  });
  const orderIdx = (last?.orderIdx ?? -1) + 1;
  // Нормалізуємо options: гарантуємо id для кожної
  let options = null;
  if (type === 'single' || type === 'multi') {
    const incoming = Array.isArray(req.body?.options) ? req.body.options : [];
    options = incoming.map((o, i) => ({
      id: String(o.id || `opt_${Date.now()}_${i}`),
      text: String(o.text || ''),
      isCorrect: !!o.isCorrect,
    }));
  }
  const q = await prisma.question.create({
    data: {
      quizId: quiz.id,
      type,
      text: String(req.body?.text || '').slice(0, 1000),
      explanation: req.body?.explanation || null,
      options: options ? options : undefined,
      correctAnswer: type === 'text' ? (req.body?.correctAnswer || null) : null,
      points: parseInt(req.body?.points, 10) || 1,
      orderIdx,
    },
  });
  res.json(adminQuestion(q));
}));

// ─── PATCH /api/quizzes/questions/:id ───
router.patch('/questions/:id', requireAuth, requireManage, wrap(async (req, res) => {
  const data = {};
  if (req.body?.text !== undefined) data.text = String(req.body.text).slice(0, 1000);
  if (req.body?.explanation !== undefined) data.explanation = req.body.explanation || null;
  if (req.body?.points !== undefined) data.points = parseInt(req.body.points, 10) || 1;
  if (req.body?.type !== undefined && QUESTION_TYPES.includes(req.body.type)) data.type = req.body.type;
  if (req.body?.options !== undefined) {
    if (Array.isArray(req.body.options)) {
      data.options = req.body.options.map((o, i) => ({
        id: String(o.id || `opt_${Date.now()}_${i}`),
        text: String(o.text || ''),
        isCorrect: !!o.isCorrect,
      }));
    } else {
      data.options = null;
    }
  }
  if (req.body?.correctAnswer !== undefined) data.correctAnswer = req.body.correctAnswer || null;
  const q = await prisma.question.update({ where: { id: req.params.id }, data });
  res.json(adminQuestion(q));
}));

// ─── DELETE /api/quizzes/questions/:id ───
router.delete('/questions/:id', requireAuth, requireManage, wrap(async (req, res) => {
  await prisma.question.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ─── POST /api/quizzes/:id/questions/reorder ───
router.post('/:id/questions/reorder', requireAuth, requireManage, wrap(async (req, res) => {
  const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
  for (const o of orders) {
    if (!o?.id) continue;
    await prisma.question.update({
      where: { id: o.id }, data: { orderIdx: parseInt(o.orderIdx, 10) || 0 },
    }).catch(() => {});
  }
  res.json({ ok: true });
}));

// ─── POST /api/quizzes/:id/start ─── почати нову спробу
router.post('/:id/start', requireAuth, wrap(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { orderIdx: 'asc' } } },
  });
  if (!quiz) return res.status(404).json({ error: 'Не знайдено' });
  if ((quiz.questions || []).length === 0) return res.status(400).json({ error: 'У тесті ще немає питань' });

  // Якщо quiz прив'язано до курсу — потрібен enrollment
  let enrollmentId = null;
  const finalForCourse = await prisma.course.findFirst({ where: { finalQuizId: quiz.id } });
  const owningCourseId = finalForCourse?.id || quiz.courseId || null;
  if (owningCourseId) {
    const enr = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId: owningCourseId } },
    });
    if (!enr) return res.status(403).json({ error: 'Вам не призначено відповідний курс' });
    enrollmentId = enr.id;
  } else if (quiz.lessonId) {
    // lesson-quiz: потрібен enrollment на курс уроку
    const lesson = await prisma.lesson.findUnique({ where: { id: quiz.lessonId } });
    if (lesson) {
      const enr = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user.id, courseId: lesson.courseId } },
      });
      if (enr) enrollmentId = enr.id;
    }
  }

  // Перевірка attempts
  const submitted = await prisma.quizAttempt.count({
    where: { quizId: quiz.id, userId: req.user.id, submittedAt: { not: null } },
  });
  if (submitted >= quiz.maxAttempts) {
    return res.status(403).json({ error: `Вичерпано спроб (${quiz.maxAttempts})` });
  }

  // Якщо є незавершена спроба — повертаємо її
  const open = await prisma.quizAttempt.findFirst({
    where: { quizId: quiz.id, userId: req.user.id, submittedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  let attempt = open;
  if (!attempt) {
    attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id, userId: req.user.id, enrollmentId,
        attemptNumber: submitted + 1,
      },
    });
  }

  // Готуємо питання (опц. перемішуємо)
  let questions = (quiz.questions || []).map(publicQuestion);
  if (quiz.shuffleQuestions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }
  res.json({
    attemptId: attempt.id,
    quiz: serializeQuiz(quiz),
    questions,
    startedAt: ms(attempt.startedAt),
    attemptNumber: attempt.attemptNumber,
    timeLimit: quiz.timeLimit || null,
  });
}));

// ─── POST /api/quizzes/attempts/:id/submit ─── відправити відповіді
router.post('/attempts/:id/submit', requireAuth, wrap(async (req, res) => {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: req.params.id },
    include: { quiz: { include: { questions: { orderBy: { orderIdx: 'asc' } } } } },
  });
  if (!attempt) return res.status(404).json({ error: 'Не знайдено' });
  if (attempt.userId !== req.user.id) return res.status(403).json({ error: 'Чужа спроба' });
  if (attempt.submittedAt) return res.status(400).json({ error: 'Спроба вже завершена' });

  const incoming = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const answerByQid = new Map(incoming.map((a) => [a.questionId, a.answer]));

  // Перевірка timeLimit (server-side enforcement)
  let timeExceeded = false;
  if (attempt.quiz.timeLimit) {
    const elapsed = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000;
    if (elapsed > attempt.quiz.timeLimit + 5) { // 5с допуск на мережу
      timeExceeded = true;
    }
  }

  let totalEarned = 0;
  let totalPossible = 0;
  const graded = [];
  for (const q of attempt.quiz.questions) {
    totalPossible += q.points;
    if (timeExceeded) {
      graded.push({ questionId: q.id, answer: answerByQid.get(q.id) ?? null, isCorrect: false, pointsEarned: 0 });
      continue;
    }
    const ans = answerByQid.get(q.id);
    const { isCorrect, pointsEarned } = gradeAnswer(q, ans);
    totalEarned += pointsEarned;
    graded.push({ questionId: q.id, answer: ans ?? null, isCorrect, pointsEarned });
  }
  const score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  const passed = !timeExceeded && score >= attempt.quiz.passingScore;
  const updated = await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      submittedAt: new Date(),
      score, passed, answers: graded,
    },
  });
  await logAction(req.user.id, 'quiz.submitted', 'quiz_attempt', updated.id, {
    quizId: attempt.quizId, score, passed, timeExceeded,
  });

  // Якщо final-quiz курсу й пройдено + усі уроки готові → завершити курс
  maybeCompleteCourseAfterFinalQuiz(updated, attempt.quiz, req.user).catch(() => {});

  // Відповідь юзеру — деталі з isCorrect/explanation, якщо showCorrectAnswers
  const submitted = await prisma.quizAttempt.count({
    where: { quizId: attempt.quizId, userId: req.user.id, submittedAt: { not: null } },
  });
  const attemptsLeft = Math.max(0, attempt.quiz.maxAttempts - submitted);
  const detailedAnswers = graded.map((g) => {
    const q = attempt.quiz.questions.find((x) => x.id === g.questionId);
    return {
      ...g,
      question: attempt.quiz.showCorrectAnswers ? adminQuestion(q) : publicQuestion(q),
    };
  });
  res.json({
    score, passed,
    attemptsLeft,
    timeExceeded,
    submittedAt: ms(updated.submittedAt),
    answers: attempt.quiz.showCorrectAnswers ? detailedAnswers : detailedAnswers.map((d) => ({ questionId: d.questionId, isCorrect: d.isCorrect, pointsEarned: d.pointsEarned })),
  });
}));

// ─── GET /api/quizzes/:id/attempts ─── мої спроби
router.get('/:id/attempts', requireAuth, wrap(async (req, res) => {
  const list = await prisma.quizAttempt.findMany({
    where: { quizId: req.params.id, userId: req.user.id },
    orderBy: { startedAt: 'desc' },
  });
  res.json(list.map((a) => serializeAttempt(a)));
}));

// ─── GET /api/quizzes/attempts/:id ─── деталі моєї спроби
router.get('/attempts/:id', requireAuth, wrap(async (req, res) => {
  const a = await prisma.quizAttempt.findUnique({
    where: { id: req.params.id },
    include: { quiz: { include: { questions: { orderBy: { orderIdx: 'asc' } } } } },
  });
  if (!a) return res.status(404).json({ error: 'Не знайдено' });
  if (a.userId !== req.user.id && !canManageQuizzes(req.user)) return res.status(403).json({ error: 'Чужа спроба' });
  const showAnswers = a.quiz.showCorrectAnswers || canManageQuizzes(req.user);
  const graded = Array.isArray(a.answers) ? a.answers : [];
  const detailed = graded.map((g) => {
    const q = a.quiz.questions.find((x) => x.id === g.questionId);
    return {
      ...g,
      question: showAnswers && q ? adminQuestion(q) : (q ? publicQuestion(q) : null),
    };
  });
  res.json({
    ...serializeAttempt(a),
    quiz: serializeQuiz(a.quiz),
    answers: detailed,
  });
}));

// ─── GET /api/quizzes/:id/attempts/all ─── HR-звіт, усі спроби
router.get('/:id/attempts/all', requireAuth, requireManage, wrap(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { orderIdx: 'asc' } } },
  });
  if (!quiz) return res.status(404).json({ error: 'Не знайдено' });
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id },
    include: { user: { select: { id: true, name: true, surname: true } } },
    orderBy: { startedAt: 'desc' },
  });
  // Статистика по питаннях — % невірних
  const perQuestion = {};
  for (const a of attempts) {
    if (!Array.isArray(a.answers)) continue;
    for (const g of a.answers) {
      const r = (perQuestion[g.questionId] = perQuestion[g.questionId] || { total: 0, wrong: 0 });
      r.total += 1;
      if (!g.isCorrect) r.wrong += 1;
    }
  }
  const submitted = attempts.filter((a) => a.submittedAt);
  const passedCount = submitted.filter((a) => a.passed).length;
  const avg = submitted.length ? Math.round(submitted.reduce((s, a) => s + (a.score || 0), 0) / submitted.length) : 0;
  res.json({
    quiz: serializeQuiz(quiz, {
      questionsCount: quiz.questions.length,
      questions: quiz.questions.map(adminQuestion),
    }),
    stats: {
      totalAttempts: attempts.length,
      submittedAttempts: submitted.length,
      passRate: submitted.length ? Math.round((passedCount / submitted.length) * 100) : 0,
      avgScore: avg,
    },
    perQuestion: Object.entries(perQuestion).map(([qid, r]) => ({
      questionId: qid,
      total: r.total,
      wrongPct: r.total ? Math.round((r.wrong / r.total) * 100) : 0,
    })),
    attempts: attempts.map((a) => ({
      ...serializeAttempt(a),
      user: {
        id: a.user.id,
        name: `${a.user.name}${a.user.surname ? ' ' + a.user.surname : ''}`,
      },
    })),
  });
}));

export default router;
