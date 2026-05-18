import { useState } from 'react';
import { Star } from 'lucide-react';

// Рейтинг 1..5. avg — середнє (заповнення), mine — мій вибір (підсвітка).
// onRate(n) робить його інтерактивним; без onRate — лише показ.
export default function Stars({ avg = 0, mine = null, count = 0, onRate }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onRate === 'function';

  return (
    <div className="flex items-center gap-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = hover ? n <= hover : n <= Math.round(avg);
          const isMine = mine != null && n <= mine;
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onRate(n)}
              onMouseEnter={() => interactive && setHover(n)}
              onMouseLeave={() => interactive && setHover(0)}
              title={interactive ? `Оцінити на ${n}` : undefined}
              className={interactive ? 'cursor-pointer' : 'cursor-default'}
            >
              <Star
                className={`w-4 h-4 ${active ? 'text-amber-500' : isMine ? 'text-amber-300' : 'text-stone-300'}`}
                fill={active || isMine ? 'currentColor' : 'none'}
              />
            </button>
          );
        })}
      </div>
      <span className="text-xs text-stone-500">
        ★ {Number(avg).toFixed(1)} ({count} {count === 1 ? 'оцінка' : count >= 2 && count <= 4 ? 'оцінки' : 'оцінок'})
        {mine != null && <span className="text-amber-600"> · ваша: {mine}</span>}
      </span>
    </div>
  );
}
