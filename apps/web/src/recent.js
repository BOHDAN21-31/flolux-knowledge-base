// Нещодавно переглянуті статті — у localStorage (без БД).
const KEY = 'flolux:recent';
const MAX = 10;

export function getRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function addRecent(article) {
  if (!article?.id) return;
  try {
    const list = getRecent().filter((r) => r.articleId !== article.id);
    list.unshift({ articleId: article.id, title: article.title || 'Без назви', viewedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* ignore */ }
}
