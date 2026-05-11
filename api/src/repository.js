function defaultAllTimeBest(playerId) {
  return {
    player_id: playerId,
    best_cps: 0,
    best_run_id: null,
    updated_at: null,
  };
}

export async function getChallengeByDate(db, challengeDate) {
  return db
    .prepare('SELECT id, challenge_date, item_count FROM daily_challenges WHERE challenge_date = ?')
    .bind(challengeDate)
    .first();
}

export async function getChallengeById(db, challengeId) {
  return db
    .prepare('SELECT id, challenge_date, item_count FROM daily_challenges WHERE id = ?')
    .bind(challengeId)
    .first();
}

export async function getChallengeItemByPosition(db, challengeId, position) {
  return db
    .prepare(
      'SELECT id, challenge_id, position, text, normalized_text, char_count FROM challenge_items WHERE challenge_id = ? AND position = ?',
    )
    .bind(challengeId, position)
    .first();
}

export async function getChallengeItemById(db, itemId) {
  return db
    .prepare('SELECT id, challenge_id, position, text, normalized_text, char_count FROM challenge_items WHERE id = ?')
    .bind(itemId)
    .first();
}

export async function getOrCreatePlayer(db, playerInput) {
  const existingPlayer = await db
    .prepare('SELECT id, anon_id, status FROM players WHERE anon_id = ?')
    .bind(playerInput.anonId)
    .first();

  if (existingPlayer) {
    await db
      .prepare('UPDATE players SET last_seen_at = ?, last_ip_hash = ? WHERE id = ?')
      .bind(playerInput.nowIso, playerInput.ipHash, existingPlayer.id)
      .run();

    return existingPlayer;
  }

  const playerId = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO players (id, anon_id, created_at, last_seen_at, last_ip_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(playerId, playerInput.anonId, playerInput.nowIso, playerInput.nowIso, playerInput.ipHash, 'active')
    .run();

  return {
    id: playerId,
    anon_id: playerInput.anonId,
    status: 'active',
  };
}

export async function getOrCreatePlayerProgress(db, progressInput) {
  const existingProgress = await db
    .prepare(
      'SELECT id, player_id, challenge_id, completed_items, current_item_position, daily_best_run_id, daily_best_cps, updated_at FROM player_challenge_progress WHERE player_id = ? AND challenge_id = ?',
    )
    .bind(progressInput.playerId, progressInput.challengeId)
    .first();

  if (existingProgress) {
    return existingProgress;
  }

  const progressId = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO player_challenge_progress (id, player_id, challenge_id, completed_items, current_item_position, daily_best_run_id, daily_best_cps, updated_at) VALUES (?, ?, ?, 0, 1, NULL, 0, ?)',
    )
    .bind(progressId, progressInput.playerId, progressInput.challengeId, progressInput.nowIso)
    .run();

  return {
    id: progressId,
    player_id: progressInput.playerId,
    challenge_id: progressInput.challengeId,
    completed_items: 0,
    current_item_position: 1,
    daily_best_run_id: null,
    daily_best_cps: 0,
    updated_at: progressInput.nowIso,
  };
}

export async function getAllTimeBest(db, playerId) {
  const row = await db
    .prepare('SELECT player_id, best_run_id, best_cps, updated_at FROM player_all_time_best WHERE player_id = ?')
    .bind(playerId)
    .first();

  return row ?? defaultAllTimeBest(playerId);
}

export async function countRecentRunStartsByPlayer(db, playerId, startedAfterIso) {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM runs WHERE player_id = ? AND started_at >= ?')
    .bind(playerId, startedAfterIso)
    .first();

  return Number(row?.count ?? 0);
}

export async function countRecentRunStartsByIp(db, startedIpHash, startedAfterIso) {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM runs WHERE started_ip_hash = ? AND started_at >= ?')
    .bind(startedIpHash, startedAfterIso)
    .first();

  return Number(row?.count ?? 0);
}

export async function countRecentCompletedRunsByPlayer(db, playerId, completedAfterIso) {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM runs WHERE player_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND validation_status IN ('accepted', 'suspicious')",
    )
    .bind(playerId, completedAfterIso)
    .first();

  return Number(row?.count ?? 0);
}

export async function recordRunStart(db, runInput) {
  await db
    .prepare(
      'INSERT INTO runs (id, player_id, challenge_id, item_id, run_token_hash, started_at, started_ip_hash, validation_status, suspicious_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      runInput.playerId,
      runInput.challengeId,
      runInput.itemId,
      runInput.tokenHash,
      runInput.startedAt,
      runInput.startedIpHash,
      'started',
      '[]',
    )
    .run();
}

export async function getRunByTokenHash(db, tokenHash) {
  return db
    .prepare(
      'SELECT id, player_id, challenge_id, item_id, started_at, started_ip_hash, validation_status FROM runs WHERE run_token_hash = ?',
    )
    .bind(tokenHash)
    .first();
}

export async function completeRun(db, runInput) {
  await db
    .prepare(
      'UPDATE runs SET completed_at = ?, elapsed_ms_client = ?, elapsed_ms_server_floor = ?, backspace_count = ?, typed_length = ?, cps = ?, validation_status = ?, suspicious_flags = ? WHERE id = ?',
    )
    .bind(
      runInput.completedAt,
      runInput.elapsedMsClient,
      runInput.elapsedMsServerFloor,
      runInput.backspaceCount,
      runInput.typedLength,
      runInput.cps,
      runInput.validationStatus,
      JSON.stringify(runInput.suspiciousFlags),
      runInput.runId,
    )
    .run();
}

export async function advancePlayerProgress(db, progressInput) {
  await db
    .prepare(
      'UPDATE player_challenge_progress SET completed_items = ?, current_item_position = ?, updated_at = ? WHERE id = ?',
    )
    .bind(progressInput.completedItems, progressInput.currentItemPosition, progressInput.updatedAt, progressInput.progressId)
    .run();
}

export async function updateDailyBest(db, bestInput) {
  await db
    .prepare(
      'UPDATE player_challenge_progress SET daily_best_run_id = ?, daily_best_cps = ?, updated_at = ? WHERE id = ?',
    )
    .bind(bestInput.runId, bestInput.cps, bestInput.updatedAt, bestInput.progressId)
    .run();
}

export async function upsertAllTimeBest(db, bestInput) {
  await db
    .prepare(
      'INSERT INTO player_all_time_best (player_id, best_run_id, best_cps, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET best_run_id = excluded.best_run_id, best_cps = excluded.best_cps, updated_at = excluded.updated_at',
    )
    .bind(bestInput.playerId, bestInput.runId, bestInput.cps, bestInput.updatedAt)
    .run();
}

export async function getDailyRank(db, challengeId, playerId) {
  const row = await db
    .prepare(
      `SELECT rank
       FROM (
         SELECT player_id, RANK() OVER (ORDER BY daily_best_cps DESC, updated_at ASC) AS rank
         FROM player_challenge_progress
         WHERE challenge_id = ? AND daily_best_cps > 0
       ) ranked
       WHERE player_id = ?`,
    )
    .bind(challengeId, playerId)
    .first();

  return row?.rank ?? null;
}

export async function getAllTimeRank(db, playerId) {
  const row = await db
    .prepare(
      `SELECT rank
       FROM (
         SELECT player_id, RANK() OVER (ORDER BY best_cps DESC, updated_at ASC) AS rank
         FROM player_all_time_best
         WHERE best_cps > 0
       ) ranked
       WHERE player_id = ?`,
    )
    .bind(playerId)
    .first();

  return row?.rank ?? null;
}