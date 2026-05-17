import React, { useState, useEffect } from 'react';
import { Flower2, Lock, Mail, User, LogOut, Shield, BookOpen, Plus, MessageSquare, Edit3, Trash2, Check, X, Search, Settings, ChevronRight, Users, FileText, AlertCircle, Send, Eye, EyeOff, Wrench, Printer, Monitor, Wifi, ArrowLeft, Star, Clock, Tag, Briefcase } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, setToken, clearToken, getToken } from './api';

// ============ КОНСТАНТИ ============
const REFERRAL_WORD = 'Flolux';

const ROLES = {
  admin: { name: 'Адміністратор', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: Shield },
  florist: { name: 'Флорист', color: 'bg-pink-100 text-pink-800 border-pink-300', icon: Flower2 },
  location_manager: { name: 'Управляючий локації', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Users },
  warehouse: { name: 'Складський працівник', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: FileText },
  accountant: { name: 'Бухгалтер', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: FileText },
  wholesale: { name: 'Оптовий менеджер', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Users },
  courier: { name: 'Кур\'єр', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: Users },
  logist: { name: 'Логіст', color: 'bg-cyan-100 text-cyan-800 border-cyan-300', icon: Users },
  barista: { name: 'Бариста', color: 'bg-stone-100 text-stone-800 border-stone-300', icon: Users },
  driver: { name: 'Водій вантажного авто', color: 'bg-slate-100 text-slate-800 border-slate-300', icon: Users },
  tech: { name: 'Технічна підтримка', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: Wrench }
};

// Ролі для реєстрації — всі, крім admin
const REGISTER_ROLES = Object.entries(ROLES).filter(([key]) => key !== 'admin');

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
  const [dataLoaded, setDataLoaded] = useState(false);

  const [authMode, setAuthMode] = useState('login');
  const [view, setView] = useState('home');
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [showCreateArticle, setShowCreateArticle] = useState(false);

  // Перевірка токена при старті
  useEffect(() => {
    const t = getToken();
    if (!t) { setAuthChecked(true); return; }
    apiGet('/auth/me')
      .then((r) => setCurrentUser(r.user))
      .catch(() => clearToken())
      .finally(() => setAuthChecked(true));
  }, []);

  // Завантаження даних після входу
  useEffect(() => {
    if (!currentUser) { setDataLoaded(false); return; }
    Promise.all([apiGet('/topics'), apiGet('/articles')])
      .then(([topics, arts]) => {
        setTopicsMap(groupTopics(topics));
        setArticles(arts);
        setDataLoaded(true);
      })
      .catch((e) => console.error('Не вдалося завантажити дані:', e));
  }, [currentUser]);

  const reloadArticles = async () => {
    const arts = await apiGet('/articles');
    setArticles(arts);
    return arts;
  };
  const reloadTopics = async () => {
    const topics = await apiGet('/topics');
    setTopicsMap(groupTopics(topics));
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setView('home');
    setActiveTopic(null);
    setActiveArticle(null);
  };

  const onAuthSuccess = (user) => {
    setCurrentUser(user);
    setView('home');
  };

  if (!authChecked) return <Splash text="Завантаження..." />;

  if (!currentUser) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={onAuthSuccess} />;
  }

  if (!dataLoaded) return <Splash text="Готуємо вашу базу знань..." />;

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}>
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={(v) => { setView(v); setActiveTopic(null); setActiveArticle(null); }}
        view={view}
        isAdmin={isAdmin}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'home' && !activeTopic && !activeArticle && (
          <HomeView
            user={currentUser}
            topics={topicsMap}
            articles={articles}
            onTopicClick={(t) => { setActiveTopic(t); setView('topic'); }}
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
            onClose={() => setShowCreateArticle(false)}
            onCreated={async () => { await reloadArticles(); setShowCreateArticle(false); }}
          />
        )}
      </main>
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

  const handleLogin = async () => {
    setError(''); setSuccess('');
    if (!form.email || !form.password) return setError('Заповніть всі поля');
    setBusy(true);
    try {
      const r = await apiPost('/auth/login', { email: form.email, password: form.password });
      setToken(r.token);
      onSuccess(r.user);
    } catch (e) {
      setError(e.message);
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
      const r = await apiPost('/auth/register', {
        referralWord: form.referral,
        name: form.name,
        email: form.email,
        password: form.password,
        requestedRole: form.requestedRole,
      });
      if (r.token) {
        setToken(r.token);
        onSuccess(r.user);
        return;
      }
      setSuccess(r.message || 'Реєстрація успішна. Очікуйте підтвердження адміністратора.');
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'linear-gradient(135deg, #fdf2f8 0%, #fff7ed 50%, #f0fdf4 100%)',
      fontFamily: 'Georgia, "Playfair Display", serif'
    }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-sm mb-4 border border-rose-200">
            <Flower2 className="w-10 h-10 text-rose-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl tracking-wide text-stone-800 mb-2" style={{ letterSpacing: '0.1em' }}>FLOLUX</h1>
          <p className="text-stone-500 text-sm italic">База знань компанії</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 border border-stone-100">
          <div className="flex gap-1 mb-6 bg-stone-50 rounded-md p-1">
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-3 text-sm rounded transition ${mode === 'login' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Вхід</button>
            <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-3 text-sm rounded transition ${mode === 'register' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Реєстрація</button>
            <button onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-3 text-sm rounded transition ${mode === 'reset' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Відновити</button>
          </div>

          {mode === 'login' && (
            <div className="space-y-4">
              <Field icon={Mail} label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field icon={Lock} label="Пароль" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(v) => setForm({ ...form, password: v })}
                rightIcon={showPassword ? EyeOff : Eye} onRightClick={() => setShowPassword(!showPassword)} />
              <button onClick={handleLogin} disabled={busy} className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white py-3 rounded-md transition tracking-wider text-sm">
                {busy ? 'ЗАЧЕКАЙТЕ...' : 'УВІЙТИ'}
              </button>
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
function Header({ user, onLogout, onNavigate, view, isAdmin }) {
  const RoleIcon = ROLES[user.role]?.icon || User;
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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

          <nav className="flex items-center gap-1">
            <NavBtn active={view === 'home'} onClick={() => onNavigate('home')} icon={BookOpen}>Моя бібліотека</NavBtn>
            <NavBtn active={view === 'tech'} onClick={() => onNavigate('tech')} icon={Wrench}>Технічка</NavBtn>
            {isAdmin && <NavBtn active={view === 'admin'} onClick={() => onNavigate('admin')} icon={Shield}>Адмін</NavBtn>}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-stone-700" style={{ fontFamily: 'system-ui, sans-serif' }}>{user.name}</div>
            <div className="text-xs text-stone-500">{ROLES[user.role]?.name || 'Без ролі'}</div>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${ROLES[user.role]?.color || 'bg-stone-100 text-stone-600'} border`}>
            <RoleIcon className="w-4 h-4" />
          </div>
          <button onClick={onLogout} className="p-2 text-stone-400 hover:text-rose-500 transition" title="Вийти">
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
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition ${active ? 'bg-stone-100 text-stone-800' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}>
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ============ ГОЛОВНА ============
function HomeView({ user, topics, articles, onTopicClick }) {
  if (!user.role) {
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

  const userTopics = topics[user.role] || [];
  const recentArticles = articles
    .filter((a) => userTopics.some((t) => t.id === a.topicId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  return (
    <div>
      <div className="mb-10 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Вітаємо</p>
        <h1 className="text-4xl text-stone-800 mb-2">{user.name}</h1>
        <p className="text-stone-500 italic">Ваш робочий простір — {ROLES[user.role]?.name.toLowerCase()}</p>
      </div>

      <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4">Розділи знань для вашої ролі</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-12">
        {userTopics.map((topic) => {
          const count = articles.filter((a) => a.topicId === topic.id).length;
          return (
            <button key={topic.id} onClick={() => onTopicClick(topic)}
              className="text-left bg-white border border-stone-200 rounded-lg p-6 hover:border-rose-300 hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl text-stone-800 group-hover:text-rose-600 transition">{topic.title}</h3>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-rose-400 group-hover:translate-x-1 transition" />
              </div>
              <p className="text-sm text-stone-500 italic mb-3">{topic.description}</p>
              <p className="text-xs text-stone-400">{count} {articleWord(count)}</p>
            </button>
          );
        })}
        {userTopics.length === 0 && (
          <p className="text-stone-400 italic col-span-2">Для вашої ролі ще немає розділів.</p>
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

      <div className="grid md:grid-cols-2 gap-4">
        {topics.map((topic) => {
          const count = articles.filter((a) => a.topicId === topic.id).length;
          const iconMap = { 'tc-1': Printer, 'tc-2': Monitor, 'tc-3': Wifi, 'tc-4': Wifi, 'tc-5': Settings };
          const Icon = iconMap[topic.id] || Wrench;
          return (
            <button key={topic.id} onClick={() => onTopicClick(topic)}
              className="text-left bg-white border border-stone-200 rounded-lg p-6 hover:border-indigo-300 hover:shadow-md transition group">
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
        {topics.length === 0 && <p className="text-stone-400 italic col-span-2">Технічних розділів ще немає.</p>}
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
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-8 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Розділ</p>
        <h1 className="text-3xl text-stone-800 mb-2">{topic.title}</h1>
        <p className="text-stone-500 italic">{topic.description}</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Пошук статей..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400 bg-white"
            style={{ fontFamily: 'system-ui, sans-serif' }} />
        </div>
        <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition text-sm">
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
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: article.title, content: article.content });

  const canEdit = isAdmin || article.author === user.id;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet(`/articles/${article.id}/comments`),
      apiGet(`/articles/${article.id}/suggestions`),
    ]).then(([c, s]) => {
      if (!active) return;
      setComments(c);
      setSuggestions(s);
    }).catch((e) => console.error(e));
    return () => { active = false; };
  }, [article.id]);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const c = await apiPost(`/articles/${article.id}/comments`, { content: commentText });
    setComments((prev) => [...prev, c]);
    setCommentText('');
  };

  const handleSuggestion = async () => {
    if (!suggestionText.trim()) return;
    const s = await apiPost(`/articles/${article.id}/suggestions`, { content: suggestionText });
    setSuggestions((prev) => [...prev, s]);
    setSuggestionText('');
    setShowSuggest(false);
  };

  const handleSaveEdit = async () => {
    const updated = await apiPatch(`/articles/${article.id}`, editForm);
    setEditMode(false);
    await onArticleUpdated(updated);
  };

  const setSuggStatus = async (sugg, status) => {
    const updated = await apiPatch(`/suggestions/${sugg.id}`, { status });
    setSuggestions((prev) => prev.map((s) => (s.id === sugg.id ? updated : s)));
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> До розділу
      </button>

      <article className="bg-white border border-stone-200 rounded-lg p-8 mb-6">
        {editMode ? (
          <div className="space-y-4">
            <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full text-3xl border-b-2 border-stone-200 focus:border-rose-400 focus:outline-none pb-2" style={{ fontFamily: 'Georgia, serif' }} />
            <textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={15}
              className="w-full p-3 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-500 text-white rounded text-sm">Зберегти</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl text-stone-800">{article.title}</h1>
              {canEdit && (
                <button onClick={() => { setEditForm({ title: article.title, content: article.content }); setEditMode(true); }} className="text-stone-400 hover:text-rose-500 transition">
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

            <div className="prose max-w-none text-stone-700 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'system-ui, sans-serif', fontSize: '15px', lineHeight: '1.75' }}>
              {renderMarkdown(article.content)}
            </div>
          </>
        )}
      </article>

      {/* Пропозиції правок */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Пропозиції покращень <span className="text-stone-400 text-sm">({suggestions.length})</span>
          </h3>
          <button onClick={() => setShowSuggest(!showSuggest)} className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Запропонувати правку
          </button>
        </div>

        {showSuggest && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded">
            <textarea value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Опишіть пропозицію щодо покращення статті..." rows={3}
              className="w-full p-3 border border-amber-200 rounded text-sm focus:outline-none focus:border-amber-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSuggestion} className="px-4 py-1.5 bg-amber-500 text-white rounded text-sm">Надіслати</button>
              <button onClick={() => setShowSuggest(false)} className="px-4 py-1.5 bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
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
                    <span className="text-xs text-stone-400 ml-2">{ROLES[s.authorRole]?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === 'approved' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Прийнято</span>}
                    {s.status === 'rejected' && <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded">Відхилено</span>}
                    {s.status === 'pending' && isAdmin && (
                      <>
                        <button onClick={() => setSuggStatus(s, 'approved')} className="text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setSuggStatus(s, 'rejected')} className="text-rose-500 hover:text-rose-600"><X className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-stone-700" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Коментарі */}
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg text-stone-800 flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-stone-500" />
          Обговорення <span className="text-stone-400 text-sm">({comments.length})</span>
        </h3>

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
            className="flex-1 px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-rose-400" style={{ fontFamily: 'system-ui, sans-serif' }} />
          <button onClick={handleComment} className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-md transition">
            <Send className="w-4 h-4" />
          </button>
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
function CreateArticleModal({ topic, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', content: '', tags: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Заповніть назву та зміст статті');
      return;
    }
    setBusy(true);
    try {
      await apiPost('/articles', {
        topicId: topic.id,
        section: topic.id.startsWith('tc-') ? 'tech' : 'role',
        title: form.title,
        content: form.content,
        tags: form.tags,
      });
      await onCreated();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Нова стаття в розділі</p>
            <h2 className="text-xl text-stone-800">{topic.title}</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
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

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>

        <div className="p-6 border-t border-stone-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-md text-sm">Скасувати</button>
          <button onClick={handleSave} disabled={busy} className="px-4 py-2 bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Збереження...' : 'Опублікувати'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ АДМІН-ПАНЕЛЬ ============
function AdminPanel({ topicsMap, reloadTopics, articles }) {
  const [tab, setTab] = useState('users');

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-stone-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-200">
            <Shield className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Управління системою</p>
            <h1 className="text-3xl text-stone-800">Адмін-панель</h1>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-stone-100 rounded-md p-1 w-fit">
        <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>Користувачі</TabBtn>
        <TabBtn active={tab === 'topics'} onClick={() => setTab('topics')}>Розділи</TabBtn>
        <TabBtn active={tab === 'moderation'} onClick={() => setTab('moderation')}>Модерація</TabBtn>
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'topics' && <TopicsTab topicsMap={topicsMap} reloadTopics={reloadTopics} />}
      {tab === 'moderation' && <ModerationTab articles={articles} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded text-sm transition ${active ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
      {children}
    </button>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/admin/users').then(setUsers).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, []);

  const updateUser = async (id, changes) => {
    const updated = await apiPatch(`/admin/users/${id}`, changes);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  };

  if (loading) return <div className="p-8 text-center text-stone-400 italic">Завантаження…</div>;

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Користувач</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Бажана роль</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Призначена роль</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Статус</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Дії</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-stone-100 last:border-0">
              <td className="px-4 py-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <div className="text-sm text-stone-800">{u.name}</div>
                <div className="text-xs text-stone-500">{u.email}</div>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs px-2 py-1 bg-stone-50 text-stone-600 rounded border border-stone-200">
                  {ROLES[u.requestedRole]?.name || '—'}
                </span>
              </td>
              <td className="px-4 py-3">
                <select value={u.assignedRole || ''} onChange={(e) => updateUser(u.id, { assignedRole: e.target.value || null })}
                  className="text-sm border border-stone-200 rounded px-2 py-1 bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <option value="">— без ролі —</option>
                  {Object.entries(ROLES).map(([key, r]) => (
                    <option key={key} value={key}>{r.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                {u.approved ? (
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Підтверджений</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200">Очікує</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {!u.approved && (
                    <button onClick={() => updateUser(u.id, { approved: true })} className="text-xs px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600">
                      Підтвердити
                    </button>
                  )}
                  {u.approved && u.assignedRole !== 'admin' && (
                    <button onClick={() => updateUser(u.id, { approved: false })} className="text-xs px-3 py-1 bg-stone-100 text-stone-700 rounded hover:bg-stone-200">
                      Заблокувати
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <div className="p-8 text-center text-stone-400 italic">Користувачів ще немає</div>}
    </div>
  );
}

function TopicsTab({ topicsMap, reloadTopics }) {
  const [selectedRole, setSelectedRole] = useState('florist');
  const [newTopic, setNewTopic] = useState({ title: '', description: '' });
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!newTopic.title.trim()) return;
    setBusy(true);
    try {
      await apiPost('/topics', { roleKey: selectedRole, title: newTopic.title, description: newTopic.description });
      setNewTopic({ title: '', description: '' });
      await reloadTopics();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    await apiDelete(`/topics/${id}`);
    await reloadTopics();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg text-stone-800 mb-4">Управління розділами знань</h3>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-md" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {Object.entries(ROLES).map(([key, r]) => (
              <option key={key} value={key}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {(topicsMap[selectedRole] || []).map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 rounded">
              <div>
                <div className="text-sm text-stone-800">{t.title}</div>
                <div className="text-xs text-stone-500 italic">{t.description}</div>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-rose-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(topicsMap[selectedRole] || []).length === 0 && (
            <p className="text-sm text-stone-400 italic">Для цієї ролі ще немає розділів.</p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">Додати новий розділ</p>
          <div className="space-y-2">
            <input type="text" value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
              placeholder="Назва розділу" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }} />
            <input type="text" value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
              placeholder="Опис" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }} />
            <button onClick={handleAdd} disabled={busy} className="px-4 py-2 bg-rose-500 disabled:opacity-60 text-white rounded text-sm hover:bg-rose-600">
              <Plus className="w-4 h-4 inline mr-1" />Додати розділ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModerationTab({ articles }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/suggestions?status=pending').then(setPending).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, []);

  const decide = async (id, status) => {
    await apiPatch(`/suggestions/${id}`, { status });
    setPending((prev) => prev.filter((s) => s.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-stone-400 italic">Завантаження…</div>;

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-6">
      <h3 className="text-lg text-stone-800 mb-4">Пропозиції на модерацію ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="text-sm text-stone-400 italic">Усі пропозиції розглянуті</p>
      ) : (
        <div className="space-y-3">
          {pending.map((s) => {
            const article = articles.find((a) => a.id === s.articleId);
            return (
              <div key={s.id} className="p-4 bg-stone-50 rounded border border-stone-200">
                <div className="text-xs text-stone-500 mb-1">До статті: <span className="text-stone-700">{article?.title || '—'}</span></div>
                <div className="text-sm text-stone-700 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-stone-500">{s.authorName} · {ROLES[s.authorRole]?.name}</div>
                  <div className="flex gap-2">
                    <button onClick={() => decide(s.id, 'approved')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Прийняти</button>
                    <button onClick={() => decide(s.id, 'rejected')} className="px-3 py-1 bg-stone-200 text-stone-700 rounded text-xs">Відхилити</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
