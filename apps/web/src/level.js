// Простий гейміфікований рівень акаунта за рейтингом (к-сть отриманих 4–5★ оцінок).
export function accountLevel(rating = 0) {
  const r = Number(rating) || 0;
  if (r >= 50) return 'Майстер';
  if (r >= 20) return 'Експерт';
  if (r >= 5) return 'Активний';
  return 'Новачок';
}
