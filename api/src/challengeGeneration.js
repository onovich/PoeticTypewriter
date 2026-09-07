import { CHALLENGE_POOL } from '../data/challengePool.js';
import { DAILY_ITEM_COUNT } from '../../shared/challengeRules.js';

const DEFAULT_ITEM_COUNT = DAILY_ITEM_COUNT;

function assertValidDate(challengeDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) {
    throw new Error(`Invalid challenge date: ${challengeDate}`);
  }
}

function normalizeChallengeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createSeedFromDate(challengeDate) {
  let seed = 2166136261;
  for (const char of challengeDate) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619) >>> 0;
  }

  return seed || 1;
}

function nextRandom(seedState) {
  return (Math.imul(seedState, 1664525) + 1013904223) >>> 0;
}

function shuffleWithSeed(items, initialSeed) {
  const shuffled = [...items];
  let seedState = initialSeed;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seedState = nextRandom(seedState);
    const swapIndex = seedState % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function getNormalizedChallengePool() {
  const uniqueTexts = new Set();
  const normalizedPool = [];

  CHALLENGE_POOL.forEach((text) => {
    const normalizedText = normalizeChallengeText(text);
    if (!normalizedText || uniqueTexts.has(normalizedText)) {
      return;
    }

    uniqueTexts.add(normalizedText);
    normalizedPool.push(normalizedText);
  });

  return normalizedPool;
}

export function generateDailyChallengeSet(challengeDate, itemCount = DEFAULT_ITEM_COUNT) {
  assertValidDate(challengeDate);
  if (!Number.isInteger(itemCount) || itemCount < 1) throw new Error('Item count must be a positive integer');

  const normalizedPool = getNormalizedChallengePool();
  if (normalizedPool.length < itemCount) {
    throw new Error(`Challenge pool too small: required ${itemCount}, received ${normalizedPool.length}`);
  }

  const seed = createSeedFromDate(challengeDate);
  const challengeId = `chl_${challengeDate.replace(/-/g, '_')}`;
  const compactDate = challengeDate.replace(/-/g, '');
  const items = shuffleWithSeed(normalizedPool, seed)
    .slice(0, itemCount)
    .map((text, index) => {
      const position = index + 1;
      return {
        charCount: text.length,
        id: `itm_${compactDate}_${String(position).padStart(3, '0')}`,
        normalizedText: text,
        position,
        text,
      };
    });

  return {
    challengeDate,
    challengeId,
    itemCount,
    items,
    seed: String(seed),
  };
}

function escapeSqlValue(value) {
  return value.replace(/'/g, "''");
}

export function createDailyChallengeSeedSql(challengeSet) {
  const lines = [
    '-- Poetic Typewriter daily challenge seed',
    `-- challenge date: ${challengeSet.challengeDate}`,
    `-- challenge id: ${challengeSet.challengeId}`,
    `-- item count: ${challengeSet.itemCount}`,
    'PRAGMA foreign_keys = ON;',
    '',
    'INSERT OR IGNORE INTO daily_challenges (id, challenge_date, seed, item_count, created_at)',
    `VALUES ('${challengeSet.challengeId}', '${challengeSet.challengeDate}', '${challengeSet.seed}', ${challengeSet.itemCount}, datetime('now'));`,
    '',
  ];

  challengeSet.items.forEach((item) => {
    lines.push(
      'INSERT OR IGNORE INTO challenge_items (id, challenge_id, position, text, normalized_text, char_count, created_at)',
      `VALUES ('${item.id}', '${challengeSet.challengeId}', ${item.position}, '${escapeSqlValue(item.text)}', '${escapeSqlValue(item.normalizedText)}', ${item.charCount}, datetime('now'));`,
      '',
    );
  });

  return `${lines.join('\n')}\n`;
}
