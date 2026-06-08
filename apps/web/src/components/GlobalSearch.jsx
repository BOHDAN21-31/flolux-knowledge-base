import { useState, useEffect, useRef } from 'react';
import { Search, FileText, User, MapPin, BookOpen, X } from 'lucide-react';
import { apiGet } from '../api';

const GROUPS = [
  { key: 'articles', label: 'Статті', icon: FileText },
  { key: 'users', label: 'Користувачі', icon: User },
  { key: 'locations', label: 'Локації', icon: MapPin },
  { key: 'topics', label: 'Розділи', icon: BookOpen },
];

export default function GlobalSearch({ open, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ articles: [], users: [], locations: [], topics: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ(''); setRes({ articles: [], users: [], locations: [], topics: [] }); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // debounce 200мс
  useEffect(() => {
    if (!open) return undefined;
    if (q.trim().length < 2) { setRes({ articles: [], users: [], locations: [], topics: [] }); return undefined; }
    let active2 = true;
    setLoading(true);
    const t = setTimeout(() => {
      apiGet(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((d) => { if (active2) { setRes(d); setActive(0); } })
        .catch(() => { if (active2) setRes({ articles: [], users: [], locations: [], topics: [] }); })
        .finally(() => { if (active2) setLoading(false); });
    }, 200);
    return () => { active2 = false; clearTimeout(t); };
  }, [q, open]);

  // Плаский список для навігації стрілками
  const flat = [];
  GROUPS.forEach((g) => (res[g.key] || []).forEach((item) => flat.push({ kind: g.key, item })));

  const pick = (entry) => {
    if (!entry) return;
    onPick(entry.kind, entry.item);
    onClose();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); pick(flat[active]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flat.length, active]);

  if (!open) return null;

  let idx = -1;
  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-2 sm:px-4 pt-4 sm:pt-20">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-stone-200 dark:border-stone-700">
          <Search className="w-4 h-4 text-stone-400 flex-shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук…"
            className="flex-1 min-w-0 py-3 bg-transparent text-stone-800 dark:text-stone-100 focus:outline-none text-sm"
            style={{ fontFamily: 'system-ui, sans-serif' }} />
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[70vh] sm:max-h-[60vh] overflow-y-auto" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {q.trim().length < 2 ? (
            <p className="p-6 text-sm text-stone-400 text-center">Введіть щонайменше 2 символи…</p>
          ) : loading && flat.length === 0 ? (
            <p className="p-6 text-sm text-stone-400 text-center">Пошук…</p>
          ) : flat.length === 0 ? (
            <p className="p-6 text-sm text-stone-400 text-center">Нічого не знайдено</p>
          ) : (
            GROUPS.filter((g) => (res[g.key] || []).length > 0).map((g) => (
              <div key={g.key}>
                <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <g.icon className="w-3.5 h-3.5" /> {g.label}
                </div>
                {(res[g.key] || []).map((item) => {
                  idx += 1;
                  const i = idx;
                  return (
                    <button key={`${g.key}-${item.id}`} onClick={() => pick({ kind: g.key, item })}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full text-left px-4 py-3 min-h-[44px] flex flex-col ${active === i ? 'bg-rose-50 dark:bg-stone-800' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                      <span className="text-sm text-stone-800 dark:text-stone-100 truncate">
                        {item.title || item.name}
                      </span>
                      <span className="text-xs text-stone-400 truncate">
                        {item.excerpt || (item.roles ? item.roles.join(', ') : '') || item.city || item.roleKey || ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
