import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompletionHistory } from '../src/logic/services/completionHistory.js';

test('completion average weights time, survives reload and compares only prior complete days for this player', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, v) => { raw = v; } };
  const s = { playerId: 'a', challengeId: 'day1', challengeDate: '2026-09-08', totalItems: 2, completedItems: 2 };
  let history = createCompletionHistory(storage);
  history.record(s, { itemId: 'one', text: 'abcd' }, { elapsedMs: 1000 }, { validationStatus: 'accepted', nextItem: {} });
  history.record(s, { itemId: 'two', text: 'abcdef' }, { elapsedMs: 4000 }, { validationStatus: 'accepted', nextItem: null });
  history = createCompletionHistory(storage);
  assert.equal(history.summarize(s).averageCps, 2);
  const next = { ...s, challengeId: 'day2', challengeDate: '2026-09-09' };
  history.record(next, { itemId: 'one', text: 'abcd' }, { elapsedMs: 1000 }, { validationStatus: 'accepted', nextItem: {} });
  assert.equal(history.summarize(next).averageCps, null);
  history.record(next, { itemId: 'two', text: 'abcdef' }, { elapsedMs: 1000 }, { validationStatus: 'suspicious', nextItem: null });
  assert.equal(history.summarize(next).averageCps, null);
  history.record(next, { itemId: 'two', text: 'abcdef' }, { elapsedMs: 1000 }, { validationStatus: 'accepted', nextItem: null });
  assert.equal(history.summarize(next).differenceCps, 3);
  assert.equal(history.summarize({ ...next, playerId: 'b' }).averageCps, null);
  assert.equal(history.summarize({ ...next, completedItems: 1 }).averageCps, null);
});

test('missing and blocked history do not prevent a completion summary', () => {
  const history = createCompletionHistory({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  const s = { playerId: 'a', challengeId: 'one', challengeDate: '2026-09-09', totalItems: 1, completedItems: 1 };
  assert.equal(history.summarize(s).averageCps, null);
  history.record(s, { itemId: 'one', text: 'abcd' }, { elapsedMs: 1000 }, { validationStatus: 'accepted', nextItem: null });
  assert.equal(history.summarize(s).averageCps, 4);
});
