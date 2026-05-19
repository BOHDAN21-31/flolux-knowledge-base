import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, MapPin, Inbox, BookOpen, MessageSquare, ScrollText,
  Shield, Plus, Trash2, X, Search, ChevronRight, FileText,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { useRoles } from '../RolesContext';
import { TOPIC_ICON_NAMES, iconFor } from '../icons';
import Stars from '../Stars';

const fmtDate = (ms) => new Date(ms).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });

const NAV = [
  { key: 'dashboard', label: 'Огляд', icon: LayoutDashboard },
  { key: 'users', label: 'Користувачі', icon: Users },
  { key: 'locations', label: 'Локації', icon: MapPin },
  { key: 'requests', label: 'Запити', icon: Inbox },
  { key: 'content', label: 'Контент', icon: BookOpen },
  { key: 'topics', label: 'Розділи', icon: FileText },
  { key: 'roles', label: 'Ролі', icon: Shield },
  { key: 'moderation', label: 'Модерація', icon: MessageSquare },
  { key: 'audit', label: 'Журнал дій', icon: ScrollText },
];

export default function AdminPanel({ topicsMap, reloadTopics, articles, allLocations, reloadLocations, reloadArticles, tab: tabProp, onTab }) {
  const tab = tabProp || 'dashboard';
  const setTab = (t) => onTab?.(t);

  return (
    <div>
      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-200">
          <Shield className="w-6 h-6 text-rose-500" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Управління системою</p>
          <h1 className="text-2xl md:text-3xl text-stone-800">Адмін-панель</h1>
        </div>
      </div>

      {/* Mobile: горизонтальний скрол-таб (sticky) */}
      <div className="md:hidden -mx-4 px-4 mb-4 sticky top-[60px] z-20 bg-stone-50/95 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto scroll-touch py-2" style={{ scrollSnapType: 'x proximity' }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setTab(n.key)} style={{ scrollSnapAlign: 'start' }}
              className={`flex items-center gap-2 px-3 min-h-[44px] rounded-md text-sm whitespace-nowrap flex-shrink-0 transition ${tab === n.key ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-stone-600 bg-white border border-stone-200'}`}>
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
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition ${tab === n.key ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-stone-600 hover:bg-stone-100 border border-transparent'}`}>
                <n.icon className="w-4 h-4" />{n.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {tab === 'dashboard' && <Dashboard onJump={setTab} />}
          {tab === 'users' && <UsersTab allLocations={allLocations} />}
          {tab === 'locations' && <LocationsTab allLocations={allLocations} reloadLocations={reloadLocations} />}
          {tab === 'requests' && <RequestsTab reloadLocations={reloadLocations} />}
          {tab === 'content' && (
            <ContentTab articles={articles} topicsMap={topicsMap} allLocations={allLocations}
              reloadArticles={reloadArticles} />
          )}
          {tab === 'topics' && <TopicsTab topicsMap={topicsMap} reloadTopics={reloadTopics} />}
          {tab === 'roles' && <RolesTab />}
          {tab === 'moderation' && <ModerationTab articles={articles} />}
          {tab === 'audit' && <AuditTab />}
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-stone-200 rounded-lg ${className}`}>{children}</div>;
}

// ============ ОГЛЯД ============
function Dashboard({ onJump }) {
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
    { label: 'Користувачів', value: s.usersTotal, hint: `${s.usersPending} очікують`, to: 'users' },
    { label: 'Статей', value: s.articles, to: 'content' },
    { label: 'Коментарів', value: s.comments },
    { label: 'Пропозицій на модерації', value: s.suggestionsPending, to: 'moderation' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stat.map((c) => (
          <button key={c.label} onClick={() => c.to && onJump(c.to)} disabled={!c.to}
            className="text-left bg-white border border-stone-200 rounded-lg p-5 disabled:cursor-default hover:enabled:border-rose-300 transition">
            <div className="text-3xl text-stone-800">{c.value}</div>
            <div className="text-sm text-stone-500 mt-1">{c.label}</div>
            {c.hint && <div className="text-xs text-amber-600 mt-1">{c.hint}</div>}
          </button>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 mb-4">Користувачі за ролями</h3>
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
        <h3 className="text-sm uppercase tracking-wider text-stone-500 mb-4">Реєстрації за 30 днів</h3>
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
        <h3 className="text-sm uppercase tracking-wider text-stone-500 mb-4">Останні дії</h3>
        {s.recentAudit.length === 0 ? (
          <p className="text-sm text-stone-400 italic">Журнал порожній</p>
        ) : (
          <div className="space-y-2">
            {s.recentAudit.map((a) => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-sm border-b border-stone-100 last:border-0 pb-2 last:pb-0">
                <span className="text-stone-700 break-words"><b className="text-stone-900">{a.actorName}</b> · <code className="text-xs text-rose-600">{a.action}</code> · {a.targetType}</span>
                <span className="text-xs text-stone-400 flex-shrink-0">{fmtDate(a.createdAt)}</span>
              </div>
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
          <button onClick={() => setAdding(true)} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 hover:border-rose-400 hover:text-rose-600 flex items-center gap-1">
            <Plus className="w-3 h-3" />роль
          </button>
        )
      )}
    </div>
  );
}

function UsersTab({ allLocations }) {
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
  const setApproved = async (id, approved) => { await apiPatch(`/api/admin/users/${id}`, { approved }); await load(); };
  const delUser = async (id) => {
    if (!window.confirm('Видалити користувача? Дію не можна скасувати.')) return;
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
    if (action === 'delete' && !window.confirm(`Видалити ${sel.size} користувач(ів)?`)) return;
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
            className="w-full pl-10 pr-3 py-2 border border-stone-200 rounded-md text-sm" />
        </div>
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-md text-sm">
          <option value="">Усі ролі</option>
          {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-md text-sm">
          <option value="">Будь-який статус</option>
          <option value="pending">Очікують</option>
          <option value="approved">Підтверджені</option>
        </select>
        <select value={fLoc} onChange={(e) => setFLoc(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-md text-sm">
          <option value="">Усі локації</option>
          {allLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Card>

      {sel.size > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-md px-4 py-2 text-sm">
          <span className="text-stone-700">Вибрано: {sel.size}</span>
          <button onClick={() => bulk('approve')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Підтвердити вибраних</button>
          <button onClick={() => bulk('delete')} className="px-3 py-1 bg-rose-500 text-white rounded text-xs">Видалити</button>
          <button onClick={() => setSel(new Set())} className="text-stone-500 text-xs ml-auto">Скинути</button>
        </div>
      )}

      {/* Desktop: таблиця */}
      <Card className="overflow-hidden hidden md:block">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Користувач</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Ролі</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Статус</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                <td className="px-4 py-3"><input type="checkbox" checked={sel.has(u.id)} onChange={() => toggleSel(u.id)} /></td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => setDetail(u.id)} style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <div className="text-sm text-stone-800">{u.name}{u.surname ? ` ${u.surname}` : ''}</div>
                  <div className="text-xs text-stone-500">{u.email}</div>
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
                    {u.approved && !u.roles?.includes('admin') && <button onClick={() => setApproved(u.id, false)} className="text-xs px-3 py-1 bg-stone-100 text-stone-700 rounded">Заблокувати</button>}
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
                <div className="text-sm text-stone-800">{u.name}{u.surname ? ` ${u.surname}` : ''}</div>
                <div className="text-xs text-stone-500 break-all">{u.email}</div>
                {u.requestedRole && <div className="text-xs text-stone-400">бажана: {roleName(u.requestedRole)}</div>}
              </button>
              {u.approved
                ? <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex-shrink-0">Підтв.</span>
                : <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200 flex-shrink-0">Очікує</span>}
            </div>
            <div className="mt-3"><RoleChips user={u} onAdd={addRole} onRemove={removeRole} /></div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex gap-2">
              {!u.approved && <button onClick={() => setApproved(u.id, true)} className="flex-1 min-h-[44px] text-sm bg-emerald-500 text-white rounded">Підтвердити</button>}
              {u.approved && !u.roles?.includes('admin') && <button onClick={() => setApproved(u.id, false)} className="flex-1 min-h-[44px] text-sm bg-stone-100 text-stone-700 rounded">Заблокувати</button>}
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
  const [u, setU] = useState(null);
  useEffect(() => { apiGet(`/api/admin/users/${id}`).then(setU).catch((e) => console.error(e)); }, [id]);

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4" onClick={onClose}>
      <div className="bg-white w-full h-full md:h-auto md:max-w-lg md:max-h-[85vh] overflow-y-auto rounded-none md:rounded-lg p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky -top-5 md:-top-6 bg-white py-2 -my-2">
          <h3 className="text-xl text-stone-800">Деталі користувача</h3>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>
        {!u ? <p className="text-stone-400 italic">Завантаження…</p> : (
          <div className="space-y-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div>
              <div className="text-lg text-stone-800">{u.name}{u.surname ? ` ${u.surname}` : ''}</div>
              <div className="text-sm text-stone-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Ролі</div>
              <div className="flex flex-wrap gap-1.5">
                {(u.roles || []).map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded-full border" style={roleChipStyle(r)}>{roleName(r)}</span>)}
                {(u.roles || []).length === 0 && <span className="text-xs text-stone-400 italic">немає</span>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Локації</div>
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
              <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Статті ({u.articles?.length || 0})</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(u.articles || []).map((a) => (
                  <div key={a.id} className="text-sm text-stone-700 flex items-center gap-2"><FileText className="w-3 h-3 text-stone-400" />{a.title}</div>
                ))}
                {(u.articles || []).length === 0 && <span className="text-xs text-stone-400 italic">немає</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ ЛОКАЦІЇ ============
const PRESET_CITIES = ['Київ', 'Львів', 'Івано-Франківськ', 'Рівне'];

function LocationsTab({ allLocations, reloadLocations }) {
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
    if (!window.confirm('Видалити локацію?')) return;
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
          <h3 className="text-lg text-stone-800">Локації ({allLocations.length})</h3>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Додати
          </button>
        </div>
        {error && <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        {allLocations.length === 0 && <p className="text-sm text-stone-400 italic">Локацій ще немає</p>}
        <div className="space-y-5">
          {Object.entries(grouped).map(([city, locs]) => (
            <div key={city}>
              <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">{city}</div>
              <div className="space-y-2">
                {locs.map((l) => (
                  <div key={l.id} className={`border rounded ${l.active === false ? 'border-stone-200 bg-stone-50 opacity-70' : 'border-stone-200'}`}>
                    <div className="flex items-center justify-between p-3 gap-2">
                      <button onClick={() => (openId === l.id ? setOpenId(null) : openLocation(l.id))} className="flex items-center gap-2 text-left min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color || '#a8a29e' }} />
                        <span className="text-sm text-stone-800 truncate">{l.name}</span>
                        <span className="text-xs text-stone-400 flex-shrink-0">{l.userCount} люд.</span>
                        <ChevronRight className={`w-4 h-4 text-stone-300 transition flex-shrink-0 ${openId === l.id ? 'rotate-90' : ''}`} />
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => toggleActive(l)} title={l.active === false ? 'Активувати' : 'Деактивувати'}
                          className={`px-2 min-h-[36px] rounded text-xs border ${l.active === false ? 'border-stone-300 text-stone-500' : 'border-emerald-300 text-emerald-700 bg-emerald-50'}`}>
                          {l.active === false ? 'Неактивна' : 'Активна'}
                        </button>
                        <button onClick={() => removeLocation(l.id)} className="w-9 h-9 flex items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {openId === l.id && (
                      <div className="border-t border-stone-100 p-3 bg-stone-50">
                        {l.address && <div className="text-xs text-stone-500 mb-2">{l.address}</div>}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-wider text-stone-500">Працівники</span>
                          <button onClick={openAssign} className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"><Plus className="w-3 h-3" />Призначити</button>
                        </div>
                        {workers.length === 0 ? <p className="text-sm text-stone-400 italic">Немає працівників</p> : workers.map((w) => (
                          <div key={w.userLocationId} className="flex items-center justify-between py-1.5 text-sm">
                            <span>{w.name}{w.surname ? ` ${w.surname}` : ''} {w.isManager && <span className="text-xs text-purple-600">· керівник</span>} {!w.approved && <span className="text-xs text-amber-600">· очікує</span>}</span>
                            <button onClick={() => detach(w.userId)} className="text-xs text-stone-500 hover:text-rose-600">Зняти</button>
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
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md p-5 sm:p-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-stone-800" style={{ fontFamily: 'Georgia, serif' }}>Додати локацію</h3>
              <button onClick={() => setAddOpen(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Назва" className="w-full px-3 min-h-[44px] border border-stone-200 rounded-md text-sm" />
              <select value={form.cityPreset} onChange={(e) => setForm({ ...form, cityPreset: e.target.value })} className="w-full px-3 min-h-[44px] border border-stone-200 rounded-md text-sm">
                {PRESET_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="other">Інше місто…</option>
              </select>
              {form.cityPreset === 'other' && (
                <input value={form.cityOther} onChange={(e) => setForm({ ...form, cityOther: e.target.value })} placeholder="Назва міста" className="w-full px-3 min-h-[44px] border border-stone-200 rounded-md text-sm" />
              )}
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Адреса (необов.)" className="w-full px-3 min-h-[44px] border border-stone-200 rounded-md text-sm" />
              <label className="flex items-center gap-3 text-sm text-stone-600">
                Колір <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-16 border border-stone-200 rounded-md" />
              </label>
              {error && <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
              <button onClick={addLocation} className="w-full px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">Додати локацію</button>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-stone-800">Призначити користувача</h3>
              <button onClick={() => setAssignOpen(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <select value={assign.userId} onChange={(e) => setAssign({ ...assign, userId: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 rounded-md mb-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <option value="">— оберіть користувача —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.surname ? ` ${u.surname}` : ''} ({u.email})</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-stone-600 mb-4 min-h-[44px]">
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
        <h3 className="text-lg text-stone-800 mb-4">Запити на локації ({locReqs.length})</h3>
        {locReqs.length === 0 ? <p className="text-sm text-stone-400 italic">Немає запитів</p> : (
          <div className="space-y-3">
            {locReqs.map((r) => (
              <div key={r.id} className="p-4 bg-stone-50 rounded border border-stone-200 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-stone-800">{r.userName}</span><span className="text-stone-400"> → </span>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: r.locationColor || '#a8a29e' }} />{r.locationName}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decideLoc(r.id, 'approved')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Прийняти</button>
                  <button onClick={() => decideLoc(r.id, 'rejected')} className="px-3 py-1 bg-stone-200 text-stone-700 rounded text-xs">Відхилити</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg text-stone-800 mb-4">Запити на ролі ({roleReqs.length})</h3>
        {roleReqs.length === 0 ? <p className="text-sm text-stone-400 italic">Немає запитів</p> : (
          <div className="space-y-3">
            {roleReqs.map((r) => (
              <div key={r.userId} className="p-4 bg-stone-50 rounded border border-stone-200 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-stone-800">{r.userName}</span> <span className="text-xs text-stone-500">({r.email})</span>
                  <span className="text-stone-400"> → </span><span className="text-stone-700">{roleName(r.requestedRole)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveRole(r)} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">Підтвердити + роль</button>
                  <button onClick={() => rejectRole(r)} className="px-3 py-1 bg-stone-200 text-stone-700 rounded text-xs">Відхилити</button>
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
  const { roleName, roleKeys, roleChipStyle } = useRoles();
  const allTopics = useMemo(() => Object.values(topicsMap).flat(), [topicsMap]);
  const topicById = useMemo(() => Object.fromEntries(allTopics.map((t) => [t.id, t])), [allTopics]);
  const topicRole = (a) => topicById[a.topicId]?.roleKey || '—';

  const [fRole, setFRole] = useState('');
  const [fLoc, setFLoc] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());
  const [moveTopic, setMoveTopic] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);

  const filtered = articles.filter((a) => {
    if (fRole && topicRole(a) !== fRole) return false;
    if (fLoc && !(a.locations || []).some((l) => l.locationId === fLoc)) return false;
    if (q && !(`${a.title} ${a.authorName || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkDelete = async () => {
    if (sel.size === 0 || !window.confirm(`Видалити ${sel.size} статей?`)) return;
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за назвою / автором" className="w-full pl-10 pr-3 py-2 border border-stone-200 rounded-md text-sm" />
        </div>
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-md text-sm">
          <option value="">Усі ролі</option>
          {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
        </select>
        <select value={fLoc} onChange={(e) => setFLoc(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-md text-sm">
          <option value="">Усі локації</option>
          {allLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={() => setPublishOpen(true)} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" />Опублікувати статтю
        </button>
      </Card>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-rose-50 border border-rose-200 rounded-md px-4 py-2 text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <span className="text-stone-700">Вибрано: {sel.size}</span>
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
          <button onClick={() => setSel(new Set())} className="text-stone-500 text-xs ml-auto">Скинути</button>
        </div>
      )}

      {/* Desktop: таблиця */}
      <Card className="overflow-hidden hidden md:block">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Стаття</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Роль</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Локації</th>
              <th className="text-left text-xs uppercase tracking-wider text-stone-500 px-4 py-3">Автор</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                <td className="px-4 py-3"><input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} /></td>
                <td className="px-4 py-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <div className="text-sm text-stone-800">{a.title}</div>
                  <div className="text-xs text-stone-400">{new Date(a.createdAt).toLocaleDateString('uk-UA')}</div>
                </td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full border" style={roleChipStyle(topicRole(a))}>{roleName(topicRole(a))}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(a.locations || []).length === 0 ? <span className="text-xs text-stone-400 italic">усі</span> :
                      a.locations.map((l) => <span key={l.locationId} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ background: l.color || '#a8a29e' }}>{l.name}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-stone-600" style={{ fontFamily: 'system-ui, sans-serif' }}>{a.authorName || '—'}</td>
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
                <div className="text-sm text-stone-800">{a.title}</div>
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
      <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg md:text-xl text-stone-800">Опублікувати статтю</h2>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Роль</label>
              <select value={role} onChange={(e) => { setRole(e.target.value); setTopicId(''); }} className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm">
                {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Розділ</label>
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm">
                <option value="">— оберіть розділ —</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Заголовок" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} placeholder="Текст статті. **жирний** підтримується." className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" />
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Теги через кому" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" />
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Локації <span className="normal-case text-stone-400">(порожньо = усі)</span></label>
            <div className="flex flex-wrap gap-2">
              {allLocations.map((l) => {
                const on = locationIds.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLoc(l.id)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${on ? 'text-white border-transparent' : 'text-stone-600 border-stone-300 bg-white'}`}
                    style={on ? { background: l.color || '#a8a29e' } : undefined}>{l.name}</button>
                );
              })}
            </div>
          </div>
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>
        <div className="p-4 md:p-6 border-t border-stone-200 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 text-stone-700 rounded-md text-sm">Скасувати</button>
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
            className={`aspect-square flex items-center justify-center rounded-md border transition ${on ? 'bg-rose-50 border-rose-400 text-rose-600' : 'border-stone-200 text-stone-500 hover:border-rose-300'}`}>
            <Ico className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

function TopicsTab({ topicsMap, reloadTopics }) {
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
    if (!window.confirm('Видалити розділ?')) return;
    await apiDelete(`/api/topics/${id}`);
    await reloadTopics();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800">Розділи знань</h3>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-md text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {roleKeys.map((k) => <option key={k} value={k}>{roleName(k)}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {list.map((t) => {
            const Ico = iconFor(t.icon);
            return editId === t.id ? (
              <div key={t.id} className="p-3 border border-rose-200 rounded bg-rose-50/40 space-y-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded text-sm" placeholder="Назва" />
                <input value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded text-sm" placeholder="Опис" />
                <IconPicker value={editDraft.icon} onChange={(ic) => setEditDraft({ ...editDraft, icon: ic })} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm">Зберегти</button>
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded text-sm">Скасувати</button>
                </div>
              </div>
            ) : (
              <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 rounded">
                <div className="flex items-center gap-3">
                  <Ico className="w-5 h-5 text-stone-500" />
                  <div>
                    <div className="text-sm text-stone-800">{t.title}</div>
                    <div className="text-xs text-stone-500 italic">{t.description}</div>
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

        <div className="mt-5 pt-5 border-t border-stone-100 space-y-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <p className="text-xs uppercase tracking-wider text-stone-500">Новий розділ</p>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Назва розділу" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" />
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Опис" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" />
          <div>
            <p className="text-xs text-stone-500 mb-1.5">Іконка {draft.icon && <span className="text-rose-600">· {draft.icon}</span>}</p>
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
    if (!window.confirm(`Видалити роль «${r.name}»?`)) return;
    try { await apiDelete(`/api/admin/roles/${r.key}`); await reload(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800">Ролі ({roles.length})</h3>
          <button onClick={openNew} className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Створити роль
          </button>
        </div>
        <div className="space-y-2">
          {roles.map((r) => {
            const Ico = iconFor(r.iconKey, Shield);
            return (
              <div key={r.key} className="flex items-center justify-between gap-3 p-3 border border-stone-200 rounded">
                <button onClick={() => openEdit(r)} className="flex items-center gap-3 text-left min-w-0">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center border flex-shrink-0"
                    style={{ background: `${r.color || '#a8a29e'}1A`, color: r.color || '#78716c', borderColor: `${r.color || '#a8a29e'}55` }}>
                    <Ico className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm text-stone-800 flex items-center gap-2 flex-wrap">
                      {r.name} <code className="text-xs text-stone-400">{r.key}</code>
                      {r.restricted && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">обмежена</span>}
                    </span>
                    {r.description && <span className="block text-xs text-stone-500 truncate">{r.description}</span>}
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
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] rounded-none sm:rounded-lg flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 sticky top-0 bg-white">
              <h3 className="text-lg text-stone-800" style={{ fontFamily: 'Georgia, serif' }}>{editing.__new ? 'Нова роль' : `Редагування: ${editing.name}`}</h3>
              <button onClick={() => setEditing(null)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Назва ролі" className="w-full px-3 min-h-[44px] border border-stone-200 rounded-md text-sm" />
              {editing.__new && form.name && (
                <p className="text-xs text-stone-400">Ключ: <code>{form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || '—'}</code></p>
              )}
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Опис" className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm" />
              <label className="flex items-center gap-3 text-sm text-stone-600">
                Колір <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-16 border border-stone-200 rounded-md" />
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 min-h-[44px]">
                <input type="checkbox" className="w-4 h-4" checked={form.restricted} onChange={(e) => setForm({ ...form, restricted: e.target.checked })} />
                Обмежений доступ (контент бачать лише призначені)
              </label>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Іконка {form.iconKey && <span className="text-rose-600">· {form.iconKey}</span>}</p>
                <IconPicker value={form.iconKey} onChange={(ic) => setForm({ ...form, iconKey: ic })} />
              </div>
              {error && <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
            </div>
            <div className="p-4 sm:p-5 border-t border-stone-200 flex gap-2 justify-end sticky bottom-0 bg-white">
              <button onClick={() => setEditing(null)} className="px-4 min-h-[44px] bg-stone-100 text-stone-700 rounded-md text-sm">Скасувати</button>
              <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">{busy ? 'Збереження…' : 'Зберегти'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModerationTab({ articles }) {
  const { roleName } = useRoles();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/suggestions?status=pending').then(setPending).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, []);

  const decide = async (id, status) => {
    await apiPatch(`/api/suggestions/${id}`, { status });
    setPending((p) => p.filter((s) => s.id !== id));
  };

  if (loading) return <Card className="p-8 text-center text-stone-400 italic">Завантаження…</Card>;

  return (
    <Card className="p-6">
      <h3 className="text-lg text-stone-800 mb-4">Пропозиції на модерацію ({pending.length})</h3>
      {pending.length === 0 ? <p className="text-sm text-stone-400 italic">Усі пропозиції розглянуті</p> : (
        <div className="space-y-3">
          {pending.map((s) => {
            const article = articles.find((a) => a.id === s.articleId);
            return (
              <div key={s.id} className="p-4 bg-stone-50 rounded border border-stone-200">
                <div className="text-xs text-stone-500 mb-1">До статті: <span className="text-stone-700">{article?.title || '—'}</span></div>
                <div className="text-sm text-stone-700 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.content}</div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500">{s.authorName} · {roleName(s.authorRole)}</span>
                    <Stars avg={s.ratingAvg} count={s.ratingCount} />
                  </div>
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
        <h3 className="text-lg text-stone-800">Журнал дій</h3>
        <div className="flex gap-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <input value={fAction} onChange={(e) => setFAction(e.target.value)} placeholder="Фільтр за дією (напр. user.)"
            className="flex-1 sm:flex-none px-3 min-h-[44px] border border-stone-200 rounded-md text-sm" onKeyDown={(e) => e.key === 'Enter' && load(fAction)} />
          <button onClick={() => load(fAction)} className="px-4 min-h-[44px] bg-stone-700 text-white rounded-md text-sm">Фільтр</button>
        </div>
      </div>
      {loading ? <p className="text-stone-400 italic text-sm">Завантаження…</p> : logs.length === 0 ? (
        <p className="text-sm text-stone-400 italic">Журнал порожній</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((a) => (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-sm border-b border-stone-100 last:border-0 py-2">
              <span className="text-stone-700 break-words">
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
