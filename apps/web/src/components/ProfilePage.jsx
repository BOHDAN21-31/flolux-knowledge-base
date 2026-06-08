import React, { useState, useRef, useEffect } from 'react';
import { User, Lock, MapPin, Camera, Check, AlertCircle, Trash2, Fingerprint, Plus, Star, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiDelete, apiUpload, webauthnRegister, webauthnSupported } from '../api';
import { userRoles } from '../roles';
import { useRoles } from '../RolesContext';
import { accountLevel } from '../level';
import { useConfirm } from './ConfirmDialog';
import ActivityFeed from './ActivityFeed';

function Banner({ error, success }) {
  if (error) return <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" />{error}</div>;
  if (success) return <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded flex gap-2"><Check className="w-4 h-4 mt-0.5" />{success}</div>;
  return null;
}

const SEC_TO_TAB = { data: 'personal', security: 'security', locations: 'locations', notifications: 'notifications' };
const TAB_TO_SEC = { personal: 'data', security: 'security', locations: 'locations', notifications: 'notifications' };

export default function ProfilePage({ user, allLocations, onRefresh, section = 'data', onSection, onOpenArticle }) {
  const tab = SEC_TO_TAB[section] || 'personal';
  const setTab = (k) => onSection?.(TAB_TO_SEC[k] || 'data');
  const tabs = [
    { key: 'personal', label: '📄 Особисті дані' },
    { key: 'security', label: '🔒 Безпека' },
    { key: 'locations', label: '📍 Мої локації' },
    { key: 'notifications', label: '🔔 Сповіщення' },
  ];

  return (
    <div>
      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 dark:border-stone-700">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Профіль</p>
        <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">{user.name}{user.surname ? ` ${user.surname}` : ''}</h1>
      </div>

      {/* Mobile: таб-навігація (одна секція за раз) */}
      <div className="md:hidden flex gap-1 mb-6 bg-stone-100 dark:bg-stone-800 rounded-md p-1 overflow-x-auto scroll-touch">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 min-h-[44px] rounded text-sm whitespace-nowrap flex-shrink-0 transition ${tab === t.key ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: лише активна секція */}
      <div className="md:hidden">
        {tab === 'personal' && <PersonalSection user={user} allLocations={allLocations} onRefresh={onRefresh} onOpenArticle={onOpenArticle} />}
        {tab === 'security' && <SecuritySection user={user} onRefresh={onRefresh} />}
        {tab === 'locations' && <LocationsSection user={user} allLocations={allLocations} onRefresh={onRefresh} />}
        {tab === 'notifications' && <NotificationSettings />}
      </div>

      {/* Desktop: усі секції на сторінці */}
      <div className="hidden md:block space-y-12">
        <PersonalSection user={user} allLocations={allLocations} onRefresh={onRefresh} onOpenArticle={onOpenArticle} />
        <SecuritySection user={user} onRefresh={onRefresh} />
        <LocationsSection user={user} allLocations={allLocations} onRefresh={onRefresh} />
        <NotificationSettings />
      </div>
    </div>
  );
}

function PersonalSection({ user, allLocations, onRefresh, onOpenArticle }) {
  const { roleName, roleChipStyle } = useRoles();
  const [form, setForm] = useState({
    name: user.name || '', surname: user.surname || '',
    email: user.email || '', phone: user.phone || '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [birthday, setBirthday] = useState(null);
  const [perms, setPerms] = useState([]);
  useEffect(() => {
    let active = true;
    apiGet('/api/users/me/birthday').then((d) => { if (active) setBirthday(d.birthday); }).catch(() => {});
    apiGet('/api/users/me/permissions').then((d) => { if (active) setPerms(Array.isArray(d) ? d : []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // userCount з бекенду включає мене -> для моїх локацій мінус я сам.
  const locCount = (locId) => Math.max(0, (allLocations.find((l) => l.id === locId)?.userCount ?? 0) - 1);

  const save = async () => {
    setError(''); setSuccess(''); setBusy(true);
    try {
      await apiPatch('/api/users/me', form);
      await onRefresh();
      setSuccess('Збережено');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setSuccess(''); setBusy(true);
    try {
      const up = await apiUpload(file);
      await apiPatch('/api/users/me', { avatarUrl: up.url });
      await onRefresh();
      setSuccess('Аватар оновлено');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6 flex items-center gap-5">
        <button onClick={() => fileRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center group">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-stone-400" />}
          <span className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
        <div>
          <div className="text-lg text-stone-800 dark:text-stone-100">{user.name}{user.surname ? ` ${user.surname}` : ''}</div>
          <div className="text-sm text-stone-500 dark:text-stone-400">{user.email}</div>
          <div className="text-xs text-stone-400 mt-1">Натисніть на фото, щоб змінити аватар</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-1"><Star className="w-4 h-4" /><span className="text-2xl text-stone-800 dark:text-stone-100">{user.rating ?? 0}</span></div>
          <div className="text-xs text-stone-500 dark:text-stone-400">Рейтинг</div>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-center">
          <div className="text-sm text-stone-800 dark:text-stone-100 mt-1">{accountLevel(user.rating)}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Рівень</div>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-center">
          <div className="text-sm mt-1">{user.approved
            ? <span className="text-emerald-700">Підтверджений</span>
            : <span className="text-amber-700">Очікує</span>}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Статус акаунта</div>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-center">
          <div className="text-sm text-stone-800 dark:text-stone-100 mt-1">{userRoles(user).length || '—'}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Ролей призначено</div>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">Мої ролі</h3>
        {userRoles(user).length === 0 ? (
          <p className="text-sm text-stone-400 italic">Ролі ще не призначені адміністратором</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {userRoles(user).map((r) => (
              <span key={r} className="px-3 py-1 rounded-full text-sm border" style={roleChipStyle(r)}>
                {roleName(r)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6 space-y-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Labeled label="Ім'я"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Прізвище"><input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="inp" /></Labeled>
          <Labeled label="E-mail"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Телефон"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Бажана роль (read-only)"><input value={user.requestedRole ? roleName(user.requestedRole) : '—'} readOnly className="inp bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400" /></Labeled>
          <Labeled label="Ролі (read-only)"><input value={userRoles(user).map(roleName).join(', ') || '—'} readOnly className="inp bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400" /></Labeled>
          <Labeled label="Дата народження (read-only)">
            <input value={birthday ? new Date(birthday).toLocaleDateString('uk-UA') : '— зверніться до HR для зміни'} readOnly className="inp bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400" />
          </Labeled>
        </div>
        <Banner error={error} success={success} />
        <button onClick={save} disabled={busy} className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">Зараз на моїх локаціях</h3>
        {(user.locations || []).filter((l) => l.approved).length === 0 ? (
          <p className="text-sm text-stone-400 italic">Немає підтверджених локацій</p>
        ) : (
          <div className="space-y-2">
            {user.locations.filter((l) => l.approved).map((l) => (
              <div key={l.locationId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: l.color || '#a8a29e' }} />
                  {l.name}{l.isManager ? ' · керівник' : ''}
                </span>
                <span className="text-stone-500 dark:text-stone-400">{locCount(l.locationId)} людей</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {perms.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
          <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">🔐 Мої права</h3>
          <div className="space-y-2">
            {perms.map((p) => {
              const soon = p.expiresAt && (p.expiresAt - Date.now()) < 14 * 864e5;
              const src = p.source === 'individual'
                ? 'індивідуально'
                : `роль: ${p.source?.startsWith('role:') ? p.source.slice(5) : '—'}`;
              return (
                <div key={p.key} className="flex items-center justify-between gap-2 text-sm border-b border-stone-100 dark:border-stone-800 last:border-0 pb-2 last:pb-0">
                  <span className="text-stone-700 dark:text-stone-200">
                    {p.name} <code className="text-[10px] text-stone-400">{p.key}</code>
                  </span>
                  <span className="text-xs text-stone-400 flex-shrink-0 text-right">
                    {src}
                    {p.expiresAt && (
                      <span className={soon ? 'block text-amber-600' : 'block'}>
                        {soon ? 'Закінчується ' : 'до '}{new Date(p.expiresAt).toLocaleDateString('uk-UA')}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ActivityFeed userId={user.id} onOpenArticle={onOpenArticle} title="🕐 Моя активність" />

      <style>{`.inp{width:100%;padding:0.55rem 0.75rem;border:1px solid #e7e5e4;border-radius:0.375rem;outline:none}.inp:focus{border-color:#fb7185}`}</style>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SecuritySection({ user, onRefresh }) {
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  React.useEffect(() => { webauthnSupported().then(setBioSupported); }, []);

  const changePw = async () => {
    setError(''); setSuccess('');
    if (pw.newPassword !== pw.confirm) return setError('Паролі не співпадають');
    if (pw.newPassword.length < 6) return setError('Новий пароль мінімум 6 символів');
    setBusy(true);
    try {
      await apiPost('/api/users/me/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setSuccess('Пароль змінено');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const addDevice = async () => {
    setError(''); setSuccess('');
    try {
      const name = window.prompt('Назва пристрою', navigator.platform || 'Мій пристрій');
      if (name === null) return;
      await webauthnRegister(name || 'Мій пристрій');
      await onRefresh();
      setSuccess('Пристрій додано');
    } catch (e) { setError(e.message || 'Не вдалося додати пристрій'); }
  };

  const removeDevice = async (id) => {
    await apiDelete(`/api/users/me/webauthn/${id}`);
    await onRefresh();
  };

  return (
    <div className="space-y-6 max-w-2xl" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6 space-y-3">
        <h3 className="text-lg text-stone-800 dark:text-stone-100 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}><Lock className="w-4 h-4" /> Зміна паролю</h3>
        <input type="password" placeholder="Поточний пароль" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="inp2" />
        <input type="password" placeholder="Новий пароль" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="inp2" />
        <input type="password" placeholder="Підтвердьте новий пароль" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="inp2" />
        <Banner error={error} success={success} />
        <button onClick={changePw} disabled={busy} className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Збереження...' : 'Змінити пароль'}
        </button>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
        <h3 className="text-lg text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-4" style={{ fontFamily: 'Georgia, serif' }}><Fingerprint className="w-4 h-4" /> Touch / Face ID</h3>
        <div className="space-y-2 mb-4">
          {(user.webauthn || []).length === 0 ? (
            <p className="text-sm text-stone-400 italic">Немає зареєстрованих пристроїв</p>
          ) : user.webauthn.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-900 rounded">
              <span className="text-sm text-stone-700 dark:text-stone-200">{w.deviceName}</span>
              <button onClick={() => removeDevice(w.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        {bioSupported ? (
          <button onClick={addDevice} className="flex items-center gap-2 px-4 py-2 border border-stone-300 hover:border-rose-400 rounded-md text-sm text-stone-700 dark:text-stone-200">
            <Plus className="w-4 h-4" /> Додати цей пристрій (Touch/Face ID)
          </button>
        ) : (
          <p className="text-xs text-stone-400 italic">Цей браузер не підтримує WebAuthn</p>
        )}
      </div>
      <style>{`.inp2{width:100%;padding:0.6rem 0.75rem;border:1px solid #e7e5e4;border-radius:0.375rem;outline:none}.inp2:focus{border-color:#fb7185}`}</style>
    </div>
  );
}

function LocationsSection({ user, allLocations, onRefresh }) {
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const approved = (user.locations || []).filter((l) => l.approved);
  const requestedIds = new Set([
    ...(user.locations || []).map((l) => l.locationId),
    ...(user.locationRequests || []).map((r) => r.locationId),
  ]);
  const available = allLocations.filter((l) => l.active !== false && !requestedIds.has(l.id));
  const cities = [...new Set(available.map((l) => l.city || 'Інше'))];
  const filtered = available.filter((l) => {
    if (cityFilter !== 'all' && (l.city || 'Інше') !== cityFilter) return false;
    if (search && !`${l.name} ${l.address || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const grouped = filtered.reduce((acc, l) => {
    const c = l.city || 'Інше';
    (acc[c] = acc[c] || []).push(l);
    return acc;
  }, {});
  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const sendRequests = async () => {
    if (selected.length === 0) return;
    setError(''); setBusy(true);
    try {
      for (const id of selected) {
        await apiPost('/api/users/me/locations/request', { locationId: id });
      }
      await onRefresh();
      setShowModal(false); setSelected([]); setSearch(''); setCityFilter('all');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const detach = async (l) => {
    const ok = await confirm({ title: 'Відкріпитись від локації?', description: `Локація «${l.name}». Цю прив'язку буде знято.`, confirmLabel: 'Відкріпитись' });
    if (!ok) return;
    setError('');
    try {
      await apiDelete(`/api/users/me/locations/${l.locationId}`);
      await onRefresh();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 dark:text-stone-100 flex items-center gap-2"><MapPin className="w-4 h-4" /> Підтверджені локації</h3>
          <button onClick={() => setShowModal(true)} className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Запросити локацію
          </button>
        </div>
        {approved.length === 0 ? (
          <p className="text-sm text-stone-400 italic">Поки що немає підтверджених локацій</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {approved.map((l) => (
              <span key={l.locationId} className="pl-3 pr-2 py-1 rounded-full text-sm text-white flex items-center gap-1.5" style={{ background: l.color || '#a8a29e' }}>
                {l.name}{l.isManager ? ' · керівник' : ''}
                <button onClick={() => detach(l)} title="Відкріпитись" className="hover:bg-white/25 rounded-full p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {(user.locationRequests || []).length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
          <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">Запити в обробці</h3>
          <div className="space-y-2">
            {user.locationRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-700 dark:text-stone-200">{r.locationName}</span>
                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">Очікує підтвердження</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-stone-900 w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[85vh] rounded-none sm:rounded-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 dark:border-stone-700 sticky top-0 bg-white dark:bg-stone-900">
              <h3 className="text-lg text-stone-800 dark:text-stone-100">Запросити локацію</h3>
              <button onClick={() => setShowModal(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {available.length === 0 ? (
                <p className="text-sm text-stone-400 italic">Немає доступних локацій для запиту</p>
              ) : (
                <>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук локації…"
                    className="w-full px-3 min-h-[44px] mb-3 border border-stone-200 dark:border-stone-700 rounded-md text-sm" />
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {['all', ...cities].map((c) => (
                      <button key={c} onClick={() => setCityFilter(c)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${cityFilter === c ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
                        {c === 'all' ? 'Всі' : c}
                      </button>
                    ))}
                  </div>
                  {Object.keys(grouped).length === 0 ? (
                    <p className="text-sm text-stone-400 italic">Нічого не знайдено</p>
                  ) : Object.entries(grouped).map(([city, locs]) => (
                    <div key={city} className="mb-4">
                      <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">{city}</div>
                      <div className="space-y-1.5">
                        {locs.map((l) => (
                          <label key={l.id} className="flex items-start gap-3 p-2.5 rounded-md border border-stone-200 dark:border-stone-700 hover:border-rose-300 cursor-pointer">
                            <input type="checkbox" className="mt-0.5 w-4 h-4" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} />
                            <span className="flex-1">
                              <span className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-100">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color || '#a8a29e' }} />{l.name}
                              </span>
                              {l.address && <span className="block text-xs text-stone-400 mt-0.5">{l.address}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {available.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-stone-200 dark:border-stone-700 sticky bottom-0 bg-white dark:bg-stone-900">
                {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
                <button onClick={sendRequests} disabled={busy || selected.length === 0}
                  className="w-full px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
                  {busy ? 'Надсилання...' : `Запросити вибрані${selected.length ? ` (${selected.length})` : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PREF_LABELS = [
  ['newArticleAll', 'Нові статті — всі'],
  ['newArticleMyRole', 'Нові статті — моя роль'],
  ['newArticleMyLocation', 'Нові статті — моя локація'],
  ['comments', 'Коментарі до моїх статей'],
  ['suggestions', 'Пропозиції до моїх статей'],
  ['suggestionApproved', 'Прийняття моїх пропозицій'],
  ['birthdays', 'Дні народження колег'],
  ['digests', 'Дайджести компанії'],
  ['announcementsAll', '📢 Усі оголошення компанії'],
  ['announcementsUrgentOnly', '📢 Лише термінові оголошення'],
  ['roleChanges', 'Зміна моїх ролей'],
  ['locationChanges', 'Зміна моїх локацій'],
];

function NotificationSettings() {
  const [pref, setPref] = useState(null);

  useEffect(() => {
    let active = true;
    apiGet('/api/users/me/notification-preferences')
      .then((p) => { if (active) setPref(p); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggle = async (key) => {
    const next = !pref[key];
    setPref((p) => ({ ...p, [key]: next }));
    apiPatch('/api/users/me/notification-preferences', { [key]: next }).catch(() => {});
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <TelegramSection />
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Сповіщення</h3>
        {!pref ? (
          <p className="text-sm text-stone-400 italic">Завантаження…</p>
        ) : (
          <div className="space-y-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {PREF_LABELS.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0 cursor-pointer min-h-[44px]">
                <span className="text-sm text-stone-700 dark:text-stone-200">{label}</span>
                <input type="checkbox" className="w-5 h-5 accent-rose-500" checked={!!pref[key]} onChange={() => toggle(key)} />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const BOT_USERNAME = 'Flolux_Librarybot';

function TelegramSection() {
  const confirm = useConfirm();
  const [status, setStatus] = useState(null); // {linked, username, linkedAt}
  const [pref, setPref] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const loadStatus = () => apiGet('/api/users/me/telegram').then(setStatus).catch(() => {});
  useEffect(() => {
    loadStatus();
    apiGet('/api/users/me/notification-preferences').then(setPref).catch(() => {});
  }, []);

  // Поки показано код і ще не прив'язано — опитуємо статус кожні 3 с
  useEffect(() => {
    if (!code || status?.linked) return undefined;
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, [code, status?.linked]);

  useEffect(() => { if (status?.linked) setCode(''); }, [status?.linked]);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await apiPost('/api/users/me/telegram/generate-code');
      setCode(r.code);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const copy = (text, what) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(''), 1800);
    }).catch(() => {});
  };

  const toggleTg = async () => {
    const next = !pref?.telegramEnabled;
    setPref((p) => ({ ...p, telegramEnabled: next }));
    apiPatch('/api/users/me/notification-preferences', { telegramEnabled: next }).catch(() => {});
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: 'Відключити Telegram?',
      description: 'Ви більше не отримуватимете сповіщення в Telegram. Прив’язку можна відновити пізніше.',
      confirmLabel: 'Відключити',
    });
    if (!ok) return;
    await apiDelete('/api/users/me/telegram').catch(() => {});
    setCode('');
    await loadStatus();
  };

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">📱 Telegram</h3>

      {status?.linked ? (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-sm">✅ Підключено</div>
          {status.username && <div className="text-sm text-stone-600 dark:text-stone-300">Username: @{status.username}</div>}
          {status.linkedAt && <div className="text-sm text-stone-500 dark:text-stone-400">Прив’язано: {new Date(status.linkedAt).toLocaleDateString('uk-UA')}</div>}
          <label className="flex items-center justify-between gap-3 py-2 border-t border-stone-100 dark:border-stone-800 mt-2 cursor-pointer min-h-[44px]">
            <span className="text-sm text-stone-700 dark:text-stone-200">Отримувати сповіщення в Telegram</span>
            <input type="checkbox" className="w-5 h-5 accent-rose-500" checked={pref?.telegramEnabled !== false} onChange={toggleTg} />
          </label>
          <button onClick={disconnect} className="px-4 min-h-[44px] rounded-md text-sm bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-rose-600">
            Відключити
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-600 dark:text-stone-300">Отримуйте сповіщення про нові статті та події прямо в Telegram.</p>
          {!code ? (
            <button onClick={generate} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
              {busy ? 'Генерація…' : 'Згенерувати код'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="text-2xl tracking-widest px-4 py-2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100">{code}</code>
                <button onClick={() => copy(code, 'code')} className="px-3 min-h-[44px] rounded-md text-sm border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300">
                  {copied === 'code' ? 'Скопійовано' : 'Скопіювати'}
                </button>
              </div>
              <ol className="text-sm text-stone-600 dark:text-stone-300 list-decimal pl-5 space-y-1">
                <li>Відкрийте бота: <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">@{BOT_USERNAME}</a></li>
                <li>Надішліть боту: <code>/start {code}</code></li>
                <li>Готово!</li>
              </ol>
              <button onClick={() => copy(`/start ${code}`, 'cmd')} className="px-4 min-h-[44px] rounded-md text-sm border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300">
                {copied === 'cmd' ? 'Скопійовано' : `Скопіювати команду /start ${code}`}
              </button>
              <p className="text-xs text-stone-400 italic">Очікую підтвердження від Telegram…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
