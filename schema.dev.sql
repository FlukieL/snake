-- Snake Game Leaderboard Schema - DEVELOPMENT table
-- Same structure as the production `scores` table (see schema.sql), but stored
-- under a separate name so dev/test submissions never mix with real scores.
-- Lives in the SAME D1 database (snake-scores) as production.

CREATE TABLE IF NOT EXISTS scores_dev (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id TEXT,
    score INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'classic',
    level INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_dev_user_mode_score ON scores_dev (user_id, mode, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_dev_score ON scores_dev (score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_dev_mode_level_score ON scores_dev (mode, level DESC, score DESC);
