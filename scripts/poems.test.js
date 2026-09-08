import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POEM_LIBRARY, getPoemAttribution } from '../shared/poemLibrary.js';
import { CLASSIC_POEMS } from '../shared/classicPoems.js';
import { createFreePoemDeck, FREE_DECK_KEY } from '../src/logic/services/freePoemDeck.js';
import { generateDailyChallengeSet } from '../api/src/challengeGeneration.js';

const makeStorage = () => {
  const items = new Map();
  return { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value) };
};
test('every classic typing line preserves a traceable source and normalizes without splitting accented words', () => {
  for (const poem of CLASSIC_POEMS) {
    assert(poem.author && poem.title && poem.selection > 0);
    assert.equal(poem.text, poem.original.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').trim().replace(/\s+/g, ' '));
    assert.doesNotMatch(poem.original, /['‘’]/);
    assert(poem.text.length <= 45);
  }
});
test('large typing library is unique and keyboard compatible; every daily set has ten distinct lines', () => {
  assert(POEM_LIBRARY.length >= 400);
  assert.equal(new Set(POEM_LIBRARY.map(text => text.trim().toLowerCase())).size, POEM_LIBRARY.length);
  for (const text of POEM_LIBRARY) assert.match(text, /^[a-z]+(?: [a-z]+)*$/);
  for (let day = 0; day < 366; day++) {
    const date = new Date(Date.UTC(2026, 0, day + 1)).toISOString().slice(0, 10);
    const set = generateDailyChallengeSet(date);
    assert.equal(set.items.length, 10);
    assert.equal(new Set(set.items.map(item => item.normalizedText)).size, 10);
    assert.equal(new Set(set.items.map(item => getPoemAttribution(item.text).author)).size, 10);
    assert.deepEqual(set, generateDailyChallengeSet(date));
  }
  for (const count of [0, -1, 1.5, NaN, Infinity, 10000]) assert.throws(() => generateDailyChallengeSet('2026-01-01', count));
});
test('free mode consumes the entire pool before repeating across reloads and sequential tabs', () => {
  const storage = makeStorage();
  const options = { poems: POEM_LIBRARY, storage, now: () => new Date('2026-09-07T12:00:00Z') };
  const firstTab = createFreePoemDeck(options);
  const draws = [];
  for (let i = 0; i < POEM_LIBRARY.length; i++) {
    draws.push(i % 2 ? createFreePoemDeck(options).next() : firstTab.next());
  }
  assert.equal(new Set(draws).size, POEM_LIBRARY.length);
  const nextCycle = Array.from({ length: POEM_LIBRARY.length }, () => firstTab.next());
  assert.notEqual(nextCycle[0], draws.at(-1));
  assert.equal(new Set(nextCycle).size, POEM_LIBRARY.length);
});
test('UTC rollover, corrupted storage and unavailable storage all allow continued draws', () => {
  const storage = makeStorage();
  let date = new Date('2026-09-07T23:59:00Z');
  const options = { poems: ['first line', 'second line'], storage, now: () => date, random: () => 0 };
  const deck = createFreePoemDeck(options);
  assert.equal(deck.next(), 'first line');
  date = new Date('2026-09-08T00:00:00Z');
  assert.equal(deck.next(), 'first line');
  storage.setItem(FREE_DECK_KEY, '{broken');
  assert.equal(deck.next(), 'second line');
  assert.equal(JSON.parse(storage.getItem(FREE_DECK_KEY)).day, '2026-09-08');
  const blocked = createFreePoemDeck({ ...options, storage: { getItem() { throw Error(); } } });
  assert.notEqual(blocked.next(), blocked.next());
  const writeBlocked = createFreePoemDeck({ ...options, storage: { getItem: () => null, setItem() { throw Error(); } } });
  assert.notEqual(writeBlocked.next(), writeBlocked.next());
});
