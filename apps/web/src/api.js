// API-клієнт Flolux. JWT-токен зберігається в localStorage під ключем "token"
// і додається в кожен запит як Authorization: Bearer.
// При 401 токен видаляється і кидається подія "flolux:unauthorized".

const TOKEN_KEY = 'token';
export const UNAUTHORIZED_EVENT = 'flolux:unauthorized';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export function clearToken() {
  setToken(null);
}

async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const err = new Error('Сесія завершилася. Увійдіть знову.');
    err.status = 401;
    throw err;
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Помилка запиту (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body) => request('POST', path, body ?? {});
export const apiPatch = (path, body) => request('PATCH', path, body ?? {});
export const apiDelete = (path) => request('DELETE', path);

// Завантаження файлу (multipart/form-data). Повертає { url, type, size, mime }.
// Завантаження через XHR — щоб мати прогрес (onProgress(percent)).
export function apiUpload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        clearToken();
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
        reject(new Error('Сесія завершилася. Увійдіть знову.'));
        return;
      }
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || 'Помилка завантаження'));
    };
    xhr.onerror = () => reject(new Error('Помилка мережі під час завантаження'));
    xhr.send(fd);
  });
}

// WebAuthn (Touch/Face ID) через @simplewebauthn/browser
export async function webauthnRegister(deviceName) {
  const { startRegistration } = await import('@simplewebauthn/browser');
  const options = await apiPost('/api/auth/webauthn/register/options');
  const response = await startRegistration(options);
  return apiPost('/api/auth/webauthn/register/verify', { response, deviceName });
}

export async function webauthnLogin(email) {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const options = await apiPost('/api/auth/webauthn/login/options', { email });
  const response = await startAuthentication(options);
  // повертає { token, user } — як звичайний пароль-логін
  return apiPost('/api/auth/webauthn/login/verify', { email, response });
}

export async function webauthnSupported() {
  try {
    const { browserSupportsWebAuthn } = await import('@simplewebauthn/browser');
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}
