import { prisma } from './db.js';
import { DEFAULT_TOPICS, DEFAULT_ROLES } from './constants.js';
import { PERMISSION_CATALOG, DEFAULT_PRESETS } from './permissions.js';

// Сід каталогу permissions. Upsert за ключем — назви/описи оновлюються,
// дефолтні лишаються protected (не видаляються через API).
export async function seedPermissions() {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { category: p.category, name: p.name, description: p.description ?? null, protected: true },
      create: { ...p, description: p.description ?? null, protected: true },
    });
  }
  console.log(`[seed] permissions синхронізовано (${PERMISSION_CATALOG.length})`);
}

// Дефолтні пресети — лише якщо такої назви ще нема (правки адміна не чіпаємо).
export async function seedPresets() {
  for (const preset of DEFAULT_PRESETS) {
    const exists = await prisma.permissionPreset.findFirst({ where: { name: preset.name } });
    if (!exists) await prisma.permissionPreset.create({ data: { ...preset } });
  }
  console.log(`[seed] пресети синхронізовано (${DEFAULT_PRESETS.length} дефолтних)`);
}

// Сід дефолтних ролей. Upsert лише за відсутності ключа — правки адміна не затираються.
export async function seedRoles() {
  for (const r of DEFAULT_ROLES) {
    await prisma.role.upsert({ where: { key: r.key }, update: {}, create: r });
  }
  console.log(`[seed] ролі синхронізовано (${DEFAULT_ROLES.length} дефолтних)`);
}

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

// Спец-топіки, що мають існувати завжди (idempotent upsert, не лише на порожній БД).
export async function seedSpecialTopics() {
  await prisma.topic.upsert({
    where: { id: 'hr-digests' },
    update: {},
    create: { id: 'hr-digests', roleKey: 'hr', title: 'Дайджести компанії', description: 'Загальнокорпоративні новини' },
  });
  console.log('[seed] спец-топік hr-digests синхронізовано');
}

const LOCATIONS = [
  // Київ
  { name: 'Бухгалтерія', slug: 'buhgalteriya', city: 'Київ', color: '#64748b' },
  { name: 'ВЛ16', slug: 'vl16', city: 'Київ', address: 'вул. Володимиро-Либідьска 16', color: '#10b981' },
  { name: 'Комфорт Таун', slug: 'komfort-taun', city: 'Київ', address: 'вул. Березнева 12', color: '#f59e0b' },
  { name: 'Коновальця 32б', slug: 'konovaltsya-32b', city: 'Київ', address: 'вул. Євгена Коновальця 32Б', color: '#e11d48' },
  { name: 'Лесі Українки', slug: 'lesi-ukrainky', city: 'Київ', address: 'бул. Лесі Українки, 12', color: '#0ea5e9' },
  { name: 'Нова Англія', slug: 'nova-anglia', city: 'Київ', address: 'вул. Михайла Максимовича, 26', color: '#a855f7' },
  { name: 'Оболонь', slug: 'obolon', city: 'Київ', color: '#3b82f6' },
  { name: 'Пимоненко', slug: 'pymonenko', city: 'Київ', address: 'вул. Пимоненка, 13Ж', color: '#06b6d4' },
  { name: 'Позняки', slug: 'poznyaky', city: 'Київ', address: 'пр-т. Бажана, 16Д', color: '#dc2626' },
  { name: 'Ретро', slug: 'retro', city: 'Київ', address: 'просп. Європейського союзу, 53/46', color: '#8b5cf6' },
  // Львів
  { name: 'Антоновича', slug: 'antonovycha', city: 'Львів', address: 'вул. Антоновича 31Б', color: '#84cc16' },
  { name: 'Винниченка', slug: 'vynnychenka', city: 'Львів', address: 'вул. Винниченка 3', color: '#f97316' },
  { name: 'Хмельницього ЖК', slug: 'khmelnytskoho-zhk', city: 'Львів', address: 'вул. Богдана Хмельницького 207Г', color: '#eab308' },
  // Івано-Франківськ
  { name: 'Вовчинецька 227', slug: 'vovchynetska-227', city: 'Івано-Франківськ', address: 'вул. Вовчинецька 227', color: '#22c55e' },
  { name: 'Хмельницького склад', slug: 'khmelnytskoho-sklad', city: 'Івано-Франківськ', address: 'вул. Хмельницького', color: '#14b8a6' },
  { name: 'Чорновола 3', slug: 'chornovola-3', city: 'Івано-Франківськ', address: 'вул. Чорновола, 3', color: '#ec4899' },
  // Рівне
  { name: 'Захисників Маріуполя 89', slug: 'zakhysnykiv-mariupolya-89', city: 'Рівне', address: 'вул. Захисників Маріуполя 89', color: '#a855f7' },
];

// Сід дефолтних локацій. Виконується лише якщо таблиця Location порожня.
export async function seedLocations() {
  if ((await prisma.location.count()) === 0) {
    await prisma.location.createMany({ data: LOCATIONS });
    console.log(`[seed] створено ${LOCATIONS.length} дефолтних локацій`);
  }
}

// Один порожній документ кожної категорії — стартова точка для адміна.
// Чернетки (publishedAt=null), не видні юзерам. Idempotent — створюються тільки
// за відсутності таких slug.
const DEFAULT_DOCS = [
  { slug: 'rules-of-conduct', title: 'Правила поведінки в компанії', category: 'conduct', iconKey: 'Shield', color: '#dc2626', description: 'Загальні правила та етика співробітників' },
  { slug: 'work-schedule', title: 'Робочий графік', category: 'schedule', iconKey: 'Clock', color: '#3b82f6', description: 'Розпорядок дня, перерви, вихідні' },
  { slug: 'how-to-reach-out', title: 'Алгоритм звернень', category: 'communication', iconKey: 'MessageCircle', color: '#10b981', description: 'До кого звертатись у різних ситуаціях' },
  { slug: 'vacation-policy', title: 'Політика відпусток', category: 'policies', iconKey: 'FileCheck', color: '#8b5cf6', description: 'Порядок оформлення відпусток та відгулів' },
];

export async function seedCompanyDocs() {
  for (const d of DEFAULT_DOCS) {
    const exists = await prisma.companyDoc.findUnique({ where: { slug: d.slug } });
    if (!exists) {
      await prisma.companyDoc.create({ data: { ...d, publishedAt: null } });
    }
  }
  console.log(`[seed] корпоративні документи синхронізовано (${DEFAULT_DOCS.length} шаблонів)`);
}
