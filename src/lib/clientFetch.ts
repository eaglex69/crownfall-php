const TOKEN_KEY = 'royale_session_token';
export const SESSION_TOKEN_KEY = TOKEN_KEY;

export function getToken(): string | null {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try { if (token) window.localStorage.setItem(TOKEN_KEY, token); else window.localStorage.removeItem(TOKEN_KEY); } catch {}
}
function buildInit(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token && !headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
  return { ...init, headers, credentials: 'same-origin' };
}
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, buildInit(init));
  if (res.status === 401 && !url.includes('/api/auth') && !url.includes('/api/auth/link')) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('royale-session-expired'));
  }
  return res;
}
