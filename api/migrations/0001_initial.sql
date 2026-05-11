CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  anon_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY,
  challenge_date TEXT NOT NULL UNIQUE,
  seed TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_items (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(challenge_id, position),
  FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_challenge_progress (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  completed_items INTEGER NOT NULL DEFAULT 0,
  current_item_position INTEGER NOT NULL DEFAULT 1,
  daily_best_run_id TEXT,
  daily_best_cps REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(player_id, challenge_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  run_token_hash TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  elapsed_ms_client INTEGER,
  elapsed_ms_server_floor INTEGER,
  backspace_count INTEGER,
  typed_length INTEGER,
  cps REAL,
  validation_status TEXT NOT NULL DEFAULT 'started',
  suspicious_flags TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES challenge_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_all_time_best (
  player_id TEXT PRIMARY KEY,
  best_run_id TEXT,
  best_cps REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_players_anon_id ON players(anon_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(challenge_date);
CREATE INDEX IF NOT EXISTS idx_challenge_items_challenge_position ON challenge_items(challenge_id, position);
CREATE INDEX IF NOT EXISTS idx_progress_player_challenge ON player_challenge_progress(player_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_runs_player_challenge ON runs(player_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_runs_token_hash ON runs(run_token_hash);
CREATE INDEX IF NOT EXISTS idx_all_time_best_cps ON player_all_time_best(best_cps DESC);