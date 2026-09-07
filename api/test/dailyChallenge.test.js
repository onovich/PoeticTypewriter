import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { ensureDailyChallenge } from '../src/dailyChallenge.js';

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
    assert.equal(first.item_count, 100);
    const before = await db.prepare('SELECT id, text FROM challenge_items ORDER BY id').all();
    assert.equal(before.results.length, 100);
    await ensureDailyChallenge(db, '2026-09-07');
    assert.deepEqual((await db.prepare('SELECT id, text FROM challenge_items ORDER BY id').all()).results, before.results);
    const tomorrow = await ensureDailyChallenge(db, '2026-09-08');
    assert.notEqual(tomorrow.id, first.id);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM challenge_items').first()).count, 200);
  } finally { await mf.dispose(); }
});
