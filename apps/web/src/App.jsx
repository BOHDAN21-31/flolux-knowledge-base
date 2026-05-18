import { useState, useEffect, useRef } from 'react';
import { Flower2, Lock, Mail, User, LogOut, Shield, BookOpen, Plus, MessageSquare, Edit3, Check, X, Search, Settings, ChevronRight, AlertCircle, Send, Eye, EyeOff, Wrench, Printer, Monitor, Wifi, ArrowLeft, Star, Clock, Tag, Briefcase, MapPin, Fingerprint, Menu, ChevronDown } from 'lucide-react';
import { apiGet, apiPost, apiPatch, setToken, clearToken, getToken, UNAUTHORIZED_EVENT, apiUpload, webauthnLogin, webauthnSupported } from './api';
import ProfilePage from './components/ProfilePage';
import AdminPanel from './components/AdminPanel';
import Stars from './Stars';
import { ROLES, REGISTER_ROLES, ROLE_KEYS, roleName, userRoles, isAdminUser } from './roles';
import { iconFor } from './icons';

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
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [topicsMap, setTopicsMap] = useState({});
  const [articles, setArticles] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [authMode, setAuthMode] = useState('login');
  const [view, setView] = useState('home');
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [showCreateArticle, setShowCreateArticle] = useState(false);

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
      setView('home');
      setActiveTopic(null);
      setActiveArticle(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
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
    setView('home');
    setActiveTopic(null);
    setActiveArticle(null);
  };

  const onAuthSuccess = async () => {
    await refreshMe().catch(() => {});
    setView('home');
  };

  if (!authChecked) return <Splash text="Завантаження..." />;

  if (!currentUser) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={onAuthSuccess} />;
  }

  if (!dataLoaded) return <Splash text="Готуємо вашу базу знань..." />;

  const isAdmin = isAdminUser(currentUser);

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}>
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={(v) => { setView(v); setActiveTopic(null); setActiveArticle(null); }}
        onProfile={() => { setView('profile'); setActiveTopic(null); setActiveArticle(null); }}
        view={view}
        isAdmin={isAdmin}
      />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
        {view === 'home' && !activeTopic && !activeArticle && (
          <HomeView
            user={currentUser}
            topics={topicsMap}
            articles={articles}
            allLocations={allLocations}
            isAdmin={isAdmin}
            onTopicClick={(t) => { setActiveTopic(t); setView('topic'); }}
            onGoProfile={() => setView('profile')}
          />
        )}

        {view === 'profile' && (
          <ProfilePage
            user={currentUser}
            allLocations={allLocations}
            onRefresh={refreshMe}
          />
        )}

        {view === 'tech' && !activeTopic && !activeArticle && (
          <TechView
            topics={topicsMap.tech || []}
            articles={articles.filter((a) => a.section === 'tech')}
            onTopicClick={(t) => { setActiveTopic(t); }}
          />
        )}

        {view === 'admin' && isAdmin && (
          <AdminPanel
            topicsMap={topicsMap}
            reloadTopics={reloadTopics}
            articles={articles}
            allLocations={allLocations}
            reloadLocations={reloadLocations}
            reloadArticles={reloadArticles}
          />
        )}

        {activeTopic && !activeArticle && (
          <TopicView
            topic={activeTopic}
            articles={articles.filter((a) => a.topicId === activeTopic.id)}
            onBack={() => { setActiveTopic(null); }}
            onArticleClick={(a) => setActiveArticle(a)}
            onCreate={() => setShowCreateArticle(true)}
          />
        )}

        {activeArticle && (
          <ArticleView
            article={activeArticle}
            user={currentUser}
            isAdmin={isAdmin}
            onBack={() => setActiveArticle(null)}
            onArticleUpdated={async (updated) => {
              setActiveArticle(updated);
              await reloadArticles();
            }}
          />
        )}

        {showCreateArticle && activeTopic && (
          <CreateArticleModal
            topic={activeTopic}
            allLocations={allLocations}
            onClose={() => setShowCreateArticle(false)}
            onCreated={async () => { await reloadArticles(); setShowCreateArticle(false); }}
          />
        )}
      </main>

      <MobileBottomNav
        view={view}
        isAdmin={isAdmin}
        onNavigate={(v) => { setView(v); setActiveTopic(null); setActiveArticle(null); }}
        onProfile={() => { setView('profile'); setActiveTopic(null); setActiveArticle(null); }}
      />
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
        <p className="text-stone-500 italic">{text}</p>
      </div>
    </div>
  );
}

// ============ AUTH ============
function AuthScreen({ mode, setMode, onSuccess }) {
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
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-white shadow-sm mb-4 border border-rose-200">
            <Flower2 className="w-9 h-9 md:w-10 md:h-10 text-rose-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl md:text-4xl tracking-wide text-stone-800 mb-2" style={{ letterSpacing: '0.1em' }}>FLOLUX</h1>
          <p className="text-stone-500 text-sm italic">База знань компанії</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 border border-stone-100">
          <div className="flex gap-1 mb-6 bg-stone-50 rounded-md p-1">
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 min-h-[44px] px-3 text-sm rounded transition ${mode === 'login' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Вхід</button>
            <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 min-h-[44px] px-3 text-sm rounded transition ${mode === 'register' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Реєстрація</button>
            <button onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className={`flex-1 min-h-[44px] px-3 text-sm rounded transition ${mode === 'reset' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Відновити</button>
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
                  className="w-full flex items-center justify-center gap-2 border border-stone-300 hover:border-rose-400 text-stone-700 py-3 rounded-md transition text-sm">
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
                <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Бажана роль</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <select
                    value={form.requestedRole}
                    onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 text-stone-800 bg-stone-50/50"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    {REGISTER_ROLES.map(([key, r]) => (
                      <option key={key} value={key}>{r.name}</option>
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
              <p className="text-sm text-stone-600 italic">Введіть e-mail, прив'язаний до акаунту.</p>
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
      <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 text-stone-800 bg-stone-50/50"
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
  const RoleIcon = ROLES[primary]?.icon || User;
  return (
    <span className={`${size} rounded-full flex items-center justify-center overflow-hidden border ${ROLES[primary]?.color || 'bg-stone-100 text-stone-600'}`}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <RoleIcon className="w-4 h-4" />}
    </span>
  );
}

function Header({ user, onLogout, onNavigate, onProfile, view, isAdmin }) {
  const roles = userRoles(user);
  const primary = isAdmin ? 'admin' : (user.role || roles[0] || null);
  const roleLabel = primary
    ? `${ROLES[primary]?.name || 'Без ролі'}${roles.length > 1 ? ` +${roles.length - 1}` : ''}`
    : 'Без ролі';
  const [sheet, setSheet] = useState(false);
  const go = (fn) => { setSheet(false); fn(); };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-200 group-hover:bg-rose-100 transition">
              <Flower2 className="w-5 h-5 text-rose-500" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl tracking-widest text-stone-800">FLOLUX</div>
              <div className="text-xs text-stone-400 italic -mt-0.5">База знань</div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <NavBtn active={view === 'home'} onClick={() => onNavigate('home')} icon={BookOpen}>{isAdmin ? 'Уся бібліотека' : 'Моя бібліотека'}</NavBtn>
            <NavBtn active={view === 'tech'} onClick={() => onNavigate('tech')} icon={Wrench}>Технічка</NavBtn>
            {isAdmin && <NavBtn active={view === 'admin'} onClick={() => onNavigate('admin')} icon={Shield}>Адмін</NavBtn>}
          </nav>
        </div>

        {/* Desktop: профіль + вихід */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={onProfile} className="text-right group" title="Мій профіль">
            <div className="text-sm text-stone-700 group-hover:text-rose-600 transition" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {user.name}{user.surname ? ` ${user.surname}` : ''}
            </div>
            <div className="text-xs text-stone-500">{roleLabel}</div>
          </button>
          <button onClick={onProfile} className="w-9 h-9" title="Мій профіль"><HeaderAvatar user={user} primary={primary} size="w-9 h-9" /></button>
          <button onClick={onLogout} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-rose-500 transition" title="Вийти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile: бургер */}
        <button onClick={() => setSheet(true)} className="md:hidden w-11 h-11 flex items-center justify-center text-stone-600" aria-label="Меню">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile sheet (висувне меню справа) */}
      {sheet && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-stone-900/50" onClick={() => setSheet(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-xl flex flex-col animate-[slidein_.2s_ease-out]"
            style={{ fontFamily: 'Georgia, serif' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <span className="text-lg tracking-widest text-stone-800">FLOLUX</span>
              <button onClick={() => setSheet(false)} className="w-11 h-11 flex items-center justify-center text-stone-500" aria-label="Закрити">
                <X className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => go(onProfile)} className="flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 text-left">
              <HeaderAvatar user={user} primary={primary} size="w-11 h-11" />
              <div style={{ fontFamily: 'system-ui, sans-serif' }}>
                <div className="text-sm text-stone-800">{user.name}{user.surname ? ` ${user.surname}` : ''}</div>
                <div className="text-xs text-stone-500">{roleLabel}</div>
              </div>
            </button>
            <nav className="flex-1 p-3 space-y-1">
              <SheetItem icon={BookOpen} active={view === 'home'} onClick={() => go(() => onNavigate('home'))}>{isAdmin ? 'Уся бібліотека' : 'Моя бібліотека'}</SheetItem>
              <SheetItem icon={Wrench} active={view === 'tech'} onClick={() => go(() => onNavigate('tech'))}>Технічка</SheetItem>
              {isAdmin && <SheetItem icon={Shield} active={view === 'admin'} onClick={() => go(() => onNavigate('admin'))}>Адмін</SheetItem>}
              <SheetItem icon={User} active={view === 'profile'} onClick={() => go(onProfile)}>Профіль</SheetItem>
            </nav>
            <button onClick={() => go(onLogout)}
              className="m-3 flex items-center justify-center gap-2 min-h-[44px] rounded-md border border-stone-200 text-stone-600 hover:text-rose-600 hover:border-rose-300 transition text-sm">
              <LogOut className="w-4 h-4" /> Вийти
            </button>
          </div>
          <style>{`@keyframes slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </div>
      )}
    </header>
  );
}

function NavBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 min-h-[44px] rounded-md text-sm transition ${active ? 'bg-stone-100 text-stone-800' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}>
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function SheetItem({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 min-h-[48px] rounded-md text-sm transition ${active ? 'bg-rose-50 text-rose-700' : 'text-stone-600 hover:bg-stone-50'}`}>
      <Icon className="w-5 h-5" /> {children}
    </button>
  );
}

// Нижня навігація для мобільного (основні розділи). Десктоп — прихована.
function MobileBottomNav({ view, isAdmin, onNavigate, onProfile }) {
  const items = [
    { key: 'home', label: isAdmin ? 'Бібліотека' : 'Бібліотека', icon: BookOpen, onClick: () => onNavigate('home') },
    { key: 'tech', label: 'Технічка', icon: Wrench, onClick: () => onNavigate('tech') },
    { key: 'profile', label: 'Профіль', icon: User, onClick: onProfile },
  ];
  if (isAdmin) items.push({ key: 'admin', label: 'Адмін', icon: Shield, onClick: () => onNavigate('admin') });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map((it) => {
        const active = view === it.key;
        return (
          <button key={it.key} onClick={it.onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs transition ${active ? 'text-rose-600' : 'text-stone-500'}`}>
            <it.icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.7} />
            <span style={{ fontFamily: 'system-ui, sans-serif' }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ============ ГОЛОВНА ============
function HomeView({ user, topics, articles, allLocations = [], isAdmin, onTopicClick, onGoProfile }) {
  const roles = userRoles(user);
  const [roleFilter, setRoleFilter] = useState('all');

  if (!isAdmin && roles.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl text-stone-800 mb-2">Очікування призначення ролі</h2>
        <p className="text-stone-500 max-w-md mx-auto italic">
          Ваш акаунт зареєстровано, але адміністратор ще не призначив вам роль.
          Зверніться до керівництва.
        </p>
      </div>
    );
  }

  // admin бачить усі ролі групами; інші — лише свої.
  const baseRoles = isAdmin ? ROLE_KEYS : roles;
  const shownRoles = (roleFilter === 'all' ? baseRoles : [roleFilter]).filter((r) => (topics[r] || []).length > 0);
  const allShownTopics = shownRoles.flatMap((r) => topics[r] || []);
  const recentArticles = articles
    .filter((a) => allShownTopics.some((t) => t.id === a.topicId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  const approved = (user.locations || []).filter((l) => l.approved);
  // userCount з бекенду включає мене -> для моїх локацій мінус я сам.
  const countFor = (id) => Math.max(0, (allLocations.find((x) => x.id === id)?.userCount ?? 0) - 1);

  return (
    <div>
      <div className="mb-8 md:mb-10 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Вітаємо</p>
        <h1 className="text-3xl md:text-4xl text-stone-800 mb-2">{user.name}</h1>
        <p className="text-stone-500 italic">
          {isAdmin ? 'Уся бібліотека знань Flolux' : `Ваші ролі — ${roles.map(roleName).join(', ').toLowerCase()}`}
        </p>
      </div>

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
              <div key={l.locationId} className="bg-white border border-stone-200 rounded-lg p-4 flex items-center justify-between">
                <span className="flex items-center gap-2 text-stone-800">
                  <span className="w-3 h-3 rounded-full" style={{ background: l.color || '#a8a29e' }} />
                  {l.name}{l.isManager ? ' · керівник' : ''}
                </span>
                <span className="text-sm text-stone-500">{countFor(l.locationId)} {countFor(l.locationId) === 1 ? 'колега' : 'колег'} на локації</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-widest text-stone-400">
          {isAdmin ? 'Усі розділи знань' : 'Розділи знань для ваших ролей'}
        </h2>
        {baseRoles.length > 1 && (
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <option value="all">Усе</option>
            {baseRoles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
          </select>
        )}
      </div>

      <div className="space-y-10 mb-12">
        {shownRoles.map((rk) => (
          <div key={rk}>
            {(shownRoles.length > 1) && (
              <h3 className="text-sm text-stone-600 mb-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${ROLES[rk]?.color || 'bg-stone-100'}`}>{roleName(rk)}</span>
              </h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(topics[rk] || []).map((topic) => {
                const count = articles.filter((a) => a.topicId === topic.id).length;
                const Ico = iconFor(topic.icon);
                return (
                  <button key={topic.id} onClick={() => onTopicClick(topic)}
                    className="text-left bg-white border border-stone-200 rounded-lg p-5 md:p-6 hover:border-rose-300 hover:shadow-md transition group">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-100 transition">
                        <Ico className="w-5 h-5 text-rose-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="text-xl text-stone-800 group-hover:text-rose-600 transition">{topic.title}</h3>
                          <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-rose-400 group-hover:translate-x-1 transition" />
                        </div>
                        <p className="text-sm text-stone-500 italic mb-2">{topic.description}</p>
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
              <div key={a.id} className="bg-white border border-stone-200 rounded p-4 hover:border-stone-300 transition cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                  <Clock className="w-3 h-3" />
                  {new Date(a.createdAt).toLocaleDateString('uk-UA')}
                </div>
                <h3 className="text-stone-800">{a.title}</h3>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============ ТЕХНІЧНА БАЗА ============
function TechView({ topics, articles, onTopicClick }) {
  return (
    <div>
      <div className="mb-10 pb-6 border-b border-stone-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-200">
            <Wrench className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Спеціалізований розділ</p>
            <h1 className="text-3xl text-stone-800">Технічна база Flolux</h1>
          </div>
        </div>
        <p className="text-stone-500 italic max-w-2xl">
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
              className="text-left bg-white border border-stone-200 rounded-lg p-5 md:p-6 hover:border-indigo-300 hover:shadow-md transition group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition">
                  <Icon className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl text-stone-800 mb-2 group-hover:text-indigo-600 transition">{topic.title}</h3>
                  <p className="text-sm text-stone-500 italic mb-2">{topic.description}</p>
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
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-4 min-h-[44px] transition">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Розділ</p>
        <h1 className="text-2xl md:text-3xl text-stone-800 mb-2">{topic.title}</h1>
        <p className="text-stone-500 italic">{topic.description}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Пошук статей..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 min-h-[44px] py-2.5 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400 bg-white"
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
              className="block w-full text-left bg-white border border-stone-200 rounded-lg p-5 hover:border-rose-300 hover:shadow-sm transition group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg text-stone-800 group-hover:text-rose-600 transition mb-1">{a.title}</h3>
                  <p className="text-sm text-stone-500 line-clamp-2 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    {a.content.replace(/[*#]/g, '').substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span>{new Date(a.createdAt).toLocaleDateString('uk-UA')}</span>
                    {a.tags && a.tags.length > 0 && (
                      <div className="flex gap-1.5">
                        {a.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-stone-100 rounded text-stone-600">{t}</span>
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
function ArticleView({ article, user, isAdmin, onBack, onArticleUpdated }) {
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [openSug, setOpenSug] = useState(false);
  const [openCom, setOpenCom] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: article.title, content: article.content });

  const canEdit = isAdmin || article.author === user.id;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet(`/api/articles/${article.id}/comments`),
      apiGet(`/api/articles/${article.id}/suggestions`),
    ]).then(([c, s]) => {
      if (!active) return;
      setComments(c);
      setSuggestions(s);
    }).catch((e) => console.error(e));
    return () => { active = false; };
  }, [article.id]);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const c = await apiPost(`/api/articles/${article.id}/comments`, { content: commentText });
    setComments((prev) => [...prev, c]);
    setCommentText('');
  };

  const handleSuggestion = async () => {
    if (!suggestionText.trim()) return;
    const s = await apiPost(`/api/articles/${article.id}/suggestions`, { content: suggestionText });
    setSuggestions((prev) => [...prev, s]);
    setSuggestionText('');
    setShowSuggest(false);
  };

  const handleSaveEdit = async () => {
    const updated = await apiPatch(`/api/articles/${article.id}`, editForm);
    setEditMode(false);
    await onArticleUpdated(updated);
  };

  const setSuggStatus = async (sugg, status) => {
    const updated = await apiPatch(`/api/suggestions/${sugg.id}`, { status });
    setSuggestions((prev) => prev.map((s) => (s.id === sugg.id ? updated : s)));
  };

  const rateSuggestion = async (sugg, rating) => {
    const updated = await apiPost(`/api/suggestions/${sugg.id}/rate`, { rating });
    setSuggestions((prev) =>
      prev
        .map((s) => (s.id === sugg.id ? updated : s))
        .sort((a, b) => b.ratingAvg - a.ratingAvg || b.createdAt - a.createdAt));
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-4 min-h-[44px] transition">
        <ArrowLeft className="w-4 h-4" /> До розділу
      </button>

      <article className="bg-white border border-stone-200 rounded-lg p-5 md:p-8 mb-6">
        {editMode ? (
          <div className="space-y-4">
            <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full text-2xl md:text-3xl border-b-2 border-stone-200 focus:border-rose-400 focus:outline-none pb-2" style={{ fontFamily: 'Georgia, serif' }} />
            <textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={15}
              className="w-full p-3 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-500 text-white rounded text-sm">Зберегти</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl md:text-3xl text-stone-800">{article.title}</h1>
              {canEdit && (
                <button onClick={() => { setEditForm({ title: article.title, content: article.content }); setEditMode(true); }} className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-stone-400 hover:text-rose-500 transition">
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-400 mb-6 pb-6 border-b border-stone-100">
              <Clock className="w-3 h-3" />
              {new Date(article.createdAt).toLocaleDateString('uk-UA')}
              {article.authorName && article.author !== 'system' && (
                <>
                  <span>·</span>
                  <span>{article.authorName}</span>
                </>
              )}
              {article.tags && article.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex gap-1.5">
                    {article.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-stone-100 rounded text-stone-600 flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {article.locations && article.locations.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {article.locations.map((l) => (
                  <span key={l.locationId} className="px-2 py-0.5 rounded-full text-xs text-white flex items-center gap-1" style={{ background: l.color || '#a8a29e' }}>
                    <MapPin className="w-3 h-3" />{l.name}
                  </span>
                ))}
              </div>
            )}

            <div className="prose max-w-none text-stone-700 whitespace-pre-wrap break-words" style={{ fontFamily: 'system-ui, sans-serif', fontSize: '16px', lineHeight: '1.7' }}>
              {renderMarkdown(article.content)}
            </div>

            {article.mediaUrls && article.mediaUrls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {article.mediaUrls.map((url) => (
                  /\.(mp4|mov|webm)$/i.test(url)
                    ? <video key={url} src={url} controls className="w-full rounded-lg border border-stone-200" />
                    : <img key={url} src={url} alt="" className="w-full rounded-lg border border-stone-200 object-cover" />
                ))}
              </div>
            )}
          </>
        )}
      </article>

      {/* Пропозиції правок */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button onClick={() => setOpenSug((v) => !v)} className="flex items-center gap-2 text-lg text-stone-800 md:cursor-default">
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
              <button onClick={() => setShowSuggest(false)} className="px-4 min-h-[44px] bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
            </div>
          </div>
        )}

        {suggestions.length === 0 ? (
          <p className="text-sm text-stone-400 italic">Поки що немає пропозицій. Будьте першим!</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className={`p-4 rounded border ${s.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : s.status === 'rejected' ? 'bg-rose-50 border-rose-200 opacity-60' : 'bg-stone-50 border-stone-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm text-stone-700">{s.authorName}</span>
                    <span className="text-xs text-stone-400 ml-2">{roleName(s.authorRole)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === 'approved' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Прийнято</span>}
                    {s.status === 'rejected' && <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded">Відхилено</span>}
                    {s.status === 'pending' && isAdmin && (
                      <>
                        <button onClick={() => setSuggStatus(s, 'approved')} className="w-10 h-10 flex items-center justify-center text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setSuggStatus(s, 'rejected')} className="w-10 h-10 flex items-center justify-center text-rose-500 hover:text-rose-600"><X className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-stone-700 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</p>
                <Stars avg={s.ratingAvg ?? 0} mine={s.myRating ?? null} count={s.ratingCount ?? 0} onRate={(n) => rateSuggestion(s, n)} />
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Коментарі */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 md:p-6">
        <button onClick={() => setOpenCom((v) => !v)} className="w-full flex items-center justify-between gap-2 mb-4 md:cursor-default">
          <span className="text-lg text-stone-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-stone-500" />
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
              <div key={c.id} className="flex gap-3 p-3 bg-stone-50 rounded">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${ROLES[c.authorRole]?.color || 'bg-stone-100'}`}>
                  {(c.authorName || '?')[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-stone-700">{c.authorName}</span>
                    <span className="text-xs text-stone-400">{ROLES[c.authorRole]?.name}</span>
                    <span className="text-xs text-stone-400">· {new Date(c.createdAt).toLocaleDateString('uk-UA')}</span>
                  </div>
                  <p className="text-sm text-stone-700" style={{ fontFamily: 'system-ui, sans-serif' }}>{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleComment()} placeholder="Написати коментар..."
            className="flex-1 px-4 min-h-[44px] border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
          <button onClick={handleComment} className="w-12 min-h-[44px] flex items-center justify-center bg-stone-800 hover:bg-stone-900 text-white rounded-md transition flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

// Простий markdown-рендеринг
function renderMarkdown(text) {
  if (!text) return null;
  const parts = text.split('\n');
  return parts.map((line, i) => {
    const processed = line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="text-stone-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} className="mb-2">{processed}</p>;
  });
}

// ============ СТВОРЕННЯ СТАТТІ ============
function CreateArticleModal({ topic, allLocations = [], onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', content: '', tags: '' });
  const [locationIds, setLocationIds] = useState([]);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRef = useRef(null);

  const toggleLoc = (id) => setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onPickMedia = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(''); setUploading(true);
    try {
      for (const f of files) {
        const up = await apiUpload(f);
        setMediaUrls((prev) => [...prev, { url: up.url, type: up.type }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (mediaRef.current) mediaRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Заповніть назву та зміст статті');
      return;
    }
    setBusy(true);
    try {
      await apiPost('/api/articles', {
        topicId: topic.id,
        section: topic.id.startsWith('tc-') ? 'tech' : 'role',
        title: form.title,
        content: form.content,
        tags: form.tags,
        locationIds,
        mediaUrls: mediaUrls.map((m) => m.url),
      });
      await onCreated();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Нова стаття в розділі</p>
            <h2 className="text-lg md:text-xl text-stone-800">{topic.title}</h2>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Заголовок</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} placeholder="Назва статті" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Зміст</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }}
              placeholder="Текст статті. Можна використовувати **жирний** текст." />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Теги (через кому)</label>
            <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }}
              placeholder="наприклад: троянди, догляд, поради" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">
              Локації <span className="text-stone-400 normal-case">(порожньо = доступно всім за роллю)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {allLocations.map((l) => {
                const on = locationIds.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLoc(l.id)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${on ? 'text-white border-transparent' : 'text-stone-600 border-stone-300 bg-white'}`}
                    style={on ? { background: l.color || '#a8a29e' } : undefined}>
                    {l.name}
                  </button>
                );
              })}
              {allLocations.length === 0 && <span className="text-sm text-stone-400 italic">Локацій ще немає</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Фото / відео</label>
            <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickMedia} />
            <button type="button" onClick={() => mediaRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border border-stone-300 hover:border-rose-400 rounded-md text-sm text-stone-700 disabled:opacity-60">
              <Plus className="w-4 h-4" /> {uploading ? 'Завантаження...' : 'Додати фото/відео'}
            </button>
            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {mediaUrls.map((m, i) => (
                  <div key={m.url} className="relative group">
                    {m.type === 'video'
                      ? <video src={m.url} className="w-full h-24 object-cover rounded" />
                      : <img src={m.url} alt="" className="w-full h-24 object-cover rounded" />}
                    <button type="button" onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-stone-900/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>

        <div className="p-4 md:p-6 border-t border-stone-200 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 text-stone-700 rounded-md text-sm">Скасувати</button>
          <button onClick={handleSave} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Збереження...' : 'Опублікувати'}
          </button>
        </div>
      </div>
    </div>
  );
}
