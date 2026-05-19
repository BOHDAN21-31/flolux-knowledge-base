import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiGet } from './api';

// Ролі тепер у БД. Контекст вантажить їх раз і роздає по застосунку.
const RolesContext = createContext(null);

export function RolesProvider({ children }) {
  const [roles, setRoles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await apiGet('/api/roles');
      setRoles(Array.isArray(list) ? list : []);
    } catch {
      setRoles([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const byKey = Object.fromEntries(roles.map((r) => [r.key, r]));
  const roleName = (key) => byKey[key]?.name || key || '—';
  const roleColor = (key) => byKey[key]?.color || null;
  const roleKeys = roles.map((r) => r.key);
  const registerRoles = roles.filter((r) => r.key !== 'admin');

  // М'який бейдж за hex-кольором ролі (раніше були tailwind-класи).
  const roleChipStyle = (key) => {
    const c = roleColor(key);
    if (!c) return { background: '#f5f5f4', color: '#57534e', borderColor: '#e7e5e4' };
    return { background: `${c}1A`, color: c, borderColor: `${c}55` };
  };

  const value = {
    roles, byKey, roleName, roleColor, roleKeys, registerRoles,
    roleChipStyle, loaded, reload,
  };
  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}

export function useRoles() {
  const ctx = useContext(RolesContext);
  if (!ctx) {
    // Безпечний фолбек, якщо хук викликано поза провайдером.
    return {
      roles: [], byKey: {}, roleName: (k) => k || '—', roleColor: () => null,
      roleKeys: [], registerRoles: [], roleChipStyle: () => ({}),
      loaded: false, reload: () => {},
    };
  }
  return ctx;
}
