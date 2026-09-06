// Lightweight client-side score integrity checks. This is deliberately a
// deterrent, not a security boundary: code running in a player's browser can
// always be modified. Its purpose is to stop simple console edits and basic
// scripts that only overwrite `state.score` before submitting.
let activeRunId = null;
let expectedScore = 0;
let lastFruitAt = 0;
let invalidRun = false;

// At the fastest supported Levels Mode speed, the game cannot consume two
// fruit on consecutive updates sooner than roughly 38ms apart. Leave a small
// margin for timer precision while still rejecting a tight scripted burst.
const MIN_FRUIT_INTERVAL_MS = 25;

export function beginScoreIntegrityRun(runId) {
    activeRunId = runId;
    expectedScore = 0;
    lastFruitAt = 0;
    invalidRun = false;
}

// Called by the authoritative game update path immediately after it awards
// fruit points. `liveScore` must exactly match the score maintained here.
export function recordVerifiedFruitScore(points, liveScore) {
    const now = performance.now();

    if (!Number.isInteger(points) || points < 1 || !Number.isInteger(liveScore)) {
        invalidRun = true;
        return;
    }

    if (lastFruitAt && now - lastFruitAt < MIN_FRUIT_INTERVAL_MS) {
        invalidRun = true;
        return;
    }

    expectedScore += points;
    lastFruitAt = now;

    if (liveScore !== expectedScore) {
        invalidRun = true;
    }
}

// Returns false whenever the public, mutable game state differs from the
// independently maintained game-loop total.
export function isScoreSubmissionTrusted(runId, liveScore) {
    return !invalidRun &&
        Boolean(activeRunId) &&
        activeRunId === runId &&
        Number.isInteger(liveScore) &&
        liveScore > 0 &&
        liveScore === expectedScore;
}
