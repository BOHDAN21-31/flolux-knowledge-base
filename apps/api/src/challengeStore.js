// Короткостроковий in-memory стор челенджів WebAuthn (TTL 5 хв).
// Достатньо для одного інстансу; при рестарті незавершені челенджі губляться — це ок.

const TTL_MS = 5 * 60 * 1000;
const store = new Map();

export function putChallenge(key, challenge) {
  store.set(key, { challenge, expires: Date.now() + TTL_MS });
}

export function takeChallenge(key) {
  const entry = store.get(key);
  store.delete(key);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.challenge;
}

// Періодичне прибирання прострочених
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expires < now) store.delete(k);
  }
}, TTL_MS).unref?.();
