// Talks to the Apps Script backends. Sign-in with Google Identity Services.
import { t, getLang } from './i18n.js';

const CFG = window.SERVISI_CONFIG || { backends: [], googleClientId: '' };
const TOKEN_KEY = 'servisi.idToken';
const BACKEND_KEY = 'servisi.backend';

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) { /* storage unavailable: keep in memory only */ }
}
function load(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

let idToken = load(TOKEN_KEY);
let backendUrl = load(BACKEND_KEY);

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000;
  } catch (e) {
    return 0;
  }
}

export function hasValidToken() {
  if (!idToken) return false;
  if (idToken.startsWith('fake:')) return true; // local development server only
  return tokenExpiry(idToken) - Date.now() > 60 * 1000;
}

export function setToken(token) {
  idToken = token;
  store(TOKEN_KEY, token);
}

export function signOut() {
  setToken(null);
  store(BACKEND_KEY, null);
  backendUrl = null;
  try { window.google?.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
}

export function config() {
  return CFG;
}

export function currentBackend() {
  return backendUrl;
}

export function chooseBackend(url) {
  backendUrl = url;
  store(BACKEND_KEY, url);
}

/** Renders the Google button into el and calls onToken with the ID token. */
export function renderGoogleButton(el, onToken) {
  const start = () => {
    if (!window.google?.accounts?.id) return setTimeout(start, 150);
    window.google.accounts.id.initialize({
      client_id: CFG.googleClientId,
      callback: (r) => { setToken(r.credential); onToken(r.credential); },
      auto_select: true,
      use_fedcm_for_prompt: true
    });
    window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' });
    window.google.accounts.id.prompt();
  };
  start();
}

async function post(url, action, data, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    // text/plain keeps this a "simple" request (no CORS preflight, which Apps Script cannot answer).
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, data, lang: getLang() }),
      redirect: 'follow',
      signal: ctrl.signal
    });
  } catch (e) {
    throw new ApiError('NETWORK', e.name === 'AbortError'
      ? t('The server did not answer in time. Check the connection and try again.')
      : t('No connection to the server. Check the connection and try again.'));
  } finally {
    clearTimeout(timer);
  }
  let body;
  try {
    body = await res.json();
  } catch (e) {
    throw new ApiError('BAD_RESPONSE', t('The server returned an unexpected answer (HTTP {s}).', { s: res.status }));
  }
  if (!body.ok) {
    if (body.error.code === 'AUTH') setToken(null);
    throw new ApiError(body.error.code, body.error.message);
  }
  return body.data;
}

export function call(action, data = {}) {
  if (!backendUrl) throw new ApiError('NO_BACKEND', t('No organisation selected.'));
  return post(backendUrl, action, data);
}

export function callAt(url, action, data = {}, timeoutMs) {
  return post(url, action, data, timeoutMs);
}

/** Asks every configured backend who the signed-in user is. */
export async function discover() {
  const results = await Promise.all(CFG.backends.map(async (url) => {
    try {
      return { url, ...(await post(url, 'whoami', {}, 30000)) };
    } catch (e) {
      return { url, error: e };
    }
  }));
  return results;
}
