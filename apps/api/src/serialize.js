// Перетворення Prisma-записів у форму, зручну для фронтенду
// (createdAt у мс, аліаси author/authorName/authorRole).

const ms = (d) => (d instanceof Date ? d.getTime() : d);

export const serializeArticle = (a) => ({
  id: a.id,
  topicId: a.topicId,
  section: a.section,
  title: a.title,
  content: a.content,
  tags: a.tags || [],
  mediaUrls: a.mediaUrls || [],
  locations: (a.locations || []).map((al) => ({
    locationId: al.locationId,
    name: al.location?.name,
    color: al.location?.color || null,
  })),
  author: a.authorId || 'system',
  authorRole: a.author?.assignedRole || 'tech',
  authorName: a.author?.name || 'Система',
  // Середній рейтинг усіх пропозицій до статті (для сортування бібліотеки)
  ratingAvg: (() => {
    const rs = (a.suggestions || []).flatMap((s) => s.ratings || []);
    return rs.length ? Math.round((rs.reduce((x, r) => x + r.rating, 0) / rs.length) * 10) / 10 : 0;
  })(),
  createdAt: ms(a.createdAt),
  updatedAt: ms(a.updatedAt),
});

export const serializeComment = (c) => ({
  id: c.id,
  articleId: c.articleId,
  author: c.authorId,
  authorName: c.author?.name || 'Користувач',
  authorRole: c.author?.assignedRole || null,
  content: c.content,
  createdAt: ms(c.createdAt),
});

export const serializeSuggestion = (s, userId = null) => {
  const ratings = s.ratings || [];
  const count = ratings.length;
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return {
    id: s.id,
    articleId: s.articleId,
    author: s.authorId,
    authorName: s.author?.name || 'Користувач',
    authorRole: s.author?.assignedRole || null,
    content: s.content,
    status: s.status,
    createdAt: ms(s.createdAt),
    ratingAvg: count ? Math.round((sum / count) * 10) / 10 : 0,
    ratingCount: count,
    myRating: userId ? (ratings.find((r) => r.userId === userId)?.rating ?? null) : null,
  };
};
