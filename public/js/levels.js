// Levels Mode logic: obstacle generation, level progression, and the
// power-up system (spawn/expire/apply effects). All of this only applies
// when state.gameMode === 'levels' - Classic mode is unaffected.

import { state, constants } from './state.js';

export function resetLevelsState() {
    state.level = 1;
    state.fruitsEatenThisLevel = 0;
    state.permanentSlowdown = 0;
    state.tickInterval = 1000 / constants.LEVEL_BASE_TICK_RATE;
    state.obstacles = [];
    state.upcomingObstacles = [];
    state.activePowerup = null;
    state.lastPowerupSpawnAttempt = performance.now();
    state.effects.multiplierUntil = 0;
    state.effects.multiplierStacks = 0;
    state.effects.invincibleUntil = 0;
    state.lives = constants.STARTING_LIVES;
    state.nextExtraLifeAt = constants.POINTS_PER_EXTRA_LIFE;
    state.nextExtraLifeIncrement = constants.POINTS_PER_EXTRA_LIFE;
    updateObstaclesForLevel();
}

// Call whenever the score changes in Levels Mode. Awards an extra life every
// time the score crosses the next threshold. Each successive threshold
// requires progressively more points than the last (30, then 40, then 50...)
// rather than a flat repeating amount. Returns true if a life was awarded
// (so callers can play a sound/show feedback).
export function checkForExtraLife() {
    if (state.gameMode !== 'levels') return false;
    let awarded = false;
    while (state.score >= state.nextExtraLifeAt) {
        state.lives++;
        state.nextExtraLifeIncrement += constants.EXTRA_LIFE_INCREMENT_STEP;
        state.nextExtraLifeAt += state.nextExtraLifeIncrement;
        awarded = true;
    }
    return awarded;
}

// Call on a fatal collision (self or obstacle) while in Levels Mode. If a
// life remains, consumes one and returns true so the caller can respawn the
// snake in place of triggering game over. Returns false once lives are gone.
export function loseLifeOrGameOver() {
    if (state.gameMode !== 'levels') return false;
    if (state.lives <= 0) return false;
    state.lives--;
    // Dying costs a small permanent speed penalty too, on top of any from
    // the Slow power-up - a real (if minor) consequence for crashing.
    state.permanentSlowdown += constants.SLOWDOWN_ON_DEATH;
    recomputeTickInterval();
    // Dying should clear any active score multiplier - it shouldn't survive
    // a crash/respawn and keep boosting points as if nothing happened.
    state.effects.multiplierUntil = 0;
    state.effects.multiplierStacks = 0;
    return true;
}

// Resets the snake back to a safe starting position/length after losing a
// life, keeping score/level/lives intact. Picks the safest available spot
// (falling back to the original center if needed).
export function respawnSnakeAfterLifeLost() {
    const length = Math.min(state.snake.length, 4);
    const start = findSafeSpawnPoint();
    state.snake = [];
    for (let i = 0; i < length; i++) {
        state.snake.push({ x: start.x - i, y: start.y });
    }
    state.previousSnake = state.snake.map(s => ({ x: s.x, y: s.y }));
    state.direction = 'right';
    state.directionQueue = [];
    // Brief invincibility after respawning so the player isn't immediately
    // killed again while getting their bearings.
    state.effects.invincibleUntil = performance.now() + 2000;
}

function findSafeSpawnPoint() {
    const attempts = 60;
    for (let i = 0; i < attempts; i++) {
        const x = Math.floor(Math.random() * (state.cellCount - 4)) + 2;
        const y = Math.floor(Math.random() * state.cellCount);
        if (!state.obstacles.some(o => o.x === x && o.y === y) &&
            !(state.food.x === x && state.food.y === y)) {
            return { x, y };
        }
    }
    return { x: 10, y: 10 };
}

// Computes the tick rate (ticks/sec) for a given level. The per-level speed
// increase grows the further into the run you get (accelerating difficulty):
// each level's step is LEVEL_TICK_RATE_STEP plus an additional
// LEVEL_TICK_RATE_ACCEL for every level already passed, so late levels ramp
// up noticeably faster than early ones instead of a flat linear increase.
function tickRateForLevel(level) {
    const levelsPast = level - 1;
    const accelSum = constants.LEVEL_TICK_RATE_ACCEL * levelsPast * (levelsPast + 1) / 2;
    const rate = constants.LEVEL_BASE_TICK_RATE + levelsPast * constants.LEVEL_TICK_RATE_STEP + accelSum;
    return Math.min(rate, constants.LEVEL_MAX_TICK_RATE);
}

// Recomputes state.tickInterval from the current level's base rate plus any
// accumulated permanent slowdown (from the Slow power-up and/or deaths).
// Called whenever either input changes so the two always stay in sync.
function recomputeTickInterval() {
    state.tickInterval = (1000 / tickRateForLevel(state.level)) + state.permanentSlowdown;
}

// Cells directly ahead of the snake's head (in its current direction of travel)
// that should be kept clear of obstacles, so a wall can never suddenly appear
// right in the snake's path with no time to react. Also wraps around the
// board edges, since the snake itself wraps.
function getSafeCorridorCells() {
    const cells = [];
    if (!state.snake.length) return cells;
    const head = state.snake[0];
    const dir = state.direction;
    const corridorLength = 4;

    let dx = 0, dy = 0;
    switch (dir) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
    }

    for (let i = 1; i <= corridorLength; i++) {
        let x = head.x + dx * i;
        let y = head.y + dy * i;
        if (x < 0) x = state.cellCount - 1;
        else if (x >= state.cellCount) x = 0;
        if (y < 0) y = state.cellCount - 1;
        else if (y >= state.cellCount) y = 0;
        cells.push({ x, y });
    }
    return cells;
}

// Minimum distance (in grid cells) any new obstacle cluster must keep from
// the snake's current head position, so walls always appear "further away"
// rather than right next to the player.
const MIN_DISTANCE_FROM_SNAKE = 5;

function distanceFromHead(x, y) {
    if (!state.snake.length) return Infinity;
    const head = state.snake[0];
    return Math.abs(x - head.x) + Math.abs(y - head.y);
}

function isOccupied(x, y, safeCorridor) {
    if (state.snake.some(s => s.x === x && s.y === y)) return true;
    if (state.food.x === x && state.food.y === y) return true;
    if (state.obstacles.some(o => o.x === x && o.y === y)) return true;
    // Also treat any currently active (uncollected) power-up as occupied -
    // without this, a new obstacle wall generated on level-up could spawn
    // directly on top of a power-up that's still sitting on the board,
    // making it impossible to reach/collect.
    if (state.activePowerup && state.activePowerup.x === x && state.activePowerup.y === y) return true;
    // Keep a small safe zone around the snake's starting position.
    if (Math.abs(x - 10) <= 1 && Math.abs(y - 10) <= 1) return true;
    // Never place an obstacle directly in the snake's immediate path.
    if (safeCorridor && safeCorridor.some(c => c.x === x && c.y === y)) return true;
    return false;
}

// Generates a small "L-shaped" (or straight, as a simpler fallback) cluster
// of 3-5 obstacle cells starting from an anchor point, so walls read as
// distinct rock formations rather than randomly scattered single blocks.
// `existingCells` lets the caller pass in an accumulator array (e.g. when
// building a preview layout) so clusters avoid overlapping cells already
// placed in this same generation pass, not just state.obstacles.
function buildLShapeCluster(anchorX, anchorY, safeCorridor, existingCells) {
    const cluster = [];
    const armLength = 2 + Math.floor(Math.random() * 2); // 2-3 cells per arm
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const dirA = directions[Math.floor(Math.random() * directions.length)];
    // Pick a second direction perpendicular to the first, to form the "L".
    const perpendicular = dirA[0] !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    const dirB = perpendicular[Math.floor(Math.random() * perpendicular.length)];

    const isTaken = (x, y) =>
        isOccupied(x, y, safeCorridor) ||
        cluster.some(c => c.x === x && c.y === y) ||
        (existingCells && existingCells.some(c => c.x === x && c.y === y));

    let x = anchorX, y = anchorY;
    for (let i = 0; i < armLength; i++) {
        if (x >= 0 && x < state.cellCount && y >= 0 && y < state.cellCount && !isTaken(x, y)) {
            cluster.push({ x, y });
        }
        x += dirA[0];
        y += dirA[1];
    }
    // Second arm branches off from the anchor point (the "corner" of the L).
    x = anchorX; y = anchorY;
    for (let i = 0; i < armLength; i++) {
        x += dirB[0];
        y += dirB[1];
        if (x >= 0 && x < state.cellCount && y >= 0 && y < state.cellCount && !isTaken(x, y)) {
            cluster.push({ x, y });
        }
    }
    return cluster;
}

// Computes an obstacle layout (array of {x,y}) for a given target count, as
// a handful of L-shaped clusters placed away from the snake's current
// position. Pure/non-mutating - does NOT touch state.obstacles - so it can
// be reused both to build the real layout (updateObstaclesForLevel) and a
// ghost preview of the next level's layout (computeUpcomingObstacles)
// without them interfering with each other.
function generateObstacleLayout(targetCount) {
    const layout = [];
    if (targetCount <= 0) return layout;
    const safeCorridor = getSafeCorridorCells();

    let attempts = 0;
    while (layout.length < targetCount && attempts < 60) {
        attempts++;
        const x = Math.floor(Math.random() * state.cellCount);
        const y = Math.floor(Math.random() * state.cellCount);
        if (distanceFromHead(x, y) < MIN_DISTANCE_FROM_SNAKE) continue;
        if (isOccupied(x, y, safeCorridor)) continue;
        if (layout.some(c => c.x === x && c.y === y)) continue;

        const cluster = buildLShapeCluster(x, y, safeCorridor, layout);
        for (const cell of cluster) {
            if (layout.length >= targetCount) break;
            if (!layout.some(c => c.x === cell.x && c.y === cell.y)) {
                layout.push(cell);
            }
        }
    }
    return layout;
}

// Regenerates the full obstacle layout for the current level and applies it
// immediately to state.obstacles. Called only on level-up / game start, so
// obstacle layout stays stable and predictable during a level instead of
// shifting on every fruit eaten. Also clears any stale ghost preview, since
// it's now been superseded by the real thing.
function updateObstaclesForLevel() {
    state.obstacles = obstacleCountTargetForLevel(state.level) > 0
        ? generateObstacleLayout(obstacleCountTargetForLevel(state.level))
        : [];
    state.upcomingObstacles = [];
}

// Returns how many obstacle cells the given level should have, following
// the same OBSTACLES_START_LEVEL/OBSTACLES_PER_LEVEL/MAX_OBSTACLES rules
// used previously inline in updateObstaclesForLevel.
function obstacleCountTargetForLevel(level) {
    if (level < constants.OBSTACLES_START_LEVEL) return 0;
    const extraLevels = level - constants.OBSTACLES_START_LEVEL + 1;
    return Math.min(constants.MAX_OBSTACLES, extraLevels * constants.OBSTACLES_PER_LEVEL);
}

// Computes a ghost preview of what the NEXT level's obstacle layout will
// look like, storing it in state.upcomingObstacles for the renderer to draw
// as a translucent overlay - without touching the real state.obstacles at
// all. Called once fruitsEatenThisLevel reaches FRUITS_PER_LEVEL - 1 (i.e.
// exactly one fruit away from leveling up), so new walls never just pop
// into existence with no warning.
export function computeUpcomingObstacles() {
    if (state.gameMode !== 'levels') return;
    if (state.upcomingObstacles.length > 0) return; // already computed for this upcoming level-up
    const nextLevel = state.level + 1;
    const targetCount = obstacleCountTargetForLevel(nextLevel);
    state.upcomingObstacles = targetCount > 0 ? generateObstacleLayout(targetCount) : [];
}

// Call after a fruit is eaten while in Levels Mode. Returns true if the level advanced.
// Note: obstacles are NOT regenerated on every fruit - only on level-up - so
// the wall layout stays stable and predictable while playing through a level.
// One fruit before advancing, a ghost preview of the next level's layout is
// computed (via computeUpcomingObstacles, called from game.js) so new walls
// are always telegraphed in advance rather than appearing with no warning.
export function onFruitEatenInLevelsMode() {
    if (state.gameMode !== 'levels') return false;
    state.fruitsEatenThisLevel++;

    // Exactly one fruit away from leveling up - compute the ghost preview
    // now so it's ready to render well before the actual level-up happens.
    if (state.fruitsEatenThisLevel === constants.FRUITS_PER_LEVEL - 1) {
        computeUpcomingObstacles();
    }

    if (state.fruitsEatenThisLevel >= constants.FRUITS_PER_LEVEL) {
        state.level++;
        state.fruitsEatenThisLevel = 0;
        // Speed gradually recovers as the run progresses: a portion of any
        // accumulated permanent slowdown (from Slow power-ups/deaths) is
        // shed on every level-up, so the snake starts speeding up again
        // instead of staying permanently crippled by earlier slowdowns.
        state.permanentSlowdown = Math.max(0, state.permanentSlowdown - constants.LEVEL_SLOWDOWN_DECAY);
        recomputeTickInterval();
        // If a ghost preview was already computed for this upcoming level,
        // reuse it as the real layout instead of generating a brand new one -
        // this guarantees what the player saw as a preview is exactly what
        // they get, rather than the preview being replaced by a different
        // random layout at the last moment.
        state.obstacles = state.upcomingObstacles.length > 0
            ? state.upcomingObstacles
            : generateObstacleLayout(obstacleCountTargetForLevel(state.level));
        state.upcomingObstacles = [];
        return true;
    }
    return false;
}

export function checkObstacleCollision(head) {
    if (state.gameMode !== 'levels') return false;
    if (performance.now() < state.effects.invincibleUntil) return false; // invincibility ignores obstacles
    return state.obstacles.some(o => o.x === head.x && o.y === head.y);
}

export function isInvincible() {
    return performance.now() < state.effects.invincibleUntil;
}

// Returns the multiplier's display label as a plain integer (1 = no bonus,
// 2 = "x2", 3 = "x3", etc) - used purely for the on-screen badge text.
// Automatically resets stacks to 0 once the timer runs out, so
// isScoreMultiplied()/the flashing render effect stay in sync.
export function getMultiplierValue() {
    if (performance.now() >= state.effects.multiplierUntil) {
        state.effects.multiplierStacks = 0;
        return 1;
    }
    return 1 + state.effects.multiplierStacks;
}

// Returns the actual number of points a fruit is worth right now. Each
// stack collected genuinely multiplies/compounds the bonus rather than just
// incrementing the label by one: the 1st multiplier (shown as "x2") is
// worth 2 points, the 2nd stack ("x3") is worth 4, the 3rd ("x4") is worth 6,
// and so on - i.e. 2 points per stack collected, growing every time another
// multiplier is picked up while one is already active.
export function getMultiplierPoints() {
    if (performance.now() >= state.effects.multiplierUntil) {
        state.effects.multiplierStacks = 0;
        return 1;
    }
    return 2 * state.effects.multiplierStacks;
}

export function isScoreMultiplied() {
    return performance.now() < state.effects.multiplierUntil;
}

// Call whenever a fruit is eaten while a multiplier is currently active, so
// that continuing to eat keeps the bonus going (refreshing back to the full
// duration) instead of it just ticking down and expiring after 10 seconds
// regardless of how well the player is doing. Does NOT increase the stack
// level - only collecting another multiplier power-up does that.
export function extendMultiplierOnFruitEaten() {
    if (state.gameMode !== 'levels') return;
    const now = performance.now();
    if (now < state.effects.multiplierUntil) {
        state.effects.multiplierUntil = now + constants.MULTIPLIER_DURATION;
    }
}

function randomFreeCell() {
    let attempts = 0;
    while (attempts < 100) {
        attempts++;
        const x = Math.floor(Math.random() * state.cellCount);
        const y = Math.floor(Math.random() * state.cellCount);
        if (!isOccupied(x, y)) return { x, y };
    }
    return null;
}

// Picks a random power-up type using each type's `weight` from
// POWERUP_TYPES as a relative likelihood (higher weight = more common).
function pickWeightedPowerupType() {
    const entries = Object.entries(constants.POWERUP_TYPES);
    const totalWeight = entries.reduce((sum, [, def]) => sum + (def.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const [type, def] of entries) {
        roll -= (def.weight || 1);
        if (roll <= 0) return type;
    }
    return entries[entries.length - 1][0];
}

// Attempts to spawn a power-up on a timer; only ever one active at a time.
export function maybeSpawnPowerup(now) {
    if (state.gameMode !== 'levels') return;
    if (state.activePowerup) {
        // Expire if it's been sitting too long uncollected.
        if (now - state.activePowerup.spawnTime > constants.POWERUP_LIFETIME) {
            state.activePowerup = null;
        }
        return;
    }
    if (now - state.lastPowerupSpawnAttempt < constants.POWERUP_SPAWN_INTERVAL) return;
    state.lastPowerupSpawnAttempt = now;

    const cell = randomFreeCell();
    if (!cell) return;
    const type = pickWeightedPowerupType();
    state.activePowerup = { type, x: cell.x, y: cell.y, spawnTime: now };
}

// Call when the snake's head lands on the active power-up's cell. Applies its
// effect and clears it from the board. Returns the power-up definition (for
// UI/sound feedback) or null if there was nothing to collect.
export function collectPowerupIfPresent(head) {
    if (state.gameMode !== 'levels' || !state.activePowerup) return null;
    if (state.activePowerup.x !== head.x || state.activePowerup.y !== head.y) return null;

    const { type } = state.activePowerup;
    const def = constants.POWERUP_TYPES[type];
    const now = performance.now();

    if (type === 'multiplier') {
        // Stacking: if a multiplier is already active, grabbing another one
        // increases the stack (x2 -> x3 -> x4...) instead of just refreshing
        // the same x2 bonus. The timer always resets to the full duration.
        if (now < state.effects.multiplierUntil) {
            state.effects.multiplierStacks++;
        } else {
            state.effects.multiplierStacks = 1;
        }
        state.effects.multiplierUntil = now + constants.MULTIPLIER_DURATION;
    } else if (type === 'invincible') {
        state.effects.invincibleUntil = now + def.duration;
    } else if (type === 'shrink') {
        const removeCount = Math.min(3, Math.max(0, state.snake.length - 2));
        for (let i = 0; i < removeCount; i++) state.snake.pop();
    } else if (type === 'slow') {
        // Permanent, stacking speed reduction for the rest of the run.
        state.permanentSlowdown += constants.SLOWDOWN_PER_POWERUP;
        recomputeTickInterval();
    }

    state.activePowerup = null;
    return { type, ...def };
}
