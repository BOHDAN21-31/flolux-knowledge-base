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
