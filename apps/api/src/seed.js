import bcrypt from 'bcryptjs';
import { prisma } from './db.js';
import { DEFAULT_TOPICS, DEFAULT_TECH_ARTICLES } from './constants.js';

export async function seedDatabase() {
  // 1. Топіки за замовчуванням для всіх ролей (лише якщо таблиця порожня)
  const topicCount = await prisma.topic.count();
  if (topicCount === 0) {
    const rows = [];
    for (const [roleKey, topics] of Object.entries(DEFAULT_TOPICS)) {
      for (const t of topics) {
        rows.push({ id: t.id, roleKey, title: t.title, description: t.description });
      }
    }
    await prisma.topic.createMany({ data: rows, skipDuplicates: true });
    console.log(`[seed] створено ${rows.length} дефолтних топіків`);
  }

  // 2. Перший адмін, якщо в БД немає жодного користувача
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@flolux.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin12345';
    const name = process.env.ADMIN_NAME || 'Адміністратор';
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name,
        assignedRole: 'admin',
        approved: true,
      },
    });
    console.log(`[seed] створено першого адміна: ${email} (пароль зі змінної ADMIN_PASSWORD)`);
  }

  // 3. Дефолтні технічні статті, якщо статей ще немає
  const articleCount = await prisma.article.count();
  if (articleCount === 0) {
    for (const a of DEFAULT_TECH_ARTICLES) {
      await prisma.article.create({
        data: {
          id: a.id,
          topicId: a.topicId,
          section: a.section,
          title: a.title,
          content: a.content,
          tags: a.tags,
        },
      });
    }
    console.log(`[seed] створено ${DEFAULT_TECH_ARTICLES.length} дефолтних тех-статей`);
  }
}
