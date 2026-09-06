-- One-time migration for the existing production leaderboard table.
-- Run this once only against a scores table created before user_id existed.

ALTER TABLE scores ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scores_user_mode_score
    ON scores (user_id, mode, score DESC);
