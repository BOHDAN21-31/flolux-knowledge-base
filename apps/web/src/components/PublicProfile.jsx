import { useState, useEffect } from 'react';
import {
  ArrowLeft, User, Star, FileText, MessageSquare, Lightbulb, GraduationCap, Award,
  Briefcase, Calendar, Users as UsersIcon, X,
} from 'lucide-react';
import { apiGet, apiPost } from '../api';
import { useRoles } from '../RolesContext';
import { accountLevel } from '../level';
import { employmentStatus } from '../constants';
import ActivityFeed from './ActivityFeed';

function tenureText(ms) {
  if (!ms) return null;
  const months = Math.floor((Date.now() - ms) / (30 * 86400e3));
  if (months < 1) return 'менше місяця';
  if (months < 12) return `${months} ${months === 1 ? 'місяць' : months >= 2 && months <= 4 ? 'місяці' : 'місяців'}`;
  const years = Math.floor(months / 12);
  const mrest = months % 12;
  if (mrest === 0) return `${years} ${years === 1 ? 'рік' : years >= 2 && years <= 4 ? 'роки' : 'років'}`;
  return `${years} р. ${mrest} міс.`;
}

export default function PublicProfile({ userId, currentUser, onBack, onEditProfile, onOpenArticle, onOpenUser }) {
  const { roleName, roleChipStyle } = useRoles();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const load = () => {
    setStatus('loading');
    apiGet(`/api/users/${userId}/public`)
      .then((d) => { setData(d); setStatus('ok'); })
      .catch((e) => { console.error(e); setStatus('error'); });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  if (status === 'loading') {
    return <div className="text-center py-16 text-stone-400 italic">Завантаження профілю…</div>;
  }
  if (status === 'error' || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500 dark:text-stone-400 italic mb-4">Користувача не знайдено.</p>
        <button onClick={onBack} className="px-4 min-h-[44px] bg-rose-500 text-white rounded-md text-sm">Повернутися</button>
      </div>
    );
  }

  const isMe = currentUser?.id === data.id;
  const isAdmin = (currentUser?.roles || []).some((r) => (typeof r === 'string' ? r : r.role) === 'admin') || currentUser?.assignedRole === 'admin';
  const isSupervisor = data.supervisorId && currentUser?.id === data.supervisorId;
  const canSchedule = !isMe && (isAdmin || isSupervisor || currentUser?.roles?.some?.((r) => (typeof r === 'string' ? r : r.role) === 'hr'));

  const stat = [
    { label: 'Статей', value: data.articlesCount, icon: FileText },
    { label: 'Коментарів', value: data.commentsCount, icon: MessageSquare },
    { label: 'Пропозицій', value: data.suggestionsCount, icon: Lightbulb },
  ];
  const status_ = employmentStatus(data.employmentStatus);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px] transition">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-20 h-20 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
            {data.avatarUrl
              ? <img src={data.avatarUrl} alt="" className="w-full h-full object-cover" />
              : <User className="w-8 h-8 text-stone-400" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100 break-words">{data.name}{data.surname ? ` ${data.surname}` : ''}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: status_.color, color: status_.color, background: `${status_.color}1a` }}>
                {status_.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(data.roles || []).length === 0
                ? <span className="text-xs text-stone-400 italic">без ролі</span>
                : data.roles.map((r) => (
                  <span key={r} className="px-2.5 py-0.5 rounded-full text-xs border" style={roleChipStyle(r)}>{roleName(r)}</span>
                ))}
            </div>
            {(data.position || data.department) && (
              <div className="text-sm text-stone-600 dark:text-stone-300 mt-2 flex items-center gap-1.5 flex-wrap" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <Briefcase className="w-3.5 h-3.5" />
                {data.position}{data.department ? ` · ${data.department}` : ''}
              </div>
            )}
            <div className="flex items-center gap-3 mt-3 text-sm text-stone-600 dark:text-stone-300 flex-wrap" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <span className="flex items-center gap-1 text-amber-600"><Star className="w-4 h-4" />{data.rating}</span>
              <span className="text-stone-400">·</span>
              <span>{accountLevel(data.rating)}</span>
              {data.hiredAt && (
                <>
                  <span className="text-stone-400">·</span>
                  <span className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
                    <Calendar className="w-3.5 h-3.5" /> в компанії {tenureText(data.hiredAt)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isMe && (
              <button onClick={onEditProfile} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm whitespace-nowrap">
                Редагувати профіль
              </button>
            )}
            {canSchedule && (
              <button onClick={() => setScheduleOpen(true)} className="px-4 min-h-[44px] border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-md text-sm whitespace-nowrap flex items-center gap-1.5">
                📅 Запланувати 1:1
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {stat.map((s) => (
            <div key={s.label} className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-stone-700 dark:text-stone-200"><s.icon className="w-4 h-4" /><span className="text-xl">{s.value ?? 0}</span></div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {data.supervisedUsers?.length > 0 && (
        <div className="mt-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6">
          <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3 flex items-center gap-2">
            <UsersIcon className="w-4 h-4" /> Підлеглі ({data.supervisedUsers.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.supervisedUsers.map((s) => (
              <button key={s.id} onClick={() => onOpenUser?.(s.id)}
                className="flex items-center gap-2 p-2 border border-stone-200 dark:border-stone-700 rounded hover:border-rose-300 text-left">
                <span className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {s.avatarUrl ? <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" /> : (s.name || '?')[0]}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-stone-800 dark:text-stone-100 truncate">{s.name}{s.surname ? ` ${s.surname}` : ''}</div>
                  {s.position && <div className="text-xs text-stone-400 truncate">{s.position}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <CompletedCoursesSection userId={userId} />

      <div className="mt-6">
        <ActivityFeed userId={userId} onOpenArticle={onOpenArticle} />
      </div>

      {scheduleOpen && (
        <ScheduleOneOnOneModal employee={data} currentUserId={currentUser?.id} onClose={() => setScheduleOpen(false)} onCreated={() => setScheduleOpen(false)} />
      )}
    </div>
  );
}

function CompletedCoursesSection({ userId }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    apiGet(`/api/courses/users/${userId}/completed`)
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [userId]);
  if (list.length === 0) return null;
  return (
    <div className="mt-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6">
      <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3 flex items-center gap-2">
        <Award className="w-4 h-4" /> Завершені курси ({list.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {list.map((e) => (
          <div key={e.enrollmentId} className="flex items-center gap-2 p-2 border border-stone-200 dark:border-stone-700 rounded">
            <GraduationCap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-stone-800 dark:text-stone-100 truncate">{e.course.title}</div>
              <div className="text-xs text-stone-400">{new Date(e.completedAt).toLocaleDateString('uk-UA')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleOneOnOneModal({ employee, currentUserId, onClose, onCreated }) {
  const toLocalInput = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const tomorrow10 = new Date(); tomorrow10.setDate(tomorrow10.getDate() + 1); tomorrow10.setHours(10, 0, 0, 0);
  const [form, setForm] = useState({
    scheduledAt: toLocalInput(tomorrow10.getTime()),
    duration: 30,
    location: '',
    agenda: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!form.scheduledAt) return setError('Вкажіть дату й час');
    setBusy(true);
    try {
      await apiPost('/api/one-on-ones', {
        employeeId: employee.id,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        duration: parseInt(form.duration, 10) || 30,
        location: form.location || null,
        agenda: form.agenda || null,
        organizerId: currentUserId,
      });
      onCreated?.();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-lg md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Запланувати 1:1</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-stone-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 md:p-6 space-y-3 overflow-y-auto flex-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="flex items-center gap-2 p-2 bg-stone-50 dark:bg-stone-800 rounded">
            <span className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden flex items-center justify-center flex-shrink-0">
              {employee.avatarUrl ? <img src={employee.avatarUrl} alt="" className="w-full h-full object-cover" /> : (employee.name || '?')[0]}
            </span>
            <span className="text-sm text-stone-700 dark:text-stone-200">З ким: <b>{employee.name}{employee.surname ? ` ${employee.surname}` : ''}</b></span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Дата і час</span>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Тривалість, хв</span>
              <input type="number" min={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Локація (кабінет, Meet-посилання…)</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Порядок денний (markdown)</span>
            <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={4}
              className="w-full p-3 border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
          </label>
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>
        <div className="p-4 md:p-6 border-t border-stone-200 dark:border-stone-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
          <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Збереження…' : 'Запланувати'}
          </button>
        </div>
      </div>
    </div>
  );
}
