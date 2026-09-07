import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalScoreArchive, SCORE_ARCHIVE_KEY } from '../src/logic/services/localScoreArchive.js';
const storage = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }; };
const state = { playerId: 'p1', challengeDate: '2026-09-08', challengeId: 'c1', completedItems: 1,
  stats: { recentCps: 2.1, dailyBestCps: 3.2, validationStatus: 'accepted' } };

test('score archive survives recreation and separates days and player identities', () => {
  const disk = storage();
  createLocalScoreArchive(disk).save(state);
  const archive = createLocalScoreArchive(disk);
  assert.equal(archive.restore({ ...state, stats: { dailyBestCps: 3.2 } }).recentCps, 2.1);
  assert.equal(archive.restore({ ...state, stats: {} }).dailyBestCps, 3.2);
  assert.equal(archive.restore({ ...state, playerId: 'p2', stats: {} }).recentCps, null);
  assert.equal(archive.restore({ ...state, challengeDate: '2026-09-09', stats: {} }).dailyBestCps, null);
  archive.save({ ...state, challengeDate: '2026-09-09' });
  assert.equal(Object.keys(JSON.parse(disk.getItem(SCORE_ARCHIVE_KEY)).records).length, 2);
});
test('server best including zero wins; changed progress invalidates stale recent result', () => {
  const archive = createLocalScoreArchive(storage()); archive.save(state);
  assert.equal(archive.restore({ ...state, stats: { dailyBestCps: 0 } }).dailyBestCps, 0);
  assert.equal(archive.restore({ ...state, completedItems: 2 }).recentCps, null);
  archive.save({ ...state, stats: { dailyBestCps: 3.2, recentCps: 30, validationStatus: 'suspicious' } });
  const result = archive.restore({ ...state, stats: { dailyBestCps: 3.2 } });
  assert.equal(result.recentCps, 30); assert.equal(result.dailyBestCps, 3.2);
  assert.equal(result.validationStatus, 'suspicious');
});
test('blocked storage and malformed data do not break play', () => {
  const archive = createLocalScoreArchive({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  archive.save(state); assert.equal(archive.restore(state).recentCps, 2.1);
  const disk = storage(); disk.setItem(SCORE_ARCHIVE_KEY, '{broken');
  assert.equal(createLocalScoreArchive(disk).restore({ ...state, stats: {} }).recentCps, null);
  createLocalScoreArchive(disk).save(state);
  const quota = createLocalScoreArchive({ getItem: disk.getItem, setItem() { throw Error('quota'); } });
  quota.save({ ...state, stats: { ...state.stats, recentCps: 2.8 } });
  assert.equal(quota.restore(state).recentCps, 2.8);
});
