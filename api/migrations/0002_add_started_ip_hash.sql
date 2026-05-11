ALTER TABLE runs ADD COLUMN started_ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_runs_started_ip_hash_started_at ON runs(started_ip_hash, started_at DESC);