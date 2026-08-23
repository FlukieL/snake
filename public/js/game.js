// Core game logic: the fixed-rate update loop, movement, collision detection,
// food generation/consumption, and game-over handling.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { draw, resizeCanvas, resetBlinkTimer, resetFoodSpawnTimer } from './render.js';
import { playEatSound, playGameOverSound } from './audio.js';
import { renderScoreboard, fetchHighScores } from './leaderboard.js';
import { resetSubmitUI } from './auth.js';

export function generateFood() {
    state.food = {
        x: Math.floor(Math.random() * state.cellCount),
        y: Math.floor(Math.random() * state.cellCount),
        type: constants.FRUIT_TYPES[Math.floor(Math.random() * constants.FRUIT_TYPES.length)]
    };
    for (let i = 0; i < state.snake.length; i++) {
        if (state.snake[i].x === state.food.x && state.snake[i].y === state.food.y) {
            generateFood();
            return;
        }
    }
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

function checkCollision(head) {
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

    if (checkCollision(head)) {
        triggerGameOver();
        return;
    }

    state.snake.unshift(head);
    if (head.x === state.food.x && head.y === state.food.y) {
        state.score++;
        dom.scoreCounter.textContent = state.score;
        dom.scoreCounter.classList.add('animateScore');
        playEatSound();
        generateFood();
    } else {
        state.snake.pop();
    }
}

function triggerGameOver() {
    state.gameOver = true;
    playGameOverSound();
    dom.gameMusic.pause();
    dom.finalScore.innerText = state.score;
    dom.gameOverScreen.style.display = 'flex';
    resetSubmitUI();
    renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod[state.activePeriod.gameOverHighScoreList]);
    fetchHighScores('alltime');
    fetchHighScores('weekly');
}

export function gameLoop(currentTime) {
    if (!state.lastTickTime) state.lastTickTime = currentTime;
    if (!state.gameOver && !state.gamePaused) {
        const delta = currentTime - state.lastTickTime;
        if (delta >= constants.TICK_INTERVAL) {
            state.previousSnake = state.snake.map(s => ({ x: s.x, y: s.y }));
            update();
            state.lastTickTime = currentTime - (delta % constants.TICK_INTERVAL);
        }
        const t = Math.min((currentTime - state.lastTickTime) / constants.TICK_INTERVAL, 1);
        draw(t);
    }
    if (!state.gameOver) requestAnimationFrame(gameLoop);
}

export function initializeGame() {
    state.gameOver = false;
    state.gamePaused = false;
    state.scoreSubmitted = false;
    state.inGame = true;
    state.snake = [{ x: 10, y: 10 }];
    state.previousSnake = [{ x: 10, y: 10 }];
    state.direction = 'right';
    state.directionQueue = [];
    state.score = 0;
    dom.scoreCounter.textContent = state.score;
    generateFood();
    resetBlinkTimer();
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

export function startGameSession() {
    dom.startGameScreen.style.display = 'none';
    dom.canvas.style.display = 'block';
    dom.scoreCounter.style.display = 'block';
    resizeCanvas();
    initializeGame();
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
}
