// Canvas rendering: normal mode (interpolated snake, animated head, fruit
// variety) and Nokia Mode (blocky connected snake, plus-shaped food, LCD grid).

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { isScoreMultiplied } from './levels.js';

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
    // Waves are short-lived, but this is called on every animation frame.
    // Reuse their existing objects rather than filter()/map()-allocating
    // replacement arrays and position objects continuously during gameplay.
    for (let i = state.digestionWaves.length - 1; i >= 0; i--) {
        const wave = state.digestionWaves[i];
        const pos = ((now - wave.startTime) / 1000) * constants.DIGESTION_WAVE_SPEED;
        if (pos - constants.DIGESTION_WAVE_WIDTH >= maxIndex + 2) {
            state.digestionWaves.splice(i, 1);
        } else {
            wave.renderPosition = pos;
        }
    }
    return state.digestionWaves;
}

function getSegmentOverlay(activeWaves, index) {
    let bestWave = null;
    let bestIntensity = 0;
    for (const wave of activeWaves) {
        const dist = Math.abs(index - wave.renderPosition);
        if (dist <= constants.DIGESTION_WAVE_WIDTH) {
            const intensity = 1 - dist / constants.DIGESTION_WAVE_WIDTH;
            if (intensity > bestIntensity) {
                bestWave = wave;
                bestIntensity = intensity;
            }
        }
    }
    return bestWave ? { color: bestWave.color, intensity: bestIntensity } : null;
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

// Unit forward/perpendicular vectors for each travel direction. "forward"
// points the way the snake is heading (used to push both eyes toward the
// leading edge of the head, and to aim the pupils looking that way);
// "perp" is perpendicular to forward (used to spread the two eyes apart
// side-by-side relative to the direction of travel, not the screen axes).
const DIRECTION_VECTORS = {
    right: { fwd: { x: 1, y: 0 }, perp: { x: 0, y: 1 } },
    left: { fwd: { x: -1, y: 0 }, perp: { x: 0, y: 1 } },
    up: { fwd: { x: 0, y: -1 }, perp: { x: 1, y: 0 } },
    down: { fwd: { x: 0, y: 1 }, perp: { x: 1, y: 0 } }
};

function drawHeadDetails(ctx, part, now) {
    const gridSize = state.gridSize;
    const centerX = (part.x + 0.5) * gridSize;
    const centerY = (part.y + 0.5) * gridSize;
    const { fwd, perp } = DIRECTION_VECTORS[state.direction] || DIRECTION_VECTORS.right;

    const openness = getEyeOpenness(now);
    // Eyes are pushed toward the leading (forward) edge of the head, and
    // spread apart along the perpendicular axis - this correctly places
    // them on the right side of the head when facing right, on top when
    // facing up, etc., instead of always sitting on a fixed screen edge.
    const forwardOffset = gridSize * 0.22;
    const sideOffset = gridSize * 0.22;
    const eyeRadiusX = gridSize * 0.11;
    const eyeRadiusYFull = gridSize * 0.14;
    const eyeRadiusY = eyeRadiusYFull * openness;
    // Pupils are pushed further along "forward" than the eye whites, so
    // they appear to be looking the direction the snake is travelling
    // (e.g. pupils sit on the right side of each eye when heading right).
    const pupilForwardShift = gridSize * 0.05;
    const pupilRadiusX = gridSize * 0.055;
    const pupilRadiusY = (gridSize * 0.07) * openness;

    const eye1Center = {
        x: centerX + fwd.x * forwardOffset + perp.x * sideOffset,
        y: centerY + fwd.y * forwardOffset + perp.y * sideOffset
    };
    const eye2Center = {
        x: centerX + fwd.x * forwardOffset - perp.x * sideOffset,
        y: centerY + fwd.y * forwardOffset - perp.y * sideOffset
    };

    // Canvas ellipse() takes axis-aligned radii, so rotate the ellipse to
    // align its long axis with the forward direction. Angle 0 = pointing
    // along +x (right); atan2 gives the correct rotation for any of the
    // four cardinal directions.
    const rotation = Math.atan2(fwd.y, fwd.x);

    ctx.fillStyle = 'white';
    if (eyeRadiusY > 0.6) {
        ctx.beginPath(); ctx.ellipse(eye1Center.x, eye1Center.y, eyeRadiusYFull, eyeRadiusX, rotation + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(eye2Center.x, eye2Center.y, eyeRadiusYFull, eyeRadiusX, rotation + Math.PI / 2, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'black';
        const pupil1 = { x: eye1Center.x + fwd.x * pupilForwardShift, y: eye1Center.y + fwd.y * pupilForwardShift };
        const pupil2 = { x: eye2Center.x + fwd.x * pupilForwardShift, y: eye2Center.y + fwd.y * pupilForwardShift };
        ctx.beginPath(); ctx.ellipse(pupil1.x, pupil1.y, pupilRadiusY, pupilRadiusX, rotation + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(pupil2.x, pupil2.y, pupilRadiusY, pupilRadiusX, rotation + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    } else {
        // Blinking: draw closed-eye lines instead of ellipses, oriented the
        // same way the open eyes would be (perpendicular to forward).
        ctx.strokeStyle = 'white';
        ctx.lineWidth = Math.max(1, gridSize / 18);
        ctx.lineCap = 'round';
        const lineHalf = eyeRadiusX;
        [eye1Center, eye2Center].forEach(c => {
            ctx.beginPath();
            ctx.moveTo(c.x - perp.x * lineHalf, c.y - perp.y * lineHalf);
            ctx.lineTo(c.x + perp.x * lineHalf, c.y + perp.y * lineHalf);
            ctx.stroke();
        });
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

let nokiaBackdrop = null;
let nokiaBackdropGridSize = 0;

function drawNokiaBackdrop() {
    const width = dom.canvas.width;
    const height = dom.canvas.height;
    const gridSize = state.gridSize;
    const needsRedraw = !nokiaBackdrop
        || nokiaBackdrop.width !== width
        || nokiaBackdrop.height !== height
        || nokiaBackdropGridSize !== gridSize;
    if (!needsRedraw) return;

    nokiaBackdrop = document.createElement('canvas');
    nokiaBackdrop.width = width;
    nokiaBackdrop.height = height;
    nokiaBackdropGridSize = gridSize;
    const backdropCtx = nokiaBackdrop.getContext('2d');
    backdropCtx.clearRect(0, 0, width, height);
    backdropCtx.save();
    backdropCtx.globalAlpha = 0.06;
    backdropCtx.strokeStyle = constants.NOKIA_PIXEL;
    backdropCtx.lineWidth = 1;
    const step = Math.max(2, gridSize / 8);
    backdropCtx.beginPath();
    for (let gx = 0; gx <= width; gx += step) {
        backdropCtx.moveTo(gx, 0);
        backdropCtx.lineTo(gx, height);
    }
    for (let gy = 0; gy <= height; gy += step) {
        backdropCtx.moveTo(0, gy);
        backdropCtx.lineTo(width, gy);
    }
    backdropCtx.stroke();
    backdropCtx.restore();

    backdropCtx.save();
    backdropCtx.strokeStyle = constants.NOKIA_PIXEL;
    backdropCtx.globalAlpha = 0.5;
    backdropCtx.lineWidth = Math.max(1, gridSize * 0.06);
    const inset = gridSize * 0.18;
    backdropCtx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    backdropCtx.restore();
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

    // The pixel grid and frame are static between resizes. Rasterizing them
    // once avoids recreating hundreds of canvas paths every animation frame.
    drawNokiaBackdrop();
    ctx.drawImage(nokiaBackdrop, 0, 0);
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// Named CSS colors used for the Levels Mode snake fallback (Classic mode
// colors), since hexToRgb only understands hex strings.
const NAMED_COLOR_HEX = { darkgreen: '#006400', limegreen: '#32cd32' };

// Blends a base snake segment color toward the multiplier flash color, with
// `amount` (0-1) controlling how far toward full yellow the blend goes -
// used to create a pulsing flash effect while a score multiplier is active.
function blendWithFlash(baseColor, amount) {
    const baseHex = NAMED_COLOR_HEX[baseColor] || baseColor;
    const base = hexToRgb(baseHex);
    const flash = hexToRgb(constants.MULTIPLIER_FLASH_COLOR);
    const r = Math.round(base.r + (flash.r - base.r) * amount);
    const g = Math.round(base.g + (flash.g - base.g) * amount);
    const b = Math.round(base.b + (flash.b - base.b) * amount);
    return `rgb(${r}, ${g}, ${b})`;
}

function drawSegmentOverlay(ctx, x, y, gridSize, overlay) {
    if (!overlay) return;
    const { r, g, b } = hexToRgb(overlay.color);
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, overlay.intensity);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    drawRoundedRect(ctx, x, y, gridSize, gridSize, gridSize / 4);
    // A slightly oversized, lower-alpha second pass stands in for the glow
    // ring previously done with ctx.shadowBlur - shadowBlur is extremely
    // expensive on Safari/WebKit (forces an unaccelerated software blur
    // pass), and this ran every frame for the duration of each digestion
    // wave, contributing to iOS-specific stutter. This gives a similar soft
    // "pop" without the blur cost.
    const expand = gridSize * 0.12;
    ctx.globalAlpha = Math.min(0.35, overlay.intensity * 0.45);
    drawRoundedRect(ctx, x - expand, y - expand, gridSize + expand * 2, gridSize + expand * 2, gridSize / 3);
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

// One fruit before advancing to the next level, a translucent "ghost"
// preview of where the next level's obstacle walls will appear is drawn
// over the board - a gently pulsing dashed outline rather than a solid
// fill, so it's clearly readable as a preview/warning and not mistaken for
// an already-solid obstacle the snake would collide with.
function drawUpcomingObstaclesPreview(ctx, now) {
    if (state.gameMode !== 'levels' || !state.upcomingObstacles.length) return;
    const gridSize = state.gridSize;
    const pad = Math.max(1, gridSize * 0.06);
    const pulse = 0.35 + Math.sin(now / 260) * 0.15; // gentle breathing effect

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = constants.OBSTACLE_COLOR;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(1, gridSize * 0.04);
    ctx.setLineDash([gridSize * 0.12, gridSize * 0.1]);
    for (const o of state.upcomingObstacles) {
        const x = o.x * gridSize + pad, y = o.y * gridSize + pad;
        const size = gridSize - pad * 2;
        drawRoundedRect(ctx, x, y, size, size, gridSize * 0.12);
        drawRoundedRectStroke(ctx, x, y, size, size, gridSize * 0.12);
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
    // A radial gradient fading to transparent stands in for the previous
    // ctx.shadowBlur glow - shadowBlur forces an expensive unaccelerated
    // software blur pass on Safari/WebKit and ran every frame for the
    // entire time a power-up sat on the board, contributing to iOS
    // stutter. A gradient is fully GPU-accelerated and looks equivalent.
    const glowRadius = r * 1.8;
    const gradient = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, glowRadius);
    gradient.addColorStop(0, def.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
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
    drawUpcomingObstaclesPreview(ctx, now);

    const activeWaves = updateAndGetActiveWaves(state.snake.length - 1, now);
    let headPos = null;

    // While a score multiplier is active in Levels Mode, the snake stays a
    // steady tinted color at first and only starts gently flashing yellow
    // once the bonus is close to expiring - giving a clear "hurry up" cue
    // right before it runs out, rather than flickering the whole time it's
    // active (which was distracting immediately after picking one up).
    const multiplierActive = state.gameMode === 'levels' && isScoreMultiplied();
    let flashPulse = 0;
    if (multiplierActive) {
        const remaining = state.effects.multiplierUntil - now;
        const flashWindow = 3500; // ms before expiry when flashing begins
        if (remaining > flashWindow) {
            flashPulse = 0.22; // steady, mild tint - no flashing yet
        } else {
            const urgency = 1 - remaining / flashWindow;
            const period = 260 - urgency * 100;
            const amplitude = 0.15 + urgency * 0.2;
            flashPulse = 0.22 + amplitude * Math.sin((now / period) * Math.PI * 2);
        }
    }

    for (let i = 0; i < state.snake.length; i++) {
        const curr = state.snake[i];
        const prev = state.previousSnake[i] || curr;
        const pos = interpolatePosition(prev, curr, t);
        const baseColor = state.gameMode === 'levels'
            ? (i === 0 ? constants.LEVELS_SNAKE_HEAD : constants.LEVELS_SNAKE_BODY)
            : (i === 0 ? 'darkgreen' : 'limegreen');
        ctx.fillStyle = multiplierActive
            ? blendWithFlash(baseColor, flashPulse)
            : baseColor;
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
