// Levels Mode logic: obstacle generation, level progression, and the
// power-up system (spawn/expire/apply effects). All of this only applies
// when state.gameMode === 'levels' - Classic mode is unaffected.

import { state, constants } from './state.js';

export function resetLevelsState() {
    state.level = 1;
    state.fruitsEatenThisLevel = 0;
    state.tickInterval = 1000 / constants.LEVEL_BASE_TICK_RATE;
    state.obstacles = [];
    state.activePowerup = null;
    state.lastPowerupSpawnAttempt = performance.now();
    state.effects.multiplierUntil = 0;
    state.effects.invincibleUntil = 0;
    generateObstaclesForLevel();
}

function tickRateForLevel(level) {
    const rate = constants.LEVEL_BASE_TICK_RATE + (level - 1) * constants.LEVEL_TICK_RATE_STEP;
    return Math.min(rate, constants.LEVEL_MAX_TICK_RATE);
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
        // Wrap around edges, matching the snake's own wrap-around movement.
        if (x < 0) x = state.cellCount - 1;
        else if (x >= state.cellCount) x = 0;
        if (y < 0) y = state.cellCount - 1;
        else if (y >= state.cellCount) y = 0;
        cells.push({ x, y });
    }
    return cells;
}

function isOccupied(x, y, safeCorridor) {
    if (state.snake.some(s => s.x === x && s.y === y)) return true;
    if (state.food.x === x && state.food.y === y) return true;
    if (state.obstacles.some(o => o.x === x && o.y === y)) return true;
    // Keep a small safe zone around the snake's starting position.
    if (Math.abs(x - 10) <= 1 && Math.abs(y - 10) <= 1) return true;
    // Never place an obstacle directly in the snake's immediate path.
    if (safeCorridor && safeCorridor.some(c => c.x === x && c.y === y)) return true;
    return false;
}

function generateObstaclesForLevel() {
    state.obstacles = [];
    if (state.level < constants.OBSTACLES_START_LEVEL) return;

    const extraLevels = state.level - constants.OBSTACLES_START_LEVEL + 1;
    const count = Math.min(constants.MAX_OBSTACLES, extraLevels * constants.OBSTACLES_PER_LEVEL);
    const safeCorridor = getSafeCorridorCells();

    let attempts = 0;
    while (state.obstacles.length < count && attempts < count * 20) {
        attempts++;
        const x = Math.floor(Math.random() * state.cellCount);
        const y = Math.floor(Math.random() * state.cellCount);
        if (!isOccupied(x, y, safeCorridor)) {
            state.obstacles.push({ x, y });
        }
    }
}

// Call after a fruit is eaten while in Levels Mode. Returns true if the level advanced.
export function onFruitEatenInLevelsMode() {
    if (state.gameMode !== 'levels') return false;
    state.fruitsEatenThisLevel++;
    if (state.fruitsEatenThisLevel >= constants.FRUITS_PER_LEVEL) {
        state.level++;
        state.fruitsEatenThisLevel = 0;
        state.tickInterval = 1000 / tickRateForLevel(state.level);
        generateObstaclesForLevel();
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

export function isScoreMultiplied() {
    return performance.now() < state.effects.multiplierUntil;
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
    const types = Object.keys(constants.POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
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
        state.effects.multiplierUntil = now + def.duration;
    } else if (type === 'invincible') {
        state.effects.invincibleUntil = now + def.duration;
    } else if (type === 'shrink') {
        const removeCount = Math.min(3, Math.max(0, state.snake.length - 2));
        for (let i = 0; i < removeCount; i++) state.snake.pop();
    }

    state.activePowerup = null;
    return { type, ...def };
}
