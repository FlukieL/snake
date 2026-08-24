// Decorative mini "live demo" snake animation shown on the main menu in place
// of the static logo image. A small autonomous snake wanders a compact grid
// whose walls spell out "SNAKE", eating food and growing/resetting forever.
// Purely cosmetic - fully independent of the real game state/loop. Recolors
// to match the current theme (Classic green vs Levels purple) automatically.

const COLS = 34;
const ROWS = 9;

// Bitmap spelling "SNAKE" across the grid (1 = wall cell), a compact 5x7
// block font, small enough to fit a tiny logo-sized banner.
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
// Pixel offsets so the grid is centered within the canvas whenever the
// container's aspect ratio doesn't exactly match COLS:ROWS - prevents the
// bottom (or sides) of the grid being clipped/cut off.
let offsetX = 0;
let offsetY = 0;
let lastStepTime = 0;
let stuckCounter = 0; // counts consecutive ticks without eating, to force a reset if wandering forever
const STEP_INTERVAL = 150; // ms between AI moves - deliberately slow/calm
const MAX_STUCK_TICKS = 160; // ~24s of not eating -> reset, so it never visibly loops forever

function cellKey(x, y) {
    return y * COLS + x;
}

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
    stuckCounter = 0;
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

// Breadth-first search from the head to the food, treating every snake
// segment except the tail (which will have moved out of the way by the time
// the head could reach it) as a solid obstacle alongside the walls. Returns
// the first-step direction along the shortest path, or null if unreachable.
function bfsDirectionToFood() {
    if (!food || !snake.length) return null;
    const head = snake[0];
    const blocked = new Set();
    for (let i = 0; i < snake.length - 1; i++) {
        blocked.add(cellKey(snake[i].x, snake[i].y));
    }

    const visited = new Set([cellKey(head.x, head.y)]);
    const queue = [{ pos: head, path: [] }];
    let qi = 0;

    while (qi < queue.length) {
        const { pos, path } = queue[qi++];
        if (pos.x === food.x && pos.y === food.y) {
            return path.length ? path[0] : null;
        }
        for (const dir of ['up', 'down', 'left', 'right']) {
            const next = stepFrom(pos, dir);
            if (isWall(next.x, next.y)) continue;
            const key = cellKey(next.x, next.y);
            if (visited.has(key)) continue;
            if (blocked.has(key)) continue;
            visited.add(key);
            queue.push({ pos: next, path: [...path, dir] });
        }
        // Safety cap so a pathological grid can never hang the main thread.
        if (queue.length > COLS * ROWS * 2) break;
    }
    return null;
}

// Fallback used when the food is unreachable (e.g. temporarily boxed in by
// its own body): picks any safe direction, preferring one that doesn't
// immediately reverse, so the snake keeps calmly moving instead of freezing.
function anySafeDirection() {
    const head = snake[0];
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const options = ['up', 'down', 'left', 'right'].filter(dir => {
        if (dir === opposite[direction]) return false;
        const next = stepFrom(head, dir);
        if (isWall(next.x, next.y)) return false;
        if (snake.some((s, i) => i !== snake.length - 1 && s.x === next.x && s.y === next.y)) return false;
        return true;
    });
    if (options.length) return options[Math.floor(Math.random() * options.length)];

    // Even reversing is better than freezing entirely.
    const next = stepFrom(head, opposite[direction]);
    if (!isWall(next.x, next.y)) return opposite[direction];
    return null;
}

function stepSnake() {
    stuckCounter++;
    if (stuckCounter > MAX_STUCK_TICKS) {
        resetSnake();
        return;
    }

    let nextDir = bfsDirectionToFood();
    if (!nextDir) nextDir = anySafeDirection();
    if (!nextDir) {
        resetSnake();
        return;
    }

    direction = nextDir;
    const head = stepFrom(snake[0], direction);
    snake.unshift(head);

    if (food && head.x === food.x && head.y === food.y) {
        stuckCounter = 0;
        food = randomFreeCell();
        if (!food) resetSnake();
    } else {
        snake.pop();
    }

    // Cap length so it doesn't grow forever and get stuck too often.
    if (snake.length > 14) resetSnake();
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

    ctx.save();
    ctx.translate(offsetX, offsetY);

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
        const pad = cellSize * 0.1;
        ctx.beginPath();
        const x = seg.x * cellSize + pad, y = seg.y * cellSize + pad, s = cellSize - pad * 2;
        const r = Math.min(4, s / 3);
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + s, y, x + s, y + s, r);
        ctx.arcTo(x + s, y + s, x, y + s, r);
        ctx.arcTo(x, y + s, x, y, r);
        ctx.arcTo(x, y, x + s, y, r);
        ctx.closePath();
        ctx.fill();
    });

    ctx.restore();
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
        // Use whichever dimension is more constraining (width/COLS vs
        // height/ROWS) as the cell size, so the whole COLS x ROWS grid
        // always fits fully within the canvas without being clipped -
        // previously cellSize was derived from width alone, which could
        // make the grid taller than the container and cut off the bottom
        // rows whenever the container's aspect ratio didn't exactly match
        // COLS:ROWS (e.g. a short, wide banner).
        cellSize = Math.min(rect.width / COLS, rect.height / ROWS);
        offsetX = (rect.width - cellSize * COLS) / 2;
        offsetY = (rect.height - cellSize * ROWS) / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    resetSnake();
    lastStepTime = performance.now();
    requestAnimationFrame(loop);
}
