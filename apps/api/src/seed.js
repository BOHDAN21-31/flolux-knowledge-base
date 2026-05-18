import { prisma } from './db.js';
import { DEFAULT_TOPICS } from './constants.js';

// Сід дефолтних топіків для всіх ролей. Виконується лише якщо таблиця Topic порожня.
export async function seedTopics() {
  const count = await prisma.topic.count();
  if (count > 0) return;

  const rows = [];
  for (const [roleKey, topics] of Object.entries(DEFAULT_TOPICS)) {
    for (const t of topics) {
      rows.push({ id: t.id, roleKey, title: t.title, description: t.description });
    }
  }
  await prisma.topic.createMany({ data: rows, skipDuplicates: true });
  console.log(`[seed] створено ${rows.length} дефолтних топіків`);
}

const LOCATIONS = [
  { name: 'КОНОВАЛЬЦЯ', slug: 'konovaltsya', color: '#e11d48' },
  { name: 'РЕТРО', slug: 'retro', color: '#8b5cf6' },
  { name: 'КТ', slug: 'kt', color: '#f59e0b' },
  { name: 'ВЛ', slug: 'vl', color: '#10b981' },
  { name: 'ПИМОНЕНКА', slug: 'pymonenka', color: '#0ea5e9' },
  { name: 'ПОЗНЯКИ', slug: 'poznyaky', color: '#dc2626' },
  { name: 'ОБОЛОНЬ', slug: 'obolon', color: '#3b82f6' },
  { name: 'ФЕНСІ', slug: 'fensi', color: '#ec4899' },
  { name: 'РІВНЕ', slug: 'rivne', color: '#14b8a6' },
  { name: 'ВИННИЧЕНКА Львів', slug: 'vynnychenka-lviv', color: '#f97316' },
  { name: 'АНТОНОВИЧА Львів', slug: 'antonovycha-lviv', color: '#84cc16' },
  { name: 'ВОВЧИНЕЦЬКА Франик', slug: 'vovchynetska-franyk', color: '#06b6d4' },
  { name: 'ЧОРНОВОЛА Франковськ', slug: 'chornovola-frankovsk', color: '#a855f7' },
  { name: 'Стрийська Львів', slug: 'stryjska-lviv', color: '#22c55e' },
  { name: 'Хмельницького Львів', slug: 'khmelnytskoho-lviv', color: '#eab308' },
  { name: 'Бухгалтерія', slug: 'buhgalteriya', color: '#64748b' },
];

// Сід дефолтних локацій. Виконується лише якщо таблиця Location порожня.
export async function seedLocations() {
  if ((await prisma.location.count()) === 0) {
    await prisma.location.createMany({ data: LOCATIONS });
    console.log(`[seed] створено ${LOCATIONS.length} дефолтних локацій`);
  }
}
