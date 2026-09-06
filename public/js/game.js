// Core game logic: the fixed-rate update loop, movement, collision detection,
// food generation/consumption, and game-over handling. Supports both Classic
// mode and Levels Mode (obstacles, increasing speed, power-ups) via levels.js.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { draw, resizeCanvas, resetBlinkTimer, resetFoodSpawnTimer, triggerDigestionWave } from './render.js';
import {
    playEatSound,
    playGameOverSound,
    playPowerupSound,
    playLevelUpSound,
    playExtraLifeSound,
    playLoseLifeSound,
    applyMusicPitchForMode
} from './audio.js';
import { renderScoreboard, fetchHighScores, scheduleSliderRealignment } from './leaderboard.js';
import { resetSubmitUI } from './auth.js';
import { clearMenuFocus, focusFirstMenuItem } from './input.js';
import { updateOfflineUI } from './offline.js';
import { vibrateDeath, vibrateFruit, vibratePowerup } from './haptics.js';
import {
    resetLevelsState,
    onFruitEatenInLevelsMode,
    checkObstacleCollision,
    isInvincible,
    getMultiplierValue,
    getMultiplierPoints,
    extendMultiplierOnFruitEaten,
    maybeSpawnPowerup,
    collectPowerupIfPresent,
    checkForExtraLife,
    loseLifeOrGameOver,
    respawnSnakeAfterLifeLost
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

function updateLivesBadge() {
    if (state.gameMode === 'levels' && dom.livesBadge) {
        dom.livesBadge.textContent = '\u2764\uFE0F '.repeat(Math.max(0, state.lives));
        dom.livesBadge.style.display = 'block';
    } else if (dom.livesBadge) {
        dom.livesBadge.style.display = 'none';
    }
}

// Shows/hides the "xN" multiplier badge next to the score counter, and sets
// a CSS custom property with the remaining flash duration so the badge's
// flash animation speeds up as the multiplier's timer runs down (rendered
// in render.js/CSS - this just keeps the badge's own pulse roughly matched).
function updateMultiplierBadge() {
    if (!dom.multiplierBadge) return;
    if (state.gameMode !== 'levels' || performance.now() >= state.effects.multiplierUntil) {
        dom.multiplierBadge.style.display = 'none';
        return;
    }
    const multiplier = getMultiplierValue();
    dom.multiplierBadge.textContent = `\u00d7${multiplier}`;
    dom.multiplierBadge.style.display = 'block';
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
        if (loseLifeOrGameOver()) {
            vibrateDeath();
            playLoseLifeSound();
            respawnSnakeAfterLifeLost();
            updateLivesBadge();
            updateMultiplierBadge();
            return;
        }
        vibrateDeath();
        triggerGameOver();
        return;
    }

    state.snake.unshift(head);

    // Power-up pickup (Levels Mode only)
    const collected = collectPowerupIfPresent(head);
    if (collected) {
        vibratePowerup();
        playPowerupSound();
        if (collected.type === 'multiplier') updateMultiplierBadge();
    }

    if (head.x === state.food.x && head.y === state.food.y) {
        const points = state.gameMode === 'levels' ? getMultiplierPoints() : 1;
        state.score += points;
        dom.scoreCounter.textContent = state.score;
        dom.scoreCounter.classList.add('animateScore');
        vibrateFruit();
        playEatSound();
        triggerDigestionWave(state.food.type);
        // Eating fruit while a multiplier is active refreshes its timer back
        // to the full duration, so keeping up a good streak of eating keeps
        // the bonus going rather than it always expiring after a flat 10s.
        extendMultiplierOnFruitEaten();
        updateMultiplierBadge();

        const gotExtraLife = checkForExtraLife();
        if (gotExtraLife) {
            playExtraLifeSound();
            updateLivesBadge();
        }

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
        maybeRespawnStaleFood();
    }
}

// In Levels Mode, food that's sat uneaten for too long relocates to a new
// free cell, so the board doesn't stagnate around a single hard-to-reach
// spot (especially once obstacles/power-ups start crowding the grid).
function maybeRespawnStaleFood() {
    const now = performance.now();
    if (now - state.foodSpawnTime >= constants.FOOD_RESPAWN_TIMEOUT) {
        generateFood();
    }
}

function triggerGameOver() {
    state.gameOver = true;
    playGameOverSound();
    dom.gameMusic.pause();
    dom.finalScore.innerText = state.score;
    dom.gameOverScreen.style.display = 'block';
    dom.gameHud.style.display = 'none';
    dom.pauseButton.style.display = 'none';
    // Re-show the offline banner (if still offline) now that gameplay has
    // stopped and the Game Over screen's own scoreboard/sign-in section is
    // visible again - it was intentionally hidden during active gameplay.
    updateOfflineUI();
    // Give keyboard/gamepad navigation an obvious, immediate starting point
    // on the Game Over screen too, matching the pause screen's behavior.
    requestAnimationFrame(focusFirstMenuItem);
    resetSubmitUI();
    dom.levelBadge.style.display = 'none';
    if (dom.livesBadge) dom.livesBadge.style.display = 'none';
    if (dom.multiplierBadge) dom.multiplierBadge.style.display = 'none';

    const classicScoreboard = document.querySelector('[data-scoreboard="classic"]');
    const levelsScoreboard = document.querySelector('[data-scoreboard="levels"]');

    if (state.gameMode === 'levels') {
        if (dom.finalLevel && dom.finalLevelValue) {
            dom.finalLevelValue.textContent = state.level;
            dom.finalLevel.style.display = 'block';
        }
        if (classicScoreboard) classicScoreboard.style.display = 'none';
        if (levelsScoreboard) levelsScoreboard.style.display = 'block';
        const levelsPeriod = state.activeLevelsPeriod.levelsGameOverHighScoreList;
        const levelsPage = state.activeLevelsLeaderboardPage.levelsGameOverHighScoreList;
        renderScoreboard(dom.levelsGameOverHighScoreList, state.cachedLevelsScoresByPeriod[levelsPeriod][levelsPage] || [], 'levels', levelsPage);
        fetchHighScores(levelsPeriod, 'levels', levelsPage);
    } else {
        if (dom.finalLevel) dom.finalLevel.style.display = 'none';
        if (classicScoreboard) classicScoreboard.style.display = 'block';
        if (levelsScoreboard) levelsScoreboard.style.display = 'none';
        const classicPeriod = state.activePeriod.gameOverHighScoreList;
        const classicPage = state.activeLeaderboardPage.gameOverHighScoreList;
        renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod[classicPeriod][classicPage] || [], 'classic', classicPage);
        fetchHighScores(classicPeriod, 'classic', classicPage);
    }

    // The relevant panel was selected and its list rendered above. Wait for
    // visibility and layout to settle before measuring its active-tab pill.
    scheduleSliderRealignment();
}

// Updates the multiplier badge's flash speed every frame, independent of the
// game tick rate. The badge stays solid/steady while the multiplier is fresh,
// and only starts flashing (getting progressively faster) once it's close to
// expiring, giving a clear "hurry up" cue right before it runs out rather
// than flickering the entire time it's active.
const MULTIPLIER_FLASH_WINDOW = 3500; // ms before expiry when flashing begins
let resizeFrame = null;

function handleGameResize() {
    // Mobile browsers can emit many resize events while their address bar
    // expands/collapses. Coalesce them into one canvas resize per frame.
    if (!state.inGame || resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        if (state.inGame) resizeCanvas();
    });
}

function stopGameResizeHandling() {
    window.removeEventListener('resize', handleGameResize);
    if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
    }
}

function updateMultiplierBadgeFlash(now) {
    if (!dom.multiplierBadge || dom.multiplierBadge.style.display === 'none') return;
    const remaining = state.effects.multiplierUntil - now;
    if (remaining <= 0) {
        dom.multiplierBadge.style.display = 'none';
        return;
    }
    if (remaining > MULTIPLIER_FLASH_WINDOW) {
        // Still plenty of time left - stay fully solid, no flashing at all.
        dom.multiplierBadge.style.opacity = '1';
        return;
    }
    // Within the final few seconds: flash period speeds up from ~700ms down
    // to ~200ms as the remaining time approaches 0, and the flash amplitude
    // also grows from barely noticeable to a clear pulse - so urgency builds
    // smoothly rather than snapping straight to a fast flicker.
    const urgency = 1 - remaining / MULTIPLIER_FLASH_WINDOW; // 0 (just entered window) -> 1 (about to expire)
    const period = 700 - urgency * 500;
    const amplitude = 0.08 + urgency * 0.17;
    const pulse = (1 - amplitude) + amplitude * Math.sin((now / period) * Math.PI * 2);
    dom.multiplierBadge.style.opacity = pulse.toFixed(2);
}

export function gameLoop(currentTime, sessionId = state.gameSessionId) {
    // A queued animation frame from an abandoned/previous run must never
    // mutate a newer session after the player returns to the main menu.
    if (sessionId !== state.gameSessionId || !state.inGame) return;
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
        if (state.gameMode === 'levels') updateMultiplierBadgeFlash(currentTime);
    }
    if (!state.gameOver) requestAnimationFrame(time => gameLoop(time, sessionId));
}

export function initializeGame(mode) {
    state.gameMode = mode || state.gameMode || 'classic';
    document.body.classList.toggle('levels-mode', state.gameMode === 'levels');
    // Nokia Mode is Classic-only - hide its pause-screen toggle, and visually
    // suppress the theme entirely, while playing Levels Mode.
    if (dom.nokiaModePauseButton) {
        dom.nokiaModePauseButton.style.display = state.gameMode === 'levels' ? 'none' : 'block';
    }
    if (state.gameMode === 'levels') {
        document.body.classList.remove('nokia-mode');
    } else if (state.nokiaMode) {
        document.body.classList.add('nokia-mode');
    }
    state.gameOver = false;
    state.gamePaused = false;
    state.scoreSubmitted = false;
    const sessionId = ++state.gameSessionId;
    state.inGame = true;
    // Hide the offline banner (if shown) now that we're actively playing -
    // it overlaps the fixed top-right Pause button and gameplay itself
    // doesn't depend on the network. It reappears automatically on Game
    // Over/returning to the main menu (see triggerGameOver/returnToMainMenu
    // below) if still offline at that point.
    updateOfflineUI();
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
    updateLivesBadge();
    dom.gameMusic.currentTime = 0;
    applyMusicPitchForMode();
    if (!state.musicMuted) dom.gameMusic.play().catch(() => {});
    dom.gameMusic.loop = true;
    state.lastTickTime = 0;
    dom.pauseScreen.style.display = 'none';
    requestAnimationFrame(time => gameLoop(time, sessionId));
}

// The floating top-right button always reads "Pause" - it only ever opens
// the pause screen, never toggles state itself. Resuming is handled
// exclusively by the pause screen's own "Resume" button (see resumeGame()
// below), so there's a single source of truth for the pause/resume text
// and no risk of the two falling out of sync (previously this button's
// label toggled between "Pause"/"Resume" based on state.gamePaused, but
// since it was also reachable via keyboard/gamepad shortcuts that could
// change state.gamePaused without updating dom.pauseButton, the label
// could end up showing "Resume" while the game was not actually paused).
export function togglePause() {
    if (state.gamePaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    if (state.gamePaused) return;
    state.gamePaused = true;
    dom.pauseScreen.style.display = 'block';
    dom.gameMusic.pause();
    // Focus (and visibly highlight) the first menu item - the Resume
    // button - so keyboard/gamepad "confirm" immediately resumes, and
    // arrow keys/D-pad can navigate the rest of the pause menu right away
    // without an extra keypress first.
    requestAnimationFrame(focusFirstMenuItem);
}

function resumeGame() {
    if (!state.gamePaused) return;
    state.gamePaused = false;
    dom.pauseScreen.style.display = 'none';
    if (!state.musicMuted) dom.gameMusic.play().catch(() => {});
}

export function startGameSession(mode) {
    dom.startGameScreen.style.display = 'none';
    dom.canvas.style.display = 'block';
    dom.gameHud.style.display = 'flex';
    resizeCanvas();
    initializeGame(mode);
    // A stable callback is deduplicated by addEventListener, unlike the old
    // per-session anonymous registration that accumulated after every return
    // to the menu and degraded mobile responsiveness.
    window.addEventListener('resize', handleGameResize);
    dom.pauseButton.style.display = 'block';
}

// Called from the pause screen's "Exit to Main Menu" button - quits the
// current in-progress run early (unlike the Game Over screen's Main Menu
// button, which only ever appears after the game loop has already stopped).
// Marks the game as over so the running gameLoop's requestAnimationFrame
// chain stops, then defers to the same returnToMainMenu() cleanup used
// elsewhere so both paths stay in sync.
export function exitToMainMenuFromPause(submitCurrentScoreIfNeeded) {
    state.gameOver = true;
    state.gamePaused = false;
    dom.gameMusic.pause();
    dom.pauseScreen.style.display = 'none';
    returnToMainMenu(submitCurrentScoreIfNeeded);
}

export function returnToMainMenu(submitCurrentScoreIfNeeded) {
    // Invalidate any scheduled frame from the run being abandoned before
    // resetting display state. This also protects a future Start click from
    // a stale loop running concurrently with the new game.
    state.gameSessionId++;
    state.inGame = false;
    stopGameResizeHandling();
    // Must reset gameOver/gamePaused here too (not just inGame) - both
    // exitToMainMenuFromPause() and the Game Over screen's "Main Menu"
    // button call into this function without clearing state.gameOver
    // (the latter never touches it at all), so it was staying `true`
    // indefinitely after returning to the main menu. getActiveMenuScreen()
    // in input.js checks state.gameOver BEFORE falling through to the main
    // menu screen, so it kept incorrectly resolving to the now-hidden Game
    // Over screen (which has no visible focusable buttons) - silently
    // breaking keyboard/gamepad navigation until a full page refresh reset
    // state fresh. Resetting both flags here guarantees a consistent,
    // correct state no matter which path led back to the main menu.
    state.gameOver = false;
    state.gamePaused = false;
    // Restore the theme to match whichever mode tab is currently selected on
    // the main menu (defaults to Classic), rather than assuming Classic.
    const activeModeTabBtn = document.querySelector('.mode-tab-btn.active');
    const menuMode = activeModeTabBtn ? activeModeTabBtn.getAttribute('data-mode') : 'classic';
    document.body.classList.toggle('levels-mode', menuMode === 'levels');
    if (menuMode === 'levels') {
        document.body.classList.remove('nokia-mode');
    } else if (state.nokiaMode) {
        document.body.classList.add('nokia-mode');
    }
    dom.gameOverScreen.style.display = 'none';
    submitCurrentScoreIfNeeded();
    // Re-show the offline banner (if still offline) now that we're back on
    // a menu screen - it's intentionally hidden during active gameplay.
    updateOfflineUI();
    dom.startGameScreen.style.display = 'block';
    dom.canvas.style.display = 'none';
    dom.gameHud.style.display = 'none';
    dom.pauseButton.style.display = 'none';
    dom.levelBadge.style.display = 'none';
    if (dom.livesBadge) dom.livesBadge.style.display = 'none';
    if (dom.multiplierBadge) dom.multiplierBadge.style.display = 'none';

    // Clear stale focus before returning the Play button to the user. This
    // must be synchronous: the old deferred cleanup could run after a fast
    // mobile tap on Play and blur that newly activated control.
    clearMenuFocus();
    scheduleSliderRealignment();
}
