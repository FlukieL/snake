-- Snake Game Leaderboard Schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id TEXT,
    score INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'classic',
    level INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_user_mode_score ON scores (user_id, mode, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_mode_level_score ON scores (mode, level DESC, score DESC);
