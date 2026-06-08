import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Settings, Clock, Wrench, Users, Pin, ChevronDown } from 'lucide-react';
import { apiGet, apiPost } from '../api';
import { ANNOUNCEMENT_CATEGORIES, announcementCategory } from '../constants';
import { renderMarkdown } from '../markdown';

const ICONS = { AlertCircle, Settings, Clock, Wrench, Users };

export function AnnouncementBadge({ category, priority }) {
  const c = announcementCategory(category);
  if (!c) return null;
  const Icon = ICONS[c.iconName] || AlertCircle;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border"
      style={{ background: `${c.color}1a`, color: c.color, borderColor: `${c.color}40` }}>
      <Icon className="w-3 h-3" />{c.label}
      {priority === 'urgent' && <span className="ml-1 px-1 rounded bg-rose-600 text-white text-[10px]">URGENT</span>}
      {priority === 'high' && <span className="ml-1 px-1 rounded bg-amber-600 text-white text-[10px]">HIGH</span>}
    </span>
  );
}

export function AnnouncementCard({ ann, onClick, expanded = false, onMarkRead }) {
  const c = announcementCategory(ann.category);
  const Icon = c ? (ICONS[c.iconName] || AlertCircle) : AlertCircle;
  const unread = !ann.readAt;
  const expired = ann.expiresAt && ann.expiresAt < Date.now();

  useEffect(() => {
    if (expanded && unread && onMarkRead) onMarkRead(ann.id);
  }, [expanded, unread, ann.id]);

  const wrapStyle = {};
  let cls = 'rounded-lg border p-4 transition cursor-pointer ';
  if (ann.pinned) {
    cls += 'border-amber-300 ring-1 ring-amber-200 ';
  } else {
    cls += 'border-stone-200 dark:border-stone-700 ';
  }
  if (unread && !expired) cls += 'bg-rose-50 dark:bg-rose-500/10 ';
  else cls += 'bg-white dark:bg-stone-900 ';
  if (expired) cls += 'opacity-60 ';

  return (
    <div className={cls} style={wrapStyle} onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: `${c?.color || '#78716c'}1a`, color: c?.color || '#78716c' }}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {ann.pinned && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                <Pin className="w-3 h-3" /> Закріплено
              </span>
            )}
            <AnnouncementBadge category={ann.category} priority={ann.priority} />
            {unread && !expired && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500 text-white">НОВЕ</span>
            )}
            {expired && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">Завершено</span>
            )}
          </div>
          <h3 className="text-base md:text-lg text-stone-800 dark:text-stone-100 leading-tight">{ann.title}</h3>
          <div className="text-xs text-stone-400 mt-1">
            {new Date(ann.createdAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
            {ann.expiresAt && <span> · до {new Date(ann.expiresAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}</span>}
          </div>
          {expanded && (
            <div className="prose prose-stone dark:prose-invert max-w-none text-sm mt-3 break-words"
              style={{ fontFamily: 'system-ui, sans-serif' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.body) }} />
          )}
          {!expanded && (
            <p className="text-sm text-stone-600 dark:text-stone-300 mt-1.5 line-clamp-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {String(ann.body || '').replace(/[*#>`]/g, '').slice(0, 200)}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition ${expanded ? 'rotate-180' : ''}`} />
      </div>
    </div>
  );
}

export default function AnnouncementsPage({ onBack, initialId = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(initialId);
  const [catFilter, setCatFilter] = useState('all');

  const load = () => {
    setLoading(true);
    apiGet('/api/announcements').then((d) => {
      setItems(Array.isArray(d) ? d : []);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (initialId) setOpenId(initialId); }, [initialId]);

  const markRead = (id) => {
    apiPost(`/api/announcements/${id}/read`).then(() => {
      setItems((prev) => prev.map((a) => a.id === id ? { ...a, readAt: Date.now() } : a));
    }).catch(() => {});
  };

  const shown = catFilter === 'all' ? items : items.filter((a) => a.category === catFilter);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 dark:border-stone-700">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Внутрішня комунікація</p>
        <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">📢 Оголошення</h1>
        <p className="text-stone-500 dark:text-stone-400 italic mt-1">Усі активні внутрішні оголошення компанії</p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <button onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs border transition ${catFilter === 'all' ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
          Усі ({items.length})
        </button>
        {ANNOUNCEMENT_CATEGORIES.map((c) => {
          const count = items.filter((a) => a.category === c.key).length;
          if (count === 0 && catFilter !== c.key) return null;
          return (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${catFilter === c.key ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
              style={catFilter === c.key ? { background: c.color } : undefined}>
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded mb-4">{error}</div>}
      {loading ? (
        <p className="text-sm text-stone-400 italic">Завантаження…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-8 text-center">Активних оголошень немає</p>
      ) : (
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
      )}
    </div>
  );
}
