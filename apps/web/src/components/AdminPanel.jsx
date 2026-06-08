import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, MapPin, Inbox, BookOpen, MessageSquare, ScrollText,
  Shield, Plus, Trash2, X, Search, ChevronRight, FileText, Cake, Megaphone, Key,
  KeyRound, Check, AlertCircle, Settings as SettingsIcon, Clock, Wrench, Bell,
  GraduationCap, Award, Calendar, Briefcase, ChevronDown,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { useRoles } from '../RolesContext';
import { useConfirm } from './ConfirmDialog';
import { TOPIC_ICON_NAMES, iconFor } from '../icons';
import Stars from '../Stars';
import { DIGEST_CATEGORIES, digestCategory, ANNOUNCEMENT_CATEGORIES, announcementCategory, ANNOUNCEMENT_PRIORITIES, EMPLOYMENT_STATUSES, employmentStatus, OO_OUTCOMES } from '../constants';

const fmtDate = (ms) => new Date(ms).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });

// Вкладки залежно від рівня: admin — усі; senior(HR) — контент без
// керування користувачами/системою (без Користувачів/Запитів/Ролей/Розділів).
function buildNav(isAdmin) {
  const nav = [{ key: 'dashboard', label: 'Огляд', icon: LayoutDashboard }];
  if (isAdmin) nav.push({ key: 'users', label: 'Користувачі', icon: Users });
  else nav.push({ key: 'employees', label: 'Працівники', icon: Users });
  nav.push({ key: 'locations', label: 'Локації', icon: MapPin });
  if (isAdmin) nav.push({ key: 'requests', label: 'Запити', icon: Inbox });
  nav.push({ key: 'content', label: 'Контент', icon: BookOpen });
  if (isAdmin) nav.push({ key: 'topics', label: 'Розділи', icon: FileText });
  if (isAdmin) nav.push({ key: 'roles', label: 'Ролі', icon: Shield });
  if (isAdmin) nav.push({ key: 'access', label: '🔐 Карта доступів', icon: KeyRound });
  nav.push({ key: 'moderation', label: 'Модерація', icon: MessageSquare });
  nav.push({ key: 'audit', label: 'Журнал дій', icon: ScrollText });
  nav.push({ key: 'birthdays', label: '🎂 Дні народження', icon: Cake });
  nav.push({ key: 'digests', label: '📢 Дайджести', icon: Megaphone });
  nav.push({ key: 'announcements', label: '📢 Оголошення', icon: Bell });
  nav.push({ key: 'docsReport', label: '📋 Звіт по документах', icon: FileText });
  nav.push({ key: 'lms', label: '🎓 Навчання', icon: GraduationCap });
  nav.push({ key: 'oneOnOnes', label: '📅 Зустрічі 1:1', icon: Calendar });
  return nav;
}

export default function AdminPanel({ topicsMap, reloadTopics, articles, allLocations, reloadLocations, reloadArticles, isAdmin = true, tab: tabProp, onTab, onOpenUser, onCreateDigest, onOpenCourses, onCreateCourse, onOpenCourse, onOpenQuiz }) {
  const NAV = buildNav(isAdmin);
  // Захист: HR не може потрапити на admin-only вкладку через URL — fallback на дозволену.
  const allowed = NAV.map((n) => n.key);
  const tab = allowed.includes(tabProp) ? tabProp : 'dashboard';
  const setTab = (t) => onTab?.(t);

  return (
    <div>
      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 dark:border-stone-700 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-200">
          <Shield className="w-6 h-6 text-rose-500" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Управління системою</p>
          <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">Адмін-панель</h1>
        </div>
      </div>

      {/* Mobile: горизонтальний скрол-таб (sticky) */}
      <div className="md:hidden -mx-4 px-4 mb-4 sticky top-[60px] z-30 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto scroll-touch py-2" style={{ scrollSnapType: 'x proximity' }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setTab(n.key)} style={{ scrollSnapAlign: 'start' }}
              className={`flex items-center gap-2 px-3 min-h-[44px] rounded-md text-sm whitespace-nowrap flex-shrink-0 transition ${tab === n.key ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700'}`}>
              <n.icon className="w-4 h-4" />{n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex md:gap-6 md:items-start">
        <aside className="hidden md:block w-56 flex-shrink-0 sticky top-24">
          <nav className="space-y-1">
            {NAV.map((n) => (
              <button key={n.key} onClick={() => setTab(n.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition ${tab === n.key ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 border border-transparent'}`}>
                <n.icon className="w-4 h-4" />{n.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {tab === 'dashboard' && <Dashboard onJump={setTab} isAdmin={isAdmin} />}
          {tab === 'users' && isAdmin && <UsersTab allLocations={allLocations} />}
          {tab === 'employees' && !isAdmin && <EmployeesTab allLocations={allLocations} onOpenUser={onOpenUser} />}
          {tab === 'locations' && <LocationsTab allLocations={allLocations} reloadLocations={reloadLocations} readOnly={!isAdmin} onOpenUser={onOpenUser} />}
          {tab === 'requests' && isAdmin && <RequestsTab reloadLocations={reloadLocations} />}
          {tab === 'content' && (
            <ContentTab articles={articles} topicsMap={topicsMap} allLocations={allLocations}
              reloadArticles={reloadArticles} />
          )}
          {tab === 'topics' && isAdmin && <TopicsTab topicsMap={topicsMap} reloadTopics={reloadTopics} />}
          {tab === 'roles' && isAdmin && <RolesTab />}
          {tab === 'access' && isAdmin && <AccessMatrixTab onOpenUser={onOpenUser} />}
          {tab === 'moderation' && <ModerationTab articles={articles} />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'birthdays' && <BirthdaysTab />}
          {tab === 'digests' && <DigestsTab onCreateDigest={onCreateDigest} />}
          {tab === 'announcements' && <AnnouncementsTab allLocations={allLocations} />}
          {tab === 'docsReport' && <DocsReportTab onOpenUser={onOpenUser} />}
          {tab === 'lms' && <LmsTab onOpenCourses={onOpenCourses} onCreateCourse={onCreateCourse} onOpenCourse={onOpenCourse} onOpenQuiz={onOpenQuiz} />}
          {tab === 'oneOnOnes' && <OneOnOnesTab onOpenUser={onOpenUser} />}
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg ${className}`}>{children}</div>;
}

// ============ ОГЛЯД ============
function Dashboard({ onJump, isAdmin = true }) {
  const { roleName, roleKeys, roleChipStyle } = useRoles();
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiGet('/api/admin/stats').then(setS).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Card className="p-6 text-rose-600 text-sm">{err}</Card>;
  if (!s) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  const maxReg = Math.max(1, ...s.registrations.map((r) => r.count));
  const stat = [
    isAdmin
      ? { label: 'Користувачів', value: s.usersTotal, hint: `${s.usersPending} очікують`, to: 'users' }
      : { label: 'Працівників', value: s.usersTotal, to: 'employees' },
    { label: 'Статей', value: s.articles, to: 'content' },
    { label: 'Коментарів', value: s.comments },
    { label: 'Пропозицій на модерації', value: s.suggestionsPending, to: 'moderation' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stat.map((c) => (
          <button key={c.label} onClick={() => c.to && onJump(c.to)} disabled={!c.to}
            className="text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 disabled:cursor-default hover:enabled:border-rose-300 transition">
            <div className="text-3xl text-stone-800 dark:text-stone-100">{c.value}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400 mt-1">{c.label}</div>
            {c.hint && <div className="text-xs text-amber-600 mt-1">{c.hint}</div>}
          </button>
        ))}
      </div>

      <HrInsightsCards onJump={onJump} />

      <Card className="p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Користувачі за ролями</h3>
        <div className="flex flex-wrap gap-2">
          {roleKeys.filter((k) => s.byRole[k]).map((k) => (
            <span key={k} className="px-3 py-1 rounded-full text-xs border" style={roleChipStyle(k)}>
              {roleName(k)}: {s.byRole[k]}
            </span>
          ))}
          {Object.keys(s.byRole).length === 0 && <span className="text-sm text-stone-400 italic">Немає даних</span>}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Реєстрації за 30 днів</h3>
        <div className="flex items-end gap-0.5 h-32">
          {s.registrations.map((r) => (
            <div key={r.date} className="flex-1 group relative flex flex-col justify-end" title={`${r.date}: ${r.count}`}>
              <div className="bg-rose-300 group-hover:bg-rose-500 transition rounded-t"
                style={{ height: `${(r.count / maxReg) * 100}%`, minHeight: r.count ? '4px' : '0' }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-stone-400 mt-2">
          <span>{s.registrations[0]?.date}</span>
          <span>{s.registrations[s.registrations.length - 1]?.date}</span>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Останні дії</h3>
        {s.recentAudit.length === 0 ? (
          <p className="text-sm text-stone-400 italic">Журнал порожній</p>
        ) : (
          <div className="space-y-2">
            {s.recentAudit.map((a) => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-sm border-b border-stone-100 dark:border-stone-800 last:border-0 pb-2 last:pb-0">
                <span className="text-stone-700 dark:text-stone-200 break-words"><b className="text-stone-900">{a.actorName}</b> · <code className="text-xs text-rose-600">{a.action}</code> · {a.targetType}</span>
                <span className="text-xs text-stone-400 flex-shrink-0">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ ПРАЦІВНИКИ (HR, read-only, без PII) ============
function EmployeesTab({ allLocations, onOpenUser }) {
  const { roleName, roleKeys, roleChipStyle } = useRoles();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [fRole, setFRole] = useState('');
  const [fLoc, setFLoc] = useState('');

  useEffect(() => {
    apiGet('/api/senior/users').then(setList).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Card className="p-6 text-rose-600 text-sm">{err}</Card>;
  if (!list) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  const ql = q.trim().toLowerCase();
  const shown = list.filter((u) => {
    const full = `${u.name} ${u.surname || ''}`.toLowerCase();
    if (ql && !full.includes(ql)) return false;
    if (fRole && !(u.roles || []).includes(fRole)) return false;
    if (fLoc && !(u.locations || []).some((l) => l.locationId === fLoc)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за іменем…"
              className="w-full pl-9 pr-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent" />
          </div>
          <select value={fRole} onChange={(e) => setFRole(e.target.value)}
            className="px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent">
            <option value="">Усі ролі</option>
            {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
          </select>
          <select value={fLoc} onChange={(e) => setFLoc(e.target.value)}
            className="px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent">
            <option value="">Усі локації</option>
            {allLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <div className="text-xs uppercase tracking-wider text-stone-400 mb-3">Працівники ({shown.length})</div>
        {shown.length === 0 ? <p className="text-sm text-stone-400 italic">Нікого не знайдено</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map((u) => (
              <button key={u.id} type="button" onClick={() => onOpenUser?.(u.id)}
                className="text-left border border-stone-200 dark:border-stone-700 rounded-lg p-3 hover:border-rose-300 transition flex gap-3">
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt="" loading="lazy" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  : <span className="w-11 h-11 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-stone-500 dark:text-stone-300 flex-shrink-0">{(u.name || '?')[0]}</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-stone-800 dark:text-stone-100 truncate">
                    {u.name}{u.surname ? ` ${u.surname}` : ''}
                    {!u.approved && <span className="text-xs text-amber-600"> · очікує</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(u.roles || []).map((r) => (
                      <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={roleChipStyle(r)}>{roleName(r)}</span>
                    ))}
                    {(u.roles || []).length === 0 && <span className="text-[10px] text-stone-400 italic">без ролі</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(u.locations || []).map((l) => (
                      <span key={l.locationId} className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: l.color || '#a8a29e' }}>
                        {l.name}{l.isManager ? ' ★' : ''}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    ⭐ {u.rating ?? 0}{u.birthday ? ` · 🎂 ${u.birthday}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ КОРИСТУВАЧІ ============
function RoleChips({ user, onAdd, onRemove }) {
  const { roleName, roleKeys, roleChipStyle } = useRoles();
  const [adding, setAdding] = useState(false);
  const has = new Set(user.roles || []);
  const available = roleKeys.filter((k) => !has.has(k));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(user.roles || []).map((r) => (
        <span key={r} className="text-xs px-2 py-0.5 rounded-full border flex items-center gap-1" style={roleChipStyle(r)}>
          {roleName(r)}
          <button onClick={() => onRemove(user.id, r)} className="hover:text-rose-700" title="Зняти роль"><X className="w-3 h-3" /></button>
        </span>
      ))}
      {(user.roles || []).length === 0 && <span className="text-xs text-stone-400 italic">без ролі</span>}
      {adding ? (
        <select autoFocus defaultValue="" onChange={(e) => { if (e.target.value) { onAdd(user.id, e.target.value); } setAdding(false); }}
          onBlur={() => setAdding(false)}
          className="text-xs border border-stone-300 rounded px-1 py-0.5" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <option value="">+ роль…</option>
          {available.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
        </select>
      ) : (
        available.length > 0 && (
          <button onClick={() => setAdding(true)} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 dark:text-stone-400 hover:border-rose-400 hover:text-rose-600 flex items-center gap-1">
            <Plus className="w-3 h-3" />роль
          </button>
        )
      )}
    </div>
  );
}

function UsersTab({ allLocations }) {
  const confirm = useConfirm();
  const { roleName, roleKeys } = useRoles();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fRole, setFRole] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fLoc, setFLoc] = useState('');
  const [sel, setSel] = useState(new Set());
  const [detail, setDetail] = useState(null);

  const load = () => apiGet('/api/admin/users').then(setUsers).catch((e) => console.error(e)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // фільтр за локацією потребує деталей — тягнемо мапу userId->locationIds лениво
  const [userLocs, setUserLocs] = useState({});
  useEffect(() => {
    if (!fLoc) return;
    apiGet(`/api/locations/${fLoc}/users`).then((list) => {
      setUserLocs((m) => ({ ...m, [fLoc]: new Set(list.map((u) => u.userId)) }));
    }).catch(() => {});
  }, [fLoc]);

  const addRole = async (id, role) => { await apiPost(`/api/admin/users/${id}/roles`, { role }); await load(); };
  const removeRole = async (id, role) => {
    try { await apiDelete(`/api/admin/users/${id}/roles/${role}`); await load(); }
    catch (e) { alert(e.message); }
  };
  const setApproved = async (id, approved) => {
    if (!approved) {
      const ok = await confirm({ title: 'Заблокувати користувача?', description: 'Користувач втратить доступ до системи.', confirmLabel: 'Заблокувати' });
      if (!ok) return;
    }
    await apiPatch(`/api/admin/users/${id}`, { approved });
    await load();
  };
  const delUser = async (id) => {
    const ok = await confirm({ title: 'Видалити користувача?', description: 'Дію не можна скасувати.' });
    if (!ok) return;
    try { await apiDelete(`/api/admin/users/${id}`); await load(); } catch (e) { alert(e.message); }
  };

  const filtered = useMemo(() => users.filter((u) => {
    if (q && !(`${u.name} ${u.surname || ''} ${u.email}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (fRole && !(u.roles || []).includes(fRole)) return false;
    if (fStatus === 'pending' && u.approved) return false;
    if (fStatus === 'approved' && !u.approved) return false;
    if (fLoc && !(userLocs[fLoc]?.has(u.id))) return false;
    return true;
  }), [users, q, fRole, fStatus, fLoc, userLocs]);

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (action) => {
    if (sel.size === 0) return;
    if (action === 'delete') {
      const ok = await confirm({ title: `Видалити ${sel.size} користувач(ів)?`, description: 'Дію не можна скасувати.' });
      if (!ok) return;
    }
    try {
      await apiPost('/api/admin/users/bulk', { action, ids: [...sel] });
      setSel(new Set()); await load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за ім'ям або e-mail"
            className="w-full pl-10 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
        </div>
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          <option value="">Усі ролі</option>
          {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          <option value="">Будь-який статус</option>
          <option value="pending">Очікують</option>
          <option value="approved">Підтверджені</option>
        </select>
        <select value={fLoc} onChange={(e) => setFLoc(e.target.value)} className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          <option value="">Усі локації</option>
          {allLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Card>

      {sel.size > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-md px-4 py-2 text-sm">
          <span className="text-stone-700 dark:text-stone-200">Вибрано: {sel.size}</span>
          <button onClick={() => bulk('approve')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Підтвердити вибраних</button>
          <button onClick={() => bulk('delete')} className="px-3 py-1 bg-rose-500 text-white rounded text-xs">Видалити</button>
          <button onClick={() => setSel(new Set())} className="text-stone-500 dark:text-stone-400 text-xs ml-auto">Скинути</button>
        </div>
      )}

      {/* Desktop: таблиця */}
      <Card className="overflow-hidden hidden md:block">
        <table className="w-full">
          <thead className="bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Користувач</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Ролі</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Статус</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-stone-100 dark:border-stone-800 last:border-0 hover:bg-stone-50/50">
                <td className="px-4 py-3"><input type="checkbox" checked={sel.has(u.id)} onChange={() => toggleSel(u.id)} /></td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => setDetail(u.id)} style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <div className="text-sm text-stone-800 dark:text-stone-100">{u.name}{u.surname ? ` ${u.surname}` : ''}</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">{u.email}</div>
                  {u.requestedRole && <div className="text-xs text-stone-400">бажана: {roleName(u.requestedRole)}</div>}
                </td>
                <td className="px-4 py-3"><RoleChips user={u} onAdd={addRole} onRemove={removeRole} /></td>
                <td className="px-4 py-3">
                  {u.approved
                    ? <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Підтверджений</span>
                    : <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200">Очікує</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {!u.approved && <button onClick={() => setApproved(u.id, true)} className="text-xs px-3 py-1 bg-emerald-500 text-white rounded">Підтвердити</button>}
                    {u.approved && !u.roles?.includes('admin') && <button onClick={() => setApproved(u.id, false)} className="text-xs px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded">Заблокувати</button>}
                    <button onClick={() => delUser(u.id)} className="w-10 h-10 flex items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-stone-400 italic">Нічого не знайдено</div>}
      </Card>

      {/* Mobile: картки */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 w-4 h-4" checked={sel.has(u.id)} onChange={() => toggleSel(u.id)} />
              <button onClick={() => setDetail(u.id)} className="flex-1 text-left" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <div className="text-sm text-stone-800 dark:text-stone-100">{u.name}{u.surname ? ` ${u.surname}` : ''}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400 break-all">{u.email}</div>
                {u.requestedRole && <div className="text-xs text-stone-400">бажана: {roleName(u.requestedRole)}</div>}
              </button>
              {u.approved
                ? <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex-shrink-0">Підтв.</span>
                : <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200 flex-shrink-0">Очікує</span>}
            </div>
            <div className="mt-3"><RoleChips user={u} onAdd={addRole} onRemove={removeRole} /></div>
            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 flex gap-2">
              {!u.approved && <button onClick={() => setApproved(u.id, true)} className="flex-1 min-h-[44px] text-sm bg-emerald-500 text-white rounded">Підтвердити</button>}
              {u.approved && !u.roles?.includes('admin') && <button onClick={() => setApproved(u.id, false)} className="flex-1 min-h-[44px] text-sm bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded">Заблокувати</button>}
              <button onClick={() => delUser(u.id)} className="w-12 min-h-[44px] flex items-center justify-center bg-rose-50 text-rose-500 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-8 text-center text-stone-400 italic">Нічого не знайдено</Card>}
      </div>

      {detail && <UserDetailModal id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function UserDetailModal({ id, onClose }) {
  const { roleName, roleChipStyle } = useRoles();
  const confirm = useConfirm();
  const [u, setU] = useState(null);
  const [rpOpen, setRpOpen] = useState(false);
  const [rp, setRp] = useState({ a: '', b: '' });
  const [rpErr, setRpErr] = useState('');
  const [rpDone, setRpDone] = useState('');
  const [rpCopied, setRpCopied] = useState(false);
  useEffect(() => { apiGet(`/api/admin/users/${id}`).then(setU).catch((e) => console.error(e)); }, [id]);

  const resetPassword = async () => {
    setRpErr('');
    if (rp.a.length < 8) { setRpErr('Мінімум 8 символів'); return; }
    if (rp.a !== rp.b) { setRpErr('Паролі не співпадають'); return; }
    const ok = await confirm({
      title: `Скинути пароль користувача ${u?.name || ''}?`,
      description: 'Користувач не отримає сповіщення автоматично — повідомте йому новий пароль особисто.',
      confirmLabel: 'Скинути', confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await apiPost(`/api/admin/users/${id}/reset-password`, { newPassword: rp.a });
      setRpDone(rp.a);
      setRpOpen(false);
      setRp({ a: '', b: '' });
    } catch (e) { setRpErr(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-lg md:max-h-[85vh] overflow-y-auto rounded-none md:rounded-lg p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky -top-5 md:-top-6 bg-white dark:bg-stone-900 py-2 -my-2">
          <h3 className="text-xl text-stone-800 dark:text-stone-100">Деталі користувача</h3>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>
        {!u ? <p className="text-stone-400 italic">Завантаження…</p> : (
          <div className="space-y-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div>
              <div className="text-lg text-stone-800 dark:text-stone-100">{u.name}{u.surname ? ` ${u.surname}` : ''}</div>
              <div className="text-sm text-stone-500 dark:text-stone-400">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Ролі</div>
              <div className="flex flex-wrap gap-1.5">
                {(u.roles || []).map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded-full border" style={roleChipStyle(r)}>{roleName(r)}</span>)}
                {(u.roles || []).length === 0 && <span className="text-xs text-stone-400 italic">немає</span>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Локації</div>
              {(u.locations || []).length === 0 ? <span className="text-xs text-stone-400 italic">немає</span> : (
                <div className="flex flex-wrap gap-1.5">
                  {u.locations.map((l) => (
                    <span key={l.locationId} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: l.color || '#a8a29e' }}>
                      {l.name}{l.isManager ? ' · керівник' : ''}{!l.approved ? ' · очікує' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Статті ({u.articles?.length || 0})</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(u.articles || []).map((a) => (
                  <div key={a.id} className="text-sm text-stone-700 dark:text-stone-200 flex items-center gap-2"><FileText className="w-3 h-3 text-stone-400" />{a.title}</div>
                ))}
                {(u.articles || []).length === 0 && <span className="text-xs text-stone-400 italic">немає</span>}
              </div>
            </div>

            <EmploymentEditor user={u} onSaved={() => apiGet(`/api/admin/users/${id}`).then(setU)} />

            <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
              <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">Безпека</div>
              {rpDone ? (
                <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <div className="text-sm text-stone-700 dark:text-stone-200 mb-1">Пароль скинуто. Передайте користувачу особисто:</div>
                  <div className="flex items-center gap-2">
                    <code className="text-lg px-3 py-1 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">{rpDone}</code>
                    <button onClick={() => { navigator.clipboard.writeText(rpDone).then(() => { setRpCopied(true); setTimeout(() => setRpCopied(false), 1500); }); }}
                      className="px-3 min-h-[40px] rounded text-sm border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300">
                      {rpCopied ? 'Скопійовано' : 'Скопіювати'}
                    </button>
                  </div>
                </div>
              ) : !rpOpen ? (
                <button onClick={() => { setRpOpen(true); setRpErr(''); }}
                  className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-md text-sm bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-rose-600">
                  <Key className="w-4 h-4" /> Скинути пароль
                </button>
              ) : (
                <div className="space-y-2">
                  <input type="password" value={rp.a} onChange={(e) => setRp({ ...rp, a: e.target.value })} placeholder="Новий пароль (мін. 8)"
                    className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
                  <input type="password" value={rp.b} onChange={(e) => setRp({ ...rp, b: e.target.value })} placeholder="Повторіть пароль"
                    className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
                  {rpErr && <div className="text-sm text-rose-600">{rpErr}</div>}
                  <div className="flex gap-2">
                    <button onClick={() => { setRpOpen(false); setRp({ a: '', b: '' }); setRpErr(''); }} className="px-4 min-h-[44px] rounded-md text-sm bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">Скасувати</button>
                    <button onClick={resetPassword} className="px-4 min-h-[44px] rounded-md text-sm bg-red-600 hover:bg-red-700 text-white">Скинути</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ ЛОКАЦІЇ ============
const PRESET_CITIES = ['Київ', 'Львів', 'Івано-Франківськ', 'Рівне'];

function LocationsTab({ allLocations, reloadLocations, readOnly = false, onOpenUser }) {
  const confirm = useConfirm();
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [assign, setAssign] = useState({ userId: '', isManager: false });
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cityPreset: 'Київ', cityOther: '', color: '#e11d48', address: '' });

  const grouped = allLocations.reduce((acc, l) => {
    const c = l.city || 'Інше';
    (acc[c] = acc[c] || []).push(l);
    return acc;
  }, {});

  const openLocation = async (lid) => { setOpenId(lid); setWorkers(await apiGet(`/api/locations/${lid}/users`)); };
  const addLocation = async () => {
    setError('');
    if (!form.name.trim()) return setError('Вкажіть назву');
    const city = form.cityPreset === 'other' ? form.cityOther.trim() : form.cityPreset;
    try {
      await apiPost('/api/admin/locations', { name: form.name, city: city || null, address: form.address || null, color: form.color });
      setForm({ name: '', cityPreset: 'Київ', cityOther: '', color: '#e11d48', address: '' });
      setAddOpen(false);
      await reloadLocations();
    } catch (e) { setError(e.message); }
  };
  const toggleActive = async (l) => {
    setError('');
    try { await apiPatch(`/api/admin/locations/${l.id}`, { active: l.active === false }); await reloadLocations(); }
    catch (e) { setError(e.message); }
  };
  const removeLocation = async (lid) => {
    setError('');
    if (!(await confirm({ title: 'Видалити локацію?', description: 'Локацію буде видалено остаточно.' }))) return;
    try { await apiDelete(`/api/admin/locations/${lid}`); if (openId === lid) setOpenId(null); await reloadLocations(); }
    catch (e) { setError(e.message); }
  };
  const detach = async (userId) => { await apiDelete(`/api/admin/users/${userId}/locations/${openId}`); await openLocation(openId); await reloadLocations(); };
  const openAssign = async () => { setUsers(await apiGet('/api/admin/users')); setAssign({ userId: '', isManager: false }); setAssignOpen(true); };
  const doAssign = async () => {
    if (!assign.userId) return;
    await apiPost(`/api/admin/users/${assign.userId}/locations`, { locationId: openId, isManager: assign.isManager });
    setAssignOpen(false); await openLocation(openId); await reloadLocations();
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Локації ({allLocations.length})</h3>
          {!readOnly && (
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
              <Plus className="w-4 h-4" /> Додати
            </button>
          )}
        </div>
        {error && <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        {allLocations.length === 0 && <p className="text-sm text-stone-400 italic">Локацій ще немає</p>}
        <div className="space-y-5">
          {Object.entries(grouped).map(([city, locs]) => (
            <div key={city}>
              <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">{city}</div>
              <div className="space-y-2">
                {locs.map((l) => (
                  <div key={l.id} className={`border rounded ${l.active === false ? 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 opacity-70' : 'border-stone-200 dark:border-stone-700'}`}>
                    <div className="flex items-center justify-between p-3 gap-2">
                      <button onClick={() => (openId === l.id ? setOpenId(null) : openLocation(l.id))} className="flex items-center gap-2 text-left min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color || '#a8a29e' }} />
                        <span className="text-sm text-stone-800 dark:text-stone-100 truncate">{l.name}</span>
                        <span className="text-xs text-stone-400 flex-shrink-0">{l.userCount} люд.</span>
                        <ChevronRight className={`w-4 h-4 text-stone-300 transition flex-shrink-0 ${openId === l.id ? 'rotate-90' : ''}`} />
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {readOnly ? (
                          <span className={`px-2 min-h-[36px] flex items-center rounded text-xs border ${l.active === false ? 'border-stone-300 text-stone-500 dark:text-stone-400' : 'border-emerald-300 text-emerald-700 bg-emerald-50'}`}>
                            {l.active === false ? 'Неактивна' : 'Активна'}
                          </span>
                        ) : (
                          <>
                            <button onClick={() => toggleActive(l)} title={l.active === false ? 'Активувати' : 'Деактивувати'}
                              className={`px-2 min-h-[36px] rounded text-xs border ${l.active === false ? 'border-stone-300 text-stone-500 dark:text-stone-400' : 'border-emerald-300 text-emerald-700 bg-emerald-50'}`}>
                              {l.active === false ? 'Неактивна' : 'Активна'}
                            </button>
                            <button onClick={() => removeLocation(l.id)} className="w-9 h-9 flex items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                    {openId === l.id && (
                      <div className="border-t border-stone-100 dark:border-stone-800 p-3 bg-stone-50 dark:bg-stone-900">
                        {l.address && <div className="text-xs text-stone-500 dark:text-stone-400 mb-2">{l.address}</div>}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">Працівники</span>
                          {!readOnly && <button onClick={openAssign} className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"><Plus className="w-3 h-3" />Призначити</button>}
                        </div>
                        {workers.length === 0 ? <p className="text-sm text-stone-400 italic">Немає працівників</p> : workers.map((w) => (
                          <div key={w.userLocationId} className="flex items-center justify-between py-1.5 text-sm">
                            <button type="button" onClick={() => onOpenUser?.(w.userId)} className="text-left hover:text-rose-600 truncate">
                              {w.name}{w.surname ? ` ${w.surname}` : ''} {w.isManager && <span className="text-xs text-purple-600">· керівник</span>} {!w.approved && <span className="text-xs text-amber-600">· очікує</span>}
                            </button>
                            {!readOnly && <button onClick={() => detach(w.userId)} className="text-xs text-stone-500 dark:text-stone-400 hover:text-rose-600">Зняти</button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {addOpen && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-lg w-full sm:max-w-md p-5 sm:p-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-stone-800 dark:text-stone-100" style={{ fontFamily: 'Georgia, serif' }}>Додати локацію</h3>
              <button onClick={() => setAddOpen(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Назва" className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
              <select value={form.cityPreset} onChange={(e) => setForm({ ...form, cityPreset: e.target.value })} className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm">
                {PRESET_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="other">Інше місто…</option>
              </select>
              {form.cityPreset === 'other' && (
                <input value={form.cityOther} onChange={(e) => setForm({ ...form, cityOther: e.target.value })} placeholder="Назва міста" className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
              )}
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Адреса (необов.)" className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
              <label className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-300">
                Колір <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-16 border border-stone-200 dark:border-stone-700 rounded-md" />
              </label>
              {error && <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
              <button onClick={addLocation} className="w-full px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">Додати локацію</button>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-lg w-full sm:max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-stone-800 dark:text-stone-100">Призначити користувача</h3>
              <button onClick={() => setAssignOpen(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <select value={assign.userId} onChange={(e) => setAssign({ ...assign, userId: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md mb-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <option value="">— оберіть користувача —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.surname ? ` ${u.surname}` : ''} ({u.email})</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 mb-4 min-h-[44px]">
              <input type="checkbox" className="w-4 h-4" checked={assign.isManager} onChange={(e) => setAssign({ ...assign, isManager: e.target.checked })} />
              Керівник локації
            </label>
            <button onClick={doAssign} disabled={!assign.userId} className="w-full px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">Призначити</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ЗАПИТИ ============
function RequestsTab({ reloadLocations }) {
  const { roleName } = useRoles();
  const [locReqs, setLocReqs] = useState([]);
  const [roleReqs, setRoleReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => Promise.all([
    apiGet('/api/admin/location-requests?status=pending'),
    apiGet('/api/admin/role-requests'),
  ]).then(([lr, rr]) => { setLocReqs(lr); setRoleReqs(rr); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const decideLoc = async (id, status) => {
    await apiPatch(`/api/admin/location-requests/${id}`, { status });
    setLocReqs((p) => p.filter((r) => r.id !== id));
    if (status === 'approved') await reloadLocations();
  };
  const approveRole = async (r) => {
    await apiPost(`/api/admin/users/${r.userId}/roles`, { role: r.requestedRole });
    await apiPatch(`/api/admin/users/${r.userId}`, { approved: true });
    setRoleReqs((p) => p.filter((x) => x.userId !== r.userId));
  };
  const rejectRole = async (r) => {
    await apiPatch(`/api/admin/users/${r.userId}`, { approved: false });
    setRoleReqs((p) => p.filter((x) => x.userId !== r.userId));
  };

  if (loading) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-4">Запити на локації ({locReqs.length})</h3>
        {locReqs.length === 0 ? <p className="text-sm text-stone-400 italic">Немає запитів</p> : (
          <div className="space-y-3">
            {locReqs.map((r) => (
              <div key={r.id} className="p-4 bg-stone-50 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-stone-800 dark:text-stone-100">{r.userName}</span><span className="text-stone-400"> → </span>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: r.locationColor || '#a8a29e' }} />{r.locationName}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decideLoc(r.id, 'approved')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Прийняти</button>
                  <button onClick={() => decideLoc(r.id, 'rejected')} className="px-3 py-1 bg-stone-200 text-stone-700 dark:text-stone-200 rounded text-xs">Відхилити</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-4">Запити на ролі ({roleReqs.length})</h3>
        {roleReqs.length === 0 ? <p className="text-sm text-stone-400 italic">Немає запитів</p> : (
          <div className="space-y-3">
            {roleReqs.map((r) => (
              <div key={r.userId} className="p-4 bg-stone-50 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-stone-800 dark:text-stone-100">{r.userName}</span> <span className="text-xs text-stone-500 dark:text-stone-400">({r.email})</span>
                  <span className="text-stone-400"> → </span><span className="text-stone-700 dark:text-stone-200">{roleName(r.requestedRole)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveRole(r)} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Підтвердити + роль</button>
                  <button onClick={() => rejectRole(r)} className="px-3 py-1 bg-stone-200 text-stone-700 dark:text-stone-200 rounded text-xs">Відхилити</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ КОНТЕНТ ============
function ContentTab({ articles, topicsMap, allLocations, reloadArticles }) {
  const confirm = useConfirm();
  const { roleName, roleKeys, roleChipStyle } = useRoles();
  const allTopics = useMemo(() => Object.values(topicsMap).flat(), [topicsMap]);
  const topicById = useMemo(() => Object.fromEntries(allTopics.map((t) => [t.id, t])), [allTopics]);
  const topicRole = (a) => topicById[a.topicId]?.roleKey || '—';

  const [fRole, setFRole] = useState('');
  const [fLoc, setFLoc] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());
  const [moveTopic, setMoveTopic] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);

  const filtered = articles.filter((a) => {
    if (fRole && topicRole(a) !== fRole) return false;
    if (fLoc && !(a.locations || []).some((l) => l.locationId === fLoc)) return false;
    if (fStatus) {
      const isScheduled = (a.status || 'published') === 'published' && a.publishAt && new Date(a.publishAt).getTime() > Date.now();
      if (fStatus === 'scheduled' && !isScheduled) return false;
      if (fStatus === 'published' && ((a.status || 'published') !== 'published' || isScheduled)) return false;
      if (fStatus === 'draft' && (a.status || 'published') !== 'draft') return false;
    }
    if (q && !(`${a.title} ${a.authorName || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkDelete = async () => {
    if (sel.size === 0) return;
    if (!(await confirm({ title: `Видалити ${sel.size} статей?`, description: 'Дію не можна скасувати.' }))) return;
    await apiPost('/api/admin/articles/bulk', { action: 'delete', ids: [...sel] });
    setSel(new Set()); await reloadArticles();
  };
  const bulkMove = async () => {
    if (sel.size === 0 || !moveTopic) return;
    await apiPost('/api/admin/articles/bulk', { action: 'move', ids: [...sel], targetTopicId: moveTopic });
    setSel(new Set()); setMoveTopic(''); await reloadArticles();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за назвою / автором" className="w-full pl-10 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
        </div>
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          <option value="">Усі ролі</option>
          {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
        </select>
        <select value={fLoc} onChange={(e) => setFLoc(e.target.value)} className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          <option value="">Усі локації</option>
          {allLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
          <option value="">Усі статуси</option>
          <option value="published">Опубліковані</option>
          <option value="draft">Чернетки</option>
          <option value="scheduled">Заплановані</option>
        </select>
        <button onClick={() => setPublishOpen(true)} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" />Опублікувати статтю
        </button>
      </Card>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-rose-50 border border-rose-200 rounded-md px-4 py-2 text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <span className="text-stone-700 dark:text-stone-200">Вибрано: {sel.size}</span>
          <button onClick={bulkDelete} className="px-3 py-1 bg-rose-500 text-white rounded text-xs">Видалити вибрані</button>
          <select value={moveTopic} onChange={(e) => setMoveTopic(e.target.value)} className="px-2 py-1 border border-stone-300 rounded text-xs">
            <option value="">Перенести в розділ…</option>
            {roleKeys.map((k) => (
              <optgroup key={k} label={roleName(k)}>
                {(topicsMap[k] || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </optgroup>
            ))}
          </select>
          <button onClick={bulkMove} disabled={!moveTopic} className="px-3 py-1 bg-stone-700 disabled:opacity-50 text-white rounded text-xs">Перенести</button>
          <button onClick={() => setSel(new Set())} className="text-stone-500 dark:text-stone-400 text-xs ml-auto">Скинути</button>
        </div>
      )}

      {/* Desktop: таблиця */}
      <Card className="overflow-hidden hidden md:block">
        <table className="w-full">
          <thead className="bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Стаття</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Роль</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Локації</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 px-4 py-3">Автор</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-stone-100 dark:border-stone-800 last:border-0 hover:bg-stone-50/50">
                <td className="px-4 py-3"><input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} /></td>
                <td className="px-4 py-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <div className="text-sm text-stone-800 dark:text-stone-100">{a.title}</div>
                  <div className="text-xs text-stone-400">{new Date(a.createdAt).toLocaleDateString('uk-UA')}</div>
                </td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full border" style={roleChipStyle(topicRole(a))}>{roleName(topicRole(a))}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(a.locations || []).length === 0 ? <span className="text-xs text-stone-400 italic">усі</span> :
                      a.locations.map((l) => <span key={l.locationId} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ background: l.color || '#a8a29e' }}>{l.name}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-stone-600 dark:text-stone-300" style={{ fontFamily: 'system-ui, sans-serif' }}>{a.authorName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-stone-400 italic">Статей не знайдено</div>}
      </Card>

      {/* Mobile: картки */}
      <div className="md:hidden space-y-3">
        {filtered.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 w-4 h-4" checked={sel.has(a.id)} onChange={() => toggle(a.id)} />
              <div className="flex-1 min-w-0" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <div className="text-sm text-stone-800 dark:text-stone-100">{a.title}</div>
                <div className="text-xs text-stone-400 mb-2">{new Date(a.createdAt).toLocaleDateString('uk-UA')} · {a.authorName || '—'}</div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-xs px-2 py-0.5 rounded-full border" style={roleChipStyle(topicRole(a))}>{roleName(topicRole(a))}</span>
                  {(a.locations || []).length === 0 ? <span className="text-xs text-stone-400 italic">усі локації</span> :
                    a.locations.map((l) => <span key={l.locationId} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ background: l.color || '#a8a29e' }}>{l.name}</span>)}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-8 text-center text-stone-400 italic">Статей не знайдено</Card>}
      </div>
      <p className="text-xs text-stone-400 italic">Усього статей: {articles.length} · показано {filtered.length}</p>

      {publishOpen && (
        <PublishModal topicsMap={topicsMap} allLocations={allLocations}
          onClose={() => setPublishOpen(false)}
          onCreated={async () => { setPublishOpen(false); await reloadArticles(); }} />
      )}
    </div>
  );
}

function PublishModal({ topicsMap, allLocations, onClose, onCreated }) {
  const { roleName, roleKeys } = useRoles();
  const [role, setRole] = useState('florist');
  const [topicId, setTopicId] = useState('');
  const [form, setForm] = useState({ title: '', content: '', tags: '' });
  const [locationIds, setLocationIds] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const topics = topicsMap[role] || [];
  const toggleLoc = (id) => setLocationIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (!topicId) return setError('Оберіть розділ');
    if (!form.title.trim() || !form.content.trim()) return setError('Заповніть назву та зміст');
    setBusy(true);
    try {
      await apiPost('/api/articles', {
        topicId,
        section: topicId.startsWith('tc-') ? 'tech' : 'role',
        title: form.title, content: form.content, tags: form.tags,
        locationIds, mediaUrls: [],
      });
      await onCreated();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between sticky top-0 bg-white dark:bg-stone-900 z-10">
          <h2 className="text-lg md:text-xl text-stone-800 dark:text-stone-100">Опублікувати статтю</h2>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Роль</label>
              <select value={role} onChange={(e) => { setRole(e.target.value); setTopicId(''); }} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
                {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Розділ</label>
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
                <option value="">— оберіть розділ —</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Заголовок" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} placeholder="Текст статті. **жирний** підтримується." className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Теги через кому" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Локації <span className="normal-case text-stone-400">(порожньо = усі)</span></label>
            <div className="flex flex-wrap gap-2">
              {allLocations.map((l) => {
                const on = locationIds.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLoc(l.id)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300 bg-white dark:bg-stone-900'}`}
                    style={on ? { background: l.color || '#a8a29e' } : undefined}>{l.name}</button>
                );
              })}
            </div>
          </div>
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>
        <div className="p-4 md:p-6 border-t border-stone-200 dark:border-stone-700 flex gap-2 justify-end sticky bottom-0 bg-white dark:bg-stone-900">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
          <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">{busy ? 'Збереження…' : 'Опублікувати'}</button>
        </div>
      </div>
    </div>
  );
}

// ============ РОЗДІЛИ (Topics) ============
function IconPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
      {TOPIC_ICON_NAMES.map((name) => {
        const Ico = iconFor(name);
        const on = value === name;
        return (
          <button key={name} type="button" onClick={() => onChange(on ? null : name)} title={name}
            className={`aspect-square flex items-center justify-center rounded-md border transition ${on ? 'bg-rose-50 border-rose-400 text-rose-600' : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-rose-300'}`}>
            <Ico className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

function TopicsTab({ topicsMap, reloadTopics }) {
  const confirm = useConfirm();
  const { roleName, roleKeys } = useRoles();
  const [selectedRole, setSelectedRole] = useState('florist');
  const [draft, setDraft] = useState({ title: '', description: '', icon: null });
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', description: '', icon: null });
  const [busy, setBusy] = useState(false);

  const list = topicsMap[selectedRole] || [];

  const add = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await apiPost('/api/topics', {
        id: `${selectedRole}-${Date.now()}`, roleKey: selectedRole,
        title: draft.title, description: draft.description, icon: draft.icon,
      });
      setDraft({ title: '', description: '', icon: null });
      await reloadTopics();
    } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    await apiPatch(`/api/topics/${editId}`, editDraft);
    setEditId(null);
    await reloadTopics();
  };
  const del = async (id) => {
    if (!(await confirm({ title: 'Видалити розділ?', description: 'Розділ буде видалено.' }))) return;
    await apiDelete(`/api/topics/${id}`);
    await reloadTopics();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Розділи знань</h3>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {list.map((t) => {
            const Ico = iconFor(t.icon);
            return editId === t.id ? (
              <div key={t.id} className="p-3 border border-rose-200 rounded bg-rose-50/40 space-y-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-sm" placeholder="Назва" />
                <input value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-sm" placeholder="Опис" />
                <IconPicker value={editDraft.icon} onChange={(ic) => setEditDraft({ ...editDraft, icon: ic })} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm">Зберегти</button>
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded text-sm">Скасувати</button>
                </div>
              </div>
            ) : (
              <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-900 rounded">
                <div className="flex items-center gap-3">
                  <Ico className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                  <div>
                    <div className="text-sm text-stone-800 dark:text-stone-100">{t.title}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 italic">{t.description}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditId(t.id); setEditDraft({ title: t.title, description: t.description, icon: t.icon || null }); }} className="text-stone-400 hover:text-rose-500 text-xs">Редагувати</button>
                  <button onClick={() => del(t.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p className="text-sm text-stone-400 italic">Для цієї ролі ще немає розділів.</p>}
        </div>

        <div className="mt-5 pt-5 border-t border-stone-100 dark:border-stone-800 space-y-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <p className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">Новий розділ</p>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Назва розділу" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Опис" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1.5">Іконка {draft.icon && <span className="text-rose-600">· {draft.icon}</span>}</p>
            <IconPicker value={draft.icon} onChange={(ic) => setDraft({ ...draft, icon: ic })} />
          </div>
          <button onClick={add} disabled={busy} className="px-4 py-2 bg-rose-500 disabled:opacity-60 text-white rounded text-sm"><Plus className="w-4 h-4 inline mr-1" />Додати розділ</button>
        </div>
      </Card>
    </div>
  );
}

// ============ МОДЕРАЦІЯ ============
// ============ РОЛІ ============
function RolesTab() {
  const confirm = useConfirm();
  const { roles, reload } = useRoles();
  const [editing, setEditing] = useState(null); // role obj or {__new:true}
  const [form, setForm] = useState({ name: '', description: '', iconKey: null, color: '#e11d48', restricted: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setForm({ name: '', description: '', iconKey: null, color: '#e11d48', restricted: false });
    setError(''); setEditing({ __new: true });
  };
  const openEdit = (r) => {
    setForm({ name: r.name, description: r.description || '', iconKey: r.iconKey || null, color: r.color || '#e11d48', restricted: !!r.restricted });
    setError(''); setEditing(r);
  };
  const save = async () => {
    if (!form.name.trim()) return setError('Вкажіть назву ролі');
    setBusy(true); setError('');
    try {
      if (editing.__new) {
        await apiPost('/api/admin/roles', form);
      } else {
        await apiPatch(`/api/admin/roles/${editing.key}`, form);
      }
      await reload();
      setEditing(null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!(await confirm({ title: `Видалити роль «${r.name}»?`, description: 'Роль буде видалено (якщо немає призначень/розділів).' }))) return;
    try { await apiDelete(`/api/admin/roles/${r.key}`); await reload(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Ролі ({roles.length})</h3>
          <button onClick={openNew} className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Створити роль
          </button>
        </div>
        <div className="space-y-2">
          {roles.map((r) => {
            const Ico = iconFor(r.iconKey, Shield);
            return (
              <div key={r.key} className="flex items-center justify-between gap-3 p-3 border border-stone-200 dark:border-stone-700 rounded">
                <button onClick={() => openEdit(r)} className="flex items-center gap-3 text-left min-w-0">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center border flex-shrink-0"
                    style={{ background: `${r.color || '#a8a29e'}1A`, color: r.color || '#78716c', borderColor: `${r.color || '#a8a29e'}55` }}>
                    <Ico className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2 flex-wrap">
                      {r.name} <code className="text-xs text-stone-400">{r.key}</code>
                      {r.restricted && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">обмежена</span>}
                    </span>
                    {r.description && <span className="block text-xs text-stone-500 dark:text-stone-400 truncate">{r.description}</span>}
                    <span className="block text-xs text-stone-400 mt-0.5">{r.userCount ?? 0} користувач(ів) · {r.topicCount ?? 0} розділ(ів)</span>
                  </span>
                </button>
                {r.protected
                  ? <span className="text-xs text-stone-400 flex-shrink-0">Системна роль</span>
                  : <button onClick={() => del(r)} className="w-9 h-9 flex items-center justify-center text-rose-400 hover:text-rose-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
              </div>
            );
          })}
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] rounded-none sm:rounded-lg flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 dark:border-stone-700 sticky top-0 bg-white dark:bg-stone-900">
              <h3 className="text-lg text-stone-800 dark:text-stone-100" style={{ fontFamily: 'Georgia, serif' }}>{editing.__new ? 'Нова роль' : `Редагування: ${editing.name}`}</h3>
              <button onClick={() => setEditing(null)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Назва ролі" className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
              {editing.__new && form.name && (
                <p className="text-xs text-stone-400">Ключ: <code>{form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || '—'}</code></p>
              )}
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Опис" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
              <label className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-300">
                Колір <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-16 border border-stone-200 dark:border-stone-700 rounded-md" />
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 min-h-[44px]">
                <input type="checkbox" className="w-4 h-4" checked={form.restricted} onChange={(e) => setForm({ ...form, restricted: e.target.checked })} />
                Обмежений доступ (контент бачать лише призначені)
              </label>
              <div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-1.5">Іконка {form.iconKey && <span className="text-rose-600">· {form.iconKey}</span>}</p>
                <IconPicker value={form.iconKey} onChange={(ic) => setForm({ ...form, iconKey: ic })} />
              </div>
              {error && <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
            </div>
            <div className="p-4 sm:p-5 border-t border-stone-200 dark:border-stone-700 flex gap-2 justify-end sticky bottom-0 bg-white dark:bg-stone-900">
              <button onClick={() => setEditing(null)} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
              <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">{busy ? 'Збереження…' : 'Зберегти'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModerationTab({ articles }) {
  const confirm = useConfirm();
  const { roleName } = useRoles();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/suggestions?status=pending').then(setPending).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, []);

  const decide = async (id, status) => {
    const ok = await confirm(status === 'approved'
      ? { title: 'Прийняти пропозицію?', description: 'Пропозицію буде позначено як прийняту.', confirmLabel: 'Прийняти', confirmVariant: 'primary' }
      : { title: 'Відхилити пропозицію?', description: 'Пропозицію буде відхилено.', confirmLabel: 'Відхилити' });
    if (!ok) return;
    await apiPatch(`/api/suggestions/${id}`, { status });
    setPending((p) => p.filter((s) => s.id !== id));
  };

  if (loading) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  return (
    <Card className="p-6">
      <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-4">Пропозиції на модерацію ({pending.length})</h3>
      {pending.length === 0 ? <p className="text-sm text-stone-400 italic">Усі пропозиції розглянуті</p> : (
        <div className="space-y-3">
          {pending.map((s) => {
            const article = articles.find((a) => a.id === s.articleId);
            return (
              <div key={s.id} className="p-4 bg-stone-50 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700">
                <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">До статті: <span className="text-stone-700 dark:text-stone-200">{article?.title || '—'}</span></div>
                <div className="text-sm text-stone-700 dark:text-stone-200 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 dark:text-stone-400">{s.authorName} · {roleName(s.authorRole)}</span>
                    <Stars avg={s.ratingAvg} count={s.ratingCount} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decide(s.id, 'approved')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Прийняти</button>
                    <button onClick={() => decide(s.id, 'rejected')} className="px-3 py-1 bg-stone-200 text-stone-700 dark:text-stone-200 rounded text-xs">Відхилити</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============ ЖУРНАЛ ДІЙ ============
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fAction, setFAction] = useState('');

  const load = (action) => {
    setLoading(true);
    apiGet(`/api/admin/audit-log?limit=100${action ? `&action=${encodeURIComponent(action)}` : ''}`)
      .then(setLogs).catch((e) => console.error(e)).finally(() => setLoading(false));
  };
  useEffect(() => { load(''); }, []);

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-lg text-stone-800 dark:text-stone-100">Журнал дій</h3>
        <div className="flex gap-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <input value={fAction} onChange={(e) => setFAction(e.target.value)} placeholder="Фільтр за дією (напр. user.)"
            className="flex-1 sm:flex-none px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm" onKeyDown={(e) => e.key === 'Enter' && load(fAction)} />
          <button onClick={() => load(fAction)} className="px-4 min-h-[44px] bg-stone-700 text-white rounded-md text-sm">Фільтр</button>
        </div>
      </div>
      {loading ? <p className="text-stone-400 italic text-sm">Завантаження…</p> : logs.length === 0 ? (
        <p className="text-sm text-stone-400 italic">Журнал порожній</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((a) => (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-sm border-b border-stone-100 dark:border-stone-800 last:border-0 py-2">
              <span className="text-stone-700 dark:text-stone-200 break-words">
                <b className="text-stone-900">{a.actorName}</b> · <code className="text-xs text-rose-600">{a.action}</code> · {a.targetType}{a.targetId ? ` (${a.targetId.slice(0, 8)})` : ''}
              </span>
              <span className="text-xs text-stone-400 flex-shrink-0">{fmtDate(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============ 🎂 ДНІ НАРОДЖЕННЯ (HR/admin) ============
function BirthdaysTab() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const load = () => apiGet('/api/admin/birthday-list').then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (id, value) => {
    try {
      if (value) await apiPatch(`/api/admin/users/${id}/birthday`, { birthday: value });
      else await apiDelete(`/api/admin/users/${id}/birthday`);
      await load();
    } catch (e) { alert(e.message); }
  };

  const filtered = users.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук користувача"
            className="w-full pl-10 pr-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
        </div>
      </Card>
      <Card className="p-5 md:p-6">
        <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-4">Дні народження ({users.length})</h3>
        <div className="space-y-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {filtered.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
              <span className="text-sm text-stone-800 dark:text-stone-100">{u.name}</span>
              <div className="flex items-center gap-2">
                <input type="date" defaultValue={u.birthday || ''} onChange={(e) => save(u.id, e.target.value)}
                  className="px-2 min-h-[40px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
                {u.birthday && (
                  <button onClick={() => save(u.id, null)} className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-stone-400 italic py-4 text-center">Нічого не знайдено</p>}
        </div>
      </Card>
    </div>
  );
}

// ============ 📢 ДАЙДЖЕСТИ (HR/admin) ============
function DigestsTab({ onCreateDigest }) {
  const [items, setItems] = useState([]);
  const [catFilter, setCatFilter] = useState('all');
  useEffect(() => { apiGet('/api/digests').then(setItems).catch(() => {}); }, []);

  const shown = catFilter === 'all' ? items : items.filter((d) => d.digestCategory === catFilter);

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Дайджести ({shown.length})</h3>
          <button onClick={() => onCreateDigest?.()} className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Створити дайджест
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <button onClick={() => setCatFilter('all')}
            className={`px-3 py-1 rounded-full text-xs border transition ${catFilter === 'all' ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
            Усі
          </button>
          {DIGEST_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className={`px-3 py-1 rounded-full text-xs border transition flex items-center gap-1 ${catFilter === c.key ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
              style={catFilter === c.key ? { background: c.color } : undefined}>
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {shown.map((d) => {
            const c = digestCategory(d.digestCategory);
            return (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3 border border-stone-200 dark:border-stone-700 rounded">
                <div className="flex items-center gap-2 min-w-0">
                  {c && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white flex items-center gap-1 flex-shrink-0"
                      style={{ background: c.color }}>
                      <span>{c.icon}</span>{c.label}
                    </span>
                  )}
                  <span className="text-sm text-stone-800 dark:text-stone-100 truncate">{d.title}</span>
                </div>
                <span className="text-xs text-stone-400 flex-shrink-0">{new Date(d.createdAt).toLocaleDateString('uk-UA')} · {d.status === 'draft' ? 'чернетка' : 'опубліковано'}</span>
              </div>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-stone-400 italic py-4 text-center">Ще немає дайджестів</p>}
        </div>
      </Card>
    </div>
  );
}

// ============ КАРТА ДОСТУПІВ (тільки admin) ============
const CAT_LABEL = { content: 'Контент', users: 'Користувачі', locations: 'Локації', system: 'Система' };
const CAT_ORDER = ['content', 'users', 'locations', 'system'];

function AccessMatrixTab({ onOpenUser }) {
  const [sub, setSub] = useState('users');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[['users', 'Користувачі'], ['presets', 'Пресети']].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`px-4 min-h-[40px] rounded-md text-sm border transition ${sub === k ? 'bg-rose-50 text-rose-700 border-rose-200' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}>
            {l}
          </button>
        ))}
      </div>
      {sub === 'users' ? <AccessUsers onOpenUser={onOpenUser} /> : <PresetsSubTab />}
    </div>
  );
}

function AccessUsers({ onOpenUser }) {
  const { roleName, roleChipStyle } = useRoles();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filt, setFilt] = useState('all'); // all | with | without
  const [modalUser, setModalUser] = useState(null);

  const load = () => apiGet('/api/admin/permission-matrix').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <Card className="p-6 text-rose-600 text-sm">{err}</Card>;
  if (!rows) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  const ql = q.trim().toLowerCase();
  const shown = rows.filter((u) => {
    if (ql && !`${u.name} ${u.surname || ''}`.toLowerCase().includes(ql)) return false;
    if (filt === 'with' && !u.hasAny) return false;
    if (filt === 'without' && u.hasAny) return false;
    return true;
  });
  const Counters = ({ u }) => (
    <div className="flex flex-wrap gap-1.5">
      {CAT_ORDER.map((c) => {
        const cc = u.counts[c] || { have: 0, total: 0 };
        const on = cc.have > 0;
        return (
          <span key={c} title={CAT_LABEL[c]}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'text-stone-400 border-stone-200 dark:border-stone-700'}`}>
            {CAT_LABEL[c]} {cc.have}/{cc.total}
          </span>
        );
      })}
    </div>
  );

  return (
    <>
      <Card className="p-4 md:p-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за іменем…"
              className="w-full pl-9 pr-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent" />
          </div>
          <select value={filt} onChange={(e) => setFilt(e.target.value)}
            className="px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent">
            <option value="all">Усі</option>
            <option value="with">З permissions</option>
            <option value="without">Без permissions</option>
          </select>
        </div>
      </Card>

      <Card className="p-4 md:p-5 mt-4">
        <div className="text-xs uppercase tracking-wider text-stone-400 mb-3">Користувачі ({shown.length})</div>

        {/* Desktop: таблиця */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-400 border-b border-stone-200 dark:border-stone-700">
                <th className="py-2 pr-3">Користувач</th>
                <th className="py-2 pr-3">Ролі</th>
                <th className="py-2 pr-3">Категорії прав</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 dark:border-stone-800 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt="" loading="lazy" className="w-8 h-8 rounded-full object-cover" />
                        : <span className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs">{(u.name || '?')[0]}</span>}
                      <span className="text-stone-800 dark:text-stone-100">{u.name}{u.surname ? ` ${u.surname}` : ''}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={roleChipStyle(r)}>{roleName(r)}</span>)}
                      {u.roles.length === 0 && <span className="text-[10px] text-stone-400 italic">—</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-3"><Counters u={u} /></td>
                  <td className="py-2 text-right">
                    <button onClick={() => setModalUser(u.id)} className="px-3 min-h-[36px] text-xs rounded-md border border-stone-200 dark:border-stone-700 hover:border-rose-300">
                      Permissions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: картки */}
        <div className="md:hidden space-y-2">
          {shown.map((u) => (
            <div key={u.id} className="border border-stone-200 dark:border-stone-700 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm text-stone-800 dark:text-stone-100 truncate">{u.name}{u.surname ? ` ${u.surname}` : ''}</span>
                <button onClick={() => setModalUser(u.id)} className="px-3 min-h-[36px] text-xs rounded-md border border-stone-200 dark:border-stone-700 flex-shrink-0">Permissions</button>
              </div>
              <Counters u={u} />
            </div>
          ))}
        </div>
        {shown.length === 0 && <p className="text-sm text-stone-400 italic py-4 text-center">Нікого не знайдено</p>}
      </Card>

      {modalUser && (
        <UserPermissionsModal userId={modalUser} onClose={() => setModalUser(null)}
          onChanged={load} onOpenUser={onOpenUser} />
      )}
    </>
  );
}

function UserPermissionsModal({ userId, onClose, onChanged }) {
  const { roleName } = useRoles();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState('content');
  const [presets, setPresets] = useState([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [addExpiry, setAddExpiry] = useState({}); // key -> date string draft

  const load = () => apiGet(`/api/admin/users/${userId}/permissions`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); apiGet('/api/admin/permission-presets').then(setPresets).catch(() => {}); }, [userId]);

  const refresh = (d) => { setData(d); onChanged?.(); };

  const grant = async (key, expiresAt) => {
    try { refresh(await apiPost(`/api/admin/users/${userId}/permissions`, { permissionKey: key, expiresAt: expiresAt || null })); }
    catch (e) { setErr(e.message); }
  };
  const revoke = async (key) => {
    try { refresh(await apiDelete(`/api/admin/users/${userId}/permissions/${key}`)); }
    catch (e) { setErr(e.message); }
  };
  const applyPreset = async (p) => {
    if (!(await confirm({ title: `Застосувати «${p.name}»?`, description: `Додасться ${p.permissionKeys.length} permissions цьому користувачу.` }))) return;
    setPresetOpen(false);
    try { refresh(await apiPost(`/api/admin/users/${userId}/apply-preset`, { presetId: p.id })); }
    catch (e) { setErr(e.message); }
  };

  const items = (data?.items || []).filter((i) => i.category === cat);
  const srcLabel = (i) => {
    if (i.fromRole) return `від ролі: ${i.roleKey === 'admin' ? 'admin' : (roleName(i.roleKey) || i.roleKey)}`;
    if (i.individual) {
      const dt = i.grantedAt ? new Date(i.grantedAt).toLocaleDateString('uk-UA') : '';
      const exp = i.expiresAt ? ` · до ${new Date(i.expiresAt).toLocaleDateString('uk-UA')}` : '';
      return `надано ${i.grantedBy || '—'}${dt ? `, ${dt}` : ''}${exp}`;
    }
    return '';
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-stone-200 dark:border-stone-700">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Permissions користувача</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setPresetOpen((v) => !v)} className="px-3 min-h-[40px] text-sm rounded-md border border-stone-200 dark:border-stone-700 hover:border-rose-300">
                Застосувати пресет ▾
              </button>
              {presetOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md shadow-lg z-10 py-1">
                  {presets.length === 0 && <div className="px-3 py-2 text-xs text-stone-400 italic">Пресетів немає</div>}
                  {presets.map((p) => (
                    <button key={p.id} onClick={() => applyPreset(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                      {p.name} <span className="text-xs text-stone-400">({p.permissionKeys.length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex gap-1 px-5 pt-3 flex-wrap">
          {CAT_ORDER.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 min-h-[36px] rounded-md text-xs border ${cat === c ? 'bg-rose-50 text-rose-700 border-rose-200' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}>
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>

        {err && <div className="mx-5 mt-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{err}</div>}

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {!data && <p className="text-sm text-stone-400 italic">Завантаження…</p>}
          {items.map((i) => (
            <div key={i.key} className="border border-stone-200 dark:border-stone-700 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <button
                  disabled={i.fromRole}
                  onClick={() => (i.individual ? revoke(i.key) : grant(i.key, addExpiry[i.key]))}
                  title={i.fromRole ? 'Надано через роль — зніміть роль, щоб прибрати' : ''}
                  className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${i.enabled ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 dark:border-stone-600'} ${i.fromRole ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  {i.enabled && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-stone-800 dark:text-stone-100">{i.name} <code className="text-[10px] text-stone-400">{i.key}</code></div>
                  {i.description && <div className="text-xs text-stone-500 dark:text-stone-400">{i.description}</div>}
                  {i.enabled && <div className="text-[11px] text-stone-400 mt-0.5">({srcLabel(i)})</div>}
                  {!i.enabled && (
                    <div className="flex items-center gap-2 mt-1">
                      <input type="date" value={addExpiry[i.key] || ''} onChange={(e) => setAddExpiry({ ...addExpiry, [i.key]: e.target.value })}
                        className="text-xs border border-stone-200 dark:border-stone-700 rounded px-2 py-1 bg-transparent" />
                      <span className="text-[11px] text-stone-400">термін (необов.)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {data && items.length === 0 && <p className="text-sm text-stone-400 italic">У цій категорії немає прав</p>}
        </div>
      </div>
    </div>
  );
}

function PresetsSubTab() {
  const confirm = useConfirm();
  const [presets, setPresets] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); // {id?, name, description, permissionKeys[]}

  const load = () => apiGet('/api/admin/permission-presets').then(setPresets).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    apiGet('/api/admin/permissions').then((d) => setCatalog(d.permissions || [])).catch(() => {});
  }, []);

  const save = async () => {
    if (!edit.name?.trim()) { setErr('Вкажіть назву'); return; }
    try {
      if (edit.id) await apiPatch(`/api/admin/permission-presets/${edit.id}`, edit);
      else await apiPost('/api/admin/permission-presets', edit);
      setEdit(null); setErr(''); await load();
    } catch (e) { setErr(e.message); }
  };
  const del = async (p) => {
    if (!(await confirm({ title: 'Видалити пресет?', description: `«${p.name}» буде видалено.` }))) return;
    try { await apiDelete(`/api/admin/permission-presets/${p.id}`); await load(); } catch (e) { setErr(e.message); }
  };
  const toggleKey = (k) => setEdit((s) => ({
    ...s,
    permissionKeys: s.permissionKeys.includes(k) ? s.permissionKeys.filter((x) => x !== k) : [...s.permissionKeys, k],
  }));

  if (err && !presets) return <Card className="p-6 text-rose-600 text-sm">{err}</Card>;
  if (!presets) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg text-stone-800 dark:text-stone-100">Пресети ({presets.length})</h3>
        <button onClick={() => { setEdit({ name: '', description: '', permissionKeys: [] }); setErr(''); }}
          className="flex items-center gap-1 px-3 min-h-[40px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
          <Plus className="w-4 h-4" /> Створити
        </button>
      </div>
      {err && <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{err}</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        {presets.map((p) => (
          <div key={p.id} className="border border-stone-200 dark:border-stone-700 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-stone-800 dark:text-stone-100">{p.name}</div>
                {p.description && <div className="text-xs text-stone-500 dark:text-stone-400">{p.description}</div>}
                <div className="text-[11px] text-stone-400 mt-1">{p.permissionKeys.length} permissions</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEdit({ ...p }); setErr(''); }} className="text-xs px-2 py-1 rounded border border-stone-200 dark:border-stone-700">Edit</button>
                <button onClick={() => del(p)} className="w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {presets.length === 0 && <p className="text-sm text-stone-400 italic">Пресетів немає</p>}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setEdit(null)}>
          <div className="bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-lg w-full sm:max-w-lg max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-stone-200 dark:border-stone-700">
              <h3 className="text-lg text-stone-800 dark:text-stone-100">{edit.id ? 'Редагувати пресет' : 'Новий пресет'}</h3>
              <button onClick={() => setEdit(null)} className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Назва"
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent" />
              <input value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Опис (необов.)"
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-transparent" />
              {CAT_ORDER.map((c) => (
                <div key={c}>
                  <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">{CAT_LABEL[c]}</div>
                  <div className="space-y-1">
                    {catalog.filter((p) => p.category === c).map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
                        <input type="checkbox" className="w-4 h-4" checked={edit.permissionKeys.includes(p.key)} onChange={() => toggleKey(p.key)} />
                        {p.name} <code className="text-[10px] text-stone-400">{p.key}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-stone-200 dark:border-stone-700">
              <button onClick={save} className="w-full px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">Зберегти</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


// ============ 📢 ОГОЛОШЕННЯ (admin / HR / content.publish_digest) ============
const ANN_CAT_ICONS = { AlertCircle, Settings: SettingsIcon, Clock, Wrench, Users };

function AnnouncementsTab({ allLocations = [] }) {
  const { roleKeys, roleName } = useRoles();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('active');
  const [catFilter, setCatFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    apiGet('/api/announcements?all=1').then((d) => setItems(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const shown = items.filter((a) => {
    if (filter === 'active' && a.expiresAt && a.expiresAt <= now) return false;
    if (filter === 'expired' && (!a.expiresAt || a.expiresAt > now)) return false;
    if (catFilter !== 'all' && a.category !== catFilter) return false;
    return true;
  });

  const remove = async (a) => {
    const ok = await confirm({ title: 'Видалити оголошення?', description: a.title, confirmLabel: 'Видалити' });
    if (!ok) return;
    await apiDelete(`/api/announcements/${a.id}`).catch((e) => setError(e.message));
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Оголошення ({shown.length})</h3>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Створити оголошення
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {[['active', 'Активні'], ['expired', 'Завершені'], ['all', 'Усі']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1 rounded-full text-xs border transition ${filter === k ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
              {l}
            </button>
          ))}
          <span className="mx-2 self-center text-stone-300">|</span>
          <button onClick={() => setCatFilter('all')}
            className={`px-3 py-1 rounded-full text-xs border transition ${catFilter === 'all' ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
            Усі категорії
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className={`px-3 py-1 rounded-full text-xs border transition ${catFilter === c.key ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
              style={catFilter === c.key ? { background: c.color } : undefined}>
              {c.label}
            </button>
          ))}
        </div>

        {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}

        <div className="space-y-2">
          {shown.map((a) => {
            const c = announcementCategory(a.category);
            const Icon = c ? (ANN_CAT_ICONS[c.iconName] || AlertCircle) : AlertCircle;
            const expired = a.expiresAt && a.expiresAt <= now;
            return (
              <div key={a.id} className={`flex items-start justify-between gap-3 p-3 border rounded ${expired ? 'opacity-60 border-stone-200 dark:border-stone-700' : 'border-stone-200 dark:border-stone-700'}`}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
                    style={{ background: `${c?.color || '#78716c'}1a`, color: c?.color || '#78716c' }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {a.pinned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Закріплено</span>}
                      {a.priority === 'urgent' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white">URGENT</span>}
                      {a.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white">HIGH</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: c?.color || '#78716c' }}>{c?.label || a.category}</span>
                    </div>
                    <div className="text-sm text-stone-800 dark:text-stone-100 truncate">{a.title}</div>
                    <div className="text-xs text-stone-400">
                      {new Date(a.createdAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                      {a.expiresAt && <span> · до {new Date(a.expiresAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(a)} className="w-9 h-9 flex items-center justify-center text-stone-500 hover:text-rose-600" title="Редагувати">
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(a)} className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-rose-600" title="Видалити">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-stone-400 italic py-4 text-center">Немає оголошень</p>}
        </div>
      </Card>

      {editing && (
        <AnnouncementForm
          item={editing === 'new' ? null : editing}
          allLocations={allLocations}
          roleKeys={roleKeys}
          roleName={roleName}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function AnnouncementForm({ item, allLocations, roleKeys, roleName, onClose, onSaved }) {
  const isEdit = !!item?.id;
  const toLocalInput = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [form, setForm] = useState({
    title: item?.title || '',
    body: item?.body || '',
    category: item?.category || ANNOUNCEMENT_CATEGORIES[0].key,
    priority: item?.priority || 'normal',
    pinned: !!item?.pinned,
    expiresAt: toLocalInput(item?.expiresAt),
  });
  const [targetMode, setTargetMode] = useState(() => {
    if ((item?.targetRoles?.length || 0) > 0) return 'roles';
    if ((item?.targetLocations?.length || 0) > 0) return 'locations';
    return 'all';
  });
  const [targetRoles, setTargetRoles] = useState(item?.targetRoles || []);
  const [targetLocations, setTargetLocations] = useState(item?.targetLocations || []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    setError('');
    if (!form.title.trim() || !form.body.trim()) return setError('Заповніть назву та текст');
    if (form.title.length > 100) return setError('Назва — до 100 символів');
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      priority: form.priority,
      pinned: form.pinned,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      targetRoles: targetMode === 'roles' ? targetRoles : [],
      targetLocations: targetMode === 'locations' ? targetLocations : [],
    };
    try {
      if (isEdit) await apiPatch(`/api/announcements/${item.id}`, payload);
      else await apiPost('/api/announcements', payload);
      onSaved?.();
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between sticky top-0 bg-white dark:bg-stone-900 z-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">{isEdit ? 'Редагування' : 'Нове оголошення'}</p>
            <h2 className="text-lg md:text-xl text-stone-800 dark:text-stone-100">{form.title || 'Без назви'}</h2>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Заголовок (до 100 символів)</label>
            <input type="text" maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent" />
            <div className="text-xs text-stone-400 mt-1">{form.title.length}/100</div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Текст</label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={6} placeholder="Markdown підтримується"
              className="w-full p-3 border border-stone-200 dark:border-stone-700 rounded-md bg-transparent" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Категорія</label>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_CATEGORIES.map((c) => {
                const Icon = ANN_CAT_ICONS[c.iconName] || AlertCircle;
                const on = form.category === c.key;
                return (
                  <button key={c.key} type="button" onClick={() => setForm({ ...form, category: c.key })}
                    className={`px-3 min-h-[40px] rounded-full text-sm border transition flex items-center gap-1.5 ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                    style={on ? { background: c.color } : undefined}>
                    <Icon className="w-4 h-4" />{c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Пріоритет</label>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_PRIORITIES.map((p) => {
                const on = form.priority === p.key;
                return (
                  <button key={p.key} type="button" onClick={() => setForm({ ...form, priority: p.key })}
                    className={`px-3 min-h-[40px] rounded-full text-sm border transition ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                    style={on ? { background: p.color } : undefined}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Адресати</label>
            <div className="flex flex-wrap gap-3 mb-2 text-sm text-stone-700 dark:text-stone-200">
              {[['all', 'Усі співробітники'], ['roles', 'Певні ролі'], ['locations', 'Певні локації']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="radio" name="targetMode" checked={targetMode === k} onChange={() => setTargetMode(k)} /> {l}
                </label>
              ))}
            </div>
            {targetMode === 'roles' && (
              <div className="flex flex-wrap gap-1.5">
                {roleKeys.map((rk) => {
                  const on = targetRoles.includes(rk);
                  return (
                    <button key={rk} type="button" onClick={() => toggle(targetRoles, setTargetRoles, rk)}
                      className={`px-3 py-1 rounded-full text-xs border ${on ? 'bg-rose-500 text-white border-rose-500' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
                      {roleName(rk)}
                    </button>
                  );
                })}
              </div>
            )}
            {targetMode === 'locations' && (
              <div className="flex flex-wrap gap-1.5">
                {allLocations.map((l) => {
                  const on = targetLocations.includes(l.id);
                  return (
                    <button key={l.id} type="button" onClick={() => toggle(targetLocations, setTargetLocations, l.id)}
                      className={`px-3 py-1 rounded-full text-xs border ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                      style={on ? { background: l.color || '#a8a29e' } : undefined}>
                      {l.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Завершення</label>
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent" />
              <div className="text-xs text-stone-400 mt-1">Порожньо — без терміну</div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 min-h-[44px]">
                <input type="checkbox" className="w-4 h-4 accent-rose-500" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                Закріпити вгорі
              </label>
            </div>
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>

        <div className="p-4 md:p-6 border-t border-stone-200 dark:border-stone-700 flex gap-2 justify-end sticky bottom-0 bg-white dark:bg-stone-900">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
          <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Збереження…' : isEdit ? 'Зберегти' : 'Опублікувати'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 📋 ЗВІТ ПО ДОКУМЕНТАХ (HR/admin) ============
function DocsReportTab({ onOpenUser }) {
  const [docs, setDocs] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/docs').then((d) => setDocs(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-4">Документи ({docs.length})</h3>
        {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}
        {docs.length === 0 ? (
          <p className="text-sm text-stone-400 italic py-4 text-center">Документів немає</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <DocReportRow key={d.id} doc={d} isOpen={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} onOpenUser={onOpenUser} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function DocReportRow({ doc, isOpen, onToggle, onOpenUser }) {
  const [data, setData] = useState(null);
  const [busyRemind, setBusyRemind] = useState(false);

  useEffect(() => {
    if (!isOpen || data) return;
    apiGet(`/api/docs/${doc.id}/acknowledgements`).then(setData).catch(() => {});
  }, [isOpen]);

  const remind = async (userIds) => {
    if (!userIds.length) return;
    setBusyRemind(true);
    try {
      await apiPost(`/api/docs/${doc.id}/remind`, { userIds });
    } finally { setBusyRemind(false); }
  };

  const stats = data?.stats || { totalMandatory: 0, totalRead: 0, pct: 0 };
  const pctText = stats.totalMandatory ? Math.round(stats.pct * 100) : null;

  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-stone-800 dark:text-stone-100 truncate">{doc.title}</div>
          <div className="text-xs text-stone-400">v{doc.currentVersion} · {doc.isPublished ? 'опубліковано' : 'чернетка'}</div>
        </div>
        {data && (
          <div className="text-xs text-stone-500 dark:text-stone-400 flex-shrink-0 w-28">
            {stats.totalMandatory === 0 ? (
              <span className="italic">не обов'язк.</span>
            ) : (
              <>{pctText}% ({stats.totalRead} з {stats.totalMandatory})</>
            )}
          </div>
        )}
        <div className="w-32 flex-shrink-0 hidden sm:block">
          {data && stats.totalMandatory > 0 && (
            <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded">
              <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${pctText || 0}%` }} />
            </div>
          )}
        </div>
        <Check className={`w-4 h-4 transition ${isOpen ? 'rotate-90 text-rose-500' : 'text-stone-300'}`} />
      </button>

      {isOpen && (
        <div className="border-t border-stone-200 dark:border-stone-700 p-3">
          {!data ? (
            <p className="text-xs text-stone-400 italic">Завантаження…</p>
          ) : stats.totalMandatory === 0 ? (
            <p className="text-xs text-stone-400 italic">Документ не є обов'язковим (без mandatory ролей/локацій)</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Прочитали ({data.read.length})
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {data.read.length === 0 ? <p className="text-xs text-stone-400 italic">Поки нікого</p>
                    : data.read.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between gap-2 text-xs p-2 rounded bg-emerald-50/40 dark:bg-emerald-500/5">
                        <button onClick={() => onOpenUser?.(u.userId)} className="text-stone-700 dark:text-stone-200 hover:text-rose-600 truncate text-left">
                          {u.name}
                        </button>
                        <span className="text-stone-400 flex-shrink-0">{u.acknowledgedAt ? new Date(u.acknowledgedAt).toLocaleDateString('uk-UA') : ''}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-rose-700 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1"><X className="w-3 h-3" /> Не прочитали ({data.unread.length})</span>
                  {data.unread.length > 0 && (
                    <button onClick={() => remind(data.unread.map((u) => u.userId))} disabled={busyRemind}
                      className="text-xs px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-60">
                      {busyRemind ? '…' : 'Нагадати всім'}
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {data.unread.length === 0 ? <p className="text-xs text-stone-400 italic">Усі прочитали 🎉</p>
                    : data.unread.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between gap-2 text-xs p-2 rounded bg-rose-50/40 dark:bg-rose-500/5">
                        <button onClick={() => onOpenUser?.(u.userId)} className="text-stone-700 dark:text-stone-200 hover:text-rose-600 truncate text-left">
                          {u.name}
                          {u.acknowledgedAt && <span className="text-amber-600 ml-1">(стара версія)</span>}
                        </button>
                        <button onClick={() => remind([u.userId])} disabled={busyRemind}
                          className="text-stone-400 hover:text-rose-600 text-[10px] flex-shrink-0 px-1.5 py-0.5 border border-stone-200 dark:border-stone-700 rounded">
                          Нагадати
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ 🎓 LMS: НАВЧАННЯ (admin/HR) ============
function LmsTab({ onOpenCourses, onCreateCourse, onOpenCourse, onOpenQuiz }) {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/courses').then((d) => setCourses(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
  }, []);

  // Підсумкова статистика
  const stats = courses.reduce(
    (acc, c) => {
      acc.total++;
      if (c.isPublished) acc.published++;
      return acc;
    },
    { total: 0, published: 0 }
  );

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Курси ({courses.length})</h3>
          <div className="flex items-center gap-2">
            <button onClick={onOpenCourses} className="text-sm px-3 min-h-[40px] rounded-md border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-rose-600">
              Переглянути каталог
            </button>
            <button onClick={onCreateCourse}
              className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
              <Plus className="w-4 h-4" /> Новий курс
            </button>
          </div>
        </div>
        {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <StatCard label="Усього курсів" value={stats.total} />
          <StatCard label="Опубліковано" value={stats.published} accent="emerald" />
          <StatCard label="Чернеток" value={stats.total - stats.published} accent="amber" />
        </div>

        {courses.length === 0 ? (
          <p className="text-sm text-stone-400 italic py-4 text-center">Курсів ще немає</p>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <LmsCourseRow key={c.id} course={c} onOpen={() => onOpenCourse?.(c.slug)} />
            ))}
          </div>
        )}
      </Card>

      <QuizzesStatsBlock courses={courses} onOpenQuiz={onOpenQuiz} />
    </div>
  );
}

function QuizzesStatsBlock({ courses, onOpenQuiz }) {
  const [quizzes, setQuizzes] = useState([]);
  const [openId, setOpenId] = useState(null);

  // Підвантажуємо quizes для кожного курсу через by-course
  useEffect(() => {
    if (!courses?.length) return;
    Promise.all(courses.map((c) => apiGet(`/api/quizzes/by-course/${c.id}`).catch(() => [])))
      .then((arrs) => {
        const flat = [];
        arrs.forEach((arr, i) => arr.forEach((q) => flat.push({ ...q, _courseTitle: courses[i].title })));
        // плюс finalQuiz курсів (з API не приходить by-course бо finalQuizId не=courseId)
        courses.forEach((c) => {
          if (c.finalQuizId && !flat.find((q) => q.id === c.finalQuizId)) {
            flat.push({ id: c.finalQuizId, title: `Фінальний тест: ${c.title}`, _courseTitle: c.title, _isFinal: true });
          }
        });
        setQuizzes(flat);
      });
  }, [courses?.length]);

  if (quizzes.length === 0) return null;
  return (
    <Card className="p-5 md:p-6">
      <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-4">🎯 Тести ({quizzes.length})</h3>
      <div className="space-y-2">
        {quizzes.map((q) => (
          <QuizStatsRow key={q.id} quiz={q} isOpen={openId === q.id}
            onToggle={() => setOpenId(openId === q.id ? null : q.id)}
            onOpen={() => onOpenQuiz?.(q.id)} />
        ))}
      </div>
    </Card>
  );
}

function QuizStatsRow({ quiz, isOpen, onToggle, onOpen }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!isOpen || data) return;
    apiGet(`/api/quizzes/${quiz.id}/attempts/all`).then(setData).catch(() => {});
  }, [isOpen]);

  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-stone-800 dark:text-stone-100 truncate">{quiz.title}</div>
          <div className="text-xs text-stone-400 truncate">Курс: {quiz._courseTitle}{quiz._isFinal && ' · фінальний'}</div>
        </div>
        {data?.stats && (
          <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-3 flex-shrink-0">
            <span>{data.stats.submittedAttempts} спроб</span>
            <span>{data.stats.passRate}% pass</span>
            <span>сер. {data.stats.avgScore}%</span>
          </div>
        )}
        <button onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          className="text-xs px-2 py-1 rounded border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-rose-600">
          Редагувати
        </button>
      </button>
      {isOpen && (
        <div className="border-t border-stone-200 dark:border-stone-700 p-3">
          {!data ? <p className="text-xs text-stone-400 italic">Завантаження…</p>
            : data.attempts.length === 0 ? <p className="text-xs text-stone-400 italic">Спроб ще немає</p>
            : (
              <div className="space-y-2">
                {data.perQuestion.filter((p) => p.wrongPct >= 60).length > 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                    ⚠️ Питань зі складністю &gt;60% помилок: {data.perQuestion.filter((p) => p.wrongPct >= 60).length}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-stone-400 border-b border-stone-200 dark:border-stone-700">
                        <th className="py-1 pr-2">Юзер</th>
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">Score</th>
                        <th className="py-1 pr-2">Результат</th>
                        <th className="py-1">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attempts.map((a) => (
                        <tr key={a.id} className="border-b border-stone-100 dark:border-stone-800 last:border-0">
                          <td className="py-1 pr-2 text-stone-700 dark:text-stone-200 truncate">{a.user.name}</td>
                          <td className="py-1 pr-2 text-stone-400">{a.attemptNumber}</td>
                          <td className="py-1 pr-2">{a.score ?? '—'}%</td>
                          <td className="py-1 pr-2">
                            {a.submittedAt
                              ? (a.passed ? <span className="text-emerald-700">✓ pass</span> : <span className="text-rose-700">✕ fail</span>)
                              : <span className="text-stone-400">…</span>}
                          </td>
                          <td className="py-1 text-stone-400">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('uk-UA') : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accentCls = accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : 'text-stone-800 dark:text-stone-100';
  return (
    <div className="p-4 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">{label}</div>
      <div className={`text-2xl ${accentCls}`}>{value}</div>
    </div>
  );
}

function LmsCourseRow({ course, onOpen }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    apiGet(`/api/courses/${course.id}/enrollments`).then((list) => {
      const items = Array.isArray(list) ? list : [];
      const total = items.length;
      const done = items.filter((e) => e.status === 'completed').length;
      const inProgress = items.filter((e) => e.status === 'in_progress').length;
      const overdue = items.filter((e) => e.dueAt && e.dueAt < Date.now() && e.status !== 'completed').length;
      setStats({ total, done, inProgress, overdue });
    }).catch(() => {});
  }, [course.id]);

  return (
    <button onClick={onOpen} className="w-full text-left flex items-center gap-3 p-3 border border-stone-200 dark:border-stone-700 rounded hover:border-rose-300 transition">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-stone-800 dark:text-stone-100 truncate">{course.title}</div>
        <div className="text-xs text-stone-400 flex items-center gap-2 flex-wrap">
          {course.isPublished ? <span className="text-emerald-600">опубліковано</span> : <span>чернетка</span>}
          {course.isOnboarding && <span className="text-amber-600">· онбординг</span>}
          <span>· {course.lessonsCount} уроків</span>
          {stats && <span>· {stats.total} призначень</span>}
          {stats?.overdue > 0 && <span className="text-rose-600">· {stats.overdue} прострочених</span>}
        </div>
      </div>
      {stats && stats.total > 0 && (
        <div className="text-xs text-stone-500 dark:text-stone-400 hidden sm:block w-28 flex-shrink-0">
          {Math.round((stats.done / stats.total) * 100)}% ({stats.done} з {stats.total})
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-stone-300" />
    </button>
  );
}

// ============ 🪪 Зайнятість (всередині UserDetailModal) ============
function EmploymentEditor({ user, onSaved }) {
  const toLocalDate = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const [form, setForm] = useState({
    employmentStatus: user.employmentStatus || 'employed',
    internshipStartedAt: toLocalDate(user.internshipStartedAt),
    internshipEndsAt: toLocalDate(user.internshipEndsAt),
    supervisorId: user.supervisorId || '',
    department: user.department || '',
    position: user.position || '',
    hiredAt: toLocalDate(user.hiredAt),
  });
  const [allUsers, setAllUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    apiGet('/api/admin/users').then((d) => setAllUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const save = async () => {
    setError(''); setSuccess(false); setBusy(true);
    try {
      await apiPatch(`/api/admin/users/${user.id}/employment`, {
        employmentStatus: form.employmentStatus,
        internshipStartedAt: form.internshipStartedAt ? new Date(form.internshipStartedAt + 'T00:00').toISOString() : null,
        internshipEndsAt: form.internshipEndsAt ? new Date(form.internshipEndsAt + 'T00:00').toISOString() : null,
        supervisorId: form.supervisorId || null,
        department: form.department || null,
        position: form.position || null,
        hiredAt: form.hiredAt ? new Date(form.hiredAt + 'T00:00').toISOString() : null,
      });
      setSuccess(true);
      onSaved?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const status = employmentStatus(form.employmentStatus);
  const isIntern = form.employmentStatus === 'intern' || form.employmentStatus === 'probation';

  return (
    <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5" /> Зайнятість
        </div>
        <button onClick={() => setScheduleOpen(true)}
          className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center gap-1">
          📅 1:1
        </button>
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Статус</span>
          <select value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
            {EMPLOYMENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <span className="text-[10px] inline-block mt-1 px-1.5 py-0.5 rounded" style={{ color: status.color, background: `${status.color}1a` }}>{status.label}</span>
        </label>

        {isIntern && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Стажування з</span>
              <input type="date" value={form.internshipStartedAt} onChange={(e) => setForm({ ...form, internshipStartedAt: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">До</span>
              <input type="date" value={form.internshipEndsAt} onChange={(e) => setForm({ ...form, internshipEndsAt: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
            </label>
          </div>
        )}

        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Керівник</span>
          <select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
            <option value="">— Не вказано —</option>
            {allUsers.filter((x) => x.id !== user.id).map((x) => (
              <option key={x.id} value={x.id}>{x.name}{x.surname ? ' ' + x.surname : ''}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Посада</span>
            <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Відділ</span>
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Дата прийому</span>
          <input type="date" value={form.hiredAt} onChange={(e) => setForm({ ...form, hiredAt: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
        </label>
        {error && <div className="p-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded">{error}</div>}
        {success && <div className="p-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded">Збережено</div>}
        <button onClick={save} disabled={busy}
          className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Збереження…' : 'Зберегти зайнятість'}
        </button>
      </div>
      {scheduleOpen && (
        <ScheduleOOModal employee={user} onClose={() => setScheduleOpen(false)} onCreated={() => setScheduleOpen(false)} />
      )}
    </div>
  );
}

// ============ 📅 1:1 ЗУСТРІЧІ (вкладка) ============
function OneOnOnesTab({ onOpenUser }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('upcoming'); // upcoming | all | completed | cancelled
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filter === 'upcoming') params.set('upcoming', 'true');
    else if (['completed', 'cancelled', 'scheduled'].includes(filter)) params.set('status', filter);
    apiGet(`/api/one-on-ones/admin?${params}`).then((d) => setItems(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => { apiGet('/api/admin/users').then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Зустрічі ({items.length})</h3>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Запланувати
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[['upcoming', 'Майбутні'], ['scheduled', 'Заплановано'], ['completed', 'Завершено'], ['cancelled', 'Скасовано'], ['all', 'Усі']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1 rounded-full text-xs border transition ${filter === k ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
              {l}
            </button>
          ))}
        </div>
        {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-stone-400 italic py-4 text-center">Зустрічей немає</p>
          ) : items.map((o) => <OOItemRow key={o.id} oo={o} onOpenUser={onOpenUser} onEdit={() => setEditing(o)} onChange={load} />)}
        </div>
      </Card>

      {createOpen && (
        <OOEditorModal users={users} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {editing && (
        <OOEditorModal oo={editing} users={users} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function OOItemRow({ oo, onOpenUser, onEdit, onChange }) {
  const confirm = useConfirm();
  const date = new Date(oo.scheduledAt);
  const isPast = oo.scheduledAt < Date.now();
  const statusCls = oo.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
    : oo.status === 'cancelled' ? 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
    : isPast ? 'bg-amber-100 text-amber-800'
    : 'bg-blue-100 text-blue-700';
  const statusLabel = oo.status === 'completed' ? 'Завершено'
    : oo.status === 'cancelled' ? 'Скасовано'
    : isPast ? 'Прострочена' : 'Заплановано';

  const cancel = async () => {
    const ok = await confirm({ title: 'Скасувати зустріч?', confirmLabel: 'Скасувати' });
    if (!ok) return;
    await apiDelete(`/api/one-on-ones/${oo.id}`);
    onChange?.();
  };

  return (
    <div className="p-3 border border-stone-200 dark:border-stone-700 rounded flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm text-stone-800 dark:text-stone-100">
            {date.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCls}`}>{statusLabel}</span>
          <span className="text-xs text-stone-400">{oo.duration} хв</span>
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 flex-wrap">
          {oo.employee && (
            <button onClick={() => onOpenUser?.(oo.employee.id)} className="hover:text-rose-600 truncate">
              <b>{oo.employee.name}</b>
            </button>
          )}
          <span>↔</span>
          {oo.organizer && (
            <button onClick={() => onOpenUser?.(oo.organizer.id)} className="hover:text-rose-600 truncate">
              {oo.organizer.name}
            </button>
          )}
          {oo.location && <span>· {oo.location}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="px-2 min-h-[36px] text-xs text-stone-600 dark:text-stone-300 hover:text-rose-600 rounded border border-stone-200 dark:border-stone-700">
          Деталі
        </button>
        {oo.status === 'scheduled' && (
          <button onClick={cancel} className="px-2 min-h-[36px] text-xs text-rose-600 hover:bg-rose-50 rounded border border-rose-200">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function OOEditorModal({ oo, users = [], onClose, onSaved }) {
  const isEdit = !!oo?.id;
  const toLocalInput = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
  const [form, setForm] = useState({
    employeeId: oo?.employeeId || '',
    organizerId: oo?.organizerId || '',
    scheduledAt: toLocalInput(oo?.scheduledAt || tomorrow.getTime()),
    duration: oo?.duration || 30,
    location: oo?.location || '',
    agenda: oo?.agenda || '',
    notes: oo?.notes || '',
    status: oo?.status || 'scheduled',
    outcome: oo?.outcome || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!form.employeeId || !form.scheduledAt) return setError('Виберіть співробітника і дату');
    setBusy(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/one-on-ones/${oo.id}`, {
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          duration: parseInt(form.duration, 10) || 30,
          location: form.location || null,
          agenda: form.agenda || null,
          notes: form.notes || null,
          status: form.status,
          outcome: form.outcome || null,
        });
      } else {
        await apiPost('/api/one-on-ones', {
          employeeId: form.employeeId,
          organizerId: form.organizerId || undefined,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          duration: parseInt(form.duration, 10) || 30,
          location: form.location || null,
          agenda: form.agenda || null,
        });
      }
      onSaved?.();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await apiPost(`/api/one-on-ones/${oo.id}/complete`, { notes: form.notes || null, outcome: form.outcome || null });
      onSaved?.();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">{isEdit ? 'Зустріч 1:1' : 'Запланувати 1:1'}</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-stone-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 md:p-6 space-y-3 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {!isEdit && (
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Співробітник</span>
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
                <option value="">— Виберіть —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.surname ? ' ' + u.surname : ''}</option>)}
              </select>
            </label>
          )}
          {isEdit && oo.employee && (
            <div className="text-sm text-stone-700 dark:text-stone-200">
              Зустріч з <b>{oo.employee.name}{oo.employee.surname ? ' ' + oo.employee.surname : ''}</b>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Дата і час</span>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Тривалість, хв</span>
              <input type="number" min={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Локація</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Порядок денний (markdown)</span>
            <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={3}
              className="w-full p-3 border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
          </label>
          {isEdit && (
            <>
              {oo?.employeeNotes && (
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  <div className="uppercase tracking-wider mb-1">Нотатки працівника</div>
                  <div className="p-2 bg-stone-50 dark:bg-stone-800 rounded">{oo.employeeNotes}</div>
                </div>
              )}
              <label className="block">
                <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Нотатки HR (приватні)</span>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full p-3 border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100" />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Результат</span>
                <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                  className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
                  <option value="">— Не вказано —</option>
                  {OO_OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </label>
            </>
          )}
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>
        <div className="p-4 md:p-6 border-t border-stone-200 dark:border-stone-700 flex justify-end gap-2 flex-wrap">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
          {isEdit && oo.status === 'scheduled' && (
            <button onClick={complete} disabled={busy} className="px-4 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm">
              Позначити завершеною
            </button>
          )}
          <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? '…' : isEdit ? 'Зберегти' : 'Запланувати'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Локальна обгортка для модалки запланування з UserDetail.
function ScheduleOOModal({ employee, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  useEffect(() => { apiGet('/api/admin/users').then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {}); }, []);
  return <OOEditorModal oo={{ employeeId: employee.id, employee }} users={users} onClose={onClose} onSaved={onCreated} />;
}

// ============ HR-картки на дашборді ============
function HrInsightsCards({ onJump }) {
  const [interns, setInterns] = useState([]);
  const [todayOOs, setTodayOOs] = useState([]);
  const [overdueCourses, setOverdueCourses] = useState([]);

  useEffect(() => {
    apiGet('/api/admin/users').then((users) => {
      const list = (Array.isArray(users) ? users : []).filter((u) => u.employmentStatus === 'intern' || u.employmentStatus === 'probation');
      setInterns(list);
    }).catch(() => {});

    apiGet('/api/one-on-ones/admin?upcoming=true').then((d) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = today.getTime() + 86400e3;
      setTodayOOs((Array.isArray(d) ? d : []).filter((o) => o.scheduledAt >= today.getTime() && o.scheduledAt < tomorrow));
    }).catch(() => {});

    apiGet('/api/admin/users').then(async (users) => {
      // Завантажимо list of overdue enrollments
      const all = await apiGet('/api/courses').catch(() => []);
      const list = [];
      for (const c of (Array.isArray(all) ? all : [])) {
        if (!c.isPublished) continue;
        try {
          const enrs = await apiGet(`/api/courses/${c.id}/enrollments`);
          for (const e of (Array.isArray(enrs) ? enrs : [])) {
            if (e.dueAt && e.dueAt < Date.now() && e.status !== 'completed') {
              list.push({ ...e, courseTitle: c.title, courseSlug: c.slug });
            }
          }
        } catch { /* ignore */ }
      }
      setOverdueCourses(list);
    }).catch(() => {});
  }, []);

  if (interns.length === 0 && todayOOs.length === 0 && overdueCourses.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {interns.length > 0 && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1.5">
            🎓 Стажери ({interns.length})
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {interns.map((u) => {
              const total = u.internshipStartedAt && u.internshipEndsAt ? (u.internshipEndsAt - u.internshipStartedAt) : 0;
              const passed = u.internshipStartedAt ? Math.max(0, Date.now() - u.internshipStartedAt) : 0;
              const pct = total ? Math.min(100, Math.round((passed / total) * 100)) : 0;
              const daysLeft = u.internshipEndsAt ? Math.max(0, Math.ceil((u.internshipEndsAt - Date.now()) / 86400e3)) : null;
              return (
                <div key={u.id} className="text-xs">
                  <div className="text-stone-700 dark:text-stone-200 truncate">{u.name}{u.surname ? ' ' + u.surname : ''}</div>
                  <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded mt-0.5">
                    <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: '#f59e0b' }} />
                  </div>
                  {daysLeft != null && (
                    <div className="text-[10px] text-stone-400 mt-0.5">{daysLeft === 0 ? 'Сьогодні' : `${daysLeft} дн.`}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {todayOOs.length > 0 && (
        <Card className="p-4">
          <button onClick={() => onJump('oneOnOnes')} className="w-full text-left">
            <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              📅 Сьогодні зустрічей: {todayOOs.length}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {todayOOs.map((o) => (
                <div key={o.id} className="text-xs flex items-center gap-2">
                  <span className="text-stone-500 dark:text-stone-400">{new Date(o.scheduledAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-stone-700 dark:text-stone-200 truncate">{o.employee?.name}</span>
                </div>
              ))}
            </div>
          </button>
        </Card>
      )}

      {overdueCourses.length > 0 && (
        <Card className="p-4 border-rose-200 dark:border-rose-500/30">
          <div className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2">
            ⚠️ Прострочено курсів: {overdueCourses.length}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {overdueCourses.slice(0, 6).map((e) => (
              <div key={e.id} className="text-xs">
                <div className="text-stone-700 dark:text-stone-200 truncate">{e.user?.name}</div>
                <div className="text-[10px] text-stone-400 truncate">{e.courseTitle}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
