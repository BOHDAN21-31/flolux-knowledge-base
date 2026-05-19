// Чисті хелпери для ролей користувача (без хардкоду переліку ролей —
// перелік тепер у БД через RolesContext).

// Масив ключів ролей користувача (нормалізує форми) з фолбеком на assignedRole.
export const userRoles = (u) => {
  const list = Array.isArray(u?.roles) ? u.roles.filter(Boolean) : [];
  if (list.length) return list;
  return u?.assignedRole ? [u.assignedRole] : [];
};

export const isAdminUser = (u) => userRoles(u).includes('admin');
