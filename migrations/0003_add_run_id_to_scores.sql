-- One-time production migration: makes score submission idempotent per
-- authenticated player and completed game run.

ALTER TABLE scores ADD COLUMN run_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_user_run_id
    ON scores (user_id, run_id)
    WHERE run_id IS NOT NULL;
