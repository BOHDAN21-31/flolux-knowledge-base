import { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, FileText, MessageSquare, Lightbulb, GraduationCap, Award } from 'lucide-react';
import { apiGet } from '../api';
import { useRoles } from '../RolesContext';
import { accountLevel } from '../level';
import ActivityFeed from './ActivityFeed';

export default function PublicProfile({ userId, currentUser, onBack, onEditProfile, onOpenArticle }) {
  const { roleName, roleChipStyle } = useRoles();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    setStatus('loading');
    let active = true;
    apiGet(`/api/users/${userId}/public`)
      .then((d) => { if (active) { setData(d); setStatus('ok'); } })
      .catch((e) => { if (active) { console.error(e); setStatus('error'); } });
    return () => { active = false; };
  }, [userId]);

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
  const stat = [
    { label: 'Статей', value: data.articlesCount, icon: FileText },
    { label: 'Коментарів', value: data.commentsCount, icon: MessageSquare },
    { label: 'Пропозицій', value: data.suggestionsCount, icon: Lightbulb },
  ];

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
            <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">{data.name}{data.surname ? ` ${data.surname}` : ''}</h1>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(data.roles || []).length === 0
                ? <span className="text-xs text-stone-400 italic">без ролі</span>
                : data.roles.map((r) => (
                  <span key={r} className="px-2.5 py-0.5 rounded-full text-xs border" style={roleChipStyle(r)}>{roleName(r)}</span>
                ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-sm text-stone-600 dark:text-stone-300" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <span className="flex items-center gap-1 text-amber-600"><Star className="w-4 h-4" />{data.rating}</span>
              <span className="text-stone-400">·</span>
              <span>{accountLevel(data.rating)}</span>
              <span className="text-stone-400">·</span>
              <span className="text-stone-400">з {new Date(data.createdAt).toLocaleDateString('uk-UA')}</span>
            </div>
          </div>
          {isMe && (
            <button onClick={onEditProfile} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm whitespace-nowrap">
              Редагувати профіль
            </button>
          )}
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

      <CompletedCoursesSection userId={userId} />

      <div className="mt-6">
        <ActivityFeed userId={userId} onOpenArticle={onOpenArticle} />
      </div>
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
