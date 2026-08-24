// Decorative mini "live demo" snake animation shown on the main menu in place
// of the static logo image. A small autonomous snake wanders a compact grid
// whose walls spell out "SNAKE", eating food and growing/resetting forever.
// Purely cosmetic - fully independent of the real game state/loop. Recolors
// to match the current theme (Classic green vs Levels purple) automatically.

const COLS = 30;
const ROWS = 10;

// Bitmap spelling "SNAKE" across the grid (1 = wall cell). Built from a
// simple 5-row-tall block font, centered with padding on each side.
const LETTER_S = [
    '01111',
    '10000',
    '10000',
    '01110',
    '00001',
    '00001',
    '11110'
];
const LETTER_N = [
    '10001',
    '11001',
    '10101',
    '10101',
    '10011',
    '10001',
    '10001'
];
const LETTER_A = [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
];
const LETTER_K = [
    '10001',
    '10010',
    '10100',
    '11000',
    '10100',
    '10010',
    '10001'
];
const LETTER_E = [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '11111'
];

const LETTERS = [LETTER_S, LETTER_N, LETTER_A, LETTER_K, LETTER_E];

function buildWallGrid() {
    const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const letterWidth = 5;
    const gap = 1;
    const totalWidth = LETTERS.length * letterWidth + (LETTERS.length - 1) * gap;
    const startX = Math.floor((COLS - totalWidth) / 2);
    const startY = Math.floor((ROWS - 7) / 2);

    LETTERS.forEach((letter, li) => {
        const offsetX = startX + li * (letterWidth + gap);
        letter.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
                if (row[rx] === '1') {
                    const gx = offsetX + rx;
                    const gy = startY + ry;
                    if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                        grid[gy][gx] = true;
                    }
                }
            }
        });
    });
    return grid;
}

const WALLS = buildWallGrid();

function isWall(x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    return WALLS[y][x];
}

let snake = [];
let direction = 'right';
let food = null;
let ctx = null;
let canvas = null;
let cellSize = 0;
let lastStepTime = 0;
const STEP_INTERVAL = 140; // ms between AI moves - deliberately slow/calm

function randomFreeCell() {
    let attempts = 0;
    while (attempts < 200) {
        attempts++;
        const x = Math.floor(Math.random() * COLS);
        const y = Math.floor(Math.random() * ROWS);
        if (isWall(x, y)) continue;
        if (snake.some(s => s.x === x && s.y === y)) continue;
        return { x, y };
    }
    return null;
}

function resetSnake() {
    const start = randomFreeCell() || { x: 1, y: 1 };
    snake = [start];
    direction = 'right';
    food = randomFreeCell();
}

// Simple greedy AI: tries the direction that most reduces distance to the
// food while avoiding walls/self-collision; falls back to any safe direction.
function pickNextDirection() {
    if (!food || !snake.length) return direction;
    const head = snake[0];
    const options = ['up', 'down', 'left', 'right'].filter(dir => {
        if (dir === 'up' && direction === 'down') return false;
        if (dir === 'down' && direction === 'up') return false;
        if (dir === 'left' && direction === 'right') return false;
        if (dir === 'right' && direction === 'left') return false;
        const next = stepFrom(head, dir);
        if (isWall(next.x, next.y)) return false;
        if (snake.some((s, i) => i !== snake.length - 1 && s.x === next.x && s.y === next.y)) return false;
        return true;
    });
    if (options.length === 0) return null;

    options.sort((a, b) => {
        const da = stepFrom(head, a);
        const db = stepFrom(head, b);
        const distA = Math.abs(da.x - food.x) + Math.abs(da.y - food.y);
        const distB = Math.abs(db.x - food.x) + Math.abs(db.y - food.y);
        return distA - distB;
    });
    return options[0];
}

function stepFrom(pos, dir) {
    switch (dir) {
        case 'up': return { x: pos.x, y: pos.y - 1 };
        case 'down': return { x: pos.x, y: pos.y + 1 };
        case 'left': return { x: pos.x - 1, y: pos.y };
        case 'right': return { x: pos.x + 1, y: pos.y };
        default: return pos;
    }
}

function stepSnake() {
    const nextDir = pickNextDirection();
    if (!nextDir) {
        resetSnake();
        return;
    }
    direction = nextDir;
    const head = stepFrom(snake[0], direction);
    snake.unshift(head);

    if (food && head.x === food.x && head.y === food.y) {
        food = randomFreeCell();
        if (!food) resetSnake();
    } else {
        snake.pop();
    }

    // Cap length so it doesn't grow forever and get stuck too often.
    if (snake.length > 18) resetSnake();
}

function getThemeColors() {
    const isLevels = document.body.classList.contains('levels-mode');
    return {
        head: isLevels ? '#7d3f8e' : '#0f5c22',
        body: isLevels ? '#ba68c8' : '#33d17a',
        wall: isLevels ? 'rgba(186, 104, 200, 0.35)' : 'rgba(51, 209, 122, 0.35)',
        food: isLevels ? '#ffd54f' : '#ff6b6b',
        bg: '#101014'
    };
}

function draw() {
    if (!ctx || !canvas) return;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.wall;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (WALLS[y][x]) {
                ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
            }
        }
    }

    if (food) {
        ctx.fillStyle = colors.food;
        const r = cellSize * 0.35;
        ctx.beginPath();
        ctx.arc((food.x + 0.5) * cellSize, (food.y + 0.5) * cellSize, r, 0, Math.PI * 2);
        ctx.fill();
    }

    snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? colors.head : colors.body;
        const pad = cellSize * 0.08;
        ctx.beginPath();
        const x = seg.x * cellSize + pad, y = seg.y * cellSize + pad, s = cellSize - pad * 2;
        const r = Math.min(6, s / 3);
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + s, y, x + s, y + s, r);
        ctx.arcTo(x + s, y + s, x, y + s, r);
        ctx.arcTo(x, y + s, x, y, r);
        ctx.arcTo(x, y, x + s, y, r);
        ctx.closePath();
        ctx.fill();
    });
}

function loop(now) {
    if (!canvas || !canvas.isConnected) return; // stop if removed from DOM
    if (now - lastStepTime >= STEP_INTERVAL) {
        stepSnake();
        lastStepTime = now;
    }
    draw();
    requestAnimationFrame(loop);
}

export function initLogoAnimation() {
    canvas = document.getElementById('logoAnimationCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cellSize = rect.width / COLS;
    };
    resize();
    window.addEventListener('resize', resize);

    resetSnake();
    lastStepTime = performance.now();
    requestAnimationFrame(loop);
}
