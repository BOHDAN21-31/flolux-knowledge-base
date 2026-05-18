// Спільна мапа ролей. Винесено в окремий модуль, щоб App.jsx, AdminPanel.jsx
// та ProfilePage.jsx не утворювали циклічних імпортів.
import { Flower2, Shield, Users, FileText, Wrench } from 'lucide-react';

export const ROLES = {
  admin: { name: 'Адміністратор', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: Shield },
  florist: { name: 'Флорист', color: 'bg-pink-100 text-pink-800 border-pink-300', icon: Flower2 },
  location_manager: { name: 'Управляючий локації', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Users },
  warehouse: { name: 'Складський працівник', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: FileText },
  accountant: { name: 'Бухгалтер', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: FileText },
  wholesale: { name: 'Оптовий менеджер', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Users },
  courier: { name: "Кур'єр", color: 'bg-orange-100 text-orange-800 border-orange-300', icon: Users },
  logist: { name: 'Логіст', color: 'bg-cyan-100 text-cyan-800 border-cyan-300', icon: Users },
  barista: { name: 'Бариста', color: 'bg-stone-100 text-stone-800 border-stone-300', icon: Users },
  driver: { name: 'Водій вантажного авто', color: 'bg-slate-100 text-slate-800 border-slate-300', icon: Users },
  tech: { name: 'Технічна підтримка', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: Wrench },
};

// Усі ключі ролей у стабільному порядку (для груп бібліотеки / селекторів).
export const ROLE_KEYS = Object.keys(ROLES);

// Ролі для реєстрації — всі, крім admin.
export const REGISTER_ROLES = Object.entries(ROLES).filter(([key]) => key !== 'admin');

export const roleName = (key) => ROLES[key]?.name || '—';

// Масив ролей користувача (нормалізує можливі форми) з фолбеком на assignedRole.
export const userRoles = (u) => {
  const list = Array.isArray(u?.roles) ? u.roles.filter(Boolean) : [];
  if (list.length) return list;
  return u?.assignedRole ? [u.assignedRole] : [];
};

export const isAdminUser = (u) => userRoles(u).includes('admin');
