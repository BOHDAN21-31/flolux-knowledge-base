// Централізовані хелпери прав. Єдине джерело правди — lib.js.
// admin            — повний доступ (все, як раніше).
// senior (hr|admin)— повний доступ до КОНТЕНТУ (статті/локації read/дайджести),
//                    але БЕЗ PII користувачів, скидання паролів,
//                    керування ролями/локаціями CRUD, видалення юзерів,
//                    повного адмін-журналу.
export {
  isAdmin,
  isSenior,
  canSeeUserPII,
  canManageUsers,
  canManageSystem,
} from './lib.js';

import { isSenior } from './lib.js';

export const canSeeAllContent = (u) => isSenior(u);
