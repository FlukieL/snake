-- One-time development migration: makes score submission idempotent per
-- authenticated player and completed game run.

ALTER TABLE scores_dev ADD COLUMN run_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_dev_user_run_id
    ON scores_dev (user_id, run_id)
    WHERE run_id IS NOT NULL;
