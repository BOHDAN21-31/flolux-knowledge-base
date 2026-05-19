import { useState, useEffect } from 'react';
import { FileText, MessageSquare, Lightbulb } from 'lucide-react';
import { apiGet } from '../api';

const META = {
  article: { icon: FileText, verb: 'створив(ла) статтю' },
  comment: { icon: MessageSquare, verb: 'коментар у' },
  suggestion: { icon: Lightbulb, verb: 'запропонував(ла) правку у' },
};

export default function ActivityFeed({ userId, onOpenArticle, title = '🕐 Активність' }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let active = true;
    apiGet(`/api/users/${userId}/activity`)
      .then((d) => { if (active) setItems(Array.isArray(d) ? d : []); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [userId]);

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-6">
      <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">{title}</h3>
      {items === null ? (
        <p className="text-sm text-stone-400 italic">Завантаження…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone-400 italic">Поки що немає активності</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {items.map((it, i) => {
            const m = META[it.type] || META.article;
            const Ico = m.icon;
            return (
              <button key={`${it.type}-${it.articleId}-${i}`} onClick={() => onOpenArticle?.(it.articleId)}
                className="w-full text-left flex items-start gap-2.5 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0 hover:text-rose-600">
                <Ico className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-stone-700 dark:text-stone-200">
                  <span className="text-stone-400">{new Date(it.at).toLocaleDateString('uk-UA')}</span>
                  {' — '}{m.verb} «{it.articleTitle}»
                  {it.type === 'suggestion' && it.ratingCount > 0 && (
                    <span className="text-amber-600"> · ★ {it.ratingAvg}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
