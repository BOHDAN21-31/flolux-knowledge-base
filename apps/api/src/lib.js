// Дрібні спільні утиліти бекенду.

export const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// Простий slug з назви (підтримує юнікод-літери), з фолбеком.
export function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[\s.]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || `loc-${Date.now()}`;
}

export const isAdmin = (user) => user?.assignedRole === 'admin';
