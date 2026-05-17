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
  { name: 'Позняки', slug: 'poznyaky', color: '#e11d48' },
  { name: 'КТ', slug: 'kt', color: '#f59e0b' },
  { name: 'ВЛ16', slug: 'vl16', color: '#10b981' },
  { name: 'Оболонь', slug: 'obolon', color: '#3b82f6' },
  { name: 'Ретро.Склад', slug: 'retro-sklad', color: '#8b5cf6' },
  { name: 'Кон.Фенси', slug: 'kon-fensi', color: '#ec4899' },
  { name: 'Максимовича', slug: 'maksymovycha', color: '#14b8a6' },
];

// Сід дефолтних локацій. Виконується лише якщо таблиця Location порожня.
export async function seedLocations() {
  if ((await prisma.location.count()) === 0) {
    await prisma.location.createMany({ data: LOCATIONS });
    console.log(`[seed] створено ${LOCATIONS.length} дефолтних локацій`);
  }
}
