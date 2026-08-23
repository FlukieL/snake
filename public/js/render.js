// Canvas rendering: normal mode (interpolated snake, animated head, fruit
// variety) and Nokia Mode (blocky connected snake, plus-shaped food, LCD grid).

import { dom } from './dom.js';
import { state, constants } from './state.js';

function wrapDelta(d) {
    if (Math.abs(d) > 1) return d > 0 ? d - state.cellCount : d + state.cellCount;
    return d;
}

function interpolatePosition(prev, curr, t) {
    const dx = wrapDelta(curr.x - prev.x);
    const dy = wrapDelta(curr.y - prev.y);
    return { x: prev.x + dx * t, y: prev.y + dy * t };
}

function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function getFoodSpawnScale() {
    const age = performance.now() - state.foodSpawnTime;
    if (age >= constants.FOOD_POP_DURATION) return 1;
    return Math.max(0, easeOutBack(age / constants.FOOD_POP_DURATION));
}

function getEyeOpenness(now) {
    if (now >= state.nextBlinkTime) {
        state.blinkStartTime = now;
        state.nextBlinkTime = now + 2500 + Math.random() * 3000;
    }
    const sinceBlink = now - state.blinkStartTime;
    if (sinceBlink >= 0 && sinceBlink < constants.BLINK_DURATION) {
        const p = sinceBlink / constants.BLINK_DURATION;
        return 1 - Math.abs(Math.sin(p * Math.PI));
    }
    return 1;
}

export function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.82;
    dom.canvas.width = size;
    dom.canvas.height = size;
    state.gridSize = dom.canvas.width / state.cellCount;
}

export function resetBlinkTimer() {
    state.nextBlinkTime = performance.now() + 2000 + Math.random() * 2500;
    state.blinkStartTime = -Infinity;
}

export function resetFoodSpawnTimer() {
    state.foodSpawnTime = performance.now();
}

// --- Digestion wave: after eating, the fruit's primary color travels through
// the snake's body from head to tail over time, purely as a visual flourish.
export function triggerDigestionWave(fruitType) {
    const color = constants.FRUIT_COLORS[fruitType] || constants.FRUIT_COLORS.apple;
    state.digestionWaves.push({ color, startTime: performance.now() });
}

function updateAndGetActiveWaves(maxIndex, now) {
    state.digestionWaves = state.digestionWaves.filter(wave => {
        const elapsed = (now - wave.startTime) / 1000;
        const pos = elapsed * constants.DIGESTION_WAVE_SPEED;
        return pos - constants.DIGESTION_WAVE_WIDTH < maxIndex + 2;
    });
    return state.digestionWaves.map(wave => {
        const elapsed = (now - wave.startTime) / 1000;
        return { color: wave.color, pos: elapsed * constants.DIGESTION_WAVE_SPEED };
    });
}

function getSegmentOverlay(activeWaves, index) {
    let best = null;
    for (const wave of activeWaves) {
        const dist = Math.abs(index - wave.pos);
        if (dist <= constants.DIGESTION_WAVE_WIDTH) {
            const intensity = 1 - dist / constants.DIGESTION_WAVE_WIDTH;
            if (!best || intensity > best.intensity) best = { color: wave.color, intensity };
        }
    }
    return best;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
}

function drawTongue(ctx, part) {
    const now = performance.now();
    const wag = Math.sin(now / 220) * (Math.PI / 10);
    const gridSize = state.gridSize;

    const tongueLength = gridSize * 0.32, tongueWidth = gridSize * 0.06;
    const forkLength = gridSize * 0.1, forkAngle = Math.PI / 8;
    ctx.strokeStyle = 'red'; ctx.lineWidth = tongueWidth; ctx.lineCap = 'round';

    const startX = (part.x + 0.5) * gridSize, startY = (part.y + 0.5) * gridSize;
    let baseAngle;
    switch (state.direction) {
        case 'right': baseAngle = 0; break;
        case 'left': baseAngle = Math.PI; break;
        case 'up': baseAngle = -Math.PI / 2; break;
        case 'down': baseAngle = Math.PI / 2; break;
    }
    const angle = baseAngle + wag;

    const edgeOffset = gridSize * 0.5;
    const anchorX = startX + Math.cos(baseAngle) * edgeOffset;
    const anchorY = startY + Math.sin(baseAngle) * edgeOffset;
    const endX = anchorX + Math.cos(angle) * tongueLength;
    const endY = anchorY + Math.sin(angle) * tongueLength;

    ctx.beginPath(); ctx.moveTo(anchorX, anchorY); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX + Math.cos(angle + forkAngle) * forkLength, endY + Math.sin(angle + forkAngle) * forkLength);
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX + Math.cos(angle - forkAngle) * forkLength, endY + Math.sin(angle - forkAngle) * forkLength);
    ctx.stroke();
}

function drawHeadDetails(ctx, part, now) {
    const gridSize = state.gridSize;
    const eyeWidth = gridSize / 5, eyeHeight = gridSize / 8;
    const eyeOffsetX = gridSize / 4, eyeOffsetY = gridSize / 6;
    const openness = getEyeOpenness(now);
    let eyeX, eyeY1, eyeY2;
    switch (state.direction) {
        case 'right':
            eyeX = part.x * gridSize + eyeOffsetX;
            eyeY1 = part.y * gridSize + eyeOffsetY * 1.3;
            eyeY2 = (part.y + 1) * gridSize - eyeOffsetY * 1.3;
            break;
        case 'left':
            eyeX = (part.x + 1) * gridSize - eyeOffsetX;
            eyeY1 = part.y * gridSize + eyeOffsetY * 1.3;
            eyeY2 = (part.y + 1) * gridSize - eyeOffsetY * 1.3;
            break;
        case 'up':
            eyeX = (part.x + 0.5) * gridSize - eyeOffsetX;
            eyeY1 = eyeY2 = (part.y + 1) * gridSize - eyeOffsetY;
            break;
        case 'down':
            eyeX = (part.x + 0.5) * gridSize - eyeOffsetX;
            eyeY1 = eyeY2 = part.y * gridSize + eyeOffsetY;
            break;
    }
    ctx.fillStyle = 'white';
    if (state.direction === 'left' || state.direction === 'right') {
        const halfH = (eyeHeight / 2) * openness;
        if (halfH > 0.3) {
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, halfH, eyeWidth / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY2, halfH, eyeWidth / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, halfH / 2, eyeWidth / 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY2, halfH / 2, eyeWidth / 4, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = Math.max(1, gridSize / 18);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(eyeX - eyeWidth / 4, eyeY1); ctx.lineTo(eyeX + eyeWidth / 4, eyeY1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(eyeX - eyeWidth / 4, eyeY2); ctx.lineTo(eyeX + eyeWidth / 4, eyeY2); ctx.stroke();
        }
    } else {
        const halfH = (eyeHeight / 2) * openness;
        if (halfH > 0.3) {
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, eyeWidth / 2, halfH, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX + eyeOffsetX * 2, eyeY1, eyeWidth / 2, halfH, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, eyeWidth / 4, halfH / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX + eyeOffsetX * 2, eyeY1, eyeWidth / 4, halfH / 2, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = Math.max(1, gridSize / 18);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(eyeX - eyeWidth / 4, eyeY1); ctx.lineTo(eyeX + eyeWidth / 4, eyeY1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(eyeX + eyeOffsetX * 2 - eyeWidth / 4, eyeY1); ctx.lineTo(eyeX + eyeOffsetX * 2 + eyeWidth / 4, eyeY1); ctx.stroke();
        }
    }

    drawTongue(ctx, part);
}

function drawAppleFruit(ctx, cx, cy) {
    const gridSize = state.gridSize;
    const r = gridSize / 2.5;
    ctx.fillStyle = 'red';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'brown'; ctx.lineWidth = gridSize / 15;
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r - gridSize / 8); ctx.stroke();
    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.ellipse(cx + gridSize / 16, cy - r - gridSize / 16, gridSize / 8, gridSize / 16, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawOrange(ctx, cx, cy) {
    const gridSize = state.gridSize;
    const r = gridSize / 2.5;
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a7c2a'; ctx.lineWidth = gridSize / 15;
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r - gridSize / 10); ctx.stroke();
    ctx.fillStyle = '#3f8f3f';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r - gridSize / 10, gridSize / 9, gridSize / 18, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawGrape(ctx, cx, cy) {
    const gridSize = state.gridSize;
    const r = gridSize / 6.5;
    ctx.fillStyle = '#8e44ad';
    [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx * r * 1.1, cy + dy * r * 1.1, r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = gridSize / 18;
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 2.4); ctx.lineTo(cx, cy - r * 3.2); ctx.stroke();
}

function drawCherry(ctx, cx, cy) {
    const gridSize = state.gridSize;
    const r = gridSize / 5.5;
    const offset = gridSize / 6;
    ctx.fillStyle = '#d21f3c';
    ctx.beginPath(); ctx.arc(cx - offset, cy + offset / 2, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + offset, cy + offset / 2, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a7c2a'; ctx.lineWidth = gridSize / 20;
    ctx.beginPath();
    ctx.moveTo(cx - offset, cy + offset / 2 - r);
    ctx.quadraticCurveTo(cx, cy - gridSize / 2, cx, cy - gridSize / 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + offset, cy + offset / 2 - r);
    ctx.quadraticCurveTo(cx, cy - gridSize / 2, cx, cy - gridSize / 1.8);
    ctx.stroke();
}

function drawLemon(ctx, cx, cy) {
    const gridSize = state.gridSize;
    ctx.fillStyle = '#f4e04d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, gridSize / 2.6, gridSize / 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - gridSize / 2.7, cy, gridSize / 12, gridSize / 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + gridSize / 2.7, cy, gridSize / 12, gridSize / 12, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawFruit(ctx, now) {
    const scale = getFoodSpawnScale();
    const gridSize = state.gridSize;
    const cx = (state.food.x + 0.5) * gridSize, cy = (state.food.y + 0.5) * gridSize;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    switch (state.food.type) {
        case 'orange': drawOrange(ctx, cx, cy); break;
        case 'grape': drawGrape(ctx, cx, cy); break;
        case 'cherry': drawCherry(ctx, cx, cy); break;
        case 'lemon': drawLemon(ctx, cx, cy); break;
        default: drawAppleFruit(ctx, cx, cy); break;
    }

    ctx.restore();
}

function drawNokiaScene(ctx) {
    const gridSize = state.gridSize;
    const pad = Math.max(1, gridSize * 0.12);
    const half = gridSize / 2;

    ctx.fillStyle = constants.NOKIA_PIXEL;
    ctx.strokeStyle = constants.NOKIA_PIXEL;

    for (let i = 0; i < state.snake.length; i++) {
        const part = state.snake[i];
        const cx = part.x * gridSize + half;
        const cy = part.y * gridSize + half;
        ctx.fillRect(part.x * gridSize + pad, part.y * gridSize + pad, gridSize - pad * 2, gridSize - pad * 2);

        if (i < state.snake.length - 1) {
            const next = state.snake[i + 1];
            let dx = next.x - part.x;
            let dy = next.y - part.y;
            if (Math.abs(dx) > 1) dx = 0;
            if (Math.abs(dy) > 1) dy = 0;
            if (dx !== 0 || dy !== 0) {
                const nx = next.x * gridSize + half;
                const ny = next.y * gridSize + half;
                const bridgeThickness = gridSize - pad * 2;
                ctx.save();
                ctx.beginPath();
                ctx.lineWidth = bridgeThickness;
                ctx.lineCap = 'butt';
                ctx.moveTo(cx, cy);
                ctx.lineTo(nx, ny);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    const foodCx = state.food.x * gridSize + half;
    const foodCy = state.food.y * gridSize + half;
    const armLength = gridSize * 0.32;
    const armThickness = Math.max(1.5, gridSize * 0.14);
    ctx.lineWidth = armThickness;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(foodCx - armLength, foodCy);
    ctx.lineTo(foodCx + armLength, foodCy);
    ctx.moveTo(foodCx, foodCy - armLength);
    ctx.lineTo(foodCx, foodCy + armLength);
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = constants.NOKIA_PIXEL;
    ctx.lineWidth = 1;
    const step = Math.max(2, gridSize / 8);
    for (let gx = 0; gx <= dom.canvas.width; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, dom.canvas.height);
        ctx.stroke();
    }
    for (let gy = 0; gy <= dom.canvas.height; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(dom.canvas.width, gy);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = constants.NOKIA_PIXEL;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, gridSize * 0.06);
    const inset = gridSize * 0.18;
    ctx.strokeRect(inset, inset, dom.canvas.width - inset * 2, dom.canvas.height - inset * 2);
    ctx.restore();
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function drawSegmentOverlay(ctx, x, y, gridSize, overlay) {
    if (!overlay) return;
    const { r, g, b } = hexToRgb(overlay.color);
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, overlay.intensity);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    drawRoundedRect(ctx, x, y, gridSize, gridSize, gridSize / 4);
    // A soft glow ring around the segment for extra visual pop.
    ctx.globalAlpha = Math.min(0.4, overlay.intensity * 0.5);
    ctx.shadowColor = overlay.color;
    ctx.shadowBlur = gridSize * 0.6;
    drawRoundedRect(ctx, x, y, gridSize, gridSize, gridSize / 4);
    ctx.restore();
}

function drawObstacles(ctx) {
    if (state.gameMode !== 'levels' || !state.obstacles.length) return;
    const gridSize = state.gridSize;
    const pad = Math.max(1, gridSize * 0.06);
    ctx.save();
    ctx.fillStyle = constants.OBSTACLE_COLOR;
    for (const o of state.obstacles) {
        const x = o.x * gridSize + pad, y = o.y * gridSize + pad;
        const size = gridSize - pad * 2;
        drawRoundedRect(ctx, x, y, size, size, gridSize * 0.12);
        // Subtle crack/texture lines for a rock-like appearance.
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = Math.max(1, gridSize * 0.03);
        ctx.beginPath();
        ctx.moveTo(x + size * 0.25, y + size * 0.2);
        ctx.lineTo(x + size * 0.55, y + size * 0.55);
        ctx.moveTo(x + size * 0.7, y + size * 0.25);
        ctx.lineTo(x + size * 0.5, y + size * 0.6);
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function drawPowerup(ctx, now) {
    if (state.gameMode !== 'levels' || !state.activePowerup) return;
    const gridSize = state.gridSize;
    const def = constants.POWERUP_TYPES[state.activePowerup.type];
    if (!def) return;

    const cx = (state.activePowerup.x + 0.5) * gridSize;
    const cy = (state.activePowerup.y + 0.5) * gridSize;
    const pulse = 1 + Math.sin(now / 180) * 0.08;
    const r = gridSize * 0.38 * pulse;

    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = gridSize * 0.5;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0a0a';
    ctx.font = `bold ${Math.round(gridSize * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.symbol, cx, cy + 1);
    ctx.restore();
}

// While invincible in Levels Mode, draw a pulsing golden outline around the
// snake's head so the player has clear visual feedback the effect is active.
function drawInvincibilityGlow(ctx, headPos, now) {
    if (state.gameMode !== 'levels') return;
    if (now >= state.effects.invincibleUntil) return;
    const gridSize = state.gridSize;
    const x = headPos.x * gridSize, y = headPos.y * gridSize;
    const pulse = 0.5 + Math.sin(now / 100) * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(79, 195, 247, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = Math.max(2, gridSize * 0.12);
    drawRoundedRectStroke(ctx, x - 2, y - 2, gridSize + 4, gridSize + 4, gridSize / 4);
    ctx.restore();
}

function drawRoundedRectStroke(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.stroke();
}

export function draw(t) {
    const ctx = dom.ctx;
    const now = performance.now();
    ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);

    // Nokia Mode is restricted to Classic mode only - Levels Mode always uses
    // full-color rendering (obstacles, power-ups, purple theme) regardless of
    // whether the Nokia toggle happens to be on.
    if (state.nokiaMode && state.gameMode !== 'levels') {
        drawNokiaScene(ctx);
        return;
    }

    drawObstacles(ctx);

    const activeWaves = updateAndGetActiveWaves(state.snake.length - 1, now);
    let headPos = null;

    for (let i = 0; i < state.snake.length; i++) {
        const curr = state.snake[i];
        const prev = state.previousSnake[i] || curr;
        const pos = interpolatePosition(prev, curr, t);
        ctx.fillStyle = state.gameMode === 'levels'
            ? (i === 0 ? constants.LEVELS_SNAKE_HEAD : constants.LEVELS_SNAKE_BODY)
            : (i === 0 ? 'darkgreen' : 'limegreen');
        const x = pos.x * state.gridSize, y = pos.y * state.gridSize;
        drawRoundedRect(ctx, x, y, state.gridSize, state.gridSize, state.gridSize / 4);
        if (activeWaves.length > 0) {
            const overlay = getSegmentOverlay(activeWaves, i);
            drawSegmentOverlay(ctx, x, y, state.gridSize, overlay);
        }
        if (i === 0) {
            headPos = pos;
            drawHeadDetails(ctx, pos, now);
        }
    }
    if (headPos) drawInvincibilityGlow(ctx, headPos, now);
    drawFruit(ctx, now);
    drawPowerup(ctx, now);
}
