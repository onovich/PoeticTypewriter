import api from './index.js';

const BASE_PATH = '/PoeticTypewriter';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === BASE_PATH) {
      url.pathname += '/';
      return Response.redirect(url.toString(), 308);
    }
    if (!url.pathname.startsWith(`${BASE_PATH}/`)) {
      return new Response('Not found', { status: 404 });
    }
    const apiPath = url.pathname.slice(BASE_PATH.length);
    if (apiPath === '/health' || apiPath === '/v1' || apiPath.startsWith('/v1/')) {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) {
        return Response.json({ error: { code: 'origin_not_allowed', message: '不允许跨站访问。' } }, {
          status: 403,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      url.pathname = apiPath;
      return api.fetch(new Request(url, request), {
        ...env, ALLOWED_ORIGIN: url.origin, PLAYER_COOKIE_PATH: `${BASE_PATH}/`,
      }, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
