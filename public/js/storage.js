// Small localStorage wrapper used for persisted toggles (mute states, Nokia
// Mode) and the leaderboard cache. Centralizing these avoids scattering
// try/catch blocks and JSON.parse/stringify calls across the codebase.

export function loadBoolState(key, defaultValue) {
    try {
        const storedValue = localStorage.getItem(key);
        return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

export function saveState(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* ignore (e.g. storage disabled/full) */
    }
}

export function loadCachedHighScores(period) {
    try {
        const stored = localStorage.getItem('highScores_' + period);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

export function saveCachedHighScores(period, scores) {
    saveState('highScores_' + period, scores);
}
