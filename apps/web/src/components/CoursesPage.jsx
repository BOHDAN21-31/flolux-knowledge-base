import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, GraduationCap, Briefcase, BookOpen, Award, Plus, Check, CheckCircle,
  Lock as LockIcon, PlayCircle, ArrowUp, ArrowDown, Trash2, X, Edit3, Eye, EyeOff,
  Download, Clock, FileText, Users, Search, ChevronRight,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '../api';
import { COURSE_CATEGORIES, courseCategory } from '../constants';
import { renderMarkdown } from '../markdown';
import MarkdownEditor from './MarkdownEditor';
import { useConfirm } from './ConfirmDialog';
import { useRoles } from '../RolesContext';

const CAT_ICONS = { GraduationCap, Briefcase, BookOpen, Award };

const catIcon = (key) => {
  const c = courseCategory(key);
  return (c && CAT_ICONS[c.iconName]) || GraduationCap;
};

const articleWord = (n) => (n === 1 ? 'урок' : n >= 2 && n <= 4 ? 'уроки' : 'уроків');

const minutesText = (m) => m ? `~${m} хв` : null;

const statusLabel = (s) => ({
  assigned: 'Призначено',
  in_progress: 'У процесі',
  completed: 'Завершено',
  overdue: 'Прострочено',
}[s] || s);

const statusColor = (s) => ({
  assigned: 'bg-stone-100 text-stone-700 border-stone-300',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-rose-50 text-rose-700 border-rose-200',
}[s] || 'bg-stone-100 text-stone-700');

// ============ КАТАЛОГ + МОЇ ============
export default function CoursesPage({ onBack, onOpenCourse, onEditCourse, onCreateCourse, canManage = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const load = () => {
    setLoading(true);
    apiGet('/api/courses')
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const myCourses = items.filter((c) => c.enrollment);
  const otherCourses = items.filter((c) => !c.enrollment);

  const shown = (list) => catFilter === 'all' ? list : list.filter((c) => c.category === catFilter);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 dark:border-stone-700 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Корпоративне навчання</p>
          <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">🎓 Навчання</h1>
          <p className="text-stone-500 dark:text-stone-400 italic mt-1">Курси, що призначає вам HR</p>
        </div>
        {canManage && (
          <button onClick={onCreateCourse}
            className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Новий курс
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <button onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs border transition ${catFilter === 'all' ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
          Усі
        </button>
        {COURSE_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCatFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs border transition ${catFilter === c.key ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
            style={catFilter === c.key ? { background: c.color } : undefined}>
            {c.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded mb-4">{error}</div>}
      {loading && <p className="text-sm text-stone-400 italic">Завантаження…</p>}

      {!loading && myCourses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">Мої курси</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shown(myCourses).map((c) => (
              <CourseCard key={c.id} course={c} onOpen={() => onOpenCourse(c)} canManage={canManage} onEdit={() => onEditCourse(c)} />
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">{canManage ? 'Усі курси' : 'Каталог'}</h2>
          {shown(otherCourses).length === 0 ? (
            myCourses.length === 0
              ? <p className="text-sm text-stone-400 italic">Курсів у цій категорії немає</p>
              : null
          ) : (
            <>
              {!canManage && (
                <p className="text-xs text-stone-400 italic mb-3">Щоб записатись на курс, зверніться до HR.</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shown(otherCourses).map((c) => (
                  <CourseCard key={c.id} course={c} onOpen={() => onOpenCourse(c)} canManage={canManage} onEdit={() => onEditCourse(c)} catalog />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, onOpen, canManage, onEdit, catalog }) {
  const c = courseCategory(course.category);
  const Icon = catIcon(course.category);
  const enr = course.enrollment;
  const pct = enr?.progressPct ?? 0;
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden hover:border-rose-300 transition">
      <button onClick={onOpen} className="w-full text-left">
        {course.coverUrl ? (
          <div className="aspect-[16/7] bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <img src={course.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-[16/7] flex items-center justify-center" style={{ background: `${c?.color || '#78716c'}1a` }}>
            <Icon className="w-12 h-12" style={{ color: c?.color || '#78716c' }} />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: c?.color || '#78716c' }}>
              {c?.label || course.category}
            </span>
            {!course.isPublished && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">Чернетка</span>}
            {course.isOnboarding && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Онбординг</span>}
            {enr && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(enr.status)}`}>{statusLabel(enr.status)}</span>}
          </div>
          <h3 className="text-base text-stone-800 dark:text-stone-100 leading-tight mb-1">{course.title}</h3>
          {course.description && (
            <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {course.description}
            </p>
          )}
          <div className="text-xs text-stone-400 flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.lessonsCount} {articleWord(course.lessonsCount)}</span>
            {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{course.estimatedMinutes} хв</span>}
          </div>
          {enr && (
            <div>
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
                <span>{enr.completed} з {enr.total} уроків</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded">
                <div className="h-1.5 rounded transition-all" style={{ width: `${pct}%`, background: enr.status === 'completed' ? '#10b981' : '#fb7185' }} />
              </div>
            </div>
          )}
          {!enr && catalog && !canManage && (
            <div className="text-xs text-stone-400 italic">📌 Не призначено</div>
          )}
        </div>
      </button>
      {canManage && (
        <div className="px-4 pb-3 -mt-2 flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-xs px-2 py-1 rounded text-stone-600 dark:text-stone-300 hover:text-rose-600 flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Редагувати
          </button>
        </div>
      )}
    </div>
  );
}

// ============ ПЕРЕГЛЯД КУРСУ ============
export function CourseViewPage({ slug, onBack, onOpenLesson, onEdit, canManage }) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiGet(`/api/courses/${encodeURIComponent(slug)}`)
      .then(setCourse)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;
  if (error) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mb-4 min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</button>
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!course) return null;

  const c = courseCategory(course.category);
  const Icon = catIcon(course.category);
  const enr = course.enrollment;
  const pct = enr?.progressPct ?? 0;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      {/* Hero */}
      <div className="rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 mb-6">
        {course.coverUrl ? (
          <div className="aspect-[21/8] bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <img src={course.coverUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-[21/8] flex items-center justify-center" style={{ background: `linear-gradient(120deg, ${c?.color || '#78716c'}, ${c?.color || '#78716c'}33)` }}>
            <Icon className="w-20 h-20 text-white opacity-80" />
          </div>
        )}
        <div className="p-5 md:p-6 bg-white dark:bg-stone-900 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: c?.color || '#78716c' }}>{c?.label}</span>
              {!course.isPublished && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">Чернетка</span>}
              {course.isOnboarding && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Онбординг</span>}
              {enr && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(enr.status)}`}>{statusLabel(enr.status)}</span>}
            </div>
            <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100 mb-2">{course.title}</h1>
            {course.description && (
              <p className="text-stone-500 dark:text-stone-400 italic mb-3" style={{ fontFamily: 'system-ui, sans-serif' }}>{course.description}</p>
            )}
            <div className="text-sm text-stone-500 dark:text-stone-400 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{course.lessonsCount} {articleWord(course.lessonsCount)}</span>
              {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />~{course.estimatedMinutes} хв</span>}
              {enr?.dueAt && (
                <span className="flex items-center gap-1 text-rose-600">
                  <Clock className="w-4 h-4" />До {new Date(enr.dueAt).toLocaleDateString('uk-UA')}
                </span>
              )}
            </div>
            {enr && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
                  <span>Прогрес: {enr.completed} з {enr.total} уроків</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded">
                  <div className="h-2 rounded transition-all" style={{ width: `${pct}%`, background: enr.status === 'completed' ? '#10b981' : '#fb7185' }} />
                </div>
              </div>
            )}
          </div>
          {canManage && (
            <button onClick={onEdit} className="text-sm px-3 min-h-[40px] rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-rose-600 hover:border-rose-300 flex items-center gap-1 flex-shrink-0">
              <Edit3 className="w-3.5 h-3.5" /> Редагувати
            </button>
          )}
        </div>
      </div>

      {/* Уроки */}
      {!enr && !canManage ? (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          ℹ️ Цей курс вам не призначено. Зверніться до HR для запису.
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">Уроки</h2>
          {(course.lessons || []).map((l, idx) => {
            const completed = !!l.completedAt;
            const current = l.isCurrent;
            const locked = l.isLocked && !canManage;
            const clickable = !locked;
            return (
              <button key={l.id} disabled={locked} onClick={() => clickable && onOpenLesson(l)}
                className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition ${
                  completed ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-500/5'
                    : current ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/15'
                    : locked ? 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 opacity-60'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900'
                } ${clickable ? 'hover:border-rose-300 cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: completed ? '#10b98120' : current ? '#fb718520' : '#a8a29e20',
                    color: completed ? '#10b981' : current ? '#fb7185' : '#a8a29e',
                  }}>
                  {completed ? <CheckCircle className="w-5 h-5" />
                    : current ? <PlayCircle className="w-5 h-5" />
                    : locked ? <LockIcon className="w-4 h-4" />
                    : <span className="text-xs">{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-800 dark:text-stone-100">{l.title}</div>
                  <div className="text-xs text-stone-400">
                    {completed
                      ? `Завершено ${new Date(l.completedAt).toLocaleDateString('uk-UA')}`
                      : current ? 'Поточний урок'
                      : locked ? 'Заблоковано — спочатку завершіть попередні'
                      : minutesText(l.estimatedMinutes) || `Урок ${idx + 1}`}
                  </div>
                </div>
                {clickable && <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />}
              </button>
            );
          })}
          {(course.lessons || []).length === 0 && (
            <p className="text-sm text-stone-400 italic py-4 text-center">Уроків ще немає</p>
          )}

          {enr?.status === 'completed' && (
            <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-emerald-800 mb-3">Ви успішно завершили курс!</div>
              <a href={`/enrollments/${enr.id}/certificate`}
                className="inline-flex items-center gap-2 px-4 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <Download className="w-4 h-4" /> Завантажити сертифікат
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ ПЕРЕГЛЯД УРОКУ ============
export function LessonPlayerPage({ slug, lessonId, onBack, onOpenLesson, onOpenCertificate }) {
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet(`/api/courses/${encodeURIComponent(slug)}/lessons/${lessonId}`),
      apiGet(`/api/courses/${encodeURIComponent(slug)}`),
    ]).then(([l, c]) => { setLesson(l); setCourse(c); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [slug, lessonId]);

  const completed = !!(course?.lessons || []).find((l) => l.id === lessonId)?.completedAt;
  const enr = course?.enrollment;

  const complete = async () => {
    setBusy(true); setError('');
    try {
      const r = await apiPost(`/api/courses/lessons/${lessonId}/complete`);
      if (r.isCourseComplete) {
        // Не переходимо одразу — дамо побачити повідомлення на CourseView
      }
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;
  if (error) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mb-4 min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</button>
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!lesson || !course) return null;

  const ytMatch = lesson.videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  const vimeoMatch = lesson.videoUrl?.match(/vimeo\.com\/(\d+)/);
  const isDirectVideo = lesson.videoUrl && /\.(mp4|webm|mov)$/i.test(lesson.videoUrl);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> {course.title}
      </button>

      <div className="md:flex md:gap-6 md:items-start">
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-xs text-stone-400">Урок {(course.lessons || []).findIndex((l) => l.id === lessonId) + 1} з {course.lessonsCount}</div>
          <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100 mb-4">{lesson.title}</h1>

          {/* Video */}
          {lesson.videoUrl && (
            <div className="mb-5">
              {ytMatch ? (
                <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden">
                  <iframe className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                    title="video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen />
                </div>
              ) : vimeoMatch ? (
                <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden">
                  <iframe className="absolute inset-0 w-full h-full" src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                    title="video" allow="autoplay; fullscreen" allowFullScreen />
                </div>
              ) : isDirectVideo ? (
                <video src={lesson.videoUrl} controls className="w-full rounded-lg" />
              ) : (
                <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-rose-600 hover:underline text-sm">
                  <PlayCircle className="w-4 h-4" /> Відкрити відео
                </a>
              )}
            </div>
          )}

          {/* Body */}
          {lesson.body && (
            <div className="prose prose-stone dark:prose-invert max-w-none text-stone-700 dark:text-stone-200 break-words mb-6"
              style={{ fontFamily: 'system-ui, sans-serif', fontSize: '16px', lineHeight: '1.7' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.body) }} />
          )}

          {/* Attachments */}
          {Array.isArray(lesson.attachments) && lesson.attachments.length > 0 && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">Матеріали</div>
              <div className="space-y-1.5">
                {lesson.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded border border-stone-200 dark:border-stone-700 hover:border-rose-300 text-sm text-stone-700 dark:text-stone-200">
                    <Download className="w-4 h-4 text-rose-500" />
                    <span className="flex-1 truncate">{a.name || a.url}</span>
                    {a.size && <span className="text-xs text-stone-400">{Math.round(a.size / 1024)} КБ</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="border-t border-stone-200 dark:border-stone-700 pt-5 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {!completed ? (
              <button onClick={complete} disabled={busy}
                className="flex items-center justify-center gap-2 px-5 min-h-[48px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <Check className="w-4 h-4" />{busy ? 'Збереження…' : 'Завершити урок'}
              </button>
            ) : (
              <>
                <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Завершено
                </div>
                {lesson.nextLessonId ? (
                  <button onClick={() => onOpenLesson(lesson.nextLessonId)}
                    className="flex items-center justify-center gap-2 px-5 min-h-[48px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    Наступний урок <ChevronRight className="w-4 h-4" />
                  </button>
                ) : enr?.status === 'completed' && (
                  <button onClick={() => onOpenCertificate(enr.id)}
                    className="flex items-center justify-center gap-2 px-5 min-h-[48px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    <Download className="w-4 h-4" /> Сертифікат
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar — список уроків */}
        <aside className="md:w-72 flex-shrink-0 mt-6 md:mt-0 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3">
          <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">Усі уроки</div>
          <ul className="space-y-1">
            {(course.lessons || []).map((l, idx) => {
              const isThis = l.id === lessonId;
              const Icon = l.completedAt ? CheckCircle : l.isCurrent ? PlayCircle : l.isLocked ? LockIcon : null;
              return (
                <li key={l.id}>
                  <button disabled={l.isLocked && !isThis} onClick={() => !l.isLocked && onOpenLesson(l.id)}
                    className={`w-full text-left flex items-center gap-2 p-2 rounded text-sm ${
                      isThis ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      : l.completedAt ? 'text-emerald-700 dark:text-emerald-300'
                      : l.isLocked ? 'text-stone-400 cursor-not-allowed'
                      : 'text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}>
                    {Icon ? <Icon className="w-4 h-4 flex-shrink-0" /> : <span className="w-4 text-xs text-center text-stone-400">{idx + 1}</span>}
                    <span className="truncate">{l.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

// ============ РЕДАКТОР КУРСУ ============
export function CourseEditorPage({ slug, onBack, allLocations = [], isAdmin }) {
  const confirm = useConfirm();
  const { roleKeys, roleName } = useRoles();
  const [course, setCourse] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const coverRef = useRef(null);
  const attachRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    apiGet(`/api/courses/${encodeURIComponent(slug)}`)
      .then((c) => {
        setCourse(c);
        setMeta({
          title: c.title,
          description: c.description || '',
          category: c.category,
          coverUrl: c.coverUrl || '',
          estimatedMinutes: c.estimatedMinutes ?? '',
          dueDays: c.dueDays ?? '',
          targetRoles: c.targetRoles || [],
          isOnboarding: !!c.isOnboarding,
        });
        if (!activeLessonId && (c.lessons || []).length) setActiveLessonId(c.lessons[0].id);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [slug]);

  if (!course || !meta) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;

  const active = (course.lessons || []).find((l) => l.id === activeLessonId) || null;

  const saveMeta = async () => {
    try {
      await apiPatch(`/api/courses/${course.id}`, {
        ...meta,
        estimatedMinutes: meta.estimatedMinutes === '' ? null : meta.estimatedMinutes,
        dueDays: meta.dueDays === '' ? null : meta.dueDays,
      });
      load();
    } catch (e) { setError(e.message); }
  };

  const uploadCover = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const up = await apiUpload(f);
      setMeta((m) => ({ ...m, coverUrl: up.url }));
      await apiPatch(`/api/courses/${course.id}`, { coverUrl: up.url });
      load();
    } catch (err) { setError(err.message); }
    finally { setUploading(false); if (coverRef.current) coverRef.current.value = ''; }
  };

  const updateLesson = (patch) => {
    setCourse((c) => ({ ...c, lessons: c.lessons.map((l) => l.id === activeLessonId ? { ...l, ...patch } : l) }));
  };

  const saveLesson = async () => {
    if (!active) return;
    try {
      await apiPatch(`/api/courses/lessons/${active.id}`, {
        title: active.title, body: active.body, videoUrl: active.videoUrl,
        estimatedMinutes: active.estimatedMinutes || null,
        attachments: active.attachments || [],
      });
    } catch (e) { setError(e.message); }
  };

  const addLesson = async () => {
    try {
      const l = await apiPost(`/api/courses/${course.id}/lessons`, { title: 'Новий урок', body: '' });
      setCourse((c) => ({ ...c, lessons: [...c.lessons, l] }));
      setActiveLessonId(l.id);
    } catch (e) { setError(e.message); }
  };

  const removeLesson = async (l) => {
    const ok = await confirm({ title: 'Видалити урок?', description: l.title, confirmLabel: 'Видалити' });
    if (!ok) return;
    await apiDelete(`/api/courses/lessons/${l.id}`).catch((e) => setError(e.message));
    load();
  };

  const move = async (l, dir) => {
    const list = [...course.lessons].sort((a, b) => a.orderIdx - b.orderIdx);
    const idx = list.findIndex((x) => x.id === l.id);
    const tgt = dir === 'up' ? idx - 1 : idx + 1;
    if (tgt < 0 || tgt >= list.length) return;
    const orders = [
      { id: list[idx].id, orderIdx: tgt },
      { id: list[tgt].id, orderIdx: idx },
    ];
    await apiPost(`/api/courses/${course.id}/lessons/reorder`, { lessonOrders: orders });
    load();
  };

  const publish = async () => {
    await apiPost(`/api/courses/${course.id}/publish`);
    load();
  };
  const unpublish = async () => {
    const ok = await confirm({ title: 'Зняти з публікації?', description: 'Юзери, які ще не пройшли, не зможуть переглядати', confirmLabel: 'Зняти' });
    if (!ok) return;
    await apiPost(`/api/courses/${course.id}/unpublish`);
    load();
  };
  const removeCourse = async () => {
    const ok = await confirm({ title: 'Видалити курс?', description: 'Назавжди разом з уроками та призначеннями', confirmLabel: 'Видалити' });
    if (!ok) return;
    await apiDelete(`/api/courses/${course.id}`);
    onBack?.();
  };

  const uploadAttachment = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !active) return;
    setUploading(true);
    try {
      const up = await apiUpload(f);
      const next = [...(active.attachments || []), { url: up.url, name: f.name, size: f.size }];
      updateLesson({ attachments: next });
      await apiPatch(`/api/courses/lessons/${active.id}`, { attachments: next });
    } catch (err) { setError(err.message); }
    finally { setUploading(false); if (attachRef.current) attachRef.current.value = ''; }
  };

  const toggleRole = (rk) => setMeta((p) => ({ ...p, targetRoles: p.targetRoles.includes(rk) ? p.targetRoles.filter((x) => x !== rk) : [...p.targetRoles, rk] }));

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-4 pb-4 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Редагування курсу</p>
          <h1 className="text-xl md:text-2xl text-stone-800 dark:text-stone-100">{meta.title}</h1>
          <div className="text-xs text-stone-400 mt-0.5">
            {course.isPublished ? <span className="text-emerald-600">опубліковано</span> : <span className="text-stone-500">чернетка</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {course.isPublished ? (
            <button onClick={unpublish}
              className="px-3 min-h-[40px] rounded-md text-sm bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200 flex items-center gap-1">
              <EyeOff className="w-4 h-4" /> Зняти
            </button>
          ) : (
            <button onClick={publish}
              className="px-3 min-h-[40px] rounded-md text-sm bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1">
              <Eye className="w-4 h-4" /> Опублікувати
            </button>
          )}
          {isAdmin && (
            <button onClick={removeCourse}
              className="px-3 min-h-[40px] rounded-md text-sm border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Видалити
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}

      {/* Metadata */}
      <details className="mb-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg" style={{ fontFamily: 'system-ui, sans-serif' }} open>
        <summary className="p-3 text-sm text-stone-700 dark:text-stone-200 cursor-pointer flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Метадані
        </summary>
        <div className="p-4 border-t border-stone-200 dark:border-stone-700 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Назва</span>
              <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Опис</span>
              <input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Тривалість, хв</span>
              <input type="number" value={meta.estimatedMinutes} onChange={(e) => setMeta({ ...meta, estimatedMinutes: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Дедлайн, днів</span>
              <input type="number" value={meta.dueDays} onChange={(e) => setMeta({ ...meta, dueDays: e.target.value })}
                placeholder="опц." className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Категорія</span>
            <div className="flex flex-wrap gap-2">
              {COURSE_CATEGORIES.map((c) => {
                const on = meta.category === c.key;
                const Icon = CAT_ICONS[c.iconName] || GraduationCap;
                return (
                  <button key={c.key} type="button" onClick={() => setMeta({ ...meta, category: c.key })}
                    className={`px-3 min-h-[40px] rounded-full text-sm border flex items-center gap-1.5 ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                    style={on ? { background: c.color } : undefined}>
                    <Icon className="w-4 h-4" />{c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Цільові ролі</span>
            <div className="flex flex-wrap gap-1.5">
              {roleKeys.map((rk) => {
                const on = meta.targetRoles.includes(rk);
                return (
                  <button key={rk} type="button" onClick={() => toggleRole(rk)}
                    className={`px-3 py-1 rounded-full text-xs border ${on ? 'bg-rose-500 text-white border-rose-500' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
                    {roleName(rk)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-400 italic mt-1">Порожньо = для всіх</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
            <input type="checkbox" className="w-4 h-4 accent-rose-500" checked={meta.isOnboarding} onChange={(e) => setMeta({ ...meta, isOnboarding: e.target.checked })} />
            Базовий курс новачка (онбординг) — призначається автоматично при підтвердженні юзера
          </label>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Обкладинка</span>
            {meta.coverUrl && <img src={meta.coverUrl} alt="" className="mb-2 max-h-32 rounded border border-stone-200 dark:border-stone-700" />}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-3 min-h-[40px] border border-stone-300 hover:border-rose-400 rounded-md text-sm text-stone-700 dark:text-stone-200">
              <Plus className="w-4 h-4" /> {uploading ? 'Завантаження…' : 'Завантажити обкладинку'}
            </button>
          </div>
          <button onClick={saveMeta} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            Зберегти метадані
          </button>
        </div>
      </details>

      <div className="md:flex md:gap-6 md:items-start">
        <aside className="md:w-72 flex-shrink-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3 mb-4 md:mb-0 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-stone-400">Уроки</div>
            <button onClick={addLesson} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Урок
            </button>
          </div>
          {(course.lessons || []).length === 0 ? (
            <p className="text-xs text-stone-400 italic py-2">Уроків ще немає</p>
          ) : (
            <ul className="space-y-0.5">
              {[...course.lessons].sort((a, b) => a.orderIdx - b.orderIdx).map((l, idx, arr) => (
                <li key={l.id} className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${activeLessonId === l.id ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'}`}>
                  <button onClick={() => setActiveLessonId(l.id)} className="flex-1 text-left truncate">
                    {idx + 1}. {l.title}
                  </button>
                  <button onClick={() => move(l, 'up')} disabled={idx === 0} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                  <button onClick={() => move(l, 'down')} disabled={idx === arr.length - 1} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                  <button onClick={() => removeLesson(l)} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="flex-1 min-w-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4">
          {!active ? (
            <p className="text-sm text-stone-400 italic">Оберіть або створіть урок зліва</p>
          ) : (
            <div className="space-y-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Назва уроку</label>
                <input value={active.title} onChange={(e) => updateLesson({ title: e.target.value })} onBlur={saveLesson}
                  className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Відео URL (YouTube/Vimeo/.mp4)</label>
                  <input value={active.videoUrl || ''} onChange={(e) => updateLesson({ videoUrl: e.target.value })} onBlur={saveLesson}
                    placeholder="https://youtu.be/..." className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Тривалість, хв (опц.)</label>
                  <input type="number" value={active.estimatedMinutes || ''} onChange={(e) => updateLesson({ estimatedMinutes: e.target.value })} onBlur={saveLesson}
                    className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Текст уроку</label>
                <MarkdownEditor value={active.body || ''} onChange={(v) => updateLesson({ body: v })} placeholder="Markdown підтримується (тулбар вище)." />
                <button onClick={saveLesson} className="mt-2 px-3 min-h-[40px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
                  Зберегти урок
                </button>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Матеріали</label>
                <input ref={attachRef} type="file" className="hidden" onChange={uploadAttachment} />
                <button type="button" onClick={() => attachRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-3 min-h-[40px] border border-stone-300 hover:border-rose-400 rounded-md text-sm text-stone-700 dark:text-stone-200">
                  <Plus className="w-4 h-4" /> {uploading ? 'Завантаження…' : 'Додати файл'}
                </button>
                {(active.attachments || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {active.attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 rounded border border-stone-200 dark:border-stone-700">
                        <Download className="w-3 h-3 text-stone-400" />
                        <span className="flex-1 truncate">{a.name || a.url}</span>
                        <button onClick={async () => {
                          const next = active.attachments.filter((_, j) => j !== i);
                          updateLesson({ attachments: next });
                          await apiPatch(`/api/courses/lessons/${active.id}`, { attachments: next });
                        }} className="text-stone-400 hover:text-rose-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <EnrollmentsAdmin courseId={course.id} />
    </div>
  );
}

function EnrollmentsAdmin({ courseId }) {
  const [list, setList] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [error, setError] = useState('');

  const load = () => apiGet(`/api/courses/${courseId}/enrollments`).then((d) => setList(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [courseId]);

  const remove = async (e) => {
    if (!window.confirm('Зняти призначення?')) return;
    await apiDelete(`/api/courses/enrollments/${e.id}`);
    load();
  };

  return (
    <div className="mt-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400">Призначення ({list.length})</h3>
        <button onClick={() => setShowAssign(true)} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Призначити
        </button>
      </div>
      {error && <div className="p-2 mb-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}
      {list.length === 0 ? (
        <p className="text-xs text-stone-400 italic">Нікого ще не призначено</p>
      ) : (
        <div className="space-y-1">
          {list.map((e) => (
            <div key={e.id} className="flex items-center gap-2 p-2 text-xs border border-stone-200 dark:border-stone-700 rounded">
              <span className="flex-1 truncate text-stone-700 dark:text-stone-200">{e.user.name}</span>
              <span className={`px-1.5 py-0.5 rounded border ${statusColor(e.status)}`}>{statusLabel(e.status)}</span>
              <span className="text-stone-400">{e.progressPct}%</span>
              <button onClick={() => remove(e)} className="text-stone-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
      {showAssign && (
        <AssignModal courseId={courseId} onClose={() => setShowAssign(false)} onAssigned={() => { setShowAssign(false); load(); }} />
      )}
    </div>
  );
}

function AssignModal({ courseId, onClose, onAssigned }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [q, setQ] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/admin/users').then((d) => setUsers(Array.isArray(d) ? d.filter((u) => u.approved) : [])).catch(() => {});
  }, []);

  const ql = q.trim().toLowerCase();
  const shown = users.filter((u) => !ql || `${u.name} ${u.surname || ''}`.toLowerCase().includes(ql));

  const assign = async () => {
    if (selected.length === 0) return;
    setBusy(true); setError('');
    try {
      await apiPost(`/api/courses/${courseId}/enroll-bulk`, {
        userIds: selected,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      onAssigned?.();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-lg md:max-h-[85vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Призначити курс</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-stone-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук користувача…"
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent" />
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Дедлайн (опц.)</span>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent" />
          </label>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {shown.map((u) => {
              const on = selected.includes(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${on ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/15' : 'border-stone-200 dark:border-stone-700'}`}>
                  <input type="checkbox" checked={on} onChange={() => setSelected((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])}
                    className="w-4 h-4 accent-rose-500" />
                  <span className="text-sm text-stone-700 dark:text-stone-200">{u.name}{u.surname ? ` ${u.surname}` : ''}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-stone-200 dark:border-stone-700 flex justify-between gap-2">
          {error && <div className="text-xs text-rose-600 flex-1">{error}</div>}
          <button onClick={assign} disabled={busy || selected.length === 0}
            className="ml-auto px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Призначення…' : `Призначити (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ НОВИЙ КУРС ============
export function NewCoursePage({ onBack, onCreated }) {
  const [form, setForm] = useState({ slug: '', title: '', description: '', category: 'general' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-');

  const save = async () => {
    setError('');
    const slug = form.slug || slugify(form.title);
    if (!slug || !form.title.trim()) return setError('Заповніть назву');
    setBusy(true);
    try {
      const c = await apiPost('/api/courses', { ...form, slug });
      onCreated?.(c);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Назад
      </button>
      <h1 className="text-2xl text-stone-800 dark:text-stone-100 mb-4">Новий курс</h1>
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 space-y-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Назва</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Slug (URL)</span>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.title) || 'florist-basics'}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Опис</span>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
        </label>
        <div>
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Категорія</span>
          <div className="flex flex-wrap gap-2">
            {COURSE_CATEGORIES.map((c) => {
              const on = form.category === c.key;
              const Icon = CAT_ICONS[c.iconName] || GraduationCap;
              return (
                <button key={c.key} type="button" onClick={() => setForm({ ...form, category: c.key })}
                  className={`px-3 min-h-[40px] rounded-full text-sm border flex items-center gap-1.5 ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                  style={on ? { background: c.color } : undefined}>
                  <Icon className="w-4 h-4" />{c.label}
                </button>
              );
            })}
          </div>
        </div>
        {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Створення…' : 'Створити'}
        </button>
      </div>
    </div>
  );
}

// ============ СЕРТИФІКАТ ============
export function CertificatePage({ enrollmentId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet(`/api/courses/enrollments/${enrollmentId}/certificate`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [enrollmentId]);

  if (error) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mb-4 min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</button>
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!data) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <Download className="w-4 h-4" /> Зберегти PDF
        </button>
      </div>

      <div className="certificate-sheet mx-auto bg-white text-stone-800 border-8 border-double border-amber-700 p-8 md:p-16"
        style={{
          maxWidth: '900px',
          aspectRatio: '297 / 210',
          backgroundImage: 'radial-gradient(circle at 20% 20%, #fef3c780 0%, transparent 40%), radial-gradient(circle at 80% 80%, #fed7aa80 0%, transparent 40%)',
        }}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center border border-rose-200">
              <span className="text-xl">🌸</span>
            </div>
            <div className="text-2xl tracking-widest" style={{ fontFamily: 'Georgia, serif' }}>FLOLUX</div>
          </div>
          <div className="text-xs uppercase tracking-[0.4em] text-stone-500 mb-1">Сертифікат</div>
          <div className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Georgia, serif' }}>про завершення</div>
          <p className="text-stone-600 italic mb-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
            Цей документ засвідчує, що
          </p>
          <h1 className="text-3xl md:text-5xl mb-4 text-stone-800" style={{ fontFamily: 'Georgia, serif' }}>
            {data.userName}
          </h1>
          <p className="text-stone-600 italic mb-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
            успішно завершив курс
          </p>
          <h2 className="text-xl md:text-3xl mb-8 text-rose-700" style={{ fontFamily: 'Georgia, serif' }}>
            «{data.courseName}»
          </h2>
          <div className="flex justify-around text-stone-500 text-sm mt-12" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div>
              <div className="border-t border-stone-400 pt-1 px-4">
                {new Date(data.completedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="text-xs mt-1">Дата завершення</div>
            </div>
            <div>
              <div className="border-t border-stone-400 pt-1 px-4">Flolux</div>
              <div className="text-xs mt-1">Підпис</div>
            </div>
          </div>
          <div className="mt-6 text-xs text-stone-400">
            Унікальний ID сертифіката: <code>{data.certificateId}</code>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print, header, nav, footer { display: none !important; }
          .certificate-sheet { border-color: #b45309 !important; box-shadow: none !important; max-width: 100% !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
