import assert from 'node:assert/strict';
import { test } from 'node:test';
import api from '../src/index.js';
import cloudflare from '../src/cloudflare.js';
import { readCookie, buildPlayerCookie } from '../src/cookies.js';
import { readFileSync } from 'node:fs';
import { createSignedRunToken, verifySignedRunToken } from '../src/tokens.js';

test('async malformed JSON is caught and returned as JSON with no-store', async () => {
  const db = { prepare() { return { bind() { return this; }, async first() { return { id: 'player' }; }, async run() {} }; } };
  const response = await api.fetch(new Request('https://game.onovich.com/v1/runs/start', {
    method: 'POST', body: '{',
  }), { DB: db, RUN_TOKEN_SECRET: 'test-only' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'invalid_json');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('foreign origins cannot reach the API; same-origin API and static assets route separately', async () => {
  const blocked = await cloudflare.fetch(new Request('https://game.onovich.com/PoeticTypewriter/v1/runs/start', {
    method: 'POST', headers: { Origin: 'https://blog.onovich.com' },
  }), {});
  assert.equal(blocked.status, 403);
  const env = { DB: {}, RUN_TOKEN_SECRET: 'test-only', ASSETS: { fetch: () => new Response('asset') } };
  const health = await cloudflare.fetch(new Request('https://game.onovich.com/PoeticTypewriter/health', {
    headers: { Origin: 'https://game.onovich.com' },
  }), env);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('Access-Control-Allow-Origin'), 'https://game.onovich.com');
  const unknown = await cloudflare.fetch(new Request('https://game.onovich.com/PoeticTypewriter/v1/missing'), env);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, 'not_found');
  assert.equal(await (await cloudflare.fetch(new Request('https://game.onovich.com/PoeticTypewriter/'), env)).text(), 'asset');
});

test('subpath redirect preserves query, root and sibling routes stay outside this application', async () => {
  const redirect = await cloudflare.fetch(new Request('https://game.onovich.com/PoeticTypewriter?mode=daily'), {});
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), 'https://game.onovich.com/PoeticTypewriter/?mode=daily');
  for (const path of ['/', '/v1/runs/start', '/another-game/', '/PoeticTypewriterOther/']) {
    assert.equal((await cloudflare.fetch(new Request(`https://game.onovich.com${path}`), {})).status, 404);
  }
  const cookie = buildPlayerCookie('player', { PLAYER_COOKIE_PATH: '/PoeticTypewriter/' });
  assert.match(cookie, /Path=\/PoeticTypewriter\/; HttpOnly; SameSite=Lax/);
  assert.match(cookie, /; Secure$/);
  const config = JSON.parse(readFileSync(new URL('../wrangler.cloudflare.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(config.env.production.routes, [
    { pattern: 'game.onovich.com/PoeticTypewriter', zone_name: 'onovich.com' },
    { pattern: 'game.onovich.com/PoeticTypewriter/*', zone_name: 'onovich.com' },
  ]);
});

test('invalid cookies and malformed or tampered tokens do not crash the API', async () => {
  assert.equal(readCookie(new Request('https://game.onovich.com', { headers: { Cookie: 'pt_player=%ZZ' } }), 'pt_player'), null);
  const secret = 'test-only';
  for (const token of [null, {}, 42, 'x', 'a.b.c', 'x.%', 'a.b']) {
    assert.equal(await verifySignedRunToken(token, secret), null);
  }
  const payload = { playerId: 'player', expiresAtMs: Date.now() + 10000 };
  const token = await createSignedRunToken(payload, secret);
  assert.deepEqual(await verifySignedRunToken(token, secret), payload);
  assert.equal(await verifySignedRunToken(token, 'different-secret'), null);
});
