import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TypingRunTracker } from '../src/logic/stats/typingRunTracker.js';

test('live elapsed time shares the scoring clock, freezes at finish, and resets', () => {
  let now = 1000;
  const tracker = new TypingRunTracker({ now: () => now });
  tracker.recordInput({ accepted: false });
  assert.equal(tracker.getElapsedMs(), 0);
  tracker.recordInput({ accepted: true, inputKind: 'char', poemText: 'ab' });
  now += 750;
  assert.equal(tracker.getElapsedMs(), 750);
  tracker.recordInput({ accepted: true, inputKind: 'backspace', poemText: 'ab' });
  now += 250;
  const result = tracker.finishRun();
  assert.equal(result.elapsedMs, 1000);
  now += 5000;
  assert.equal(tracker.getElapsedMs(), result.elapsedMs);
  tracker.reset();
  assert.equal(tracker.getElapsedMs(), 0);
});
