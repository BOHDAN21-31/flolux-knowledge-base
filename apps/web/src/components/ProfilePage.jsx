import React, { useState, useRef } from 'react';
import { User, Lock, MapPin, Camera, Check, AlertCircle, Trash2, Fingerprint, Plus, Star, X } from 'lucide-react';
import { apiPatch, apiPost, apiDelete, apiUpload, webauthnRegister, webauthnSupported } from '../api';
import { userRoles } from '../roles';
import { useRoles } from '../RolesContext';
import { accountLevel } from '../level';

function Banner({ error, success }) {
  if (error) return <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" />{error}</div>;
  if (success) return <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded flex gap-2"><Check className="w-4 h-4 mt-0.5" />{success}</div>;
  return null;
}

const SEC_TO_TAB = { data: 'personal', security: 'security', locations: 'locations' };
const TAB_TO_SEC = { personal: 'data', security: 'security', locations: 'locations' };

export default function ProfilePage({ user, allLocations, onRefresh, section = 'data', onSection }) {
  const tab = SEC_TO_TAB[section] || 'personal';
  const setTab = (k) => onSection?.(TAB_TO_SEC[k] || 'data');
  const tabs = [
    { key: 'personal', label: '📄 Особисті дані' },
    { key: 'security', label: '🔒 Безпека' },
    { key: 'locations', label: '📍 Мої локації' },
  ];

  return (
    <div>
      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Профіль</p>
        <h1 className="text-2xl md:text-3xl text-stone-800">{user.name}{user.surname ? ` ${user.surname}` : ''}</h1>
      </div>

      {/* Mobile: таб-навігація (одна секція за раз) */}
      <div className="md:hidden flex gap-1 mb-6 bg-stone-100 rounded-md p-1 overflow-x-auto scroll-touch">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 min-h-[44px] rounded text-sm whitespace-nowrap flex-shrink-0 transition ${tab === t.key ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: лише активна секція */}
      <div className="md:hidden">
        {tab === 'personal' && <PersonalSection user={user} allLocations={allLocations} onRefresh={onRefresh} />}
        {tab === 'security' && <SecuritySection user={user} onRefresh={onRefresh} />}
        {tab === 'locations' && <LocationsSection user={user} allLocations={allLocations} onRefresh={onRefresh} />}
      </div>

      {/* Desktop: усі три секції на сторінці */}
      <div className="hidden md:block space-y-12">
        <PersonalSection user={user} allLocations={allLocations} onRefresh={onRefresh} />
        <SecuritySection user={user} onRefresh={onRefresh} />
        <LocationsSection user={user} allLocations={allLocations} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

function PersonalSection({ user, allLocations, onRefresh }) {
  const { roleName, roleChipStyle } = useRoles();
  const [form, setForm] = useState({
    name: user.name || '', surname: user.surname || '',
    email: user.email || '', phone: user.phone || '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

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
      <div className="bg-white border border-stone-200 rounded-lg p-6 flex items-center gap-5">
        <button onClick={() => fileRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center group">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-stone-400" />}
          <span className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
        <div>
          <div className="text-lg text-stone-800">{user.name}{user.surname ? ` ${user.surname}` : ''}</div>
          <div className="text-sm text-stone-500">{user.email}</div>
          <div className="text-xs text-stone-400 mt-1">Натисніть на фото, щоб змінити аватар</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-1"><Star className="w-4 h-4" /><span className="text-2xl text-stone-800">{user.rating ?? 0}</span></div>
          <div className="text-xs text-stone-500">Рейтинг</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="text-sm text-stone-800 mt-1">{accountLevel(user.rating)}</div>
          <div className="text-xs text-stone-500 mt-1">Рівень</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="text-sm mt-1">{user.approved
            ? <span className="text-emerald-700">Підтверджений</span>
            : <span className="text-amber-700">Очікує</span>}</div>
          <div className="text-xs text-stone-500 mt-1">Статус акаунта</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="text-sm text-stone-800 mt-1">{userRoles(user).length || '—'}</div>
          <div className="text-xs text-stone-500 mt-1">Ролей призначено</div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 mb-3">Мої ролі</h3>
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

      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Labeled label="Ім'я"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Прізвище"><input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="inp" /></Labeled>
          <Labeled label="E-mail"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Телефон"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Бажана роль (read-only)"><input value={user.requestedRole ? roleName(user.requestedRole) : '—'} readOnly className="inp bg-stone-50 text-stone-500" /></Labeled>
          <Labeled label="Ролі (read-only)"><input value={userRoles(user).map(roleName).join(', ') || '—'} readOnly className="inp bg-stone-50 text-stone-500" /></Labeled>
        </div>
        <Banner error={error} success={success} />
        <button onClick={save} disabled={busy} className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-sm uppercase tracking-wider text-stone-500 mb-3">Зараз на моїх локаціях</h3>
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
                <span className="text-stone-500">{locCount(l.locationId)} людей</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`.inp{width:100%;padding:0.55rem 0.75rem;border:1px solid #e7e5e4;border-radius:0.375rem;outline:none}.inp:focus{border-color:#fb7185}`}</style>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">{label}</label>
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
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-3">
        <h3 className="text-lg text-stone-800 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}><Lock className="w-4 h-4" /> Зміна паролю</h3>
        <input type="password" placeholder="Поточний пароль" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="inp2" />
        <input type="password" placeholder="Новий пароль" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="inp2" />
        <input type="password" placeholder="Підтвердьте новий пароль" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="inp2" />
        <Banner error={error} success={success} />
        <button onClick={changePw} disabled={busy} className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Збереження...' : 'Змінити пароль'}
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg text-stone-800 flex items-center gap-2 mb-4" style={{ fontFamily: 'Georgia, serif' }}><Fingerprint className="w-4 h-4" /> Touch / Face ID</h3>
        <div className="space-y-2 mb-4">
          {(user.webauthn || []).length === 0 ? (
            <p className="text-sm text-stone-400 italic">Немає зареєстрованих пристроїв</p>
          ) : user.webauthn.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-3 bg-stone-50 rounded">
              <span className="text-sm text-stone-700">{w.deviceName}</span>
              <button onClick={() => removeDevice(w.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        {bioSupported ? (
          <button onClick={addDevice} className="flex items-center gap-2 px-4 py-2 border border-stone-300 hover:border-rose-400 rounded-md text-sm text-stone-700">
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
    if (!window.confirm(`Відкріпитись від локації «${l.name}»? Ви впевнені?`)) return;
    setError('');
    try {
      await apiDelete(`/api/users/me/locations/${l.locationId}`);
      await onRefresh();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-stone-800 flex items-center gap-2"><MapPin className="w-4 h-4" /> Підтверджені локації</h3>
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
        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <h3 className="text-sm uppercase tracking-wider text-stone-500 mb-3">Запити в обробці</h3>
          <div className="space-y-2">
            {user.locationRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-700">{r.locationName}</span>
                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">Очікує підтвердження</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[85vh] rounded-none sm:rounded-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 sticky top-0 bg-white">
              <h3 className="text-lg text-stone-800">Запросити локацію</h3>
              <button onClick={() => setShowModal(false)} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {available.length === 0 ? (
                <p className="text-sm text-stone-400 italic">Немає доступних локацій для запиту</p>
              ) : (
                <>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук локації…"
                    className="w-full px-3 min-h-[44px] mb-3 border border-stone-200 rounded-md text-sm" />
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {['all', ...cities].map((c) => (
                      <button key={c} onClick={() => setCityFilter(c)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${cityFilter === c ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 border-stone-300'}`}>
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
                          <label key={l.id} className="flex items-start gap-3 p-2.5 rounded-md border border-stone-200 hover:border-rose-300 cursor-pointer">
                            <input type="checkbox" className="mt-0.5 w-4 h-4" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} />
                            <span className="flex-1">
                              <span className="flex items-center gap-2 text-sm text-stone-800">
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
              <div className="p-4 sm:p-5 border-t border-stone-200 sticky bottom-0 bg-white">
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
