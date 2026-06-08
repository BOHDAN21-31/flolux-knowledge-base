// Категорії дайджестів — синхронізовано з apps/api/src/routes/digests.js
export const DIGEST_CATEGORIES = [
  { key: 'company_news', label: 'Новини компанії', icon: '📰', color: '#0ea5e9', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { key: 'welcome', label: 'Welcome нових співробітників', icon: '👋', color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { key: 'achievement', label: 'Досягнення команд', icon: '🏆', color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { key: 'process_change', label: 'Зміни в процесах', icon: '⚙️', color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { key: 'important_date', label: 'Важливі дати', icon: '🗓', color: '#ef4444', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
];

export const digestCategory = (key) => DIGEST_CATEGORIES.find((c) => c.key === key) || null;

// Категорії оголошень — синхронізовано з apps/api/src/routes/announcements.js
export const ANNOUNCEMENT_CATEGORIES = [
  { key: 'urgent', label: 'Терміново', iconName: 'AlertCircle', color: '#ef4444', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { key: 'process', label: 'Зміни в процесах', iconName: 'Settings', color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { key: 'deadline', label: 'Дедлайн', iconName: 'Clock', color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { key: 'tech_update', label: 'Технічне оновлення', iconName: 'Wrench', color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { key: 'org_change', label: 'Організаційне', iconName: 'Users', color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
];

export const announcementCategory = (key) => ANNOUNCEMENT_CATEGORIES.find((c) => c.key === key) || null;

// Категорії корпоративних документів — синхронізовано з apps/api/src/routes/company-docs.js
export const DOC_CATEGORIES = [
  { key: 'conduct', label: 'Правила поведінки', iconName: 'Shield', color: '#dc2626' },
  { key: 'schedule', label: 'Робочий графік', iconName: 'Clock', color: '#3b82f6' },
  { key: 'communication', label: 'Алгоритм звернень', iconName: 'MessageCircle', color: '#10b981' },
  { key: 'policies', label: 'Політики', iconName: 'FileCheck', color: '#8b5cf6' },
];

export const docCategory = (key) => DOC_CATEGORIES.find((c) => c.key === key) || null;

// Категорії курсів (LMS) — синхронізовано з apps/api/src/routes/courses.js
export const COURSE_CATEGORIES = [
  { key: 'onboarding', label: 'Онбординг', iconName: 'GraduationCap', color: '#10b981' },
  { key: 'role_specific', label: 'Для ролі', iconName: 'Briefcase', color: '#3b82f6' },
  { key: 'general', label: 'Загальні', iconName: 'BookOpen', color: '#a855f7' },
  { key: 'advanced', label: 'Поглиблені', iconName: 'Award', color: '#f59e0b' },
];

export const courseCategory = (key) => COURSE_CATEGORIES.find((c) => c.key === key) || null;

export const ANNOUNCEMENT_PRIORITIES = [
  { key: 'urgent', label: 'Терміновий', color: '#ef4444' },
  { key: 'high', label: 'Високий', color: '#f59e0b' },
  { key: 'normal', label: 'Звичайний', color: '#78716c' },
];
