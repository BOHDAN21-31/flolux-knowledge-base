import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, Settings } from 'lucide-react';
import { apiGet, apiPatch } from '../api';

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'щойно';
  if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
  if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
  return new Date(ms).toLocaleDateString('uk-UA');
}

export default function NotificationBell({ onOpenPath, onOpenAll, onOpenSettings }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCount = useCallback(() => {
    apiGet('/api/notifications/unread-count').then((d) => setCount(d.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 30000);
    return () => clearInterval(t);
  }, [loadCount]);

  const loadList = () => {
    setLoading(true);
    apiGet('/api/notifications?limit=20')
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.readAt) {
      apiPatch(`/api/notifications/${n.id}/read`).then(loadCount).catch(() => {});
    }
    if (n.linkPath) onOpenPath(n.linkPath);
  };

  const markAll = async () => {
    await apiPatch('/api/notifications/read-all').catch(() => {});
    loadCount();
    loadList();
  };

  return (
    <div className="relative">
      <button onClick={toggle} className="w-11 h-11 flex items-center justify-center text-stone-500 dark:text-stone-300 hover:text-rose-500 relative" aria-label="Сповіщення">
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:right-0 md:top-12 md:w-96 bg-white dark:bg-stone-900 md:border border-stone-200 dark:border-stone-700 md:rounded-lg md:shadow-xl flex flex-col"
            style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700">
              <span className="text-stone-800 dark:text-stone-100" style={{ fontFamily: 'Georgia, serif' }}>Сповіщення</span>
              <div className="flex items-center gap-1">
                <button onClick={markAll} title="Позначити всі прочитаними" className="w-9 h-9 flex items-center justify-center text-stone-500 dark:text-stone-300 hover:text-rose-500"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setOpen(false); onOpenSettings(); }} title="Налаштування" className="w-9 h-9 flex items-center justify-center text-stone-500 dark:text-stone-300 hover:text-rose-500"><Settings className="w-4 h-4" /></button>
                <button onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center text-stone-400 md:hidden"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[70vh] md:max-h-96">
              {loading ? (
                <p className="p-6 text-sm text-stone-400 text-center">Завантаження…</p>
              ) : items.length === 0 ? (
                <p className="p-6 text-sm text-stone-400 text-center">Сповіщень немає</p>
              ) : items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex gap-3 ${n.readAt ? '' : 'bg-rose-50/60 dark:bg-stone-800/60'}`}>
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-rose-500'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm text-stone-800 dark:text-stone-100">{n.title}</span>
                    {n.body && <span className="block text-xs text-stone-500 dark:text-stone-400 truncate">{n.body}</span>}
                    <span className="block text-xs text-stone-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => { setOpen(false); onOpenAll(); }}
              className="p-3 text-sm text-rose-600 hover:bg-stone-50 dark:hover:bg-stone-800 border-t border-stone-200 dark:border-stone-700">
              Усі сповіщення
            </button>
          </div>
        </>
      )}
    </div>
  );
}
