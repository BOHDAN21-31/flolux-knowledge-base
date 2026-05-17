import React, { useState, useRef } from 'react';
import { User, Lock, MapPin, Camera, Check, AlertCircle, Trash2, Fingerprint, Plus, Star, X } from 'lucide-react';
import { apiPatch, apiPost, apiDelete, apiUpload, webauthnRegister, webauthnSupported } from '../api';

const ROLE_NAMES = {
  admin: 'Адміністратор', florist: 'Флорист', location_manager: 'Управляючий локації',
  warehouse: 'Складський працівник', accountant: 'Бухгалтер', wholesale: 'Оптовий менеджер',
  courier: "Кур'єр", logist: 'Логіст', barista: 'Бариста', driver: 'Водій вантажного авто',
  tech: 'Технічна підтримка',
};

function Banner({ error, success }) {
  if (error) return <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" />{error}</div>;
  if (success) return <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded flex gap-2"><Check className="w-4 h-4 mt-0.5" />{success}</div>;
  return null;
}

export default function ProfilePage({ user, allLocations, onRefresh }) {
  const [tab, setTab] = useState('personal');
  const tabs = [
    { key: 'personal', label: '📄 Особисті дані' },
    { key: 'security', label: '🔒 Безпека' },
    { key: 'locations', label: '📍 Мої локації' },
  ];

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Профіль</p>
        <h1 className="text-3xl text-stone-800">{user.name}{user.surname ? ` ${user.surname}` : ''}</h1>
      </div>

      <div className="flex gap-1 mb-6 bg-stone-100 rounded-md p-1 w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded text-sm transition ${tab === t.key ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && <PersonalSection user={user} allLocations={allLocations} onRefresh={onRefresh} />}
      {tab === 'security' && <SecuritySection user={user} onRefresh={onRefresh} />}
      {tab === 'locations' && <LocationsSection user={user} allLocations={allLocations} onRefresh={onRefresh} />}
    </div>
  );
}

function PersonalSection({ user, allLocations, onRefresh }) {
  const [form, setForm] = useState({
    name: user.name || '', surname: user.surname || '',
    email: user.email || '', phone: user.phone || '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const locCount = (locId) => allLocations.find((l) => l.id === locId)?.userCount ?? 0;

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

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-1"><Star className="w-4 h-4" /><span className="text-2xl text-stone-800">{user.rating ?? 0}</span></div>
          <div className="text-xs text-stone-500">Рейтинг</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="text-sm mt-1">{user.approved
            ? <span className="text-emerald-700">Підтверджений</span>
            : <span className="text-amber-700">Очікує</span>}</div>
          <div className="text-xs text-stone-500 mt-1">Статус акаунта</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
          <div className="text-sm text-stone-800 mt-1">{ROLE_NAMES[user.assignedRole] || '—'}</div>
          <div className="text-xs text-stone-500 mt-1">Призначена роль</div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Labeled label="Ім'я"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Прізвище"><input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="inp" /></Labeled>
          <Labeled label="E-mail"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Телефон"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="inp" /></Labeled>
          <Labeled label="Бажана роль (read-only)"><input value={ROLE_NAMES[user.requestedRole] || '—'} readOnly className="inp bg-stone-50 text-stone-500" /></Labeled>
          <Labeled label="Призначена роль (read-only)"><input value={ROLE_NAMES[user.assignedRole] || '—'} readOnly className="inp bg-stone-50 text-stone-500" /></Labeled>
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
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const approved = (user.locations || []).filter((l) => l.approved);
  const requestedIds = new Set([
    ...(user.locations || []).map((l) => l.locationId),
    ...(user.locationRequests || []).map((r) => r.locationId),
  ]);
  const available = allLocations.filter((l) => !requestedIds.has(l.id));

  const sendRequest = async () => {
    if (!selected) return;
    setError(''); setBusy(true);
    try {
      await apiPost('/api/users/me/locations/request', { locationId: selected });
      await onRefresh();
      setShowModal(false); setSelected('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
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
              <span key={l.locationId} className="px-3 py-1 rounded-full text-sm text-white" style={{ background: l.color || '#a8a29e' }}>
                {l.name}{l.isManager ? ' · керівник' : ''}
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
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-stone-800">Запросити локацію</h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            {available.length === 0 ? (
              <p className="text-sm text-stone-400 italic">Немає доступних локацій для запиту</p>
            ) : (
              <>
                <select value={selected} onChange={(e) => setSelected(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-md mb-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <option value="">— оберіть локацію —</option>
                  {available.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
                <button onClick={sendRequest} disabled={busy || !selected} className="w-full px-4 py-2 bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
                  {busy ? 'Надсилання...' : 'Надіслати запит'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
