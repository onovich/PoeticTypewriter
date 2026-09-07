import { generateDailyChallengeSet } from './challengeGeneration.js';
import { getChallengeByDate } from './repository.js';

// The UTC date and deterministic pool match the existing CLI seed workflow.
// D1 batch is transactional; concurrent first requests use the same IDs.
export async function ensureDailyChallenge(db, date) {
  const existing = await getChallengeByDate(db, date);
  if (existing) return existing;

  const set = generateDailyChallengeSet(date);
  const createdAt = new Date().toISOString();
  const itemStatements = [];
  // 14 rows x 7 values = 98 parameters, below D1's 100 parameter limit.
  // This also keeps first-request initialization well below the Free query limit.
  for (let start = 0; start < set.items.length; start += 14) {
    const items = set.items.slice(start, start + 14);
    itemStatements.push(db.prepare(
      `INSERT OR IGNORE INTO challenge_items (id, challenge_id, position, text, normalized_text, char_count, created_at) VALUES ${items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
    ).bind(...items.flatMap((item) => [item.id, set.challengeId, item.position, item.text, item.normalizedText, item.charCount, createdAt])));
  }
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO daily_challenges (id, challenge_date, seed, item_count, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(set.challengeId, date, set.seed, set.itemCount, createdAt),
    ...itemStatements,
  ]);
  return getChallengeByDate(db, date);
}
