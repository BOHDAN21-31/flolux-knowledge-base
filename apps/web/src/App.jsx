import { useState, useEffect, useRef, createElement } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flower2, Lock, Mail, User, LogOut, Shield, BookOpen, Plus, MessageSquare, Edit3, Check, X, Search, Settings, ChevronRight, AlertCircle, Send, Eye, EyeOff, Wrench, Printer, Monitor, Wifi, ArrowLeft, Star, Clock, Tag, Briefcase, MapPin, Fingerprint, ChevronDown, Link2, Sun, Moon, Bookmark, FileText, Trash2, GraduationCap, Award, PlayCircle, CheckCircle, Lock as LockIcon, Download } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, setToken, clearToken, getToken, UNAUTHORIZED_EVENT, apiUpload, webauthnLogin, webauthnSupported } from './api';
import ProfilePage from './components/ProfilePage';
import PublicProfile from './components/PublicProfile';
import AdminPanel from './components/AdminPanel';
import GlobalSearch from './components/GlobalSearch';
import MarkdownEditor from './components/MarkdownEditor';
import NotificationBell from './components/NotificationBell';
import NotificationsPage from './components/NotificationsPage';
import AnnouncementsPage, { AnnouncementCard } from './components/AnnouncementsPage';
import DocsPage, { DocViewPage, DocEditorPage, NewDocPage } from './components/DocsPage';
import CoursesPage, { CourseViewPage, LessonPlayerPage, CourseEditorPage, NewCoursePage, CertificatePage } from './components/CoursesPage';
import { QuizPlayerPage, AttemptResultPage, QuizEditorPage } from './components/QuizPages';
import InstallPrompt from './components/InstallPrompt';
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog';
import Stars from './Stars';
import { userRoles, isAdminUser, isSeniorUser } from './roles';
import { RolesProvider, useRoles } from './RolesContext';
import { iconFor } from './icons';
import { useTheme } from './theme';
import { renderMarkdown } from './markdown';
import { getRecent, addRecent, removeRecent, pruneRecent } from './recent';
import { DIGEST_CATEGORIES, digestCategory } from './constants';

// ── Навігаційний стек ⇄ URL ──
function pathForFrame(f) {
  switch (f?.type) {
    case 'tech': return '/tech';
    case 'profile': return f.section ? `/profile/${f.section}` : '/profile';
    case 'notifications': return '/notifications';
    case 'admin': return f.tab ? `/admin/${f.tab}` : '/admin';
    case 'publicProfile': return `/users/${f.userId}`;
    case 'topic': return `/topics/${f.topicId}`;
    case 'article': return `/articles/${f.articleId}`;
    case 'editArticle': return `/articles/${f.articleId}/edit`;
    case 'createArticle': return `/topics/${f.topicId}/new`;
    case 'createDigest': return '/digests/new';
    case 'announcements': return f.announcementId ? `/announcements/${f.announcementId}` : '/announcements';
    case 'docs': return '/docs';
    case 'doc': return `/docs/${f.slug}`;
    case 'editDoc': return `/docs/${f.slug}/edit`;
    case 'newDoc': return '/docs/new';
    case 'courses': return '/courses';
    case 'course': return `/courses/${f.slug}`;
    case 'lesson': return `/courses/${f.slug}/lessons/${f.lessonId}`;
    case 'editCourse': return `/courses/${f.slug}/edit`;
    case 'newCourse': return '/courses/new';
    case 'certificate': return `/enrollments/${f.enrollmentId}/certificate`;
    case 'takeQuiz': return `/quizzes/${f.quizId}/take`;
    case 'attemptResult': return `/attempts/${f.attemptId}`;
    case 'editQuiz': return `/quizzes/${f.quizId}/edit`;
    default: return '/';
  }
}
function frameFromPath(pathname) {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  if (p === '/' || p === '') return { type: 'home' };
  if (p === '/tech') return { type: 'tech' };
  if (p === '/profile') return { type: 'profile' };
  if (p === '/notifications') return { type: 'notifications' };
  if (p === '/digests/new') return { type: 'createDigest' };
  if (p === '/docs') return { type: 'docs' };
  if (p === '/docs/new') return { type: 'newDoc' };
  if (p === '/courses') return { type: 'courses' };
  if (p === '/courses/new') return { type: 'newCourse' };
  if (p === '/announcements') return { type: 'announcements' };
  {
    const m2 = p.match(/^\/announcements\/([^/]+)$/);
    if (m2) return { type: 'announcements', announcementId: m2[1] };
  }
  if (p === '/admin') return { type: 'admin' };
  let m;
  if ((m = p.match(/^\/profile\/(data|security|locations|notifications)$/))) return { type: 'profile', section: m[1] };
  if ((m = p.match(/^\/users\/([^/]+)$/))) return { type: 'publicProfile', userId: m[1] };
  if ((m = p.match(/^\/admin\/([^/]+)$/))) return { type: 'admin', tab: m[1] };
  if ((m = p.match(/^\/topics\/([^/]+)\/new$/))) return { type: 'createArticle', topicId: m[1] };
  if ((m = p.match(/^\/topics\/([^/]+)$/))) return { type: 'topic', topicId: m[1] };
  if ((m = p.match(/^\/articles\/([^/]+)\/edit$/))) return { type: 'editArticle', articleId: m[1] };
  if ((m = p.match(/^\/articles\/([^/]+)$/))) return { type: 'article', articleId: m[1] };
  if ((m = p.match(/^\/docs\/([^/]+)\/edit$/))) return { type: 'editDoc', slug: m[1] };
  if ((m = p.match(/^\/docs\/([^/]+)$/))) return { type: 'doc', slug: m[1] };
  if ((m = p.match(/^\/courses\/([^/]+)\/edit$/))) return { type: 'editCourse', slug: m[1] };
  if ((m = p.match(/^\/courses\/([^/]+)\/lessons\/([^/]+)$/))) return { type: 'lesson', slug: m[1], lessonId: m[2] };
  if ((m = p.match(/^\/courses\/([^/]+)$/))) return { type: 'course', slug: m[1] };
  if ((m = p.match(/^\/enrollments\/([^/]+)\/certificate$/))) return { type: 'certificate', enrollmentId: m[1] };
  if ((m = p.match(/^\/quizzes\/([^/]+)\/take$/))) return { type: 'takeQuiz', quizId: m[1] };
  if ((m = p.match(/^\/quizzes\/([^/]+)\/edit$/))) return { type: 'editQuiz', quizId: m[1] };
  if ((m = p.match(/^\/attempts\/([^/]+)$/))) return { type: 'attemptResult', attemptId: m[1] };
  return { type: 'home' };
}
const TOP_LEVEL = ['home', 'tech', 'admin', 'profile', 'notifications', 'docs', 'courses'];

// ============ КОНСТАНТИ ============
const REFERRAL_WORD = 'Flolux';

const articleWord = (count) => (count === 1 ? 'стаття' : count >= 2 && count <= 4 ? 'статті' : 'статей');

// Масив топіків -> мапа { roleKey: [{id,title,description}] }
function groupTopics(list) {
  const map = {};
  for (const t of list) {
    (map[t.roleKey] = map[t.roleKey] || []).push(t);
  }
  return map;
}

// ============ ГОЛОВНИЙ КОМПОНЕНТ ============
export default function FloluxKB() {
  return (
    <RolesProvider>
      <ConfirmProvider>
        <AppInner />
      </ConfirmProvider>
    </RolesProvider>
  );
}

function AppInner() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [topicsMap, setTopicsMap] = useState({});
  const [articles, setArticles] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [authMode, setAuthMode] = useState('login');
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ── Навігаційний стек (Задача 5) синхронізований з URL (Задача 2) ──
  const initFrame = frameFromPath(window.location.pathname);
  const [stack, setStack] = useState(
    TOP_LEVEL.includes(initFrame.type) ? [initFrame] : [{ type: 'home' }, initFrame]
  );
  const current = stack[stack.length - 1];

  const go = (nextStack) => {
    setStack(nextStack);
    const path = pathForFrame(nextStack[nextStack.length - 1]);
    if (path !== location.pathname) navigate(path);
  };
  const push = (frame) => go([...stack, frame]);
  const back = () => go(stack.length > 1 ? stack.slice(0, -1) : [{ type: 'home' }]);
  const reset = (frame) => go([frame]);
  const navigatePath = (path) => {
    const f = frameFromPath(path);
    if (TOP_LEVEL.includes(f.type)) reset(f); else push(f);
  };

  // URL → стек (reload, ручний перехід, browser back/forward)
  useEffect(() => {
    if (pathForFrame(current) === location.pathname) return;
    const f = frameFromPath(location.pathname);
    setStack(TOP_LEVEL.includes(f.type) ? [f] : [{ type: 'home' }, f]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Cmd/Ctrl+K → глобальний пошук
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const refreshMe = async () => {
    const me = await apiGet('/api/users/me');
    setCurrentUser(me);
    return me;
  };

  // Перевірка токена при старті
  useEffect(() => {
    const t = getToken();
    if (!t) { setAuthChecked(true); return; }
    refreshMe()
      .catch(() => clearToken())
      .finally(() => setAuthChecked(true));
  }, []);

  // Глобальний вихід при 401 (протермінований/невалідний токен)
  useEffect(() => {
    const onUnauthorized = () => {
      setCurrentUser(null);
      setStack([{ type: 'home' }]);
      navigate('/');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Завантаження даних після входу
  useEffect(() => {
    if (!currentUser) { setDataLoaded(false); return; }
    if (dataLoaded) return;
    Promise.all([apiGet('/api/topics'), apiGet('/api/articles'), apiGet('/api/locations')])
      .then(([topics, arts, locs]) => {
        setTopicsMap(groupTopics(topics));
        setArticles(arts);
        setAllLocations(locs);
        setDataLoaded(true);
      })
      .catch((e) => console.error('Не вдалося завантажити дані:', e));
  }, [currentUser, dataLoaded]);

  const reloadArticles = async () => {
    const arts = await apiGet('/api/articles');
    setArticles(arts);
    return arts;
  };
  const reloadTopics = async () => {
    const topics = await apiGet('/api/topics');
    setTopicsMap(groupTopics(topics));
  };
  const reloadLocations = async () => {
    const locs = await apiGet('/api/locations');
    setAllLocations(locs);
    return locs;
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setStack([{ type: 'home' }]);
    navigate('/');
  };

  const onAuthSuccess = async () => {
    await refreshMe().catch(() => {});
    setStack([{ type: 'home' }]);
    navigate('/');
  };

  if (!authChecked) return <Splash text="Завантаження..." />;

  if (!currentUser) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={onAuthSuccess} />;
  }

  if (!dataLoaded) return <Splash text="Готуємо вашу базу знань..." />;

  const isAdmin = isAdminUser(currentUser);
  const isSenior = isSeniorUser(currentUser); // admin|hr — повний доступ до контенту
  const canAdminArea = isSenior;

  const allTopics = Object.values(topicsMap).flat();
  const topicById = (id) => allTopics.find((t) => t.id === id) || null;
  const articleById = (id) => articles.find((a) => a.id === id) || null;

  // Тип фрейму -> підсвітка в навігації (home/tech/admin/profile або null)
  const navView = ['home', 'tech', 'admin', 'profile', 'docs', 'courses'].includes(current.type)
    ? current.type
    : (['doc', 'editDoc', 'newDoc'].includes(current.type) ? 'docs'
      : (['course', 'editCourse', 'newCourse', 'lesson', 'certificate', 'takeQuiz', 'attemptResult', 'editQuiz'].includes(current.type) ? 'courses' : null));

  let screen = null;
  if (current.type === 'home') {
    screen = (
      <HomeView
        user={currentUser}
        topics={topicsMap}
        articles={articles}
        allLocations={allLocations}
        isAdmin={isAdmin}
        isSenior={isSenior}
        onTopicClick={(t) => push({ type: 'topic', topicId: t.id })}
        onArticleClick={(a) => push({ type: 'article', articleId: a.id })}
        onOpenUser={(id) => push({ type: 'publicProfile', userId: id })}
        onGoProfile={() => reset({ type: 'profile' })}
        onOpenAnnouncements={() => push({ type: 'announcements' })}
        onOpenDoc={(slug) => push({ type: 'doc', slug })}
        onOpenCourse={(slug) => push({ type: 'course', slug })}
      />
    );
  } else if (current.type === 'profile') {
    screen = (
      <ProfilePage
        user={currentUser}
        allLocations={allLocations}
        onRefresh={refreshMe}
        section={current.section || 'data'}
        onSection={(s) => reset({ type: 'profile', section: s })}
        onOpenArticle={(id) => push({ type: 'article', articleId: id })}
        onOpenCourse={(slug) => push({ type: 'course', slug })}
        onOpenCertificate={(eid) => push({ type: 'certificate', enrollmentId: eid })}
        onOpenUser={(id) => id && push({ type: 'publicProfile', userId: id })}
      />
    );
  } else if (current.type === 'publicProfile') {
    screen = (
      <PublicProfile
        userId={current.userId}
        currentUser={currentUser}
        onBack={back}
        onEditProfile={() => reset({ type: 'profile' })}
        onOpenArticle={(id) => push({ type: 'article', articleId: id })}
        onOpenUser={(id) => id && push({ type: 'publicProfile', userId: id })}
      />
    );
  } else if (current.type === 'notifications') {
    screen = <NotificationsPage onBack={back} onOpenPath={navigatePath} />;
  } else if (current.type === 'announcements') {
    screen = <AnnouncementsPage onBack={back} initialId={current.announcementId || null} />;
  } else if (current.type === 'docs') {
    screen = (
      <DocsPage
        onBack={back}
        onOpenDoc={(d) => push({ type: 'doc', slug: d.slug })}
        onEditDoc={(d) => push({ type: 'editDoc', slug: d.slug })}
        onCreateDoc={() => push({ type: 'newDoc' })}
        canManage={canAdminArea}
      />
    );
  } else if (current.type === 'doc') {
    screen = (
      <DocViewPage
        slug={current.slug}
        onBack={back}
        onEdit={() => push({ type: 'editDoc', slug: current.slug })}
        canManage={canAdminArea}
      />
    );
  } else if (current.type === 'editDoc' && canAdminArea) {
    screen = (
      <DocEditorPage
        slug={current.slug}
        onBack={back}
        allLocations={allLocations}
        isAdmin={isAdmin}
      />
    );
  } else if (current.type === 'newDoc' && canAdminArea) {
    screen = (
      <NewDocPage
        onBack={back}
        onCreated={(d) => reset({ type: 'editDoc', slug: d.slug })}
      />
    );
  } else if (current.type === 'courses') {
    screen = (
      <CoursesPage
        onBack={back}
        onOpenCourse={(c) => push({ type: 'course', slug: c.slug })}
        onEditCourse={(c) => push({ type: 'editCourse', slug: c.slug })}
        onCreateCourse={() => push({ type: 'newCourse' })}
        canManage={canAdminArea}
      />
    );
  } else if (current.type === 'course') {
    screen = (
      <CourseViewPage
        slug={current.slug}
        onBack={back}
        onOpenLesson={(l) => push({ type: 'lesson', slug: current.slug, lessonId: l.id })}
        onEdit={() => push({ type: 'editCourse', slug: current.slug })}
        onOpenQuiz={(qid) => push({ type: 'takeQuiz', quizId: qid })}
        canManage={canAdminArea}
      />
    );
  } else if (current.type === 'lesson') {
    screen = (
      <LessonPlayerPage
        slug={current.slug}
        lessonId={current.lessonId}
        onBack={back}
        onOpenLesson={(id) => reset({ type: 'lesson', slug: current.slug, lessonId: id })}
        onOpenCertificate={(eid) => push({ type: 'certificate', enrollmentId: eid })}
        onOpenQuiz={(qid) => push({ type: 'takeQuiz', quizId: qid })}
      />
    );
  } else if (current.type === 'editCourse' && canAdminArea) {
    screen = (
      <CourseEditorPage
        slug={current.slug}
        onBack={back}
        allLocations={allLocations}
        isAdmin={isAdmin}
        onOpenQuiz={(qid) => push({ type: 'editQuiz', quizId: qid })}
      />
    );
  } else if (current.type === 'newCourse' && canAdminArea) {
    screen = (
      <NewCoursePage
        onBack={back}
        onCreated={(c) => reset({ type: 'editCourse', slug: c.slug })}
      />
    );
  } else if (current.type === 'certificate') {
    screen = <CertificatePage enrollmentId={current.enrollmentId} onBack={back} />;
  } else if (current.type === 'takeQuiz') {
    screen = (
      <QuizPlayerPage
        quizId={current.quizId}
        onBack={back}
        onFinish={(attemptId) => reset(stack.length > 1
          ? [...stack.slice(0, -1), { type: 'attemptResult', attemptId }]
          : [{ type: 'home' }, { type: 'attemptResult', attemptId }])}
      />
    );
  } else if (current.type === 'attemptResult') {
    screen = (
      <AttemptResultPage
        attemptId={current.attemptId}
        onBack={back}
        onRetry={() => { /* поки що просто back, користувач повторно натисне Старт */ back(); }}
        onBackToCourse={() => back()}
      />
    );
  } else if (current.type === 'editQuiz' && canAdminArea) {
    screen = <QuizEditorPage quizId={current.quizId} onBack={back} />;
  } else if (current.type === 'tech') {
    screen = (
      <TechView
        topics={topicsMap.tech || []}
        articles={articles.filter((a) => a.section === 'tech')}
        onTopicClick={(t) => push({ type: 'topic', topicId: t.id })}
      />
    );
  } else if (current.type === 'admin' && canAdminArea) {
    screen = (
      <AdminPanel
        topicsMap={topicsMap}
        reloadTopics={reloadTopics}
        articles={articles}
        allLocations={allLocations}
        reloadLocations={reloadLocations}
        reloadArticles={reloadArticles}
        isAdmin={isAdmin}
        tab={current.tab || 'dashboard'}
        onTab={(t) => reset({ type: 'admin', tab: t })}
        onOpenUser={(id) => id && push({ type: 'publicProfile', userId: id })}
        onCreateDigest={() => push({ type: 'createDigest' })}
        onOpenCourses={() => push({ type: 'courses' })}
        onCreateCourse={() => push({ type: 'newCourse' })}
        onOpenCourse={(slug) => push({ type: 'editCourse', slug })}
        onOpenQuiz={(qid) => push({ type: 'editQuiz', quizId: qid })}
      />
    );
  } else if (current.type === 'topic') {
    const topic = topicById(current.topicId);
    screen = topic ? (
      <TopicView
        topic={topic}
        articles={articles.filter((a) => a.topicId === topic.id)}
        onBack={back}
        onArticleClick={(a) => push({ type: 'article', articleId: a.id })}
        onCreate={() => push({ type: 'createArticle', topicId: topic.id })}
      />
    ) : <NotFound onBack={back} />;
  } else if (current.type === 'article') {
    screen = (
      <ArticleView
        articleId={current.articleId}
        user={currentUser}
        isAdmin={isAdmin}
        isSenior={isSenior}
        onBack={back}
        onEdit={() => push({ type: 'editArticle', articleId: current.articleId })}
        onArticleUpdated={reloadArticles}
        onOpenUser={(id) => id && push({ type: 'publicProfile', userId: id })}
      />
    );
  } else if (current.type === 'createArticle') {
    const topic = topicById(current.topicId);
    screen = topic ? (
      <ArticleForm
        mode="create"
        topic={topic}
        allLocations={allLocations}
        onClose={back}
        onSaved={async () => { await reloadArticles(); back(); }}
      />
    ) : <NotFound onBack={back} />;
  } else if (current.type === 'editArticle') {
    const article = articleById(current.articleId);
    screen = article ? (
      <ArticleForm
        mode="edit"
        article={article}
        allLocations={allLocations}
        onClose={back}
        onSaved={async () => { await reloadArticles(); back(); }}
      />
    ) : <NotFound onBack={back} />;
  } else if (current.type === 'createDigest' && canAdminArea) {
    screen = (
      <ArticleForm
        mode="create"
        digest
        topic={{ id: 'hr-digests', title: 'Дайджест компанії' }}
        allLocations={allLocations}
        onClose={back}
        onSaved={async () => { await reloadArticles(); back(); }}
      />
    );
  } else {
    screen = <NotFound onBack={() => reset({ type: 'home' })} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 dark:bg-stone-950" style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}>
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={(v) => reset({ type: v })}
        onProfile={() => reset({ type: 'profile' })}
        view={navView}
        isAdmin={isAdmin}
        canAdmin={canAdminArea}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenPath={navigatePath}
        onOpenAllNotifications={() => reset({ type: 'notifications' })}
        onOpenNotifSettings={() => reset({ type: 'profile', section: 'notifications' })}
      />

      {currentUser && <UrgentAnnouncementBar onOpen={() => reset({ type: 'announcements' })} />}

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
        {screen}
      </main>

      <MobileBottomNav
        view={navView}
        isAdmin={isAdmin}
        canAdmin={canAdminArea}
        onNavigate={(v) => reset({ type: v })}
        onProfile={() => reset({ type: 'profile' })}
      />

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(kind, item) => {
          if (kind === 'articles') push({ type: 'article', articleId: item.id });
          else if (kind === 'users') push({ type: 'publicProfile', userId: item.id });
          else if (kind === 'topics') push({ type: 'topic', topicId: item.id });
          else if (kind === 'locations') reset({ type: 'profile', section: 'locations' });
        }}
      />

      {currentUser && <InstallPrompt />}
    </div>
  );
}

// Червона смуга з найновішим терміновим оголошенням (priority='urgent').
function UrgentAnnouncementBar({ onOpen }) {
  const [urgent, setUrgent] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet('/api/announcements').then((list) => {
      if (!active) return;
      const u = (Array.isArray(list) ? list : [])
        .filter((a) => a.priority === 'urgent' && (!a.expiresAt || a.expiresAt > Date.now()))
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
      setUrgent(u);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!urgent || dismissed) return null;
  return (
    <div className="bg-rose-600 text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <button onClick={onOpen} className="flex-1 text-left text-sm truncate hover:underline">
          <span className="font-medium">{urgent.title}</span>
          <span className="opacity-80 ml-2 hidden sm:inline">— натисніть, щоб переглянути</span>
        </button>
        <button onClick={() => setDismissed(true)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/15 flex-shrink-0" aria-label="Закрити">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function NotFound({ onBack }) {
  return (
    <div className="text-center py-16">
      <p className="text-stone-500 dark:text-stone-400 italic mb-4">Сторінку не знайдено або вона більше недоступна.</p>
      <button onClick={onBack} className="px-4 min-h-[44px] bg-rose-500 text-white rounded-md text-sm">Повернутися</button>
    </div>
  );
}

function Splash({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, #fdf2f8 0%, #fff7ed 50%, #f0fdf4 100%)',
      fontFamily: 'Georgia, serif'
    }}>
      <div className="text-center">
        <Flower2 className="w-10 h-10 text-rose-400 mx-auto mb-3 animate-pulse" strokeWidth={1.5} />
        <p className="text-stone-500 dark:text-stone-400 italic">{text}</p>
      </div>
    </div>
  );
}

// ============ AUTH ============
function AuthScreen({ mode, setMode, onSuccess }) {
  const { registerRoles } = useRoles();
  const [form, setForm] = useState({ email: '', password: '', name: '', referral: '', requestedRole: 'florist', resetEmail: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  useEffect(() => { webauthnSupported().then(setBioSupported); }, []);

  const handleLogin = async () => {
    setError(''); setSuccess('');
    if (!form.email || !form.password) return setError('Заповніть всі поля');
    setBusy(true);
    try {
      const r = await apiPost('/api/auth/login', { email: form.email, password: form.password });
      setToken(r.token);
      await onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBioLogin = async () => {
    setError(''); setSuccess('');
    let email = form.email;
    if (!email) {
      email = window.prompt('Введіть e-mail для входу через Touch/Face ID');
      if (!email) return;
      setForm((f) => ({ ...f, email }));
    }
    setBusy(true);
    try {
      const r = await webauthnLogin(email);
      setToken(r.token);
      await onSuccess();
    } catch (e) {
      setError(e.message || 'Не вдалося увійти через біометрію');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setError(''); setSuccess('');
    if (!form.email || !form.password || !form.name || !form.referral)
      return setError('Заповніть всі поля');
    if (form.referral !== REFERRAL_WORD)
      return setError('Невірне реферальне слово');
    if (form.password.length < 6)
      return setError('Пароль має містити мінімум 6 символів');
    setBusy(true);
    try {
      const r = await apiPost('/api/auth/register', {
        referralWord: form.referral,
        name: form.name,
        email: form.email,
        password: form.password,
        requestedRole: form.requestedRole,
      });
      setSuccess(r.approved
        ? 'Реєстрація успішна. Ви — перший користувач (адміністратор). Увійдіть під своїм e-mail.'
        : 'Реєстрація успішна. Очікуйте підтвердження адміністратора та призначення ролі.');
      setForm({ email: '', password: '', name: '', referral: '', requestedRole: 'florist', resetEmail: '' });
      setTimeout(() => setMode('login'), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setError(''); setSuccess('');
    if (!form.resetEmail) return setError('Введіть e-mail');
    setSuccess('Для відновлення паролю зверніться до адміністратора компанії — він скине пароль вручну.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8" style={{
      background: 'linear-gradient(135deg, #fdf2f8 0%, #fff7ed 50%, #f0fdf4 100%)',
      fontFamily: 'Georgia, "Playfair Display", serif'
    }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-stone-900 shadow-sm mb-4 border border-rose-200">
            <Flower2 className="w-9 h-9 md:w-10 md:h-10 text-rose-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl md:text-4xl tracking-wide text-stone-800 dark:text-stone-100 mb-2" style={{ letterSpacing: '0.1em' }}>FLOLUX</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm italic">База знань компанії</p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl p-6 md:p-8 border border-stone-100 dark:border-stone-800">
          <div className="flex gap-1 mb-6 bg-stone-50 dark:bg-stone-900 rounded-md p-1">
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 min-h-[44px] px-3 text-sm rounded transition ${mode === 'login' ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>Вхід</button>
            <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 min-h-[44px] px-3 text-sm rounded transition ${mode === 'register' ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>Реєстрація</button>
            <button onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className={`flex-1 min-h-[44px] px-3 text-sm rounded transition ${mode === 'reset' ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>Відновити</button>
          </div>

          {mode === 'login' && (
            <div className="space-y-4">
              <Field icon={Mail} label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field icon={Lock} label="Пароль" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(v) => setForm({ ...form, password: v })}
                rightIcon={showPassword ? EyeOff : Eye} onRightClick={() => setShowPassword(!showPassword)} />
              <button onClick={handleLogin} disabled={busy} className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white py-3 rounded-md transition tracking-wider text-sm">
                {busy ? 'ЗАЧЕКАЙТЕ...' : 'УВІЙТИ'}
              </button>
              {bioSupported && (
                <button onClick={handleBioLogin} disabled={busy} type="button"
                  className="w-full flex items-center justify-center gap-2 border border-stone-300 hover:border-rose-400 text-stone-700 dark:text-stone-200 py-3 rounded-md transition text-sm">
                  <Fingerprint className="w-4 h-4" /> Увійти через Touch / Face ID
                </button>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-4">
              <Field icon={User} label="Ім'я" type="text" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field icon={Mail} label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field icon={Lock} label="Пароль" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Бажана роль</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <select
                    value={form.requestedRole}
                    onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 text-stone-800 dark:text-stone-100 bg-stone-50/50"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    {registerRoles.map((r) => (
                      <option key={r.key} value={r.key}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-stone-400 mt-1 italic">Адміністратор підтвердить або змінить роль</p>
              </div>
              <Field icon={Shield} label="Реферальне слово" type="text" value={form.referral} onChange={(v) => setForm({ ...form, referral: v })} hint="Запитайте у керівництва" />
              <button onClick={handleRegister} disabled={busy} className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white py-3 rounded-md transition tracking-wider text-sm">
                {busy ? 'ЗАЧЕКАЙТЕ...' : 'ЗАРЕЄСТРУВАТИСЬ'}
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600 dark:text-stone-300 italic">Введіть e-mail, прив'язаний до акаунту.</p>
              <Field icon={Mail} label="E-mail" type="email" value={form.resetEmail} onChange={(v) => setForm({ ...form, resetEmail: v })} />
              <button onClick={handleReset} className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-md transition tracking-wider text-sm">
                ВІДНОВИТИ ПАРОЛЬ
              </button>
            </div>
          )}

          {error && <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}
          {success && <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded flex gap-2"><Check className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}</div>}
        </div>

        <p className="text-center text-xs text-stone-400 mt-6 italic">
          Доступ до сайту лише для співробітників Flolux після авторизації
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, type, value, onChange, hint, rightIcon: RightIcon, onRightClick }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 text-stone-800 dark:text-stone-100 bg-stone-50/50"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        />
        {RightIcon && (
          <button type="button" onClick={onRightClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            <RightIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-stone-400 mt-1 italic">{hint}</p>}
    </div>
  );
}

// ============ HEADER ============
function HeaderAvatar({ user, primary, size }) {
  const { byKey, roleChipStyle } = useRoles();
  return (
    <span className={`${size} rounded-full flex items-center justify-center overflow-hidden border`} style={roleChipStyle(primary)}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
        : createElement(iconFor(byKey[primary]?.iconKey, User), { className: 'w-4 h-4' })}
    </span>
  );
}

function Header({ user, onLogout, onNavigate, onProfile, view, isAdmin, canAdmin, theme, onToggleTheme, onOpenSearch, onOpenPath, onOpenAllNotifications, onOpenNotifSettings }) {
  const { roleName } = useRoles();
  const roles = userRoles(user);
  const primary = isAdmin ? 'admin' : (user.role || roles[0] || null);
  const roleLabel = primary
    ? `${roleName(primary)}${roles.length > 1 ? ` +${roles.length - 1}` : ''}`
    : 'Без ролі';
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-200 dark:border-stone-700">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 lg:gap-6 min-w-0 flex-shrink overflow-hidden">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group min-w-0 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center border border-rose-200 dark:border-rose-500/30 group-hover:bg-rose-100 transition flex-shrink-0">
              <Flower2 className="w-5 h-5 text-rose-500" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 hidden sm:block md:hidden lg:block">
              <div className="text-xl tracking-widest text-stone-800 dark:text-stone-100">FLOLUX</div>
              <div className="text-xs text-stone-400 italic -mt-0.5">База знань</div>
            </div>
          </button>

          {/* Desktop nav: на md тісно, на lg повноцінно */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 min-w-0">
            <NavBtn active={view === 'home'} onClick={() => onNavigate('home')} icon={BookOpen}>{canAdmin ? 'Бібліотека' : 'Моя бібліотека'}</NavBtn>
            <NavBtn active={view === 'tech'} onClick={() => onNavigate('tech')} icon={Wrench}>Технічка</NavBtn>
            <NavBtn active={view === 'docs'} onClick={() => onNavigate('docs')} icon={FileText}>Правила</NavBtn>
            <NavBtn active={view === 'courses'} onClick={() => onNavigate('courses')} icon={GraduationCap}>Навчання</NavBtn>
            {canAdmin && <NavBtn active={view === 'admin'} onClick={() => onNavigate('admin')} icon={Shield}>{isAdmin ? 'Адмін' : 'Керування'}</NavBtn>}
          </nav>
        </div>

        {/* Desktop: пошук + тема + ім'я + аватар + вихід */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0 min-w-0">
          <button onClick={onOpenSearch}
            className="hidden xl:flex items-center gap-2 px-3 min-h-[40px] rounded-md border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-rose-300 text-sm"
            style={{ fontFamily: 'system-ui, sans-serif' }} title="Пошук">
            <Search className="w-4 h-4" /> Пошук <kbd className="text-xs text-stone-400">⌘K</kbd>
          </button>
          <button onClick={onOpenSearch}
            className="xl:hidden w-11 h-11 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-rose-500" title="Пошук">
            <Search className="w-5 h-5" />
          </button>
          <button onClick={onToggleTheme} className="w-11 h-11 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-rose-500" title="Тема">
            <ThemeIcon className="w-5 h-5" />
          </button>
          <NotificationBell onOpenPath={onOpenPath} onOpenAll={onOpenAllNotifications} onOpenSettings={onOpenNotifSettings} />
          <button onClick={onProfile} className="text-right group hidden xl:block max-w-[180px] min-w-0" title="Мій профіль">
            <div className="text-sm text-stone-700 dark:text-stone-200 group-hover:text-rose-600 transition truncate" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {user.name}{user.surname ? ` ${user.surname}` : ''}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{roleLabel}</div>
          </button>
          <button onClick={onProfile} className="w-11 h-11 flex items-center justify-center" title="Мій профіль"><HeaderAvatar user={user} primary={primary} size="w-9 h-9" /></button>
          <button onClick={onLogout} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-rose-500 transition" title="Вийти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile: пошук + тема + аватар + вихід; навігація в bottom-nav */}
        <div className="md:hidden flex items-center gap-0.5">
          <button onClick={onOpenSearch} className="w-11 h-11 flex items-center justify-center text-stone-500 dark:text-stone-400 dark:text-stone-300" aria-label="Пошук">
            <Search className="w-5 h-5" />
          </button>
          <button onClick={onToggleTheme} className="w-11 h-11 flex items-center justify-center text-stone-500 dark:text-stone-400 dark:text-stone-300" aria-label="Тема">
            <ThemeIcon className="w-5 h-5" />
          </button>
          <NotificationBell onOpenPath={onOpenPath} onOpenAll={onOpenAllNotifications} onOpenSettings={onOpenNotifSettings} />
          <button onClick={onProfile} className="w-11 h-11 flex items-center justify-center" title="Мій профіль">
            <HeaderAvatar user={user} primary={primary} size="w-9 h-9" />
          </button>
          <button onClick={onLogout} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-rose-500 transition" aria-label="Вийти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2 xl:px-3 min-h-[44px] rounded-md text-sm whitespace-nowrap transition ${active ? 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/60'}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      {children}
    </button>
  );
}

// Нижня навігація для мобільного (основні розділи). Десктоп — прихована.
function MobileBottomNav({ view, isAdmin, canAdmin, onNavigate, onProfile }) {
  const items = [
    { key: 'home', label: 'Бібліотека', icon: BookOpen, onClick: () => onNavigate('home') },
    { key: 'docs', label: 'Правила', icon: FileText, onClick: () => onNavigate('docs') },
    { key: 'courses', label: 'Навчання', icon: GraduationCap, onClick: () => onNavigate('courses') },
    { key: 'profile', label: 'Профіль', icon: User, onClick: onProfile },
  ];
  if (canAdmin) items.splice(3, 0, { key: 'admin', label: isAdmin ? 'Адмін' : 'Керування', icon: Shield, onClick: () => onNavigate('admin') });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-t border-stone-200 dark:border-stone-700 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map((it) => {
        const active = view === it.key;
        return (
          <button key={it.key} onClick={it.onClick}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs transition px-1 ${active ? 'text-rose-600' : 'text-stone-500 dark:text-stone-400'}`}>
            <it.icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2.2 : 1.7} />
            <span className="truncate max-w-full" style={{ fontFamily: 'system-ui, sans-serif' }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ============ ГОЛОВНА ============
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
      {label}
      <button onClick={onRemove} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
    </span>
  );
}

function HomeView({ user, topics, articles, allLocations = [], isAdmin, isSenior = isAdmin, onTopicClick, onArticleClick, onOpenUser, onGoProfile, onOpenAnnouncements, onOpenDoc, onOpenCourse }) {
  const { roleName, roleKeys, roleChipStyle, byKey } = useRoles();
  const roles = userRoles(user);
  const [roleFilter, setRoleFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selRoles, setSelRoles] = useState([]);
  const [selLocs, setSelLocs] = useState([]);
  const [sort, setSort] = useState('new');
  const [showAllPublic, setShowAllPublic] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [popular, setPopular] = useState([]);
  const [bdToday, setBdToday] = useState([]);
  const [bdSoon, setBdSoon] = useState([]);
  const [digests, setDigests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [mandatoryDocs, setMandatoryDocs] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [recent, setRecent] = useState(getRecent());

  useEffect(() => {
    let active = true;
    // Один запит замість 5–6
    apiGet('/api/users/me/home-data').then((d) => {
      if (!active || !d) return;
      setBookmarks(Array.isArray(d.bookmarks) ? d.bookmarks : []);
      setDrafts(Array.isArray(d.drafts) ? d.drafts : []);
      setPopular(Array.isArray(d.popular) ? d.popular : []);
      setBdToday(Array.isArray(d.birthdaysToday) ? d.birthdaysToday : []);
      setBdSoon(Array.isArray(d.birthdaysUpcoming) ? d.birthdaysUpcoming : []);
      setDigests(Array.isArray(d.digests) ? d.digests : []);
    }).catch(() => {});

    apiGet('/api/announcements').then((list) => {
      if (active) setAnnouncements(Array.isArray(list) ? list : []);
    }).catch(() => {});

    apiGet('/api/docs/me/mandatory-unread').then((list) => {
      if (active) setMandatoryDocs(Array.isArray(list) ? list : []);
    }).catch(() => {});

    apiGet('/api/courses/me/onboarding').then((d) => {
      if (active) setOnboarding(d || null);
    }).catch(() => {});

    // Recent: перевіряємо існування й доступність, чистимо localStorage від мертвих id
    const recentIds = getRecent().map((r) => r.articleId);
    if (recentIds.length) {
      apiGet(`/api/articles/by-ids?ids=${recentIds.join(',')}`).then((arts) => {
        if (!active) return;
        const valid = (Array.isArray(arts) ? arts : []).map((a) => a.id);
        setRecent(pruneRecent(valid));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, []);

  if (!isSenior && roles.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl text-stone-800 dark:text-stone-100 mb-2">Очікування призначення ролі</h2>
        <p className="text-stone-500 dark:text-stone-400 max-w-md mx-auto italic">
          Ваш акаунт зареєстровано, але адміністратор ще не призначив вам роль.
          Зверніться до керівництва.
        </p>
      </div>
    );
  }

  // senior (admin|hr) — усі ролі; інші — свої, + (за toggle) усі публічні.
  const publicRoles = roleKeys.filter((k) => !byKey[k]?.restricted);
  const baseRoles = isSenior
    ? roleKeys
    : (showAllPublic ? [...new Set([...roles, ...publicRoles])] : roles);
  const shownRoles = (roleFilter === 'all' ? baseRoles : [roleFilter]).filter((r) => (topics[r] || []).length > 0);
  const allShownTopics = shownRoles.flatMap((r) => topics[r] || []);
  const recentArticles = articles
    .filter((a) => allShownTopics.some((t) => t.id === a.topicId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  const approved = (user.locations || []).filter((l) => l.approved);
  // userCount з бекенду включає мене -> для моїх локацій мінус я сам.
  const countFor = (id) => Math.max(0, (allLocations.find((x) => x.id === id)?.userCount ?? 0) - 1);

  // P5: фільтри бібліотеки
  const topicRoleOf = (a) => {
    for (const rk of Object.keys(topics)) {
      if ((topics[rk] || []).some((t) => t.id === a.topicId)) return rk;
    }
    return null;
  };
  const roleOptions = baseRoles;
  const locOptions = isSenior ? allLocations : allLocations.filter((l) => approved.some((ap) => ap.locationId === l.id));
  const toggleIn = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const filtersActive = !!q.trim() || selRoles.length > 0 || selLocs.length > 0;

  const SORTS = { new: 'Нові', old: 'Старі', title: 'Назва А-Я', rating: 'За рейтингом' };

  // P6: фільтрація на бекенді (GET /api/articles?roleKey&locationId&q&sort)
  useEffect(() => {
    if (!filtersActive) { setResults([]); return; }
    const sortMap = { new: 'new', old: 'old', title: 'az', rating: 'rating' };
    const params = new URLSearchParams();
    if (selRoles.length) params.set('roleKey', selRoles.join(','));
    if (selLocs.length) params.set('locationId', selLocs.join(','));
    if (q.trim()) params.set('q', q.trim());
    params.set('sort', sortMap[sort] || 'new');
    let active = true;
    setResultsLoading(true);
    apiGet(`/api/articles?${params.toString()}`)
      .then((list) => { if (active) setResults(Array.isArray(list) ? list : []); })
      .catch((e) => { if (active) { console.error(e); setResults([]); } })
      .finally(() => { if (active) setResultsLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersActive, q, sort, selRoles.join(','), selLocs.join(',')]);

  const activeCount = (q.trim() ? 1 : 0) + selRoles.length + selLocs.length;

  const filterControls = (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук по статтях…"
            className="w-full pl-10 pr-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="min-h-[44px] px-3 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Сортувати: {v}</option>)}
        </select>
      </div>
      {!isSenior && publicRoles.length > roles.length && (
        <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 mt-3">
          <input type="checkbox" className="w-4 h-4" checked={showAllPublic} onChange={(e) => setShowAllPublic(e.target.checked)} />
          Показати всі публічні ролі
        </label>
      )}
      {roleOptions.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {roleOptions.map((rk) => {
            const on = selRoles.includes(rk);
            return (
              <button key={rk} onClick={() => toggleIn(selRoles, setSelRoles, rk)}
                className="px-3 py-1.5 rounded-full text-xs border" style={on ? roleChipStyle(rk) : { borderColor: '#e7e5e4', color: '#78716c' }}>
                {roleName(rk)}
              </button>
            );
          })}
        </div>
      )}
      {locOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {locOptions.map((l) => {
            const on = selLocs.includes(l.id);
            return (
              <button key={l.id} onClick={() => toggleIn(selLocs, setSelLocs, l.id)}
                className={`px-3 py-1.5 rounded-full text-xs border ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                style={on ? { background: l.color || '#a8a29e' } : undefined}>
                {l.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-8 md:mb-10 pb-6 border-b border-stone-200 dark:border-stone-700">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Вітаємо</p>
        <h1 className="text-3xl md:text-4xl text-stone-800 dark:text-stone-100 mb-2">{user.name}</h1>
        <p className="text-stone-500 dark:text-stone-400 italic">
          {isSenior ? 'Уся бібліотека знань Flolux' : `Ваші ролі — ${roles.map(roleName).join(', ').toLowerCase()}`}
        </p>
      </div>

      <OnboardingCard enrollment={onboarding} onOpen={onOpenCourse} />

      <MandatoryDocsCard docs={mandatoryDocs} onOpen={onOpenDoc} />

      <HomeAnnouncements items={announcements} onChange={setAnnouncements} onSeeAll={onOpenAnnouncements} />

      <div className="mb-10 md:mb-12">
        <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Мої локації</h2>
        {approved.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-amber-800 italic">У вас немає підтверджених локацій. Запросіть локацію у профілі.</p>
            <button onClick={onGoProfile} className="px-4 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm whitespace-nowrap w-full sm:w-auto">Запросити локацію</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {approved.map((l) => (
              <div key={l.locationId} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 flex items-center justify-between">
                <span className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
                  <span className="w-3 h-3 rounded-full" style={{ background: l.color || '#a8a29e' }} />
                  {l.name}{l.isManager ? ' · керівник' : ''}
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400">{countFor(l.locationId)} {countFor(l.locationId) === 1 ? 'колега' : 'колег'} на локації</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* P5/P6: панель фільтрів — desktop inline, mobile у sheet */}
      <div className="hidden md:block bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 mb-4">
        {filterControls}
      </div>
      <div className="md:hidden mb-4">
        <button onClick={() => setMobileFilters(true)}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-sm text-stone-700 dark:text-stone-200">
          <Search className="w-4 h-4" /> Фільтри{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>
      {mobileFilters && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-stone-900/50" onClick={() => setMobileFilters(false)} />
          <div className="relative bg-white dark:bg-stone-900 rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700 sticky top-0 bg-white dark:bg-stone-900">
              <h3 className="text-lg text-stone-800 dark:text-stone-100">Фільтри</h3>
              <button onClick={() => setMobileFilters(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">{filterControls}</div>
            <div className="p-4 border-t border-stone-200 dark:border-stone-700 sticky bottom-0 bg-white dark:bg-stone-900 flex gap-2">
              <button onClick={() => { setQ(''); setSelRoles([]); setSelLocs([]); }} className="flex-1 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скинути</button>
              <button onClick={() => setMobileFilters(false)} className="flex-1 min-h-[44px] bg-rose-500 text-white rounded-md text-sm">Показати</button>
            </div>
          </div>
        </div>
      )}

      {filtersActive && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {q.trim() && <FilterChip label={`Пошук: ${q.trim()}`} onRemove={() => setQ('')} />}
          {selRoles.map((rk) => <FilterChip key={rk} label={roleName(rk)} onRemove={() => toggleIn(selRoles, setSelRoles, rk)} />)}
          {selLocs.map((id) => <FilterChip key={id} label={allLocations.find((l) => l.id === id)?.name || id} onRemove={() => toggleIn(selLocs, setSelLocs, id)} />)}
          <button onClick={() => { setQ(''); setSelRoles([]); setSelLocs([]); }} className="text-xs text-stone-500 dark:text-stone-400 hover:text-rose-600">Скинути все</button>
        </div>
      )}

      {filtersActive ? (
        <div className="space-y-3 mb-12">
          <p className="text-xs uppercase tracking-widest text-stone-400">{resultsLoading ? 'Пошук…' : `Знайдено: ${results.length}`}</p>
          {results.map((a) => {
            const rk = topicRoleOf(a);
            return (
              <button key={a.id} onClick={() => onArticleClick(a)}
                className="block w-full text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 md:p-5 hover:border-rose-300 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-stone-800 dark:text-stone-100 mb-1">{a.title}</h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-2">{a.content.replace(/[*#]/g, '').substring(0, 160)}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                      {rk && <span className="px-2 py-0.5 rounded-full border" style={roleChipStyle(rk)}>{roleName(rk)}</span>}
                      <span>{new Date(a.createdAt).toLocaleDateString('uk-UA')}</span>
                      {a.ratingAvg > 0 && <span>★ {a.ratingAvg}</span>}
                      {(a.locations || []).map((l) => (
                        <span key={l.locationId} className="px-1.5 py-0.5 rounded text-white" style={{ background: l.color || '#a8a29e' }}>{l.name}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
          {!resultsLoading && results.length === 0 && <p className="text-stone-400 italic">Нічого не знайдено за фільтрами.</p>}
        </div>
      ) : (
        <>
          {drafts.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">📝 Мої чернетки</h2>
              <div className="flex gap-3 overflow-x-auto scroll-touch pb-1">
                {drafts.map((d) => (
                  <button key={d.id} onClick={() => onArticleClick({ id: d.id })}
                    className="flex-shrink-0 w-64 text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 hover:border-rose-300 transition">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                        Чернетка
                      </span>
                    </div>
                    <div className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2">{d.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {bookmarks.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">📑 Мої закладки</h2>
              <div className="flex gap-3 overflow-x-auto scroll-touch pb-1">
                {bookmarks.map((b) => (
                  <button key={b.id} onClick={() => onArticleClick({ id: b.id })}
                    className="flex-shrink-0 w-64 text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 hover:border-rose-300 transition">
                    <div className="text-sm text-stone-800 dark:text-stone-100 line-clamp-1">{b.title}</div>
                    <div className="text-xs text-stone-400 line-clamp-2 mt-1" style={{ fontFamily: 'system-ui, sans-serif' }}>{b.excerpt}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">🕐 Нещодавно переглянуті</h2>
              <div className="flex gap-3 overflow-x-auto scroll-touch pb-1">
                {recent.map((r) => (
                  <button key={r.articleId} onClick={() => onArticleClick({ id: r.articleId })}
                    className="flex-shrink-0 w-56 text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 hover:border-rose-300 transition">
                    <div className="flex items-center gap-2 text-xs text-stone-400 mb-1"><Clock className="w-3 h-3" />{new Date(r.viewedAt).toLocaleDateString('uk-UA')}</div>
                    <div className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2">{r.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(bdToday.length > 0 || bdSoon.length > 0) && (
            <div className="mb-8 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5">
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">🎂 Дні народження</h2>
              {bdToday.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm text-stone-700 dark:text-stone-200 mb-2">Сьогодні святкують:</div>
                  <div className="flex flex-wrap gap-2">
                    {bdToday.map((u) => (
                      <button key={u.id} onClick={() => onOpenUser?.(u.id)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-stone-800 border border-rose-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-100">
                        <span className="w-6 h-6 rounded-full overflow-hidden bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs">
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.name || '?')[0]}
                        </span>
                        {u.name} <span className="text-rose-600">🎉 Привітати</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {bdSoon.length > 0 && (
                <div>
                  <div className="text-sm text-stone-500 dark:text-stone-400 mb-2">Цього тижня:</div>
                  <div className="flex flex-wrap gap-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    {bdSoon.map((u) => (
                      <button key={u.id} onClick={() => onOpenUser?.(u.id)}
                        className="text-xs px-2.5 py-1 rounded-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300">
                        {u.name} · через {u.inDays} дн.
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {digests.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">📢 Дайджест компанії</h2>
              <button onClick={() => onArticleClick({ id: digests[0].id })}
                className="block w-full text-left rounded-lg p-5 text-white mb-3"
                style={{ background: 'linear-gradient(120deg,#a855f7,#ec4899)' }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs uppercase tracking-widest opacity-80">{new Date(digests[0].createdAt).toLocaleDateString('uk-UA')}</span>
                  {digests[0].digestCategory && digestCategory(digests[0].digestCategory) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">
                      {digestCategory(digests[0].digestCategory).icon} {digestCategory(digests[0].digestCategory).label}
                    </span>
                  )}
                </div>
                <div className="text-lg md:text-xl">{digests[0].title}</div>
              </button>
              {digests.length > 3 ? (
                // Групуємо за категоріями
                (() => {
                  const groups = {};
                  digests.slice(1).forEach((d) => {
                    const k = d.digestCategory || 'other';
                    (groups[k] = groups[k] || []).push(d);
                  });
                  return (
                    <div className="space-y-3">
                      {Object.entries(groups).map(([k, list]) => {
                        const c = digestCategory(k);
                        return (
                          <div key={k}>
                            <div className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 flex items-center gap-1.5">
                              {c ? <><span>{c.icon}</span>{c.label}</> : 'Інше'}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {list.map((d) => (
                                <button key={d.id} onClick={() => onArticleClick({ id: d.id })}
                                  className="text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3 hover:border-rose-300 transition">
                                  <div className="text-xs text-stone-400 mb-1">{new Date(d.createdAt).toLocaleDateString('uk-UA')}</div>
                                  <div className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2">{d.title}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                digests.length > 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {digests.slice(1, 4).map((d) => (
                      <button key={d.id} onClick={() => onArticleClick({ id: d.id })}
                        className="text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3 hover:border-rose-300 transition">
                        <div className="text-xs text-stone-400 mb-1 flex items-center gap-1.5">
                          {d.digestCategory && digestCategory(d.digestCategory) && (
                            <span>{digestCategory(d.digestCategory).icon}</span>
                          )}
                          {new Date(d.createdAt).toLocaleDateString('uk-UA')}
                        </div>
                        <div className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2">{d.title}</div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {popular.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">🔥 Найпопулярніші</h2>
              <div className="flex gap-3 overflow-x-auto scroll-touch pb-1 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible">
                {popular.map((p) => (
                  <button key={p.id} onClick={() => onArticleClick({ id: p.id })}
                    className="flex-shrink-0 w-64 md:w-auto text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 hover:border-rose-300 transition">
                    <div className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2 mb-1">{p.title}</div>
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{p.viewsCount}</span>
                      <span>· {new Date(p.createdAt).toLocaleDateString('uk-UA')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest text-stone-400">
              {isSenior ? 'Усі розділи знань' : 'Розділи знань для ваших ролей'}
            </h2>
            {baseRoles.length > 1 && (
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                className="text-sm border border-stone-200 dark:border-stone-700 rounded-md px-3 py-1.5 bg-white dark:bg-stone-900" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <option value="all">Усе</option>
                {baseRoles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-10 mb-12">
            {shownRoles.map((rk) => (
              <div key={rk}>
                {(shownRoles.length > 1) && (
                  <h3 className="text-sm text-stone-600 dark:text-stone-300 mb-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs border" style={roleChipStyle(rk)}>{roleName(rk)}</span>
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(topics[rk] || []).map((topic) => {
                    const count = articles.filter((a) => a.topicId === topic.id).length;
                    const Ico = iconFor(topic.icon);
                    return (
                      <button key={topic.id} onClick={() => onTopicClick(topic)}
                        className="text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6 hover:border-rose-300 hover:shadow-md transition group">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-100 transition">
                            <Ico className="w-5 h-5 text-rose-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-1">
                              <h3 className="text-xl text-stone-800 dark:text-stone-100 group-hover:text-rose-600 transition">{topic.title}</h3>
                              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-rose-400 group-hover:translate-x-1 transition" />
                            </div>
                            <p className="text-sm text-stone-500 dark:text-stone-400 italic mb-2">{topic.description}</p>
                            <p className="text-xs text-stone-400">{count} {articleWord(count)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {shownRoles.length === 0 && (
              <p className="text-stone-400 italic">Розділів ще немає.</p>
            )}
          </div>

          {recentArticles.length > 0 && (
            <>
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4">Останні матеріали</h2>
              <div className="space-y-3">
                {recentArticles.map((a) => (
                  <button key={a.id} onClick={() => onArticleClick(a)}
                    className="block w-full text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded p-4 hover:border-stone-300 transition">
                    <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                      <Clock className="w-3 h-3" />
                      {new Date(a.createdAt).toLocaleDateString('uk-UA')}
                    </div>
                    <h3 className="text-stone-800 dark:text-stone-100">{a.title}</h3>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Жовта картка зверху HomeView для onboarding-курсу (якщо не завершено).
function OnboardingCard({ enrollment, onOpen }) {
  if (!enrollment || enrollment.status === 'completed') return null;
  const pct = enrollment.progressPct || 0;
  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/15 p-4">
      <div className="flex items-center gap-2 mb-2">
        <GraduationCap className="w-4 h-4 text-amber-700" />
        <h2 className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Базовий курс новачка
        </h2>
      </div>
      <div className="text-stone-800 dark:text-stone-100 mb-1 text-base">{enrollment.course.title}</div>
      {enrollment.course.description && (
        <p className="text-xs text-stone-600 dark:text-stone-300 mb-3 line-clamp-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {enrollment.course.description}
        </p>
      )}
      {enrollment.total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300 mb-1">
            <span>Прогрес: {enrollment.completed} з {enrollment.total} уроків</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-white dark:bg-stone-800 rounded">
            <div className="h-2 rounded transition-all" style={{ width: `${pct}%`, background: '#f59e0b' }} />
          </div>
        </div>
      )}
      <button onClick={() => onOpen?.(enrollment.course.slug)}
        className="px-4 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {enrollment.status === 'assigned' ? 'Почати' : 'Продовжити'} →
      </button>
    </div>
  );
}

// Червона картка зверху HomeView, якщо є непідтверджені обов'язкові документи.
function MandatoryDocsCard({ docs, onOpen }) {
  if (!docs || docs.length === 0) return null;
  return (
    <div className="mb-6 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-500/15 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-rose-600" />
        <h2 className="text-sm uppercase tracking-wider text-rose-700 dark:text-rose-300">
          Документи для ознайомлення ({docs.length})
        </h2>
      </div>
      <div className="space-y-1.5">
        {docs.map((d) => (
          <button key={d.id} onClick={() => onOpen?.(d.slug)}
            className="w-full text-left flex items-center justify-between gap-2 p-2 rounded bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-500/30 hover:border-rose-400">
            <span className="text-sm text-stone-800 dark:text-stone-100 truncate">{d.title}</span>
            <span className="text-xs text-rose-600 flex-shrink-0">
              {d.needsReack ? '↻ Оновлено' : '❗ Прочитати'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Секція "📢 Оголошення" на головній — pinned + не прочитані; click → inline expand.
function HomeAnnouncements({ items, onChange, onSeeAll }) {
  const [openId, setOpenId] = useState(null);
  if (!items || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  const shown = sorted.slice(0, 3);
  const hasMore = sorted.length > shown.length;

  const markRead = (id) => {
    apiPost(`/api/announcements/${id}/read`).then(() => {
      onChange?.((prev) => prev.map((a) => a.id === id ? { ...a, readAt: Date.now() } : a));
    }).catch(() => {});
  };

  return (
    <div className="mb-10 md:mb-12">
      <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5" /> Оголошення компанії
      </h2>
      <div className="space-y-3">
        {shown.map((a) => (
          <AnnouncementCard
            key={a.id}
            ann={a}
            expanded={openId === a.id}
            onClick={() => setOpenId(openId === a.id ? null : a.id)}
            onMarkRead={markRead}
          />
        ))}
      </div>
      {hasMore && onSeeAll && (
        <button onClick={onSeeAll} className="inline-block text-sm text-rose-600 hover:text-rose-700 mt-3">
          Усі оголошення ({sorted.length}) →
        </button>
      )}
    </div>
  );
}

// ============ ТЕХНІЧНА БАЗА ============
function TechView({ topics, articles, onTopicClick }) {
  return (
    <div>
      <div className="mb-10 pb-6 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-200">
            <Wrench className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Спеціалізований розділ</p>
            <h1 className="text-3xl text-stone-800 dark:text-stone-100">Технічна база Flolux</h1>
          </div>
        </div>
        <p className="text-stone-500 dark:text-stone-400 italic max-w-2xl">
          Діагностика обладнання, рішення типових проблем з принтерами POS-80,
          MacBook, AnyDesk та іншою технікою. Доступно всім співробітникам.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics.map((topic) => {
          const count = articles.filter((a) => a.topicId === topic.id).length;
          const iconMap = { 'tc-1': Printer, 'tc-2': Monitor, 'tc-3': Wifi, 'tc-4': Wifi, 'tc-5': Settings };
          const Icon = topic.icon ? iconFor(topic.icon, Wrench) : (iconMap[topic.id] || Wrench);
          return (
            <button key={topic.id} onClick={() => onTopicClick(topic)}
              className="text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6 hover:border-indigo-300 hover:shadow-md transition group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition">
                  <Icon className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl text-stone-800 dark:text-stone-100 mb-2 group-hover:text-indigo-600 transition">{topic.title}</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 italic mb-2">{topic.description}</p>
                  <p className="text-xs text-stone-400">{count} {articleWord(count)}</p>
                </div>
              </div>
            </button>
          );
        })}
        {topics.length === 0 && <p className="text-stone-400 italic col-span-full">Технічних розділів ще немає.</p>}
      </div>
    </div>
  );
}

// ============ ТОПІК ============
function TopicView({ topic, articles, onBack, onArticleClick, onCreate }) {
  const [search, setSearch] = useState('');
  const filtered = articles.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px] transition">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 dark:border-stone-700">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Розділ</p>
        <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100 mb-2">{topic.title}</h1>
        <p className="text-stone-500 dark:text-stone-400 italic">{topic.description}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Пошук статей..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 min-h-[44px] py-2.5 border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:border-rose-400 bg-white dark:bg-stone-900"
            style={{ fontFamily: 'system-ui, sans-serif' }} />
        </div>
        <button onClick={onCreate} className="flex items-center justify-center gap-2 px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md transition text-sm w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Створити статтю
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 italic">
          {search ? 'Нічого не знайдено за вашим запитом' : 'У цьому розділі ще немає статей. Створіть першу!'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <button key={a.id} onClick={() => onArticleClick(a)}
              className="block w-full text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 hover:border-rose-300 hover:shadow-sm transition group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg text-stone-800 dark:text-stone-100 group-hover:text-rose-600 transition mb-1">{a.title}</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    {a.content.replace(/[*#]/g, '').substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span>{new Date(a.createdAt).toLocaleDateString('uk-UA')}</span>
                    {a.tags && a.tags.length > 0 && (
                      <div className="flex gap-1.5">
                        {a.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-600 dark:text-stone-300">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-rose-400 transition flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ СТАТТЯ ============
function ArticleView({ articleId, user, isAdmin, isSenior = isAdmin, onBack, onEdit, onArticleUpdated, onOpenUser }) {
  const { roleName, roleChipStyle } = useRoles();
  const confirm = useConfirm();
  const [article, setArticle] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [commentText, setCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [openSug, setOpenSug] = useState(false);
  const [openCom, setOpenCom] = useState(false);
  const [copied, setCopied] = useState(false);

  // P1: статтю (разом з коментарями/пропозиціями/рейтингами) тягнемо з GET /api/articles/:id.
  // Дані персистентні в БД — після F5 підвантажуються знову.
  const load = async () => {
    try {
      const a = await apiGet(`/api/articles/${articleId}`);
      setArticle(a);
      setStatus('ok');
      if (onArticleUpdated) onArticleUpdated();
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };
  useEffect(() => {
    setStatus('loading');
    let active = true;
    apiGet(`/api/articles/${articleId}`)
      .then((a) => {
        if (!active) return;
        setArticle(a);
        setStatus('ok');
        addRecent(a);
        // Фіксуємо унікальний перегляд (один раз на відкриття)
        apiPost(`/api/articles/${articleId}/view`).catch(() => {});
      })
      .catch((e) => { if (active) { console.error(e); setStatus('error'); } });
    return () => { active = false; };
  }, [articleId]);

  const [showViewers, setShowViewers] = useState(false);
  const publishNow = async () => {
    await apiPatch(`/api/articles/${articleId}`, { status: 'published', publishAt: null });
    await load();
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Видалити статтю?',
      description: `Стаття "${article?.title || ''}" та всі її коментарі, пропозиції, перегляди будуть видалені назавжди. Цю дію неможливо скасувати.`,
      confirmLabel: 'Так, видалити',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/articles/${articleId}`);
      removeRecent(articleId);
      if (onArticleUpdated) onArticleUpdated();
      onBack();
    } catch (e) { alert(e.message); }
  };

  const toggleBookmark = async () => {
    try {
      const r = await apiPost(`/api/articles/${articleId}/bookmark`);
      setArticle((a) => (a ? { ...a, bookmarked: r.bookmarked } : a));
    } catch (e) { console.error(e); }
  };

  const comments = article?.comments || [];
  const suggestions = article?.suggestions || [];
  const canEdit = !!article && (isSenior || article.author === user.id);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await apiPost(`/api/articles/${articleId}/comments`, { content: commentText });
    setCommentText('');
    await load();
  };

  const handleSuggestion = async () => {
    if (!suggestionText.trim()) return;
    await apiPost(`/api/articles/${articleId}/suggestions`, { content: suggestionText });
    setSuggestionText('');
    setShowSuggest(false);
    await load();
  };

  const setSuggStatus = async (sugg, st) => {
    const ok = await confirm(st === 'approved'
      ? { title: 'Прийняти пропозицію?', description: 'Пропозицію буде позначено як прийняту.', confirmLabel: 'Прийняти', confirmVariant: 'primary' }
      : { title: 'Відхилити пропозицію?', description: 'Пропозицію буде відхилено.', confirmLabel: 'Відхилити' });
    if (!ok) return;
    await apiPatch(`/api/suggestions/${sugg.id}`, { status: st });
    await load();
  };

  const rateSuggestion = async (sugg, rating) => {
    await apiPost(`/api/suggestions/${sugg.id}/rate`, { rating });
    await load();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard недоступний */ }
  };

  if (status === 'loading') {
    return <div className="text-center py-16 text-stone-400 italic">Завантаження статті…</div>;
  }
  if (status === 'error' || !article) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500 dark:text-stone-400 italic mb-4">Статтю не знайдено або вона недоступна.</p>
        <button onClick={onBack} className="px-4 min-h-[44px] bg-rose-500 text-white rounded-md text-sm">Повернутися</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 no-print flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 min-h-[44px] transition">
          <ArrowLeft className="w-4 h-4" /> Повернутися
        </button>
        <div className="flex items-center gap-1">
          <button onClick={toggleBookmark} className={`flex items-center gap-2 text-sm min-h-[44px] px-2 transition ${article.bookmarked ? 'text-rose-600' : 'text-stone-500 dark:text-stone-400 hover:text-rose-600'}`} title="Закладка">
            <Bookmark className="w-4 h-4" fill={article.bookmarked ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">{article.bookmarked ? 'У закладках' : 'У закладки'}</span>
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-rose-600 min-h-[44px] px-2 transition" title="Завантажити PDF">
            <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Завантажити PDF</span>
          </button>
          <button onClick={copyLink} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-rose-600 min-h-[44px] px-2 transition" title="Копіювати посилання">
            <Link2 className="w-4 h-4" /> <span className="hidden sm:inline">{copied ? 'Скопійовано' : 'Копіювати посилання'}</span>
          </button>
          {canEdit && (
            <button onClick={onDelete} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-red-600 min-h-[44px] px-2 transition" title="Видалити статтю">
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Видалити</span>
            </button>
          )}
        </div>
      </div>

      <article className="article-content bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-8 mb-6">
        <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100 break-words min-w-0 flex-1">{article.title}</h1>
              {canEdit && (
                <button onClick={onEdit} className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-stone-400 hover:text-rose-500 transition" title="Редагувати">
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-400 mb-6 pb-6 border-b border-stone-100 dark:border-stone-800">
              <Clock className="w-3 h-3" />
              {new Date(article.createdAt).toLocaleDateString('uk-UA')}
              {article.authorName && article.author !== 'system' && (
                <>
                  <span>·</span>
                  <button onClick={() => onOpenUser?.(article.author)} className="hover:text-rose-600 hover:underline">{article.authorName}</button>
                </>
              )}
              {article.tags && article.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex gap-1.5">
                    {article.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-600 dark:text-stone-300 flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {article.isDigest && (
                <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ background: 'linear-gradient(90deg,#a855f7,#ec4899)' }}>📢 Дайджест</span>
              )}
              {article.isDigest && article.digestCategory && digestCategory(article.digestCategory) && (
                <span className="px-2 py-0.5 rounded-full text-xs text-white flex items-center gap-1"
                  style={{ background: digestCategory(article.digestCategory).color }}>
                  <span>{digestCategory(article.digestCategory).icon}</span>
                  {digestCategory(article.digestCategory).label}
                </span>
              )}
              {article.status === 'draft' && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200">📝 Чернетка</span>
              )}
              {article.publishAt && new Date(article.publishAt).getTime() > Date.now() && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-200">
                  🕐 Запланована публікація: {new Date(article.publishAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                <Eye className="w-3.5 h-3.5" /> {article.viewsCount ?? 0} переглянули
              </span>
              {canEdit && article.status !== 'published' && (
                <button onClick={publishNow} className="no-print px-3 py-1 rounded-full text-xs bg-rose-500 hover:bg-rose-600 text-white">
                  Опублікувати зараз
                </button>
              )}
            </div>

            {(article.viewers || []).length > 0 && (
              <div className="mb-4 no-print">
                <button onClick={() => setShowViewers((v) => !v)} className="text-xs text-stone-500 dark:text-stone-400 hover:text-rose-600 flex items-center gap-1">
                  <ChevronDown className={`w-3.5 h-3.5 transition ${showViewers ? 'rotate-180' : ''}`} /> Хто прочитав ({article.viewers.length})
                </button>
                {showViewers && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {article.viewers.map((v) => (
                      <button key={v.id} onClick={() => onOpenUser?.(v.id)}
                        className="flex items-center gap-2 px-2 py-1 rounded-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300">
                        <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden flex items-center justify-center">
                          {v.avatarUrl ? <img src={v.avatarUrl} alt="" className="w-full h-full object-cover" /> : (v.name || '?')[0]}
                        </span>
                        {v.name}
                        <span className="text-stone-400">· {new Date(v.viewedAt).toLocaleDateString('uk-UA')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {article.locations && article.locations.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {article.locations.map((l) => (
                  <span key={l.locationId} className="px-2 py-0.5 rounded-full text-xs text-white flex items-center gap-1" style={{ background: l.color || '#a8a29e' }}>
                    <MapPin className="w-3 h-3" />{l.name}
                  </span>
                ))}
              </div>
            )}

            <div className="prose prose-stone dark:prose-invert max-w-none text-stone-700 dark:text-stone-200 break-words"
              style={{ fontFamily: 'system-ui, sans-serif', fontSize: '16px', lineHeight: '1.7' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }} />

            {article.mediaUrls && article.mediaUrls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {article.mediaUrls.map((url) => (
                  /\.(mp4|mov|webm)$/i.test(url)
                    ? <video key={url} src={url} controls playsInline preload="metadata" className="w-full rounded-lg border border-stone-200 dark:border-stone-700" />
                    : <img key={url} src={url} alt="" loading="lazy" className="w-full rounded-lg border border-stone-200 dark:border-stone-700 object-cover" />
                ))}
              </div>
            )}
          </>
      </article>

      {/* Пропозиції правок */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button onClick={() => setOpenSug((v) => !v)} className="flex items-center gap-2 text-lg text-stone-800 dark:text-stone-100 md:cursor-default">
            <Star className="w-4 h-4 text-amber-500" />
            Пропозиції покращень <span className="text-stone-400 text-sm">({suggestions.length})</span>
            <ChevronDown className={`w-4 h-4 text-stone-400 md:hidden transition ${openSug ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => { setShowSuggest(!showSuggest); setOpenSug(true); }} className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1 min-h-[44px]">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Запропонувати правку</span><span className="sm:hidden">Правка</span>
          </button>
        </div>

        <div className={`${openSug ? '' : 'hidden '}md:block`}>
        {showSuggest && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded">
            <textarea value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Опишіть пропозицію щодо покращення статті..." rows={3}
              className="w-full p-3 border border-amber-200 rounded text-sm focus:outline-none focus:border-amber-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSuggestion} className="px-4 min-h-[44px] bg-amber-500 text-white rounded text-sm">Надіслати</button>
              <button onClick={() => setShowSuggest(false)} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded text-sm">Скасувати</button>
            </div>
          </div>
        )}

        {suggestions.length === 0 ? (
          <p className="text-sm text-stone-400 italic">Поки що немає пропозицій. Будьте першим!</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className={`p-4 rounded border ${s.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : s.status === 'rejected' ? 'bg-rose-50 border-rose-200 opacity-60' : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm text-stone-700 dark:text-stone-200">{s.authorName}</span>
                    <span className="text-xs text-stone-400 ml-2">{roleName(s.authorRole)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === 'approved' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Прийнято</span>}
                    {s.status === 'rejected' && <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded">Відхилено</span>}
                    {s.status === 'pending' && isSenior && (
                      <>
                        <button onClick={() => setSuggStatus(s, 'approved')} className="w-10 h-10 flex items-center justify-center text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setSuggStatus(s, 'rejected')} className="w-10 h-10 flex items-center justify-center text-rose-500 hover:text-rose-600"><X className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-200 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</p>
                <Stars avg={s.ratingAvg ?? 0} mine={s.myRating ?? null} count={s.ratingCount ?? 0} onRate={(n) => rateSuggestion(s, n)} />
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Коментарі */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6">
        <button onClick={() => setOpenCom((v) => !v)} className="w-full flex items-center justify-between gap-2 mb-4 md:cursor-default">
          <span className="text-lg text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            Обговорення <span className="text-stone-400 text-sm">({comments.length})</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-stone-400 md:hidden transition ${openCom ? 'rotate-180' : ''}`} />
        </button>

        <div className={`${openCom ? '' : 'hidden '}md:block`}>
        <div className="space-y-3 mb-4">
          {comments.length === 0 ? (
            <p className="text-sm text-stone-400 italic">Поки що немає коментарів</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 p-3 bg-stone-50 dark:bg-stone-900 rounded">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs border" style={roleChipStyle(c.authorRole)}>
                  {(c.authorName || '?')[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => onOpenUser?.(c.author)} className="text-sm text-stone-700 dark:text-stone-200 hover:text-rose-600 hover:underline">{c.authorName}</button>
                    <span className="text-xs text-stone-400">{roleName(c.authorRole)}</span>
                    <span className="text-xs text-stone-400">· {new Date(c.createdAt).toLocaleDateString('uk-UA')}</span>
                  </div>
                  <p className="text-sm text-stone-700 dark:text-stone-200" style={{ fontFamily: 'system-ui, sans-serif' }}>{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleComment()} placeholder="Написати коментар..."
            className="flex-1 px-4 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
          <button onClick={handleComment} className="w-12 min-h-[44px] flex items-center justify-center bg-stone-800 hover:bg-stone-900 text-white rounded-md transition flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

// ============ ФОРМА СТАТТІ (створення + редагування) ============
const mediaType = (url) => (/\.(mp4|mov|webm)$/i.test(url) ? 'video' : 'image');

function ArticleForm({ mode, topic, article, allLocations = [], onClose, onSaved, digest = false }) {
  const isEdit = mode === 'edit';
  const isDigestForm = digest || !!article?.isDigest;
  const { roleKeys, roleName } = useRoles();
  const [notifyOn, setNotifyOn] = useState(!!article?.notifyMode);
  const [notifyMode, setNotifyMode] = useState(article?.notifyMode || 'all');
  const [notifyTargets, setNotifyTargets] = useState(
    Array.isArray(article?.notifyTargets) ? article.notifyTargets : []
  );
  const toggleTarget = (v) => setNotifyTargets((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const [form, setForm] = useState({
    title: article?.title || '',
    content: article?.content || '',
    tags: isEdit ? (article?.tags || []).join(', ') : '',
  });
  const [digestCat, setDigestCat] = useState(article?.digestCategory || DIGEST_CATEGORIES[0].key);
  const [locationIds, setLocationIds] = useState(
    isEdit ? (article?.locations || []).map((l) => l.locationId) : []
  );
  const [mediaUrls, setMediaUrls] = useState(
    isEdit ? (article?.mediaUrls || []).map((url) => ({ url, type: mediaType(url) })) : []
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upPct, setUpPct] = useState(0);
  const [cityFilter, setCityFilter] = useState('all');
  const [locSearch, setLocSearch] = useState('');
  const mediaRef = useRef(null);

  const toLocalInput = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [pubMode, setPubMode] = useState(
    article?.status === 'draft'
      ? 'draft'
      : (article?.publishAt && new Date(article.publishAt).getTime() > Date.now() ? 'schedule' : 'now')
  );
  const [publishAt, setPublishAt] = useState(toLocalInput(article?.publishAt));

  const toggleLoc = (id) => setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const cities = [...new Set(allLocations.map((l) => l.city).filter(Boolean))];
  const visibleLocs = allLocations.filter((l) => {
    if (l.active === false && !locationIds.includes(l.id)) return false;
    if (cityFilter !== 'all' && (l.city || '—') !== cityFilter) return false;
    if (locSearch && !`${l.name} ${l.address || ''}`.toLowerCase().includes(locSearch.toLowerCase())) return false;
    return true;
  });

  const onPickMedia = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(''); setUploading(true); setUpPct(0);
    try {
      for (const f of files) {
        const up = await apiUpload(f, (pct) => setUpPct(pct));
        setMediaUrls((prev) => [...prev, { url: up.url, type: up.type, thumbnailUrl: up.thumbnailUrl || null }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false); setUpPct(0);
      if (mediaRef.current) mediaRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Заповніть назву та зміст статті');
      return;
    }
    if (pubMode === 'schedule' && !publishAt) {
      setError('Вкажіть дату й час публікації');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        tags: form.tags,
        locationIds,
        mediaUrls: mediaUrls.map((m) => m.url),
        status: pubMode === 'draft' ? 'draft' : 'published',
        publishAt: pubMode === 'schedule' && publishAt ? new Date(publishAt).toISOString() : null,
        notifyMode: notifyOn ? notifyMode : null,
        notifyTargets: notifyOn && notifyMode !== 'all' ? notifyTargets : [],
      };
      if (isDigestForm) payload.digestCategory = digestCat;
      if (isEdit) {
        await apiPatch(`/api/articles/${article.id}`, payload);
        if (isDigestForm && article?.digestCategory !== digestCat) {
          await apiPatch(`/api/digests/${article.id}`, { digestCategory: digestCat }).catch(() => {});
        }
      } else if (digest) {
        await apiPost('/api/digests', payload);
      } else {
        await apiPost('/api/articles', {
          ...payload,
          topicId: topic.id,
          section: topic.id.startsWith('tc-') ? 'tech' : 'role',
        });
      }
      await onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between sticky top-0 bg-white dark:bg-stone-900 z-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">{isEdit ? 'Редагування статті' : digest ? 'Новий дайджест' : 'Нова стаття в розділі'}</p>
            <h2 className="text-lg md:text-xl text-stone-800 dark:text-stone-100">{isEdit ? form.title || 'Без назви' : topic.title}</h2>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Заголовок</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} placeholder="Назва статті" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Зміст</label>
            <MarkdownEditor value={form.content} onChange={(v) => setForm({ ...form, content: v })}
              placeholder="Текст статті. Markdown підтримується (тулбар вище)." />
          </div>

          {isDigestForm && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Категорія дайджесту</label>
              <div className="flex flex-wrap gap-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {DIGEST_CATEGORIES.map((c) => {
                  const on = digestCat === c.key;
                  return (
                    <button key={c.key} type="button" onClick={() => setDigestCat(c.key)}
                      className={`px-3 min-h-[40px] rounded-full text-sm border transition flex items-center gap-1.5 ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300 bg-white dark:bg-stone-900'}`}
                      style={on ? { background: c.color } : undefined}>
                      <span>{c.icon}</span>{c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Теги (через кому)</label>
            <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }}
              placeholder="наприклад: троянди, догляд, поради" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
              Локації <span className="text-stone-400 normal-case">(порожньо = доступно всім за роллю)</span>
            </label>
            {allLocations.length === 0 ? (
              <span className="text-sm text-stone-400 italic">Локацій ще немає</span>
            ) : (
              <>
                <input type="text" value={locSearch} onChange={(e) => setLocSearch(e.target.value)} placeholder="Пошук локації…"
                  className="w-full px-3 min-h-[44px] mb-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }} />
                {cities.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['all', ...cities].map((c) => (
                      <button key={c} type="button" onClick={() => setCityFilter(c)}
                        className={`px-3 py-1 rounded-full text-xs border transition ${cityFilter === c ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
                        {c === 'all' ? 'Всі міста' : c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {visibleLocs.map((l) => {
                    const on = locationIds.includes(l.id);
                    return (
                      <button key={l.id} type="button" onClick={() => toggleLoc(l.id)}
                        className={`px-3 min-h-[40px] rounded-full text-sm border transition ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300 bg-white dark:bg-stone-900'}`}
                        style={on ? { background: l.color || '#a8a29e' } : undefined}>
                        {l.name}{l.city ? <span className="opacity-70"> · {l.city}</span> : ''}
                      </button>
                    );
                  })}
                  {visibleLocs.length === 0 && <span className="text-sm text-stone-400 italic">Нічого не знайдено</span>}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Фото / відео</label>
            <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickMedia} />
            <button type="button" onClick={() => mediaRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 min-h-[44px] border border-stone-300 hover:border-rose-400 rounded-md text-sm text-stone-700 dark:text-stone-200 disabled:opacity-60">
              <Plus className="w-4 h-4" /> {uploading ? `Завантаження… ${upPct}%` : 'Додати фото/відео'}
            </button>
            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {mediaUrls.map((m, i) => (
                  <div key={m.url} className="relative group">
                    {m.type === 'video'
                      ? <video src={m.url} playsInline preload="metadata" className="w-full h-24 object-cover rounded" />
                      : <img src={m.thumbnailUrl || m.url} alt="" loading="lazy" className="w-full h-24 object-cover rounded" />}
                    <button type="button" onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-stone-900/70 text-white rounded-full w-7 h-7 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontFamily: 'system-ui, sans-serif' }}>
            <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 min-h-[40px]">
              <input type="checkbox" className="w-4 h-4 accent-rose-500" checked={notifyOn} onChange={(e) => setNotifyOn(e.target.checked)} />
              Оповістити про публікацію
            </label>
            {notifyOn && (
              <div className="mt-2 pl-1 space-y-2">
                <div className="flex flex-wrap gap-3 text-sm text-stone-700 dark:text-stone-200">
                  {[['all', 'Усіх'], ['roles', 'Певні ролі'], ['locations', 'Певні локації']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-1.5">
                      <input type="radio" name="notifyMode" checked={notifyMode === k} onChange={() => { setNotifyMode(k); setNotifyTargets([]); }} /> {l}
                    </label>
                  ))}
                </div>
                {notifyMode === 'roles' && (
                  <div className="flex flex-wrap gap-1.5">
                    {roleKeys.map((rk) => (
                      <button key={rk} type="button" onClick={() => toggleTarget(rk)}
                        className={`px-3 py-1 rounded-full text-xs border ${notifyTargets.includes(rk) ? 'bg-rose-500 text-white border-rose-500' : 'text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-600'}`}>
                        {roleName(rk)}
                      </button>
                    ))}
                  </div>
                )}
                {notifyMode === 'locations' && (
                  <div className="flex flex-wrap gap-1.5">
                    {allLocations.map((l) => (
                      <button key={l.id} type="button" onClick={() => toggleTarget(l.id)}
                        className={`px-3 py-1 rounded-full text-xs border ${notifyTargets.includes(l.id) ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-600'}`}
                        style={notifyTargets.includes(l.id) ? { background: l.color || '#a8a29e' } : undefined}>
                        {l.name}{l.city ? <span className="opacity-70"> · {l.city}</span> : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Публікація</label>
            <div className="flex flex-col gap-2 text-sm text-stone-700 dark:text-stone-200" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <label className="flex items-center gap-2 min-h-[40px]">
                <input type="radio" name="pub" checked={pubMode === 'now'} onChange={() => setPubMode('now')} /> Опублікувати зараз
              </label>
              <label className="flex items-center gap-2 min-h-[40px]">
                <input type="radio" name="pub" checked={pubMode === 'draft'} onChange={() => setPubMode('draft')} /> Зберегти як чернетку
              </label>
              <label className="flex items-center gap-2 min-h-[40px]">
                <input type="radio" name="pub" checked={pubMode === 'schedule'} onChange={() => setPubMode('schedule')} /> Запланувати
              </label>
              {pubMode === 'schedule' && (
                <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)}
                  className="px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 w-full sm:w-auto" />
              )}
            </div>
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>

        <div className="p-4 md:p-6 border-t border-stone-200 dark:border-stone-700 flex gap-2 justify-end sticky bottom-0 bg-white dark:bg-stone-900">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
          <button onClick={handleSave} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Збереження...' : pubMode === 'draft' ? 'Зберегти чернетку' : pubMode === 'schedule' ? 'Запланувати' : (isEdit ? 'Зберегти зміни' : digest ? 'Опублікувати дайджест' : 'Опублікувати')}
          </button>
        </div>
      </div>
    </div>
  );
}
