// Core game logic: the fixed-rate update loop, movement, collision detection,
// food generation/consumption, and game-over handling. Supports both Classic
// mode and Levels Mode (obstacles, increasing speed, power-ups) via levels.js.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { draw, resizeCanvas, resetBlinkTimer, resetFoodSpawnTimer, triggerDigestionWave } from './render.js';
import { playEatSound, playGameOverSound, playPowerupSound, playLevelUpSound } from './audio.js';
import { renderScoreboard, fetchHighScores } from './leaderboard.js';
import { resetSubmitUI } from './auth.js';
import {
    resetLevelsState,
    onFruitEatenInLevelsMode,
    checkObstacleCollision,
    isInvincible,
    isScoreMultiplied,
    maybeSpawnPowerup,
    collectPowerupIfPresent
} from './levels.js';

function isCellOccupied(x, y) {
    if (state.snake.some(s => s.x === x && s.y === y)) return true;
    if (state.gameMode === 'levels' && state.obstacles.some(o => o.x === x && o.y === y)) return true;
    return false;
}

function updateLevelBadge() {
    if (state.gameMode === 'levels') {
        dom.levelBadge.textContent = `Level ${state.level}`;
        dom.levelBadge.style.display = 'block';
    } else {
        dom.levelBadge.style.display = 'none';
    }
}

export function generateFood() {
    const food = {
        x: Math.floor(Math.random() * state.cellCount),
        y: Math.floor(Math.random() * state.cellCount),
        type: constants.FRUIT_TYPES[Math.floor(Math.random() * constants.FRUIT_TYPES.length)]
    };
    if (isCellOccupied(food.x, food.y)) {
        generateFood();
        return;
    }
    state.food = food;
    resetFoodSpawnTimer();
}

function isValidDirectionChange(newDirection) {
    const d = state.direction;
    return !(
        (d === 'up' && newDirection === 'down') ||
        (d === 'down' && newDirection === 'up') ||
        (d === 'left' && newDirection === 'right') ||
        (d === 'right' && newDirection === 'left')
    );
}

function checkSelfCollision(head) {
    for (let i = 1; i < state.snake.length; i++) {
        if (head.x === state.snake[i].x && head.y === state.snake[i].y) return true;
    }
    return false;
}

export function queueDirection(newDir) {
    if (state.directionQueue.length < constants.MAX_QUEUE) state.directionQueue.push(newDir);
}

function update() {
    if (state.directionQueue.length > 0) {
        const newDirection = state.directionQueue.shift();
        if (isValidDirectionChange(newDirection)) state.direction = newDirection;
    }

    const head = { x: state.snake[0].x, y: state.snake[0].y };
    switch (state.direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }

    if (head.x < 0) head.x = state.cellCount - 1;
    else if (head.x >= state.cellCount) head.x = 0;
    else if (head.y < 0) head.y = state.cellCount - 1;
    else if (head.y >= state.cellCount) head.y = 0;

    const hitSelf = checkSelfCollision(head);
    const hitObstacle = checkObstacleCollision(head);
    if ((hitSelf || hitObstacle) && !isInvincible()) {
        triggerGameOver();
        return;
    }

    state.snake.unshift(head);

    // Power-up pickup (Levels Mode only)
    const collected = collectPowerupIfPresent(head);
    if (collected) {
        playPowerupSound();
    }

    if (head.x === state.food.x && head.y === state.food.y) {
        const points = isScoreMultiplied() ? 2 : 1;
        state.score += points;
        dom.scoreCounter.textContent = state.score;
        dom.scoreCounter.classList.add('animateScore');
        playEatSound();
        triggerDigestionWave(state.food.type);

        const leveledUp = onFruitEatenInLevelsMode();
        if (leveledUp) {
            playLevelUpSound();
            updateLevelBadge();
        }

        generateFood();
    } else {
        // If a "shrink" power-up was just collected, extra segments may already
        // have been popped inside collectPowerupIfPresent - don't double-pop.
        if (!collected || collected.type !== 'shrink') {
            state.snake.pop();
        }
    }

    if (state.gameMode === 'levels') {
        maybeSpawnPowerup(performance.now());
    }
}

function triggerGameOver() {
    state.gameOver = true;
    playGameOverSound();
    dom.gameMusic.pause();
    dom.finalScore.innerText = state.score;
    dom.gameOverScreen.style.display = 'flex';
    resetSubmitUI();
    dom.levelBadge.style.display = 'none';

    const classicScoreboard = document.querySelector('[data-scoreboard="classic"]');
    const levelsScoreboard = document.querySelector('[data-scoreboard="levels"]');

    if (state.gameMode === 'levels') {
        if (dom.finalLevel && dom.finalLevelValue) {
            dom.finalLevelValue.textContent = state.level;
            dom.finalLevel.style.display = 'block';
        }
        if (classicScoreboard) classicScoreboard.style.display = 'none';
        if (levelsScoreboard) levelsScoreboard.style.display = 'block';
        renderScoreboard(dom.levelsGameOverHighScoreList, state.cachedLevelsScoresByPeriod[state.activeLevelsPeriod.levelsGameOverHighScoreList], 'levels');
        fetchHighScores('alltime', 'levels');
        fetchHighScores('weekly', 'levels');
    } else {
        if (dom.finalLevel) dom.finalLevel.style.display = 'none';
        if (classicScoreboard) classicScoreboard.style.display = 'block';
        if (levelsScoreboard) levelsScoreboard.style.display = 'none';
        renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod[state.activePeriod.gameOverHighScoreList], 'classic');
        fetchHighScores('alltime', 'classic');
        fetchHighScores('weekly', 'classic');
    }
}

export function gameLoop(currentTime) {
    if (!state.lastTickTime) state.lastTickTime = currentTime;
    if (!state.gameOver && !state.gamePaused) {
        const tickInterval = state.gameMode === 'levels' ? state.tickInterval : constants.TICK_INTERVAL;
        const delta = currentTime - state.lastTickTime;
        if (delta >= tickInterval) {
            state.previousSnake = state.snake.map(s => ({ x: s.x, y: s.y }));
            update();
            state.lastTickTime = currentTime - (delta % tickInterval);
        }
        const t = Math.min((currentTime - state.lastTickTime) / tickInterval, 1);
        draw(t);
    }
    if (!state.gameOver) requestAnimationFrame(gameLoop);
}

export function initializeGame(mode) {
    state.gameMode = mode || state.gameMode || 'classic';
    state.gameOver = false;
    state.gamePaused = false;
    state.scoreSubmitted = false;
    state.inGame = true;
    state.snake = [{ x: 10, y: 10 }];
    state.previousSnake = [{ x: 10, y: 10 }];
    state.direction = 'right';
    state.directionQueue = [];
    state.score = 0;
    state.digestionWaves = [];
    dom.scoreCounter.textContent = state.score;

    if (state.gameMode === 'levels') {
        resetLevelsState();
    } else {
        state.tickInterval = constants.TICK_INTERVAL;
        state.obstacles = [];
        state.activePowerup = null;
    }

    generateFood();
    resetBlinkTimer();
    updateLevelBadge();
    dom.gameMusic.currentTime = 0;
    if (!state.musicMuted) dom.gameMusic.play().catch(() => {});
    dom.gameMusic.loop = true;
    state.lastTickTime = 0;
    dom.pauseScreen.style.display = 'none';
    requestAnimationFrame(gameLoop);
}

export function togglePause() {
    state.gamePaused = !state.gamePaused;
    dom.pauseButton.textContent = state.gamePaused ? 'Resume' : 'Pause';
    dom.pauseScreen.style.display = state.gamePaused ? 'flex' : 'none';
    if (state.gamePaused) {
        dom.gameMusic.pause();
    } else {
        if (!state.musicMuted) dom.gameMusic.play().catch(() => {});
        requestAnimationFrame(gameLoop);
    }
}

export function startGameSession(mode) {
    dom.startGameScreen.style.display = 'none';
    dom.canvas.style.display = 'block';
    dom.scoreCounter.style.display = 'block';
    resizeCanvas();
    initializeGame(mode);
    window.addEventListener('resize', resizeCanvas);
    dom.pauseButton.style.display = 'block';
}

export function returnToMainMenu(submitCurrentScoreIfNeeded) {
    state.inGame = false;
    dom.gameOverScreen.style.display = 'none';
    submitCurrentScoreIfNeeded();
    dom.startGameScreen.style.display = 'flex';
    dom.canvas.style.display = 'none';
    dom.scoreCounter.style.display = 'none';
    dom.pauseButton.style.display = 'none';
    dom.levelBadge.style.display = 'none';
}
