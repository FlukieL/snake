-- One-time migration for the existing development leaderboard table.
-- Run this once only against a scores_dev table created before user_id existed.

ALTER TABLE scores_dev ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scores_dev_user_mode_score
    ON scores_dev (user_id, mode, score DESC);
