export const PLAYER_COOKIE_NAME = 'pt_player';

export function readCookie(request, cookieName) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookiePairs = cookieHeader.split(';');
  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

export function buildPlayerCookie(anonId, env) {
  const secureFlag = env.COOKIE_SECURE !== 'false' ? '; Secure' : '';
  return `${PLAYER_COOKIE_NAME}=${encodeURIComponent(anonId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secureFlag}`;
}