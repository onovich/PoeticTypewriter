import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { ensureDailyChallenge } from '../src/dailyChallenge.js';
import api from '../src/index.js';
import { generateDailyChallengeSet, createDailyChallengeSeedSql } from '../src/challengeGeneration.js';

test('empty D1 initializes once under concurrent requests and rolls to a new date', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    cf: false,
    workers: [{ name: 'test', modules: true, script: 'export default { fetch() { return new Response("ok"); } }', d1Databases: ['DB'] }],
  }));
  try {
    const db = await mf.getD1Database('DB');
    const schema = readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
    await db.exec(schema.replace(/\r?\n/g, ' '));
    const [first, concurrent] = await Promise.all([
      ensureDailyChallenge(db, '2026-09-07'), ensureDailyChallenge(db, '2026-09-07'),
    ]);
    assert.equal(first.id, concurrent.id);
    assert.equal(first.item_count, 10);
    const before = await db.prepare('SELECT id, text FROM challenge_items ORDER BY id').all();
    assert.equal(before.results.length, 10);
    await ensureDailyChallenge(db, '2026-09-07');
    assert.deepEqual((await db.prepare('SELECT id, text FROM challenge_items ORDER BY id').all()).results, before.results);
    const tomorrow = await ensureDailyChallenge(db, '2026-09-08');
    assert.notEqual(tomorrow.id, first.id);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM challenge_items').first()).count, 20);
  } finally { await mf.dispose(); }
});

test('legacy 100-item challenge finishes at ten through real API and preserves old records', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    cf: false, workers: [{ name: 'test', modules: true, script: 'export default { fetch() { return new Response("ok"); } }', d1Databases: ['DB'] }],
  }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of ['0001_initial.sql', '0002_add_started_ip_hash.sql', '0003_add_runs_completed_index.sql']) {
      await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replace(/\r?\n/g, ' '));
    }
    const set = generateDailyChallengeSet(new Date().toISOString().slice(0, 10), 100);
    await db.exec(createDailyChallengeSeedSql(set).replace(/^--.*$/gm, '').replace(/\r?\n/g, ' '));
    const env = { DB: db, RUN_TOKEN_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters', RUN_START_LIMIT_MAX: 100 };
    const headers = { Cookie: 'pt_player=ten-sentences-test', 'Content-Type': 'application/json' };
    const get = () => api.fetch(new Request('https://example.com/v1/challenge/today', { headers }), env);
    const post = (path, body) => api.fetch(new Request(`https://example.com/v1/runs/${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), env);
    let state = await (await get()).json();
    assert.equal(state.playerId, (await db.prepare('SELECT id FROM players WHERE anon_id = ?').bind('ten-sentences-test').first()).id);
    assert.equal(state.totalItems, 10);
    const seen = new Set();
    for (let index = 0; index < 10; index++) {
      const item = state.currentItem;
      assert(item);
      assert(!seen.has(item.text)); seen.add(item.text);
      const start = await post('start', { challengeId: set.challengeId, itemId: item.itemId });
      assert.equal(start.status, 200);
      const { runToken } = await start.json();
      const finish = await post('complete', { challengeId: set.challengeId, itemId: item.itemId, runToken,
        typedLength: item.text.length, elapsedMs: item.text.length * 200, backspaceCount: 0, inputSample: [150, 210, 170, 230, 160] });
      assert.equal(finish.status, 200);
      const summary = await finish.json();
      assert.notEqual(summary.validationStatus, 'rejected');
      assert.equal(summary.nextItem === null, index === 9);
      state = await (await get()).json();
      assert.equal(state.completedItems, index + 1);
    }
    assert.equal(state.currentItem, null);
    const eleventh = await post('start', { challengeId: set.challengeId, itemId: set.items[10].id });
    assert.equal(eleventh.status, 409);
    await db.prepare('UPDATE player_challenge_progress SET completed_items = 99, current_item_position = 100').run();
    state = await (await get()).json();
    assert.equal(state.completedItems, 10);
    assert.equal(state.currentItem, null);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM challenge_items').first()).count, 100);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM runs').first()).count, 10);
    assert.equal((await db.prepare('SELECT completed_items FROM player_challenge_progress').first()).completed_items, 99);
    assert(state.stats.dailyBestCps > 0);
    const other = await (await api.fetch(new Request('https://example.com/v1/challenge/today', {
      headers: { Cookie: 'pt_player=another-player' },
    }), env)).json();
    assert.notEqual(other.playerId, state.playerId);
    assert.equal(other.stats.dailyBestCps, 0, 'daily best belongs to the requesting player, not the world leader');
    assert.equal(other.stats.dailyRank, null);
  } finally { await mf.dispose(); }
});
