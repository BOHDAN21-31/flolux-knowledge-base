import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { apiGet, apiPatch, apiDelete } from '../api';

function bucket(ms) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ms >= startToday) return 'Сьогодні';
  if (ms >= startToday - 864e5) return 'Вчора';
  if (ms >= startToday - 7 * 864e5) return 'Тиждень тому';
  return 'Раніше';
}

export default function NotificationsPage({ onBack, onOpenPath }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback((reset) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '20' });
    if (filter === 'unread') params.set('filter', 'unread');
    if (!reset && cursor) params.set('before', String(cursor));
    apiGet(`/api/notifications?${params.toString()}`)
      .then((d) => {
        setItems((prev) => (reset ? d.items : [...prev, ...d.items]));
        setCursor(d.nextCursor);
        setHasMore(!!d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, cursor]);

  useEffect(() => {
    setItems([]); setCursor(null); load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const open = (n) => {
    if (!n.readAt) apiPatch(`/api/notifications/${n.id}/read`).catch(() => {});
    if (n.linkPath) onOpenPath(n.linkPath);
  };
  const markAll = async () => { await apiPatch('/api/notifications/read-all').catch(() => {}); load(true); };
  const del = async (id, e) => { e.stopPropagation(); await apiDelete(`/api/notifications/${id}`).catch(() => {}); setItems((p) => p.filter((x) => x.id !== id)); };

  let lastBucket = null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Повернутися
        </button>
        <button onClick={markAll} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-rose-600 min-h-[44px]">
          <Check className="w-4 h-4" /> Прочитати всі
        </button>
      </div>

      <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100 mb-4">Сповіщення</h1>

      <div className="flex gap-1 mb-4 bg-stone-100 dark:bg-stone-800 rounded-md p-1 w-fit" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {[['all', 'Усі'], ['unread', 'Непрочитані']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-4 min-h-[40px] rounded text-sm ${filter === k ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {items.length === 0 && !loading ? (
          <p className="p-8 text-center text-sm text-stone-400 italic">Нічого немає</p>
        ) : items.map((n) => {
          const b = bucket(n.createdAt);
          const showHeader = b !== lastBucket;
          lastBucket = b;
          return (
            <div key={n.id}>
              {showHeader && <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-stone-400">{b}</div>}
              <div onClick={() => open(n)}
                className={`px-4 py-3 border-b border-stone-100 dark:border-stone-800 last:border-0 flex gap-3 cursor-pointer ${n.readAt ? '' : 'bg-rose-50/60 dark:bg-stone-800/60'}`}>
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-rose-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-800 dark:text-stone-100">{n.title}</div>
                  {n.body && <div className="text-xs text-stone-500 dark:text-stone-400">{n.body}</div>}
                  <div className="text-xs text-stone-400 mt-0.5">{new Date(n.createdAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
                <button onClick={(e) => del(n.id, e)} className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-rose-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button onClick={() => load(false)} disabled={loading}
            className="w-full p-3 text-sm text-rose-600 hover:bg-stone-50 dark:hover:bg-stone-800">
            {loading ? 'Завантаження…' : 'Показати більше'}
          </button>
        )}
      </div>
    </div>
  );
}
