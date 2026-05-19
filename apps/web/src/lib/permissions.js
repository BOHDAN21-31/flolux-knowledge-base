// Централізовані хелпери прав фронтенду (єдине джерело — roles.js).
// isAdmin  — повний доступ (керування користувачами/системою, PII).
// isSenior — admin|hr: повний доступ до КОНТЕНТУ, але без PII/керування.
import { isAdminUser, isSeniorUser } from '../roles';

export const isAdmin = (user) => isAdminUser(user);
export const isSenior = (user) => isSeniorUser(user);
